#!/usr/bin/env python3
"""
BirdieFriends Claude-Direct Deploy — SUPERSEDED, REFERENCE ONLY (Session 40)
This script is no longer executed by Claude. All deploys go through the Worker's
PIN-gated POST /deploy and /rollback routes (see source/worker.js), which keep the
GitHub write token in Cloudflare's secret store instead of a script Claude imports
and runs. Kept here only for the version-bump regex logic. Do not paste a live
token below — this file is public via GitHub Pages.
Functions:
  deploy(portal_path, commit_msg)  — push local file, increment version
  rollback(sha, commit_msg)        — restore portal to a prior commit SHA, increment version
"""
import sys, urllib.request, urllib.error, json, base64, re
from datetime import datetime, timezone

TOKEN  = ''  # intentionally blank — see header note. Use Worker /deploy instead.
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


def _bump_gs_version(content):
    """Auto-increment GolfScorer version suffix (a→b→...→z→aa→ab...) and sync build-date.
    Returns (new_content, old_ver, new_ver). Structural — cannot be skipped."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    # Match e.g. v8.17 · 2026-06-09p  or  v8.17 · 2026-06-09aa
    m = re.search(r"GS_VERSION = '(v[\d.]+) · (\d{4}-\d{2}-\d{2})([a-z]+)'", content)
    if not m:
        return content, None, None
    base_ver, old_date, old_suffix = m.group(1), m.group(2), m.group(3)
    # Increment suffix: a→b, z→aa, az→ba, zz→aaa
    def inc_suffix(s):
        s = list(s)
        i = len(s) - 1
        while i >= 0:
            if s[i] < 'z':
                s[i] = chr(ord(s[i]) + 1)
                return ''.join(s)
            s[i] = 'a'
            i -= 1
        return 'a' + ''.join(s)
    new_suffix = inc_suffix(old_suffix) if old_date == today else 'a'
    new_ver = f'{base_ver} · {today}{new_suffix}'
    old_ver = f'{base_ver} · {old_date}{old_suffix}'
    # Update GS_VERSION constant and build-date textContent
    content = content.replace(f"GS_VERSION = '{old_ver}'", f"GS_VERSION = '{new_ver}'")
    content = re.sub(
        r"document\.getElementById\('build-date'\)\.textContent = '[^']+'",
        f"document.getElementById('build-date').textContent = '{today}{new_suffix}'",
        content
    )
    return content, old_ver, new_ver

def deploy_file(local_path, gh_path, commit_msg='update'):
    """Deploy any single file directly to a GitHub path.
    For GolfScorer (BF_Golf_Scorer_8.html), auto-bumps version — structurally enforced.
    Creates the file if it doesn't exist yet in the repo (no sha required by the GitHub
    Contents API for new files); updates it in place if it does."""
    with open(local_path, 'r', encoding='utf-8') as f:
        file_content = f.read()
    # Auto-bump GolfScorer version — cannot be skipped
    if 'BF_Golf_Scorer' in gh_path or 'BF_Golf_Scorer' in local_path:
        file_content, old_ver, new_ver = _bump_gs_version(file_content)
        if new_ver:
            print(f'📦 GS version: {old_ver} → {new_ver}')
            commit_msg = f'{commit_msg} · {new_ver}'
            # Write bumped content back to local file
            with open(local_path, 'w', encoding='utf-8') as f:
                f.write(file_content)
    encoded = base64.b64encode(file_content.encode('utf-8')).decode()
    payload = {'message': commit_msg, 'content': encoded, 'branch': BRANCH}
    try:
        cur = gh_get(f'/contents/{gh_path}?ref=main')
        payload['sha'] = cur['sha']
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f'ℹ️  {gh_path} not found in repo — creating new file')
        else:
            raise
    result = gh_put(f'/contents/{gh_path}', payload)
    print(f'✅ {gh_path} → {result["commit"]["sha"][:7]}')
    print(f'\n🚀 {gh_path} deployed — live in ~60s')
    return result

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'deploy'
    if cmd == 'deploy':
        deploy(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'portal update')
    elif cmd == 'rollback':
        rollback(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    elif cmd == 'history':
        history(int(sys.argv[2]) if len(sys.argv) > 2 else 10)
    elif cmd == 'deploy_file':
        deploy_file(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else 'update')
    else:
        print('Usage: bf_deploy.py [deploy <path> <msg>] | [deploy_file <local> <gh_path> <msg>] | [rollback <sha> <msg>] | [history <n>]')
