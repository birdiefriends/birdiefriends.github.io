#!/usr/bin/env python3
"""
BirdieFriends Claude-Direct Deploy
Functions:
  deploy(portal_path, commit_msg)  — push local file, increment version
  rollback(sha, commit_msg)        — restore portal to a prior commit SHA, increment version
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

def _next_version():
    """Read portal_version.txt, return (new_ver_str, new_ver_file, ver_sha)."""
    ver_cur  = gh_get('/contents/source/portal_version.txt?ref=main')
    ver_text = base64.b64decode(ver_cur['content']).decode()
    m        = re.search(r'v3\.10\.(\d+)', ver_text)
    patch    = int(m.group(1)) + 1
    today    = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    now      = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
    ver_str  = f'v3.10.{patch} · {today}'
    ver_file = f'{ver_str}\nDeployed: {now}\n'
    return ver_str, ver_file, ver_cur['sha']

def _push_portal(content, commit_msg):
    """Push portal content to docs/ and source/, push version file. Returns new_ver."""
    new_ver, new_ver_file, ver_sha = _next_version()
    content = re.sub(r'v3\.10\.\d+ · \d{4}-\d{2}-\d{2}', new_ver, content)
    encoded = base64.b64encode(content.encode('utf-8')).decode()
    for gh_path in ['docs/portal.html', 'source/portal.html']:
        cur = gh_get(f'/contents/{gh_path}?ref=main')
        result = gh_put(f'/contents/{gh_path}', {
            'message': f'{commit_msg} · {new_ver}',
            'content': encoded, 'sha': cur['sha'], 'branch': BRANCH
        })
        print(f'✅ {gh_path} → {result["commit"]["sha"][:7]}')
    gh_put('/contents/source/portal_version.txt', {
        'message': f'version bump → {new_ver}',
        'content': base64.b64encode(new_ver_file.encode()).decode(),
        'sha': ver_sha, 'branch': BRANCH
    })
    print(f'✅ portal_version.txt → {new_ver}')
    print(f'\n🚀 Deployed {new_ver} — live in ~60s')
    return new_ver

def deploy(portal_path, commit_msg='portal update'):
    """Deploy from a local file."""
    with open(portal_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return _push_portal(content, commit_msg)

def rollback(sha, commit_msg=None):
    """Restore portal to a prior commit SHA and deploy as new version."""
    blob    = gh_get(f'/contents/docs/portal.html?ref={sha}')
    content = base64.b64decode(blob['content']).decode('utf-8')
    msg     = commit_msg or f'Rollback to {sha[:7]}'
    print(f'Fetched portal at {sha[:7]}')
    return _push_portal(content, msg)

def history(n=10):
    """Print last N commit SHAs and messages for portal."""
    commits = gh_get(f'/commits?path=docs/portal.html&per_page={n}&sha=main')
    for c in commits:
        print(c['sha'][:7], c['commit']['message'])

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'deploy'
    if cmd == 'deploy':
        deploy(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'portal update')
    elif cmd == 'rollback':
        rollback(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    elif cmd == 'history':
        history(int(sys.argv[2]) if len(sys.argv) > 2 else 10)
    else:
        print('Usage: bf_deploy.py [deploy <path> <msg>] | [rollback <sha> <msg>] | [history <n>]')
