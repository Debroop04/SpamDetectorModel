# Build from the ai-call-agent folder so the model files are included:
#   docker build -f backend/Dockerfile -t call-shield-api .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MODEL_DIR=/app/spam-detector \
    DATABASE_URL=sqlite:////app/data/callshield.db

WORKDIR /app/backend

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/app ./app
COPY spam-detector/spam_model.pkl spam-detector/tfidf_vectorizer.pkl spam-detector/spam_numbers.csv /app/spam-detector/

RUN useradd -m -u 1000 appuser && mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
