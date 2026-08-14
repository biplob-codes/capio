FROM python:3.11-slim

# ffmpeg is required by yt-dlp for merging separate video+audio streams
# and for audio-only extraction. Not in the base image, so install it.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render sets $PORT at runtime; uvicorn must bind to it, not a fixed port.
# Shell form so $PORT is expanded by the shell, not passed literally.
CMD uvicorn main:app --host 0.0.0.0 --port $PORT