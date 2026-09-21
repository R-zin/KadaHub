import modal

app = modal.App("catvton")


image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "git",
        "libgl1",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender-dev",
    )
    .pip_install(
        "torch",
        "torchvision",
        "diffusers",
        "transformers",
        "accelerate",
        "safetensors",
        "huggingface_hub",
        "Pillow",
        "numpy",
        "fastapi",
        "python-multipart",
    )
    .run_commands(
        "git clone https://github.com/Zheng-Chong/CatVTON.git /root/CatVTON"
    )
    .pip_install(
        "opencv-python-headless",
        "scipy",
        "einops",
        "omegaconf",
        "tqdm",
        "gradio",
    )
)


@app.cls(
    image=image,
    gpu="A10G",
    timeout=600,
    scaledown_window=300,
)
class CatVTON:

    @modal.enter()
    def load_model(self):

        import sys
        import torch

        sys.path.append("/root/CatVTON")

        from model.cloth_masker import AutoMasker
        from model.pipeline import CatVTONPipeline
        from utils import init_weight_dtype

        self.device = "cuda"

        self.pipeline = CatVTONPipeline(
            base_ckpt="runwayml/stable-diffusion-inpainting",
            attn_ckpt="/root/CatVTON/mix-48k-1024",
            attn_ckpt_version="mix",
            weight_dtype=torch.bfloat16,
            use_tf32=True,
            device="cuda",
        )

        self.mask_processor = AutoMasker(
            densepose_ckpt="/root/CatVTON/DensePose",
            schp_ckpt="/root/CatVTON/SCHP",
            device="cuda",
        )

        print("CatVTON loaded")

    @modal.method()
    def generate(
        self,
        person_bytes: bytes,
        cloth_bytes: bytes,
        cloth_type: str = "upper",
        steps: int = 50,
        guidance_scale: float = 2.5,
        seed: int = 42,
    ):

        import io
        import torch
        import numpy as np

        from PIL import Image
        from utils import resize_and_crop, resize_and_padding

        # ------------------------------------------------
        # Load images
        # ------------------------------------------------

        person = Image.open(
            io.BytesIO(person_bytes)
        ).convert("RGB")

        cloth = Image.open(
            io.BytesIO(cloth_bytes)
        ).convert("RGB")

        # ------------------------------------------------
        # Resize
        # ------------------------------------------------

        width = 768
        height = 1024

        person = resize_and_crop(
            person,
            (width, height)
        )

        cloth = resize_and_padding(
            cloth,
            (width, height)
        )

        # ------------------------------------------------
        # Generate human parsing mask
        # ------------------------------------------------

        mask = self.mask_processor(
            person,
            cloth_type
        )["mask"]

        # ------------------------------------------------
        # Blur mask
        # ------------------------------------------------

        mask = self.pipeline.mask_processor.blur(
            mask,
            blur_factor=9
        )

        # ------------------------------------------------
        # Random generator
        # ------------------------------------------------

        generator = torch.Generator(
            device="cuda"
        ).manual_seed(seed)

        # ------------------------------------------------
        # Run CatVTON
        # ------------------------------------------------

        with torch.inference_mode():

            result = self.pipeline(
                image=person,
                condition_image=cloth,
                mask=mask,
                num_inference_steps=steps,
                guidance_scale=guidance_scale,
                generator=generator,
            )[0]

        # ------------------------------------------------
        # Return PNG
        # ------------------------------------------------

        output = io.BytesIO()

        result.save(
            output,
            format="PNG"
        )

        return output.getvalue()


@app.function()
@modal.fastapi_endpoint(method="POST")
def try_on(
    person_image: bytes = modal.File(),
    cloth_image: bytes = modal.File(),
    cloth_type: str = "upper",
):

    model = CatVTON()

    result = model.generate.remote(
        person_image,
        cloth_image,
        cloth_type,
    )

    from fastapi.responses import Response

    return Response(
        content=result,
        media_type="image/png"
    )