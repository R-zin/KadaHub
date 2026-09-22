"""
KadaHub Virtual Try-On — IDM-VTON on Modal
==========================================

Serves the open-source IDM-VTON model (yisol/IDM-VTON, ECCV 2024) as a GPU
HTTP endpoint on Modal. The pipeline is reproduced faithfully from the
official gradio demo (gradio_demo/app.py) so a caller only needs to supply a
person photo and a garment photo; DensePose / OpenPose / human-parsing masks
are generated automatically inside the container.

Endpoint
--------
POST /v1/tryon        (Authorization: Bearer $TRYON_API_TOKEN)
    {
      "person_image_b64":  "<base64>",   # or "person_image_url"
      "garment_image_b64": "<base64>",   # or "garment_image_url"
      "garment_description": "short sleeve t-shirt",   # optional
      "category": "upper_body",          # upper_body | lower_body | dresses
      "steps": 30,                        # diffusion steps (quality vs latency)
      "seed": 42
    }
    -> { "image_b64": "<base64 png>", "content_type": "image/png", "elapsed_s": 12.3 }

GET  /health          (no auth)

One-time setup
--------------
    pip install modal
    modal token new
    modal secret create kadahub-tryon \\
        TRYON_API_TOKEN=<long-random-string> \\
        HF_TOKEN=<hf-read-token>          # to download yisol/IDM-VTON weights

Deploy
------
    modal deploy modal/tryon_app.py
    # -> note the printed web URL for the `api` function and set it as
    #    TRYON_MODAL_URL in server/.env

Smoke test on a real cloud GPU
------------------------------
    modal run modal/tryon_app.py
"""

from __future__ import annotations

import base64
import io
import os

import modal

# ----------------------------------------------------------------------------
# App, image, volume
# ----------------------------------------------------------------------------
app = modal.App("kadahub-tryon")

# Persistent cache for the ~10GB of HF weights so later cold starts are fast.
MODEL_VOLUME = modal.Volume.from_name("kadahub-tryon-models", create_if_missing=True)
MODEL_DIR = "/models"

IDM_REPO = "https://github.com/yisol/IDM-VTON.git"
REPO_DIR = "/opt/IDM-VTON"


# (repo_id, hf filename, destination path inside the container, expected bytes)
_PREPROCESS_CKPTS = [
    ("yisol/IDM-VTON", "densepose/model_final_162be9.pkl", f"{REPO_DIR}/ckpt/densepose/model_final_162be9.pkl", 255757821),
    ("yisol/IDM-VTON", "humanparsing/parsing_atr.onnx", f"{REPO_DIR}/ckpt/humanparsing/parsing_atr.onnx", 266859305),
    ("yisol/IDM-VTON", "humanparsing/parsing_lip.onnx", f"{REPO_DIR}/ckpt/humanparsing/parsing_lip.onnx", 266863411),
    ("lllyasviel/Annotators", "body_pose_model.pth", f"{REPO_DIR}/ckpt/openpose/ckpts/body_pose_model.pth", 209267595),
]

_LFS_POINTER_PREFIX = b"version https://git-lfs"


def _ckpt_valid(dest: str, expected_size: int) -> bool:
    """True only if dest exists, is the right size, and is not corrupt/HTML/LFS.

    A raw `requests` download can silently capture a redirect/HTML/LFS-pointer
    page that happens to be padded to the expected size, so we also verify the
    file's leading bytes look like a real binary model (ONNX protobuf / torch
    pickle) rather than ASCII text.
    """
    import os

    if not os.path.exists(dest) or os.path.getsize(dest) != expected_size:
        return False
    with open(dest, "rb") as f:
        head = f.read(64)
    if head.startswith(_LFS_POINTER_PREFIX):
        return False
    # Real ONNX/torch binaries start with a non-printable byte; HTML / JSON /
    # text error pages start with printable ASCII (e.g. '<', '{', 'V').
    return head[:1] < b"\x20" or head[:1] > b"\x7e"


