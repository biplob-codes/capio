from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

app=FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    url: str


def format_size(bytes_val):
    if not bytes_val:
        return None
    mb = bytes_val / (1024 * 1024)
    return f"{mb:.1f} MB"


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

    # Keep only mp4 video formats that have both audio+video already merged,
    # OR video-only mp4 streams (most common case for anything above 360p)
    video_formats = []
    seen_resolutions = set()

    for f in info.get("formats", []):
        if f.get("ext") != "mp4":
            continue
        if f.get("vcodec") == "none":
            continue  # skip audio-only here, handled separately below

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

    # Best audio-only option, for an "audio only" download choice
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
        "duration": info.get("duration"),  # in seconds
        "thumbnail": info.get("thumbnail"),
        "uploader": info.get("uploader"),
        "video_formats": video_formats,
        "audio": audio_info,
    }
@app.get("/health")
def home():
    return {"status":"Server is healthy!!!"}
if __name__=="__main__":
    import uvicorn
    uvicorn.run(app,host="127.0.0.1",port=3000)