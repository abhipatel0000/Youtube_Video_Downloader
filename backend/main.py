from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import os
import uuid
import time
import json
import asyncio
import threading
from utils import get_video_info, download_video
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="QuickTube API")

# CORS configuration
origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure downloads directory exists
DOWNLOADS_DIR = os.getenv("DOWNLOADS_DIR", "downloads")
if not os.path.exists(DOWNLOADS_DIR):
    os.makedirs(DOWNLOADS_DIR)

# ------------------------------------------------------------------
# In-memory progress store
# { download_id: { "status": "...", "percent": 0-100, "speed": "...",
#                  "eta": "...", "file_path": "...", "error": "..." } }
# ------------------------------------------------------------------
progress_store: dict[str, dict] = {}


class URLRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    format_id: str
    ext: str
    title: str


# ── helpers ────────────────────────────────────────────────────────

def cleanup_file(path: str):
    """Delete file after a delay to ensure transfer is complete."""
    time.sleep(180)
    if os.path.exists(path):
        try:
            os.remove(path)
            print(f"Cleaned up: {path}")
        except Exception as e:
            print(f"Error deleting {path}: {e}")


def _fmt_speed(bps: float) -> str:
    """Format bytes/s into a human-readable speed string."""
    if not bps:
        return ""
    if bps >= 1024 ** 2:
        return f"{bps / 1024 ** 2:.1f} MiB/s"
    if bps >= 1024:
        return f"{bps / 1024:.1f} KiB/s"
    return f"{bps:.0f} B/s"


def _fmt_eta(secs) -> str:
    """Format seconds into MM:SS string."""
    try:
        secs = int(secs)
    except (TypeError, ValueError):
        return ""
    if secs <= 0:
        return ""
    return f"{secs // 60:02d}:{secs % 60:02d}"


def run_download_thread(download_id: str, url: str, format_id: str, output_path: str, is_audio: bool):
    """Runs the yt-dlp download in a background thread, updating progress_store."""

    # For merged video+audio downloads yt-dlp runs two sequential streams.
    # We weight them 70% (video) + 30% (audio) for a smooth overall progress.
    stream_index = [0]   # mutable counter via list
    stream_weights = [70, 30] if not is_audio else [100]

    def progress_hook(d):
        entry = progress_store.get(download_id, {})

        if d["status"] == "downloading":
            downloaded = d.get("downloaded_bytes") or 0
            total      = d.get("total_bytes") or d.get("total_bytes_estimate") or 0

            # Per-stream percent (0-100)
            stream_pct = (downloaded / total * 100) if total > 0 else 0

            # Overall percent weighted across streams
            offset = sum(stream_weights[:stream_index[0]])
            weight = stream_weights[stream_index[0]] if stream_index[0] < len(stream_weights) else 0
            overall_pct = offset + (stream_pct / 100 * weight)
            # Cap at 99 — 100 is reserved for truly done
            overall_pct = min(round(overall_pct, 1), 99)

            progress_store[download_id] = {
                **entry,
                "status":  "downloading",
                "percent": overall_pct,
                "speed":   _fmt_speed(d.get("speed") or 0),
                "eta":     _fmt_eta(d.get("eta")),
            }

        elif d["status"] == "finished":
            # One stream finished — advance to next
            stream_index[0] += 1
            progress_store[download_id] = {
                **entry,
                "status":  "processing",
                "percent": 99,
                "speed":   "",
                "eta":     "",
            }

    try:
        download_video(url, format_id, output_path, progress_hook=progress_hook)

        # Resolve the actual file path on disk
        if is_audio:
            final_path = output_path + ".mp3"
            final_ext  = "mp3"
        else:
            final_path = output_path
            final_ext  = "mp4"

        if not os.path.exists(final_path):
            candidates = [
                output_path + ".mp3",
                output_path + ".mp4",
                output_path.rsplit(".", 1)[0] + ".mp3",
                output_path.rsplit(".", 1)[0] + ".mp4",
            ]
            for c in candidates:
                if os.path.exists(c):
                    final_path = c
                    final_ext  = c.rsplit(".", 1)[-1]
                    break

        if not os.path.exists(final_path):
            progress_store[download_id] = {
                "status": "error",
                "percent": 0,
                "error": "File not found after processing. Make sure FFmpeg is installed.",
            }
            return

        progress_store[download_id] = {
            "status":    "done",
            "percent":   100,
            "speed":     "",
            "eta":       "",
            "file_path": final_path,
            "file_ext":  final_ext,
        }

        # Schedule cleanup
        threading.Thread(target=cleanup_file, args=(final_path,), daemon=True).start()

    except Exception as e:
        progress_store[download_id] = {
            "status":  "error",
            "percent": 0,
            "error":   str(e),
        }


# ── routes ─────────────────────────────────────────────────────────

@app.post("/get-info")
async def fetch_info(request: URLRequest):
    result = get_video_info(request.url)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/download")
async def start_download(request: DownloadRequest):
    """Kick off a background download and immediately return a download_id."""
    file_id   = str(uuid.uuid4())
    is_audio  = "Audio" in request.format_id or "bestaudio" in request.format_id

    if is_audio:
        output_path = os.path.join(DOWNLOADS_DIR, file_id)       # no ext; FFmpeg adds .mp3
    else:
        output_path = os.path.join(DOWNLOADS_DIR, f"{file_id}.mp4")

    # Initialise progress entry
    progress_store[file_id] = {
        "status":  "starting",
        "percent": 0,
        "speed":   "",
        "eta":     "",
        "title":   request.title,
    }

    # Start download in a daemon thread so the response returns immediately
    t = threading.Thread(
        target=run_download_thread,
        args=(file_id, request.url, request.format_id, output_path, is_audio),
        daemon=True,
    )
    t.start()

    return {"download_id": file_id}


@app.get("/progress/{download_id}")
async def stream_progress(download_id: str):
    """Server-Sent Events endpoint that streams download progress."""

    async def event_generator():
        sent_done = False
        while not sent_done:
            entry = progress_store.get(download_id)
            if entry is None:
                data = json.dumps({"status": "not_found"})
                yield f"data: {data}\n\n"
                break

            yield f"data: {json.dumps(entry)}\n\n"

            if entry["status"] in ("done", "error"):
                sent_done = True
                break

            await asyncio.sleep(0.5)   # poll every 500 ms

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/file/{download_id}")
async def serve_file(download_id: str):
    """Serve the completed file for download."""
    entry = progress_store.get(download_id, {})
    if entry.get("status") != "done":
        raise HTTPException(status_code=404, detail="File not ready or not found.")

    final_path = entry["file_path"]
    final_ext  = entry["file_ext"]

    if not os.path.exists(final_path):
        raise HTTPException(status_code=404, detail="File has been cleaned up or does not exist.")

    media_type = "video/mp4" if final_ext == "mp4" else "audio/mpeg"
    
    # Sanitize title for filename
    raw_title = entry.get("title", "QuickTube_Video")
    clean_title = "".join([c for c in raw_title if c.isalnum() or c in (" ", ".", "_", "-")]).strip()
    if not clean_title:
        clean_title = f"QuickTube_{download_id}"
        
    return FileResponse(
        path=final_path,
        filename=f"{clean_title}.{final_ext}",
        media_type=media_type,
    )


@app.get("/")
async def root():
    return {"status": "QuickTube API is running"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
