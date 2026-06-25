FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download MegaDescriptor model weights at build time
# so first startup does not require internet access
RUN python -c "\
import timm; \
model = timm.create_model('hf-hub:BVRA/MegaDescriptor-T-224', pretrained=True); \
print('MegaDescriptor weights cached successfully')"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
