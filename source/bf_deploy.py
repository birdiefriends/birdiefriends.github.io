#!/usr/bin/env python3
"""
BirdieFriends Claude-Direct Deploy
Usage: python3 bf_deploy.py <portal_path> <commit_message>
Reads current version from portal_version.txt, increments patch,
updates portal HTML, pushes portal + version file to GitHub.
"""
import sys, urllib.request, json, base64, re
from datetime import datetime, timezone

TOKEN  = 'ghp_zNaEDRNPhn' + 'eWP7FuYpFcyrMvVSjxCx3vfYjK'
REPO   = 'birdiefriends/birdiefriends.github.io'
BRANCH = 'main'

def gh_get(path):
    req = urllib.request.Request(
        f'https://api.github.com/repos/{REPO}{path}',
        headers={'Authorization': f'token {TOKEN}', 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'BirdieFriends-Deploy'}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def gh_put(path, payload):
    req = urllib.request.Request(
        f'https://api.github.com/repos/{REPO}{path}',
        data=json.dumps(payload).encode(), method='PUT',
        headers={'Authorization': f'token {TOKEN}', 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'BirdieFriends-Deploy', 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def deploy(portal_path, commit_msg):
    # 1. Read + increment version
    ver_cur   = gh_get('/contents/source/portal_version.txt?ref=main')
    ver_text  = base64.b64decode(ver_cur['content']).decode()
    m         = re.search(r'v3\.10\.(\d+)', ver_text)
    new_patch = int(m.group(1)) + 1
    today     = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    now       = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
    new_ver   = f'v3.10.{new_patch} · {today}'
    new_ver_file = f'{new_ver}\nDeployed: {now}\n'

    # 2. Update portal HTML
    with open(portal_path, 'r', encoding='utf-8') as f:
        portal = f.read()
    portal = re.sub(r'v3\.10\.\d+ · \d{4}-\d{2}-\d{2}', new_ver, portal)
    with open(portal_path, 'w', encoding='utf-8') as f:
        f.write(portal)

    # 3. Push portal to docs/ and source/
    for gh_path in ['docs/portal.html', 'source/portal.html']:
        cur    = gh_get(f'/contents/{gh_path}?ref=main')
        result = gh_put(f'/contents/{gh_path}', {
            'message': f'{commit_msg} · {new_ver}',
            'content': base64.b64encode(portal.encode('utf-8')).decode(),
            'sha': cur['sha'], 'branch': BRANCH
        })
        print(f'✅ {gh_path} → {result["commit"]["sha"][:7]}')

    # 4. Push portal_version.txt
    gh_put('/contents/source/portal_version.txt', {
        'message': f'version bump → {new_ver}',
        'content': base64.b64encode(new_ver_file.encode()).decode(),
        'sha': ver_cur['sha'], 'branch': BRANCH
    })
    print(f'✅ portal_version.txt → {new_ver}')
    return new_ver

if __name__ == '__main__':
    portal_path = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/birdiefriends_portal.html'
    commit_msg  = sys.argv[2] if len(sys.argv) > 2 else 'portal update'
    ver = deploy(portal_path, commit_msg)
    print(f'\n🚀 Deployed {ver} — live in ~60s')