def _ensure_preprocess_ckpts():
    """Download any missing/corrupt preprocessing checkpoints into the container.

    Called both at image-build time (to bake the weights in) and at container
    start (to self-heal when Modal serves a stale/corrupt cached layer). Uses
    huggingface_hub (which handles LFS redirects + auth correctly) and verifies
    size + magic bytes, re-downloading anything invalid.
    """
    import os
    import shutil

    from huggingface_hub import hf_hub_download

    token = os.environ.get("HF_TOKEN") or None

    for repo_id, filename, dest, expected_size in _PREPROCESS_CKPTS:
        if _ckpt_valid(dest, expected_size):
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        src = hf_hub_download(repo_id=repo_id, filename=filename, token=token)
        if not _ckpt_valid(src, expected_size):
            raise RuntimeError(f"downloaded checkpoint failed validation: {filename}")
        shutil.copyfile(src, dest)
        print("fetched", filename, "->", dest, expected_size, "bytes")


def _download_preprocess_ckpts():
    """Image-build hook: bake preprocessing checkpoints into the image."""
    _ensure_preprocess_ckpts()


image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "git", "libgl1", "libglib2.0-0", "libsm6", "libxext6", "libxrender-dev",
        "ffmpeg", "build-essential", "python3-dev",
    )
    .pip_install(
        # Version set matches IDM-VTON's official environment.yaml. diffusers must
        # stay at 0.25.x: the repo's hacked UNets import PositionNet, which was
        # removed from diffusers.models.embeddings in 0.26+.
        "torch==2.1.2",
        "torchvision==0.16.2",
        "diffusers==0.25.0",
        "transformers==4.36.2",
        "accelerate==0.25.0",
        "huggingface_hub==0.20.3",
        "safetensors==0.4.2",
        "onnxruntime==1.16.3",
        "opencv-python-headless==4.9.0.80",
        "Pillow==10.2.0",
        "numpy==1.26.4",
        "scipy==1.12.0",
        "scikit-image==0.22.0",
        "einops==0.7.0",
        # av is transitively imported by the densepose package (its data/__init__
        # pulls in a video dataset module), so it must be importable even though we
        # never process video. Pin a version with a prebuilt manylinux wheel —
        # av 11.x has no cp310 wheel and fails to build from source (needs
        # pkg-config + ffmpeg dev headers).
        "av==12.3.0",
        # NOTE: basicsr / tensorboardX are intentionally omitted. basicsr is only
        # imported by OpenPose to download its body model (which we prefetch at
        # build time), and tensorboardX is training-only.
        "fvcore==0.1.5.post20221221",
        "iopath==0.1.10",
        "cloudpickle==3.0.0",
        "omegaconf==2.3.0",
        "pycocotools==2.0.7",
        "fastapi==0.110.0",
        "pydantic==2.6.4",
        "requests==2.31.0",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    # detectron2 must be compiled with torch present, so install after torch.
    # Pin to the v0.6 tag: pip's `git+...@<sha>` fails over GitHub's HTTP protocol
    # (can't fetch arbitrary SHAs), but a tag ref clones fine.
    .pip_install("detectron2 @ git+https://github.com/facebookresearch/detectron2.git@v0.6")
    .run_commands(f"git clone --depth 1 {IDM_REPO} {REPO_DIR}")
    # Pre-fetch DensePose / OpenPose / human-parsing checkpoints into the image so
    # containers start fast. This runs at build time on Modal's infra with the
    # kadahub-tryon secret injected, so HF_TOKEN is available for the gated repo.
    .run_function(_download_preprocess_ckpts, secrets=[modal.Secret.from_name("kadahub-tryon")])
    .env(
        {
            "HF_HOME": f"{MODEL_DIR}/hf",
            "TRANSFORMERS_CACHE": f"{MODEL_DIR}/hf",
            "PYTHONPATH": f"{REPO_DIR}:{REPO_DIR}/gradio_demo",
        }
    )
)


