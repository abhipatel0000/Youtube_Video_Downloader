import yt_dlp
import os
import re

_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')

def _clean(s: str) -> str:
    """Strip ANSI codes and surrounding whitespace from yt-dlp stat strings."""
    return _ANSI_RE.sub('', s or '').strip()

def get_video_info(url):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'format': 'best'
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)

            formats = []
            seen_resolutions = set()

            # Add video formats (we filter by resolution to avoid duplicates)
            for f in info.get('formats', []):
                res = f.get('height')
                ext = f.get('ext')
                vcodec = f.get('vcodec')

                if res and res not in seen_resolutions and vcodec != 'none':
                    formats.append({
                        'format_id': f['format_id'],
                        'resolution': f'{res}p',
                        'ext': 'mp4',   # We always output mp4 after merging
                        'filesize': f.get('filesize', 0),
                        'note': f.get('format_note', '')
                    })
                    seen_resolutions.add(res)

            # Add an MP3 option
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
    """Download a video (with merged audio) or extract audio as MP3."""

    is_audio = 'bestaudio' in format_id

    hooks = [progress_hook] if progress_hook else []

    if is_audio:
        # Use %(ext)s so yt-dlp writes a valid extension on Windows.
        # FFmpegExtractAudio will then replace the temp file with a .mp3.
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path + '.%(ext)s',
            'quiet': True,
            'noprogress': True,
            'progress_hooks': hooks,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
    else:
        # YouTube delivers video-only and audio-only streams separately.
        # We request the chosen video stream + best audio, then FFmpeg merges them.
        # AUDIO FIX: YouTube audio is Opus/WebM — not supported inside MP4 by most
        # players (Windows Media Player, etc.). We re-encode audio to AAC during
        # the merge so the final MP4 is universally playable.
        merge_format = f'{format_id}+bestaudio/best'
        ydl_opts = {
            'format': merge_format,
            'outtmpl': output_path,
            'quiet': True,
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
