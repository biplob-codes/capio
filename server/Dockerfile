FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Non-root user, added to group 1000 so it can read Render's mounted
# secret files (cookies.txt) without a permissions error.
RUN groupadd -g 1000 appgroup \
    && useradd -m -u 1000 -g appgroup appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}