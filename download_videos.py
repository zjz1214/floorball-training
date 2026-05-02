import json
import os
import time
import requests

# Load JSON, extract video blocks
with open('ISDBdRNj4oIqsxxqXtdcyyuJnoe.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

videos = []
for b in data['blocks']:
    if b.get('block_type') == 23 and 'file' in b:
        videos.append((b['file']['token'], b['file']['name']))

# Deduplicate
videos = sorted(set(videos), key=lambda x: x[1])
print(f'Total unique videos: {len(videos)}')

# Get access token
resp = requests.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    json={'app_id': 'cli_a97ee6cd53f85bdb', 'app_secret': 'zO1CVj9Y8aYNROHbPuXJAcreQ1ZS7850'}
)
token = resp.json()['tenant_access_token']
print(f'Got access token, expires in {resp.json()["expire"]}s')

# Download each video
os.makedirs('videos', exist_ok=True)
success = 0
failed = []

for i, (file_token, filename) in enumerate(videos):
    safe_name = filename.replace('/', '_')
    filepath = os.path.join('videos', safe_name)

    if os.path.exists(filepath):
        print(f'[{i+1}/{len(videos)}] SKIP (exists): {safe_name}')
        success += 1
        continue

    try:
        url = f'https://open.feishu.cn/open-apis/drive/v1/medias/{file_token}/download'
        r = requests.get(url, headers={'Authorization': f'Bearer {token}'}, timeout=120)
        if r.status_code == 200:
            with open(filepath, 'wb') as f:
                f.write(r.content)
            size_mb = len(r.content) / 1024 / 1024
            print(f'[{i+1}/{len(videos)}] OK ({size_mb:.1f}MB): {safe_name}')
            success += 1
        else:
            print(f'[{i+1}/{len(videos)}] FAIL (status={r.status_code}): {safe_name}')
            failed.append(safe_name)
    except Exception as e:
        print(f'[{i+1}/{len(videos)}] ERROR: {safe_name} - {e}')
        failed.append(safe_name)

    time.sleep(0.3)  # Rate limit

print(f'\nDone. Success: {success}, Failed: {len(failed)}')
if failed:
    print('Failed files:')
    for f in failed:
        print(f'  {f}')