# ----------------------------------------------------------------------------
# GPU inference container
# ----------------------------------------------------------------------------
@app.cls(
    gpu="A10G",                # 24GB, comfortable for SDXL-based IDM-VTON
    image=image,
    volumes={MODEL_DIR: MODEL_VOLUME},
    secrets=[modal.Secret.from_name("kadahub-tryon")],
    scaledown_window=300,      # idle containers scale down after 5 min (NOT kept warm)
    timeout=600,               # hard cap per call — covers cold start + model load + inference
)
class TryOnModel:
    """Loads IDM-VTON + preprocessors once per container, then serves try-ons."""

    @modal.enter()
    def load(self):
        import sys

        import torch
        from torchvision import transforms

        # Self-heal: restore any preprocessing checkpoint missing from a stale
        # cached image layer (no-op when the build-time download already ran).
        _ensure_preprocess_ckpts()

        # Import roots:
        #   REPO_DIR                          -> src.*, preprocess.*
        #   gradio_demo                       -> apply_net, utils_mask
        #   gradio_demo/detectron2/projects/DensePose -> densepose (imported by apply_net)
        for p in (
            REPO_DIR,
            f"{REPO_DIR}/gradio_demo",
            f"{REPO_DIR}/gradio_demo/detectron2/projects/DensePose",
        ):
            if p not in sys.path:
                sys.path.insert(0, p)

        from diffusers import AutoencoderKL, DDPMScheduler  # noqa: E402
        from preprocess.humanparsing.run_parsing import Parsing  # noqa: E402
        from preprocess.openpose.run_openpose import OpenPose  # noqa: E402
        from src.tryon_pipeline import (  # noqa: E402
            StableDiffusionXLInpaintPipeline as TryonPipeline,
        )
        from src.unet_hacked_garmnet import (  # noqa: E402
            UNet2DConditionModel as UNet2DConditionModel_ref,
        )
        from src.unet_hacked_tryon import UNet2DConditionModel  # noqa: E402
        from transformers import (  # noqa: E402
            AutoTokenizer,
            CLIPImageProcessor,
            CLIPTextModel,
            CLIPTextModelWithProjection,
            CLIPVisionModelWithProjection,
        )

        self.device = "cuda:0"
        self.torch = torch
        base = "yisol/IDM-VTON"
        dt = torch.float16

        unet = UNet2DConditionModel.from_pretrained(base, subfolder="unet", torch_dtype=dt)
        unet.requires_grad_(False)

        tokenizer_one = AutoTokenizer.from_pretrained(base, subfolder="tokenizer", use_fast=False)
        tokenizer_two = AutoTokenizer.from_pretrained(base, subfolder="tokenizer_2", use_fast=False)
        noise_scheduler = DDPMScheduler.from_pretrained(base, subfolder="scheduler")
        text_encoder_one = CLIPTextModel.from_pretrained(base, subfolder="text_encoder", torch_dtype=dt)
        text_encoder_two = CLIPTextModelWithProjection.from_pretrained(base, subfolder="text_encoder_2", torch_dtype=dt)
        image_encoder = CLIPVisionModelWithProjection.from_pretrained(base, subfolder="image_encoder", torch_dtype=dt)
        vae = AutoencoderKL.from_pretrained(base, subfolder="vae", torch_dtype=dt)
        unet_encoder = UNet2DConditionModel_ref.from_pretrained(base, subfolder="unet_encoder", torch_dtype=dt)
        unet_encoder.requires_grad_(False)

        self.tensor_transform = transforms.Compose(
            [transforms.ToTensor(), transforms.Normalize([0.5], [0.5])]
        )

        self.pipe = TryonPipeline.from_pretrained(
            base,
            unet=unet,
            vae=vae,
            feature_extractor=CLIPImageProcessor(),
            text_encoder=text_encoder_one,
            text_encoder_2=text_encoder_two,
            tokenizer=tokenizer_one,
            tokenizer_2=tokenizer_two,
            scheduler=noise_scheduler,
            image_encoder=image_encoder,
            torch_dtype=dt,
        )
        self.pipe.unet_encoder = unet_encoder

        # Preprocessors (run on CPU / their own device as in the demo)
        self.parsing_model = Parsing(0)
        self.openpose_model = OpenPose(0)

        # Move the heavy nets to the GPU once, like the demo does per-request.
        self.openpose_model.preprocessor.body_estimation.model.to(self.device)
        self.pipe.to(self.device)
        self.pipe.unet_encoder.to(self.device)

        try:
            self.pipe.enable_xformers_memory_efficient_attention()
        except Exception as e:  # noqa: BLE001
            print("xformers not enabled:", e)

        MODEL_VOLUME.commit()

    # -- helpers -------------------------------------------------------------
    @staticmethod
    def _decode_image(b64: str):
        from PIL import Image

        return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")

    @staticmethod
    def _fetch_image(url: str):
        import requests
        from PIL import Image

        r = requests.get(url, timeout=30)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")

    def _person_and_garment(self, p: dict):
        person = None
        if p.get("person_image_b64"):
            person = self._decode_image(p["person_image_b64"])
        elif p.get("person_image_url"):
            person = self._fetch_image(p["person_image_url"])

        garment = None
        if p.get("garment_image_b64"):
            garment = self._decode_image(p["garment_image_b64"])
        elif p.get("garment_image_url"):
            garment = self._fetch_image(p["garment_image_url"])

        if person is None or garment is None:
            raise ValueError("person_image and garment_image are required (b64 or url).")
        return person, garment

    def _densepose(self, human_img_small):
        """Run DensePose on a 384x512 person image -> 768x1024 RGB pose PIL image."""
        import numpy as np
        from PIL import Image

        import apply_net  # noqa: E402  (sys.path set up in load())
        from detectron2.data.detection_utils import (  # noqa: E402
            _apply_exif_orientation,
            convert_PIL_to_numpy,
        )

        human_img_arg = _apply_exif_orientation(human_img_small)
        human_img_arg = convert_PIL_to_numpy(human_img_arg, format="BGR")

        args = apply_net.create_argument_parser().parse_args(
            (
                "show",
                f"{REPO_DIR}/configs/densepose_rcnn_R_50_FPN_s1x.yaml",
                f"{REPO_DIR}/ckpt/densepose/model_final_162be9.pkl",
                "dp_segm",
                "-v",
                "--opts",
                "MODEL.DEVICE",
                "cuda",
            )
        )
        pose_img = args.func(args, human_img_arg)
        pose_img = pose_img[:, :, ::-1]
        return Image.fromarray(pose_img).resize((768, 1024))

    # -- core try-on ----------------------------------------------------------
    def _run(self, person_img, garment_img, garment_description, category, steps, seed):
        import numpy as np
        import torch
        from PIL import Image
        from utils_mask import get_mask_location

        torch, T = self.torch, self.tensor_transform

        garm_img = garment_img.convert("RGB").resize((768, 1024))
        human_img = person_img.convert("RGB").resize((768, 1024))

        human_small = human_img.resize((384, 512))
        keypoints = self.openpose_model(human_small)
        model_parse, _ = self.parsing_model(human_small)
        mask, _ = get_mask_location("hd", category, model_parse, keypoints)
        mask = mask.resize((768, 1024))

        pose_img = self._densepose(human_small)

        with torch.no_grad():
            with torch.cuda.amp.autocast():
                prompt = "model is wearing " + (garment_description or "a garment")
                negative_prompt = "monochrome, lowres, bad anatomy, worst quality, low quality"
                with torch.inference_mode():
                    (
                        prompt_embeds,
                        negative_prompt_embeds,
                        pooled_prompt_embeds,
                        negative_pooled_prompt_embeds,
                    ) = self.pipe.encode_prompt(
                        prompt,
                        num_images_per_prompt=1,
                        do_classifier_free_guidance=True,
                        negative_prompt=negative_prompt,
                    )

                    prompt_c = ["a photo of " + (garment_description or "a garment")]
                    (prompt_embeds_c, _, _, _) = self.pipe.encode_prompt(
                        prompt_c,
                        num_images_per_prompt=1,
                        do_classifier_free_guidance=False,
                        negative_prompt=[negative_prompt],
                    )

                    pose_tensor = T(pose_img).unsqueeze(0).to(self.device, torch.float16)
                    garm_tensor = T(garm_img).unsqueeze(0).to(self.device, torch.float16)
                    generator = torch.Generator(self.device).manual_seed(seed) if seed is not None else None

                    images = self.pipe(
                        prompt_embeds=prompt_embeds.to(self.device, torch.float16),
                        negative_prompt_embeds=negative_prompt_embeds.to(self.device, torch.float16),
                        pooled_prompt_embeds=pooled_prompt_embeds.to(self.device, torch.float16),
                        negative_pooled_prompt_embeds=negative_pooled_prompt_embeds.to(self.device, torch.float16),
                        num_inference_steps=steps,
                        generator=generator,
                        strength=1.0,
                        pose_img=pose_tensor,
                        text_embeds_cloth=prompt_embeds_c.to(self.device, torch.float16),
                        cloth=garm_tensor,
                        mask_image=mask,
                        image=human_img,
                        height=1024,
                        width=768,
                        ip_adapter_image=garm_img,
                        guidance_scale=2.0,
                    )[0]

        return images[0]

    @modal.method()
    def generate(
        self,
        person_image_b64: str | None = None,
        person_image_url: str | None = None,
        garment_image_b64: str | None = None,
        garment_image_url: str | None = None,
        garment_description: str = "a garment",
        category: str = "upper_body",
        steps: int = 30,
        seed: int | None = 42,
    ) -> bytes:
        person_img, garment_img = self._person_and_garment(
            {
                "person_image_b64": person_image_b64,
                "person_image_url": person_image_url,
                "garment_image_b64": garment_image_b64,
                "garment_image_url": garment_image_url,
            }
        )
        if category not in ("upper_body", "lower_body", "dresses"):
            category = "upper_body"
        result = self._run(person_img, garment_img, garment_description, category, steps, seed)
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        return buf.getvalue()


