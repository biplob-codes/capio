import os
import re
import logging
import mimetypes
import tempfile
import shutil

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel
import yt_dlp

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("capio")

app = FastAPI()

# --- CORS ------------------------------------------------------------------
# Comma-separated list so you can add your Vercel domain in Render's env
# vars later without touching code, e.g.:
# ALLOWED_ORIGINS=http://localhost:5173,https://capio.vercel.app
raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# --- Cookie setup ------------------------------------------------------------
# The mounted/secret cookies file is read-only, but yt-dlp writes updated
# cookies back to whatever file it's given (session refresh, etc). So we
# copy it to a writable scratch path once at startup and point yt-dlp there
# instead of at the original.
#
# Local dev: SOURCE defaults to ./cookies.txt
# Render: set COOKIES_PATH=/etc/secrets/cookies.txt as a regular env var
SOURCE_COOKIES_FILE = os.environ.get("COOKIES_PATH", "cookies.txt")
WRITABLE_COOKIES_FILE = "/tmp/cookies.txt"


def init_cookies():
    if os.path.exists(SOURCE_COOKIES_FILE):
        shutil.copyfile(SOURCE_COOKIES_FILE, WRITABLE_COOKIES_FILE)
        logger.info("Copied cookies from %s to writable path %s", SOURCE_COOKIES_FILE, WRITABLE_COOKIES_FILE)
    else:
        logger.warning("No cookies file found at %s — requests may get blocked by YouTube.", SOURCE_COOKIES_FILE)


init_cookies()


def get_cookie_opts() -> dict:
    if os.path.exists(WRITABLE_COOKIES_FILE):
        return {"cookiefile": WRITABLE_COOKIES_FILE}
    return {}
# -----------------------------------------------------------------------------


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


def get_size_bytes(f, duration):
    size = f.get("filesize") or f.get("filesize_approx")
    if size:
        return size
    tbr = f.get("tbr")
    if tbr and duration:
        return tbr * 1000 / 8 * duration
    return None


# --- Error classification ----------------------------------------------------
# yt-dlp doesn't give structured error types for these — it's all in the
# exception's string message. This maps recognizable substrings to a clear
# reason + HTTP status, so the frontend (and your logs) know what actually
# went wrong instead of a generic "download failed".
def classify_ytdlp_error(err: Exception) -> tuple[int, str]:
    msg = str(err)

    if re.search(r"sign in to confirm", msg, re.IGNORECASE):
        return 502, "auth_expired: YouTube is asking to confirm you're not a bot — cookies are likely expired or missing."
    if re.search(r"private video", msg, re.IGNORECASE):
        return 400, "private_video: This video is private."
    if re.search(r"video unavailable", msg, re.IGNORECASE):
        return 400, "unavailable: This video is unavailable (removed, region-locked, or deleted)."
    if re.search(r"http error 403", msg, re.IGNORECASE):
        return 502, "forbidden: YouTube returned 403 — usually stale cookies or rate limiting."
    if re.search(r"requested format is not available", msg, re.IGNORECASE):
        return 400, "format_unavailable: That format/resolution is no longer available for this video."
    if re.search(r"unable to extract|no video formats found", msg, re.IGNORECASE):
        return 502, "extractor_broken: yt-dlp couldn't parse this video — YouTube likely changed something. yt-dlp may need an update."

    logger.error("Unclassified yt-dlp error: %s", msg)
    return 502, f"unknown_ytdlp_error: {msg[:200]}"
# -----------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok", "cookies_present": os.path.exists(WRITABLE_COOKIES_FILE)}


@app.post("/video-info")
def get_video_info(req: VideoRequest):
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        **get_cookie_opts(),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
    except yt_dlp.utils.DownloadError as e:
        status, reason = classify_ytdlp_error(e)
        logger.warning("video-info failed for %s: %s", req.url, reason)
        raise HTTPException(status_code=status, detail=reason)
    except Exception as e:
        logger.exception("Unexpected error fetching video info for %s", req.url)
        raise HTTPException(status_code=500, detail=f"unexpected_error: {e}")

    duration = info.get("duration")
    best_by_height = {}

    for f in info.get("formats", []):
        if f.get("ext") != "mp4":
            continue
        if f.get("vcodec") == "none":
            continue

        height = f.get("height")
        if not height:
            continue

        size_bytes = get_size_bytes(f, duration)
        existing = best_by_height.get(height)

        if existing is None or (size_bytes and not existing["_size_bytes"]):
            best_by_height[height] = {
                "format_id": f["format_id"],
                "resolution": f"{height}p",
                "filesize": format_size(size_bytes),
                "_size_bytes": size_bytes,
            }

    video_formats = [
        {k: v for k, v in fmt.items() if k != "_size_bytes"}
        for fmt in best_by_height.values()
    ]
    video_formats.sort(key=lambda x: int(x["resolution"].replace("p", "")), reverse=True)

    audio_formats = [f for f in info.get("formats", []) if f.get("vcodec") == "none" and f.get("acodec") != "none"]
    best_audio = max(audio_formats, key=lambda f: f.get("abr") or 0, default=None)

    audio_info = None
    if best_audio:
        audio_info = {
            "format_id": best_audio["format_id"],
            "filesize": format_size(get_size_bytes(best_audio, duration)),
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

    tmp_dir = tempfile.mkdtemp(prefix="ytdlp_")

    if req.kind == "video":
        format_str = f"{req.format_id}+bestaudio/best"
    else:
        format_str = req.format_id

    ydl_opts = {
        "quiet": True,
        "format": format_str,
        "outtmpl": os.path.join(tmp_dir, "%(title)s.%(ext)s"),
        "restrictfilenames": True,
        **get_cookie_opts(),
    }
    if req.kind == "video":
        ydl_opts["merge_output_format"] = "mp4"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(req.url, download=True)
    except yt_dlp.utils.DownloadError as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        status, reason = classify_ytdlp_error(e)
        logger.warning("download failed for %s (%s): %s", req.url, req.format_id, reason)
        raise HTTPException(status_code=status, detail=reason)
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.exception("Unexpected error downloading %s", req.url)
        raise HTTPException(status_code=500, detail=f"unexpected_error: {e}")

    produced = [f for f in os.listdir(tmp_dir) if not f.endswith((".part", ".ytdl"))]
    if not produced:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.error("No output file produced for %s in %s", req.url, tmp_dir)
        raise HTTPException(status_code=500, detail="no_output_file: yt-dlp reported success but no file was produced.")

    filepath = os.path.join(tmp_dir, produced[0])
    media_type = mimetypes.guess_type(filepath)[0] or "application/octet-stream"

    logger.info("Serving %s (%s) for %s", produced[0], media_type, req.url)

    return FileResponse(
        path=filepath,
        filename=produced[0],
        media_type=media_type,
        background=BackgroundTask(cleanup_dir, tmp_dir),
    )


# Catch-all for anything that escapes the routes above (e.g. malformed
# request bodies before validation) so you get a logged, structured error
# instead of a bare 500 with no context in Render's logs.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": f"server_error: {exc}"})


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)