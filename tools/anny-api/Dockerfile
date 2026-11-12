# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY tools/anny-poc/requirements.txt /app/tools/anny-poc/requirements.txt
COPY tools/anny-api/requirements.txt /app/tools/anny-api/requirements.txt

RUN python -m pip install --upgrade pip \
    && python -m pip install --index-url https://download.pytorch.org/whl/cpu "torch>=2.2" \
    && python -m pip install -r /app/tools/anny-poc/requirements.txt \
    && python -m pip install -r /app/tools/anny-api/requirements.txt

# Use the same pinned official Anny source revision as the static-site GLB build.
RUN python - <<'PY'
import urllib.request
import zipfile
from pathlib import Path

archive = Path("/tmp/anny-source.zip")
urllib.request.urlretrieve(
    "https://github.com/naver/anny/archive/8f35dc2df1c4062fd2fae86734f9705de50c0c2b.zip",
    archive,
)
root = Path("/opt/anny-upstream")
root.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as bundle:
    bundle.extractall(root)
source = root / "anny-8f35dc2df1c4062fd2fae86734f9705de50c0c2b" / "src"
if not (source / "anny" / "__init__.py").is_file():
    raise SystemExit("Pinned Anny source package is missing")
archive.unlink()
PY
ENV PYTHONPATH=/opt/anny-upstream/anny-8f35dc2df1c4062fd2fae86734f9705de50c0c2b/src

COPY tools/anny-poc /app/tools/anny-poc
COPY tools/anny-api /app/tools/anny-api

EXPOSE 8000
CMD ["uvicorn", "app:app", "--app-dir", "/app/tools/anny-api", "--host", "0.0.0.0", "--port", "8000"]
