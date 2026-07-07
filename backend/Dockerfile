FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY . .
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu .

# Pre-download the MegaDescriptor model weights at build time so ECS tasks
# don't need internet access to Hugging Face Hub on every cold start —
# without this, the container can't pass its health check (or serve any
# request) until the download completes, which is slow and fragile on
# Fargate where tasks start from scratch on every deploy/scale-out.
RUN python -c "from timm import create_model; create_model('hf-hub:BVRA/MegaDescriptor-T-224', pretrained=True, num_classes=0)"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
