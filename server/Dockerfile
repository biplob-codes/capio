FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Deno: required by yt-dlp to solve YouTube's JS signature/n-challenges.
# See https://github.com/yt-dlp/yt-dlp/wiki/EJS
RUN curl -fsSL https://deno.land/install.sh | sh \
    && mv /root/.deno/bin/deno /usr/local/bin/deno \
    && chmod 755 /usr/local/bin/deno \
    && deno --version

WORKDIR /app

RUN groupadd -g 1000 appgroup \
    && useradd -m -u 1000 -g appgroup appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}