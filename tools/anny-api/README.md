# Anny HTTP API (experimental)

This folder contains a CPU-oriented FastAPI wrapper around the Anny proof-of-concept generator. It is a separate service from the Vite frontend and is **not deployed by GitHub Pages**.

## Endpoints

- `GET /health`: process health only; it does not initialize the model.
- `GET /v1/anny/phenotypes`: loads Anny and returns the exact phenotype labels published by the installed package.
- `POST /v1/anny/generate`: accepts phenotype overrides and returns a ZIP containing `body.glb` and `report.json`.
- `POST /v1/anny/generate/glb`: accepts phenotype overrides and returns a GLB binary for the Three.js viewer.

Example request:

```json
{
  "phenotypes": {
    "REPLACE_WITH_A_REAL_LABEL": 0.62
  }
}
```

Use labels returned by `GET /v1/anny/phenotypes`. Every value must be within [0, 1]. Requests do not accept bust, waist, hip, height, or other tape measurements because no validated mapping from anthropometry to Anny phenotype parameters exists.

## Connect the website viewer

Set `VITE_ANNY_API_URL` in the frontend build environment to the public base URL of this service (without a trailing slash). The 3D viewer can also accept the service URL in its Anny API panel, fetch the exact phenotype labels, adjust values in the documented [0, 1] range, and request a GLB directly.

The API service must allow the exact website origin through `ANNY_CORS_ORIGINS`. For local testing, use the local frontend origin only.

## Local run

From the repository root:

```bash
python -m pip install --index-url https://download.pytorch.org/whl/cpu "torch>=2.2"
python -m pip install -r tools/anny-poc/requirements.txt
python -m pip install -r tools/anny-api/requirements.txt
uvicorn app:app --app-dir tools/anny-api --host 127.0.0.1 --port 8000
```

OpenAPI docs are available at `/docs`.

## Container

Build from the repository root:

```bash
docker build -f tools/anny-api/Dockerfile -t 3d-patrons-anny-api .
docker run --rm -p 8000:8000 -e ANNY_CORS_ORIGINS=https://YOUR-SITE.example 3d-patrons-anny-api
```

Set `ANNY_GENERATION_TIMEOUT` to change the per-job timeout in seconds. Set `ANNY_CORS_ORIGINS` to a comma-separated allowlist of exact site origins. Leave CORS unconfigured rather than using a wildcard for a public deployment.

## Production security status

**This API is currently an experimental unauthenticated service. Do not expose it publicly as-is.** CORS is not authentication and does not prevent non-browser clients from calling the API.

Before public deployment, implement and test authentication, per-user rate limiting, bounded concurrency/queueing, request-size limits, resource quotas, durable operational monitoring, and privacy/retention controls. Keep generated body files temporary and ensure cleanup on success and failure. Hosting selection must be based on measured CPU/RAM usage, cold-start time, inference latency, and expected cost.

## Operational and scientific limits

- CPU-only proof of concept; the first request may be slow because Anny must initialize and cache model assets.
- Each request currently starts a separate generator process. This is simple isolation, not an optimized inference worker pool.
- No measurement calibration, circumference fitting, fit score, or cloth simulation is claimed. Model coordinates remain uncalibrated.
- Review upstream Anny and dependency licenses before commercial deployment.