# ----------------------------------------------------------------------------
# Web endpoint (FastAPI) — what your Express server calls
# ----------------------------------------------------------------------------
_web_image = modal.Image.debian_slim(python_version="3.10").pip_install(
    "fastapi==0.110.0", "pydantic==2.6.4", "requests==2.31.0"
)


# Pydantic models must live at module level: the web function is serialized and
# re-imported in its own namespace, where a class defined *inside* api() would be
# an unresolvable forward reference (PydanticUndefinedAnnotation). The import is
# guarded so the file still parses on a local machine without pydantic installed.
try:
    from pydantic import BaseModel
except ImportError:  # local CLI context (no pydantic); container has it
    BaseModel = object


class TryOnRequest(BaseModel):
    person_image_b64: str | None = None
    person_image_url: str | None = None
    garment_image_b64: str | None = None
    garment_image_url: str | None = None
    garment_description: str = "a garment"
    category: str = "upper_body"
    steps: int = 30
    seed: int | None = 42


@app.function(image=_web_image, secrets=[modal.Secret.from_name("kadahub-tryon")])
@modal.asgi_app()
def api():
    import time

    from fastapi import Depends, FastAPI, Header, HTTPException

    web = FastAPI(title="KadaHub Try-On (IDM-VTON)")

    def auth(authorization: str = Header(default="")):
        expected = os.environ.get("TRYON_API_TOKEN", "")
        if not expected:
            return  # token not configured -> open (dev only)
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or token != expected:
            raise HTTPException(status_code=401, detail="Invalid or missing bearer token")

    @web.get("/health")
    def health():
        return {"status": "ok", "model": "yisol/IDM-VTON"}

    @web.post("/v1/tryon", dependencies=[Depends(auth)])
    def tryon(req: TryOnRequest):
        t0 = time.time()
        try:
            model = TryOnModel()
            png_bytes = model.generate.remote(
                person_image_b64=req.person_image_b64,
                person_image_url=req.person_image_url,
                garment_image_b64=req.garment_image_b64,
                garment_image_url=req.garment_image_url,
                garment_description=req.garment_description,
                category=req.category,
                steps=req.steps,
                seed=req.seed,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"try-on failed: {e}")

        return {
            "image_b64": base64.b64encode(png_bytes).decode("ascii"),
            "content_type": "image/png",
            "elapsed_s": round(time.time() - t0, 2),
        }

    return web


