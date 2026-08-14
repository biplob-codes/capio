import os
import mimetypes
import tempfile
import shutil

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel
import yt_dlp

app = FastAPI()

# Comma-separated list of allowed origins, set via env var on Render.
# Falls back to the local Vite dev server for local development.
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


class VideoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    format_id: str
    kind: str  # "video" or "audio"


def format_size(bytes_val):
    if not bytes_val:
        return None
    mb = bytes_val / (1024 * 1024)
    return f"{mb:.1f} MB"


@app.get("/health")
def health_check():
    # Render (and any uptime checker) hits this to confirm the service is alive.
    return {"status": "ok"}


@app.post("/video-info")
def get_video_info(req: VideoRequest):
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
    except yt_dlp.utils.DownloadError:
        raise HTTPException(status_code=400, detail="Couldn't fetch video info. Check the URL.")

    video_formats = []
    seen_resolutions = set()

    for f in info.get("formats", []):
        if f.get("ext") != "mp4":
            continue
        if f.get("vcodec") == "none":
            continue

        height = f.get("height")
        if not height or height in seen_resolutions:
            continue
        seen_resolutions.add(height)

        video_formats.append({
            "format_id": f["format_id"],
            "resolution": f"{height}p",
            "filesize": format_size(f.get("filesize") or f.get("filesize_approx")),
        })

    video_formats.sort(key=lambda x: int(x["resolution"].replace("p", "")), reverse=True)

    audio_formats = [f for f in info.get("formats", []) if f.get("vcodec") == "none" and f.get("acodec") != "none"]
    best_audio = max(audio_formats, key=lambda f: f.get("abr") or 0, default=None)

    audio_info = None
    if best_audio:
        audio_info = {
            "format_id": best_audio["format_id"],
            "filesize": format_size(best_audio.get("filesize") or best_audio.get("filesize_approx")),
        }

    return {
        "title": info.get("title"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "uploader": info.get("uploader"),
        "video_formats": video_formats,
        "audio": audio_info,
    }


def cleanup_dir(path: str):
    shutil.rmtree(path, ignore_errors=True)


@app.post("/download")
def download_media(req: DownloadRequest):
    if req.kind not in ("video", "audio"):
        raise HTTPException(status_code=400, detail="kind must be 'video' or 'audio'")

    # Each request gets its own isolated temp folder — makes cleanup trivial
    # and avoids filename collisions between concurrent downloads.
    tmp_dir = tempfile.mkdtemp(prefix="ytdlp_")

    # Video-only formats (which is what most of your resolution picks are)
    # need their audio track merged back in — ffmpeg does that via yt-dlp.
    if req.kind == "video":
        format_str = f"{req.format_id}+bestaudio/best"
    else:
        format_str = req.format_id

    ydl_opts = {
        "quiet": True,
        "format": format_str,
        "outtmpl": os.path.join(tmp_dir, "%(title)s.%(ext)s"),
        "restrictfilenames": True,  # sanitizes the title into a safe filename
    }
    if req.kind == "video":
        ydl_opts["merge_output_format"] = "mp4"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(req.url, download=True)
    except yt_dlp.utils.DownloadError:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Download failed. Check the URL and format.")

    # Merging can change the file extension, so read back what actually
    # landed in the folder rather than guessing the final filename.
    produced = [f for f in os.listdir(tmp_dir) if not f.endswith((".part", ".ytdl"))]
    if not produced:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="No file was produced.")

    filepath = os.path.join(tmp_dir, produced[0])
    media_type = mimetypes.guess_type(filepath)[0] or "application/octet-stream"

    return FileResponse(
        path=filepath,
        filename=produced[0],
        media_type=media_type,
        # runs AFTER the response has been fully sent to the client
        background=BackgroundTask(cleanup_dir, tmp_dir),
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)