"""Small, versioned HTTP wrapper for the Anny GLB proof of concept.

The service accepts *Anny phenotype parameters*, not body tape measurements.
No bust/waist/hip calibration is implied by this API.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

ROOT = Path(__file__).resolve().parents[2]
GENERATOR = ROOT / "tools" / "anny-poc" / "generate.py"
MAX_PARAMETERS = 40
GENERATION_TIMEOUT_SECONDS = int(os.getenv("ANNY_GENERATION_TIMEOUT", "420"))


def normalize_phenotypes(values: dict[str, Any]) -> dict[str, float]:
    if len(values) > MAX_PARAMETERS:
        raise ValueError(f"At most {MAX_PARAMETERS} phenotype parameters are allowed")
    normalized: dict[str, float] = {}
    for label, raw in values.items():
        if not label or len(label) > 120:
            raise ValueError("Phenotype labels must contain 1 to 120 characters")
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            raise ValueError(f"Phenotype '{label}' must be numeric")
        value = float(raw)
        if not 0.0 <= value <= 1.0:
            raise ValueError(f"Phenotype '{label}' must be between 0 and 1")
        normalized[label] = value
    return normalized


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phenotypes: dict[str, Any] = Field(default_factory=dict)


app = FastAPI(
    title="3D Patrons Anny API",
    version="0.1.0",
    description=(
        "Experimental Anny phenotype-to-GLB service. Phenotype values are not "
        "anthropometric measurements and are not calibrated to centimetres."
    ),
)

origins = [item.strip() for item in os.getenv("ANNY_CORS_ORIGINS", "").split(",") if item.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "anny-api", "version": app.version}


def _load_phenotype_labels() -> list[str]:
    code = (
        "import json, anny; model=anny.Anny(local_changes='default', facial_actions='all'); "
        "print(json.dumps(list(model.phenotype_labels)))"
    )
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            timeout=GENERATION_TIMEOUT_SECONDS,
        )
        return json.loads(result.stdout.strip().splitlines()[-1])
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="Timed out while loading Anny parameter labels") from exc
    except (subprocess.CalledProcessError, json.JSONDecodeError, IndexError) as exc:
        detail = exc.stderr[-2000:] if isinstance(exc, subprocess.CalledProcessError) else str(exc)
        raise HTTPException(status_code=503, detail=f"Anny model is not ready: {detail}") from exc


@app.get("/v1/anny/phenotypes")
async def phenotype_labels() -> dict[str, Any]:
    labels = await run_in_threadpool(_load_phenotype_labels)
    return {
        "model": "Anny",
        "parameter_range": [0.0, 1.0],
        "labels": labels,
        "measurement_status": "not_calibrated",
    }


def _generate_archive(phenotypes: dict[str, float]) -> str:
    workdir = tempfile.mkdtemp(prefix="anny-job-")
    output = Path(workdir) / "body.glb"
    command = [sys.executable, str(GENERATOR), "--device", "cpu", "--output", str(output)]
    for label, value in phenotypes.items():
        command.extend(["--phenotype", f"{label}={value}"])
    try:
        subprocess.run(
            command,
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            timeout=GENERATION_TIMEOUT_SECONDS,
        )
        report = output.with_suffix(".json")
        if not output.is_file() or not report.is_file():
            raise RuntimeError("Anny generator did not produce both GLB and JSON report")
        archive = Path(workdir) / "anny-result.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            bundle.write(output, "body.glb")
            bundle.write(report, "report.json")
        return str(archive)
    except subprocess.TimeoutExpired as exc:
        import shutil
        shutil.rmtree(workdir, ignore_errors=True)
        raise TimeoutError("Anny generation exceeded the configured time limit") from exc
    except subprocess.CalledProcessError as exc:
        import shutil
        shutil.rmtree(workdir, ignore_errors=True)
        message = (exc.stderr or exc.stdout or "Anny generation failed")[-3000:]
        raise RuntimeError(message) from exc
    except Exception:
        import shutil
        shutil.rmtree(workdir, ignore_errors=True)
        raise


def _generate_glb_file(phenotypes: dict[str, float]) -> str:
    """Generate a standalone GLB file for browser clients."""
    workdir = tempfile.mkdtemp(prefix="anny-glb-job-")
    output = Path(workdir) / "body.glb"
    command = [sys.executable, str(GENERATOR), "--device", "cpu", "--output", str(output)]
    for label, value in phenotypes.items():
        command.extend(["--phenotype", f"{label}={value}"])
    try:
        subprocess.run(
            command,
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            timeout=GENERATION_TIMEOUT_SECONDS,
        )
        if not output.is_file() or output.stat().st_size < 20:
            raise RuntimeError("Anny generator did not produce a valid GLB file")
        return str(output)
    except subprocess.TimeoutExpired as exc:
        import shutil
        shutil.rmtree(workdir, ignore_errors=True)
        raise TimeoutError("Anny generation exceeded the configured time limit") from exc
    except subprocess.CalledProcessError as exc:
        import shutil
        shutil.rmtree(workdir, ignore_errors=True)
        message = (exc.stderr or exc.stdout or "Anny generation failed")[-3000:]
        raise RuntimeError(message) from exc
    except Exception:
        import shutil
        shutil.rmtree(workdir, ignore_errors=True)
        raise


@app.post("/v1/anny/generate/glb")
async def generate_body_glb(request: GenerateRequest, background_tasks: BackgroundTasks) -> FileResponse:
    """Return the generated body directly as model/gltf-binary for Three.js."""
    try:
        phenotypes = normalize_phenotypes(request.phenotypes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        glb_path = await run_in_threadpool(_generate_glb_file, phenotypes)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Anny generation failed: {exc}") from exc

    import shutil
    background_tasks.add_task(shutil.rmtree, str(Path(glb_path).parent), ignore_errors=True)
    return FileResponse(
        glb_path,
        media_type="model/gltf-binary",
        filename="anny-body.glb",
        background=background_tasks,
    )


@app.post("/v1/anny/generate")
async def generate_body(request: GenerateRequest, background_tasks: BackgroundTasks) -> FileResponse:
    try:
        phenotypes = normalize_phenotypes(request.phenotypes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        archive_path = await run_in_threadpool(_generate_archive, phenotypes)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Anny generation failed: {exc}") from exc

    import shutil
    background_tasks.add_task(shutil.rmtree, str(Path(archive_path).parent), ignore_errors=True)
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename="anny-body-result.zip",
        background=background_tasks,
    )
