"""Convert MOV/MKV videos to MP4 using ffmpeg. Run once before build.py."""
import subprocess, os, sys

VIDEO_DIR = 'videos'
FFMPEG = 'ffmpeg'

def convert_to_mp4(filepath):
    base = os.path.splitext(filepath)[0]
    outpath = base + '.mp4'
    ext = os.path.splitext(filepath)[1].lower()

    if not os.path.exists(filepath):
        return None

    # Convert MOV and MKV to MP4
    cmd = [
        FFMPEG, '-y', '-i', filepath,
        '-c:v', 'libx264', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        outpath
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'FAIL: {filepath} -> {outpath}')
        print(result.stderr[-300:])
        return None
    return outpath

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    videos = sorted(os.listdir(VIDEO_DIR))
    converted = []

    for v in videos:
        filepath = os.path.join(VIDEO_DIR, v)
        ext = os.path.splitext(v)[1].lower()
        if ext in ('.mov', '.mkv'):
            # Check if MP4 already exists
            mp4_name = os.path.splitext(v)[0] + '.mp4'
            mp4_path = os.path.join(VIDEO_DIR, mp4_name)
            if os.path.exists(mp4_path) and os.path.getsize(mp4_path) > 0:
                print(f'SKIP (already done): {v}')
                converted.append((v, mp4_name))
                continue
            print(f'Converting: {v} ... ', end='', flush=True)
            result = convert_to_mp4(filepath)
            if result:
                size = os.path.getsize(result) / 1024 / 1024
                print(f'OK ({size:.1f}MB)')
                converted.append((v, mp4_name))
            else:
                print('FAILED')

    print(f'\nConverted {len(converted)} files')

    # Print the reference updates needed
    print('\n--- MD reference updates ---')
    for old, new in converted:
        print(f'{old} -> {new}')

if __name__ == '__main__':
    main()
