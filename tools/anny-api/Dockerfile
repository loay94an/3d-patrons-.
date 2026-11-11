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

COPY tools/anny-poc /app/tools/anny-poc
COPY tools/anny-api /app/tools/anny-api

EXPOSE 8000
CMD ["uvicorn", "app:app", "--app-dir", "/app/tools/anny-api", "--host", "0.0.0.0", "--port", "8000"]
