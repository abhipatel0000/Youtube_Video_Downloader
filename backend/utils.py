import yt_dlp
import os
import re

_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')

def _clean(s: str) -> str:
    """Strip ANSI codes and surrounding whitespace from yt-dlp stat strings."""
    return _ANSI_RE.sub('', s or '').strip()


# ── Cookie setup ────────────────────────────────────────────────────────────
# Reads cookie content from the YOUTUBE_COOKIES environment variable and
# writes it to a temp file so yt-dlp can use it. This avoids committing
# sensitive cookie data to your git repository.

COOKIES_FILE = '/tmp/yt_cookies.txt'

_cookie_content = os.getenv('YOUTUBE_COOKIES', '').strip()
if _cookie_content:
    with open(COOKIES_FILE, 'w') as _f:
        _f.write(_cookie_content)
    print("[utils] cookies.txt written from YOUTUBE_COOKIES env var.")
else:
    print("[utils] WARNING: YOUTUBE_COOKIES env var not set. YouTube may block requests.")


def _base_opts() -> dict:
    """Return common yt-dlp options, including cookies if available."""
    opts = {
        'quiet': True,
        'no_warnings': True,
    }
    if os.path.exists(COOKIES_FILE):
        opts['cookiefile'] = COOKIES_FILE
    return opts


# ── Video info ───────────────────────────────────────────────────────────────

def get_video_info(url):
    ydl_opts = {
        **_base_opts(),
        'format': 'best',
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)

            formats = []
            seen_resolutions = set()

            # Add video formats (filtered by resolution to avoid duplicates)
            for f in info.get('formats', []):
                res    = f.get('height')
                vcodec = f.get('vcodec')

                if res and res not in seen_resolutions and vcodec != 'none':
                    formats.append({
                        'format_id':  f['format_id'],
                        'resolution': f'{res}p',
                        'ext':        'mp4',   # always output mp4 after merging
                        'filesize':   f.get('filesize', 0),
                        'note':       f.get('format_note', ''),
                    })
                    seen_resolutions.add(res)

            # Add MP3 audio option
            formats.append({
                'format_id':  'bestaudio/best',
                'resolution': 'MP3 (Audio)',
                'ext':        'mp3',
                'filesize':   0,
                'note':       'Highest Quality Audio',
            })

            return {
                'success':   True,
                'title':     info.get('title'),
                'thumbnail': info.get('thumbnail'),
                'duration':  info.get('duration'),
                'author':    info.get('uploader'),
                'formats':   sorted(
                    formats,
                    key=lambda x: int(x['resolution'].replace('p', '')) if 'p' in x['resolution'] else 0,
                    reverse=True,
                ),
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}


# ── Download ─────────────────────────────────────────────────────────────────

def download_video(url, format_id, output_path, progress_hook=None):
    """Download a video (with merged audio) or extract audio as MP3."""

    is_audio = 'bestaudio' in format_id
    hooks    = [progress_hook] if progress_hook else []

    if is_audio:
        # yt-dlp writes a temp file with its own extension, then FFmpeg
        # converts it to .mp3 via the FFmpegExtractAudio postprocessor.
        ydl_opts = {
            **_base_opts(),
            'format':      'bestaudio/best',
            'outtmpl':     output_path + '.%(ext)s',
            'noprogress':  True,
            'progress_hooks': hooks,
            'postprocessors': [{
                'key':              'FFmpegExtractAudio',
                'preferredcodec':   'mp3',
                'preferredquality': '192',
            }],
        }
    else:
        # YouTube delivers video-only + audio-only streams separately.
        # We request the chosen video stream + best audio, then FFmpeg merges them.
        # Audio is re-encoded to AAC so the MP4 plays everywhere (Windows, etc.).
        ydl_opts = {
            **_base_opts(),
            'format':               f'{format_id}+bestaudio/best',
            'outtmpl':              output_path,
            'noprogress':           True,
            'progress_hooks':       hooks,
            'merge_output_format':  'mp4',
            'postprocessor_args': {
                'merger': ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k'],
            },
        }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    return output_path