import yt_dlp
import os
import re
import base64

_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')

def _clean(s: str) -> str:
    """Strip ANSI codes and surrounding whitespace from yt-dlp stat strings."""
    return _ANSI_RE.sub('', s or '').strip()


# ── Cookie setup ─────────────────────────────────────────────────────────────
# Cookies are stored as a Base64-encoded env var (YOUTUBE_COOKIES_B64) to
# preserve newlines when pasting into Render's environment variable editor.
# Falls back to raw text (YOUTUBE_COOKIES) if B64 version is not set.

COOKIES_FILE = '/tmp/yt_cookies.txt'
_cookies_ready = False

def _setup_cookies():
    global _cookies_ready

    # Try Base64-encoded version first (recommended)
    b64 = os.getenv('YOUTUBE_COOKIES_B64', '').strip()
    if b64:
        try:
            content = base64.b64decode(b64).decode('utf-8')
            with open(COOKIES_FILE, 'w', encoding='utf-8') as f:
                f.write(content)
            _cookies_ready = True
            print("[utils] cookies.txt written from YOUTUBE_COOKIES_B64.")
            return
        except Exception as e:
            print(f"[utils] Failed to decode YOUTUBE_COOKIES_B64: {e}")

    # Fall back to raw text version
    raw = os.getenv('YOUTUBE_COOKIES', '').strip()
    if raw:
        try:
            with open(COOKIES_FILE, 'w', encoding='utf-8') as f:
                f.write(raw)
            _cookies_ready = True
            print("[utils] cookies.txt written from YOUTUBE_COOKIES.")
            return
        except Exception as e:
            print(f"[utils] Failed to write YOUTUBE_COOKIES: {e}")

    print("[utils] WARNING: No YouTube cookies configured. Bot detection may occur.")

_setup_cookies()


def _base_opts() -> dict:
    """Return common yt-dlp options, including cookies if available."""
    opts = {
        'quiet':       True,
        'no_warnings': True,
    }
    if _cookies_ready and os.path.exists(COOKIES_FILE):
        opts['cookiefile'] = COOKIES_FILE
    return opts


# ── Video info ────────────────────────────────────────────────────────────────

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

            for f in info.get('formats', []):
                res    = f.get('height')
                vcodec = f.get('vcodec')

                if res and res not in seen_resolutions and vcodec != 'none':
                    formats.append({
                        'format_id':  f['format_id'],
                        'resolution': f'{res}p',
                        'ext':        'mp4',
                        'filesize':   f.get('filesize', 0),
                        'note':       f.get('format_note', ''),
                    })
                    seen_resolutions.add(res)

            # Always add MP3 audio option
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


# ── Download ──────────────────────────────────────────────────────────────────

def download_video(url, format_id, output_path, progress_hook=None):
    """Download a video (with merged audio) or extract audio as MP3."""

    is_audio = 'bestaudio' in format_id
    hooks    = [progress_hook] if progress_hook else []

    if is_audio:
        ydl_opts = {
            **_base_opts(),
            'format':         'bestaudio/best',
            'outtmpl':        output_path + '.%(ext)s',
            'noprogress':     True,
            'progress_hooks': hooks,
            'postprocessors': [{
                'key':              'FFmpegExtractAudio',
                'preferredcodec':   'mp3',
                'preferredquality': '192',
            }],
        }
    else:
        ydl_opts = {
            **_base_opts(),
            'format':              f'{format_id}+bestaudio/best',
            'outtmpl':             output_path,
            'noprogress':          True,
            'progress_hooks':      hooks,
            'merge_output_format': 'mp4',
            'postprocessor_args':  {
                'merger': ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k'],
            },
        }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    return output_path