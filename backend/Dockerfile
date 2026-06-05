FROM python:3.12-slim

WORKDIR /app

# curl: healthcheck için, gcc + libpq-dev: asyncpg build için
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# --reload KALDIRILDI: Docker'da dosya izleme sorunlarına yol açıyordu.
# Geliştirme için: docker compose exec backend uvicorn app.main:app --reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
