# Anny HTTP API (experimental)

This folder packages the existing Anny proof-of-concept generator behind a
small versioned HTTP API. It is deployable as a CPU Docker container; it is
not yet deployed by GitHub Pages.

## Endpoints

- `GET /health`: process health only; it does not initialize the model.
- `GET /v1/anny/phenotypes`: loads Anny and returns the exact phenotype labels
  published by the installed package.
- `POST /v1/anny/generate`: accepts phenotype overrides and returns a ZIP
  containing `body.glb` and `report.json`.

Example request:

```json
{
  "phenotypes": {
    "REPLACE_WITH_A_REAL_LABEL": 0.62
  }
}
```

Use labels returned by `GET /v1/anny/phenotypes`. Every value must be within
[0, 1]. Unknown labels are rejected by the upstream generator. Requests do not
accept bust, waist, hip, height, or other tape measurements because no validated
mapping from anthropometry to Anny phenotype parameters exists.

## Connect the website viewer\n\nSet `VITE_ANNY_API_URL` in the frontend build environment to the public base\nURL of this service (without a trailing slash). The 3D viewer can also accept\nthe service URL in its Anny API panel, fetch the exact phenotype labels, adjust\nvalues in the documented [0, 1] range, and request a GLB directly. The API\nservice must allow the exact website origin through `ANNY_CORS_ORIGINS`.\n\n## Local run

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

Set `ANNY_GENERATION_TIMEOUT` to change the per-job timeout in seconds.
Set `ANNY_CORS_ORIGINS` to a comma-separated allowlist of exact site origins.
Leave CORS unconfigured rather than using a wildcard for a public deployment.

## Operational and scientific limits

- CPU-only proof-of-concept; the first request may be slow because Anny must
  initialize and cache model assets.
- Each request currently starts a separate generator process. This is simple
  isolation, not an optimized inference worker pool.
- Add authentication, rate limiting, durable job tracking, queueing, storage
  quotas, and privacy/retention controls before public exposure.
- No measurement calibration, circumference fitting, fit score, or cloth
  simulation is claimed. Model coordinates remain uncalibrated.
- Review upstream Anny and dependency licenses before commercial deployment.
