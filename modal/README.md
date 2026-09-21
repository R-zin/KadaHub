# AI Virtual Try-On — IDM-VTON on Modal

This deploys the open-source **IDM-VTON** model ([`yisol/IDM-VTON`](https://huggingface.co/yisol/IDM-VTON), ECCV 2024) as a GPU HTTP endpoint on [Modal](https://modal.com). The Express backend calls it from the `modal` try-on driver (`server/src/services/tryOnModalDriver.js`).

IDM-VTON was chosen as the best open-source virtual try-on model on Hugging Face for this use case: it keeps garment texture/logos/fit better than CatVTON (lighter, lower fidelity) and is far easier to serve reliably than Kolors-Virtual-Try-On (which ships as a Gradio demo around a much heavier base pipeline). Its diffusers-based pipeline maps cleanly onto a single person-photo + garment-photo request.

## Endpoint

```
POST {MODAL_URL}        Authorization: Bearer $TRYON_API_TOKEN
{
  "person_image_b64":  "<base64>",   // or "person_image_url"
  "garment_image_b64": "<base64>",   // or "garment_image_url"
  "garment_description": "short sleeve t-shirt",   // optional
  "category": "upper_body",          // upper_body | lower_body | dresses
  "steps": 30,                        // diffusion steps (quality vs latency)
  "seed": 42
}
-> { "image_b64": "<base64 png>", "content_type": "image/png", "elapsed_s": 12.3 }

GET {MODAL_URL base}/health    // no auth -> {"status":"ok","model":"yisol/IDM-VTON"}
```

`{MODAL_URL}` is the `api` function's web URL printed by `modal deploy`
(…`/v1/tryon`). `MODAL_URL base` is the same without the `/v1/tryon` suffix.

## One-time setup

```bash
pip install modal          # or: python3 -m venv .venv-modal && .venv-modal/bin/pip install modal
modal token new            # authenticate the CLI
```

The IDM-VTON weights repo is **license-gated** — open
https://huggingface.co/yisol/IDM-VTON and click *"Agree and access repository"*,
then create a **read** token at https://huggingface.co/settings/tokens.

Create the Modal secret (stores the API bearer token + HF token):

```bash
modal secret create kadahub-tryon \
  TRYON_API_TOKEN=<long-random-string> \
  HF_TOKEN=<hf-read-token>
```

## Deploy

```bash
modal deploy modal/tryon_app.py
```

The first build compiles detectron2 and downloads the DensePose / OpenPose /
human-parsing checkpoints, then on first run the ~10 GB of HF weights are cached
onto the `kadahub-tryon-models` volume for fast subsequent cold starts.

Copy the printed web URL for the `api` function.

## Wire up the backend

In `server/.env`:

```bash
TRYON_DRIVER=modal
TRYON_MODAL_URL=<printed api web URL>/v1/tryon
TRYON_API_TOKEN=<same long-random-string as the Modal secret>
# TRYON_STEPS=30
# TRYON_TIMEOUT_MS=180000
```

Restart the API and generate a try-on from the product page. Set
`TRYON_DRIVER=mock` to fall back to the no-ML stub.

## Smoke test (runs on a real cloud GPU)

```bash
modal run modal/tryon_app.py     # writes tryon_smoke.png
```

## Cost / performance notes

- GPU: `A10G` (24 GB). IDM-VTON is SDXL-based; ~16 GB is the practical floor.
- Cold start: tens of seconds the first time (model load); warm requests are
  dominated by the diffusion steps (~10–20 s at 30 steps on an A10G).
- `scaledown_window` keeps a container warm for 5 min after the last request so
  interactive use doesn't pay the cold-start every time.
- Tune cost vs latency with `steps` (20–40) and the GPU type in
  `modal/tryon_app.py`.
