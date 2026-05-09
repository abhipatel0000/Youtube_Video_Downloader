import yt_dlp
import os
import re

_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')

def _clean(s: str) -> str:
    return _ANSI_RE.sub('', s or '').strip()

# Path to cookies file — sits next to utils.py on the server
COOKIES_FILE = os.path.join(os.path.dirname(__file__), 'cookies.txt')

def _base_opts() -> dict:
    """Common yt-dlp options, including cookies if the file exists."""
    opts = {
        'quiet': True,
        'no_warnings': True,
    }
    if os.path.exists(COOKIES_FILE):
        opts['cookiefile'] = COOKIES_FILE
    return opts


def get_video_info(url):
    ydl_opts = {
        **_base_opts(),
        'format': 'best'
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)

            formats = []
            seen_resolutions = set()

            for f in info.get('formats', []):
                res = f.get('height')
                ext = f.get('ext')
                vcodec = f.get('vcodec')

                if res and res not in seen_resolutions and vcodec != 'none':
                    formats.append({
                        'format_id': f['format_id'],
                        'resolution': f'{res}p',
                        'ext': 'mp4',
                        'filesize': f.get('filesize', 0),
                        'note': f.get('format_note', '')
                    })
                    seen_resolutions.add(res)

            formats.append({
                'format_id': 'bestaudio/best',
                'resolution': 'MP3 (Audio)',
                'ext': 'mp3',
                'filesize': 0,
                'note': 'Highest Quality Audio'
            })

            return {
                'success': True,
                'title': info.get('title'),
                'thumbnail': info.get('thumbnail'),
                'duration': info.get('duration'),
                'author': info.get('uploader'),
                'formats': sorted(
                    formats,
                    key=lambda x: int(x['resolution'].replace('p', '')) if 'p' in x['resolution'] else 0,
                    reverse=True
                )
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}


def download_video(url, format_id, output_path, progress_hook=None):
    is_audio = 'bestaudio' in format_id
    hooks = [progress_hook] if progress_hook else []

    if is_audio:
        ydl_opts = {
            **_base_opts(),
            'format': 'bestaudio/best',
            'outtmpl': output_path + '.%(ext)s',
            'noprogress': True,
            'progress_hooks': hooks,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
    else:
        ydl_opts = {
            **_base_opts(),
            'format': f'{format_id}+bestaudio/best',
            'outtmpl': output_path,
            'noprogress': True,
            'progress_hooks': hooks,
            'merge_output_format': 'mp4',
            'postprocessor_args': {
                'merger': ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k'],
            },
        }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    return output_path