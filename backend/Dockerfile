FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY . .
RUN pip install --no-cache-dir .

# Pre-download MegaDescriptor model weights at build time
RUN python -c "from timm import create_model; create_model('hf-hub:BVRA/MegaDescriptor-T-224', pretrained=True)"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