# ----------------------------------------------------------------------------
# Local smoke test: `modal run modal/tryon_app.py`
#
# Uses real example photos shipped with the IDM-VTON repo (solid-color synthetic
# inputs crash the OpenPose/parsing preprocessors — no keypoints detected).
# ----------------------------------------------------------------------------
@app.local_entrypoint()
def main():
    import subprocess

    # Local entrypoint runs on your machine, so find example photos locally.
    # Prefer an existing clone; otherwise make a throwaway shallow clone.
    candidates = [
        "/tmp/idm-vton-src",
        os.path.join(os.path.dirname(__file__), ".idm-vton-src"),
    ]
    src = next((c for c in candidates if os.path.isdir(c)), None)
    if src is None:
        src = candidates[-1]
        subprocess.run(["git", "clone", "--depth", "1", IDM_REPO, src], check=True)

    person_path = f"{src}/gradio_demo/example/human/00034_00.jpg"
    garment_path = f"{src}/gradio_demo/example/cloth/04469_00.jpg"

    with open(person_path, "rb") as f:
        person_b64 = base64.b64encode(f.read()).decode()
    with open(garment_path, "rb") as f:
        garment_b64 = base64.b64encode(f.read()).decode()

    model = TryOnModel()
    png = model.generate.remote(
        person_image_b64=person_b64,
        garment_image_b64=garment_b64,
        garment_description="short sleeve t-shirt",
        category="upper_body",
        steps=25,
    )
    with open("tryon_smoke.png", "wb") as f:
        f.write(png)
    print(f"Wrote tryon_smoke.png ({len(png) / 1024:.0f} KB)")
