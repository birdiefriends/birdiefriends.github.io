#!/usr/bin/env python3
"""
BF Golf Scorer — Local Launcher with API Proxy
Run: python launch_golf_scorer.py
Press Ctrl+C to stop.
"""

import http.server
import socketserver
import os, sys, json, base64
from urllib.request import urlopen, Request
from urllib.error import HTTPError

# ── Google API (optional) ─────────────────────────────────────
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build as gbuild
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False

PORT = 8743

# ── Test Preview Mode ─────────────────────────────────────────
# Set True before a test run to intercept all /api/netlify/deploy
# calls and save generated HTML to a local  preview/  folder
# instead of pushing to GitHub Pages / birdiefriends.com.
# Players see nothing.  Flip back to False for event day.
TEST_PREVIEW_MODE = False
PREVIEW_FOLDER    = "preview"

# ── Jotform ───────────────────────────────────────────────────
# This file is backed up in the public GitHub library — key intentionally
# blank here. Paste your real key back in on the laptop copy only; never
# commit a real value to source/launch_golf_scorer.py.
JOTFORM_API_KEY = ""

# ── GitHub Pages ──────────────────────────────────────────────
# Write token — needed for Publish All Pages (results.html, standings.html, groupings.html).
# Auto-pull uses unauthenticated requests (public repo). Rotate token on GitHub after
# any exposure and update this value. This file stays on laptop only — never in GitHub.
GITHUB_TOKEN  = ""
GITHUB_REPO   = "birdiefriends/birdiefriends.github.io"
GITHUB_BRANCH = "main"

# ── Google Sheets ─────────────────────────────────────────────
# Step 1: Place your service account JSON key in the GolfScorer folder
# Step 2: Paste your Google Sheet ID below (from the Sheet URL)
SHEETS_KEY_FILE = "bf-golf-scorer-key.json"
SHEETS_ID       = "1QvnXGY8TLgCgAhXt8SBRbwa7eUz-Vouhu6Tyituee20"   # ← paste Sheet ID here after setup

# ── Landing page ──────────────────────────────────────────────
LANDING_PAGE_FILE = "birdiefriends_landing.html"

script_dir  = os.path.dirname(os.path.abspath(__file__))
GS_DATA_DIR = os.path.join(script_dir, "GS_Data")
os.makedirs(GS_DATA_DIR, exist_ok=True)   # create GS_Data folder if needed
os.chdir(script_dir)

html_files = sorted([f for f in os.listdir(script_dir)
                     if f.endswith(".html") and "Golf_Scorer" in f and "STABLE" not in f])
if not html_files:
    html_files = sorted([f for f in os.listdir(script_dir)
                         if f.endswith(".html") and "Golf" in f])
if not html_files:
    print("ERROR: No Golf Scorer HTML file found in this folder.")
    input("Press Enter to exit..."); sys.exit(1)

html_file = html_files[-1]


class ProxyHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args): pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type",   "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors(); self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()

    # ── GET ───────────────────────────────────────────────────
    def do_GET(self):
        path = self.path.split("?")[0]

        if path.startswith("/api/jotform/submissions/"):
            self._jotform(path.split("/")[-1]); return

        # ── Portal: event requests + registrations ────────────
        if path == "/api/portal/events":
            self._portal_events(); return
        if path == "/api/portal/registrations":
            self._portal_registrations(); return

        if path == "/api/netlify/status":
            self._json(200, {
                "configured":   True,
                "siteUrl":      "https://birdiefriends.com",
                "preview_mode": TEST_PREVIEW_MODE,
            }); return

        if path.startswith("/preview/"):
            rel      = path[len("/preview/"):]
            filepath = os.path.join(script_dir, PREVIEW_FOLDER, rel)
            if not os.path.isfile(filepath):
                self.send_response(404); self.end_headers(); return
            with open(filepath, "rb") as f: data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self._cors(); self.end_headers(); self.wfile.write(data)
            return

        if path == "/api/sheets/status":
            key_ok   = os.path.isfile(os.path.join(script_dir, SHEETS_KEY_FILE))
            sheet_ok = bool(SHEETS_ID)
            self._json(200, {
                "available":  GOOGLE_AVAILABLE,
                "keyFound":   key_ok,
                "sheetConfigured": sheet_ok,
                "ready":      GOOGLE_AVAILABLE and key_ok and sheet_ok,
                "sheetUrl":   f"https://docs.google.com/spreadsheets/d/{SHEETS_ID}" if SHEETS_ID else ""
            }); return

        if path == "/api/data/list":
            self._data_list(); return
        if path == "/api/scorecard/submissions":
            self._scorecard_submissions(); return

        if path == "/":
            path = f"/{html_file}"

        filepath = os.path.join(script_dir, path.lstrip("/"))
        if not os.path.isfile(filepath):
            self.send_response(404); self.end_headers(); return

        ext  = os.path.splitext(filepath)[1].lower()
        mime = {".html":"text/html",".js":"text/javascript",
                ".css":"text/css",".png":"image/png",
                ".jpg":"image/jpeg"}.get(ext,"application/octet-stream")
        with open(filepath,"rb") as f: data = f.read()
        self.send_response(200)
        self.send_header("Content-Type",   mime)
        self.send_header("Content-Length", str(len(data)))
        self._cors(); self.end_headers(); self.wfile.write(data)

    # ── POST ──────────────────────────────────────────────────
    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/netlify/deploy":  self._github_deploy();  return
        if path == "/api/deploy/landing":  self._deploy_landing(); return
        if path == "/api/deploy/portal":   self._deploy_portal();  return
        if path == "/api/sheets/push":     self._sheets_push();    return
        if path == "/api/data/export":     self._data_export();    return
        if path == "/api/data/import":     self._data_import();    return
        self.send_response(404); self._cors(); self.end_headers()

    # ── GS Data folder (Import / Export JSON) ────────────────
    def _data_list(self):
        """Return sorted list of .json files in GS_Data folder."""
        try:
            files = sorted(
                [f for f in os.listdir(GS_DATA_DIR) if f.endswith('.json')],
                reverse=True
            )
            self._json(200, {"files": files, "folder": GS_DATA_DIR})
        except Exception as ex:
            self._json(500, {"error": str(ex)})

    def _data_export(self):
        """Receive JSON from GS and write to GS_Data folder."""
        try:
            length   = int(self.headers.get("Content-Length", 0))
            payload  = json.loads(self.rfile.read(length))
            filename = payload.get("filename", "")
            data_str = payload.get("data", "")
            if not filename or not data_str:
                raise Exception("Missing filename or data.")
            # Safety: only allow simple filenames, no path traversal
            filename = os.path.basename(filename)
            if not filename.endswith(".json"):
                filename += ".json"
            filepath = os.path.join(GS_DATA_DIR, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(data_str)
            print(f"  💾 Exported: GS_Data/{filename}")
            self._json(200, {"success": True, "filename": filename, "folder": GS_DATA_DIR})
        except Exception as ex:
            self._json(500, {"error": str(ex)})

    def _data_import(self):
        """Read a named .json file from GS_Data and return its contents."""
        try:
            length   = int(self.headers.get("Content-Length", 0))
            payload  = json.loads(self.rfile.read(length))
            filename = os.path.basename(payload.get("filename", ""))
            if not filename:
                raise Exception("Missing filename.")
            filepath = os.path.join(GS_DATA_DIR, filename)
            if not os.path.isfile(filepath):
                raise Exception(f"File not found: {filename}")
            with open(filepath, "r", encoding="utf-8") as f:
                data_str = f.read()
            json.loads(data_str)   # validate before sending
            print(f"  📂 Imported: GS_Data/{filename}")
            self._json(200, {"success": True, "filename": filename, "data": data_str})
        except Exception as ex:
            self._json(500, {"error": str(ex)})

    # ── Scorecard Photo OCR ──────────────────────────────────────
    def _scorecard_submissions(self):
        """Fetch scorecard photo submissions from Jotform for a given event."""
        try:
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            event = qs.get('event', [''])[0].strip()
            if not event:
                self._json(400, {"error": "Missing event parameter"}); return

            SCORECARD_FORM_ID = "261192446029053"
            url = (f"https://api.jotform.com/form/{SCORECARD_FORM_ID}/submissions"
                   f"?apiKey={JOTFORM_API_KEY}&limit=100&orderby=created_at"
                   f'&filter=%7B%22status%3Ane%22%3A%5B%22DELETED%22%2C%22ARCHIVED%22%5D%7D')
            req = Request(url, headers={"User-Agent": "BFGolfScorer/1.0"})
            resp = urlopen(req, timeout=15)
            data = json.loads(resp.read())

            if data.get("responseCode") != 200:
                self._json(500, {"error": "Jotform API error", "detail": data}); return

            # Filter by event name (QID 5)
            all_subs = data.get("content", [])
            event_subs = [
                s for s in all_subs
                if (s.get("answers", {}).get("5", {}).get("answer", "") or "").strip().lower()
                   == event.lower()
            ]

            # Extract image URL (QID 3) per submission
            results = []
            for s in event_subs:
                img_url = (s.get("answers", {}).get("3", {}).get("answer", "") or "").strip()
                results.append({
                    "submission_id": s.get("id"),
                    "created_at":    s.get("created_at"),
                    "image_url":     img_url,
                    "event":         s.get("answers", {}).get("5", {}).get("answer", ""),
                })

            print(f"  📸 Scorecard submissions for '{event}': {len(results)} found")
            self._json(200, {"submissions": results, "event": event, "count": len(results)})

        except Exception as ex:
            self._json(500, {"error": str(ex)})

    # ── Jotform proxy ─────────────────────────────────────────
    def _jotform(self, form_id):
        try:
            url = (f"https://api.jotform.com/form/{form_id}/submissions"
                   f"?apiKey={JOTFORM_API_KEY}&limit=1000&orderby=created_at"
                   f'&filter=%7B%22status%3Ane%22%3A%5B%22DELETED%22%2C%22ARCHIVED%22%5D%7D')
            with urlopen(Request(url, method="GET"), timeout=30) as r:
                body = r.read()
            self.send_response(200)
            self.send_header("Content-Type","application/json")
            self._cors(); self.end_headers(); self.wfile.write(body)
        except Exception as ex:
            self._json(500, {"error": str(ex)})

    # ── Portal: fetch all Event Request submissions ───────────
    def _portal_events(self):
        """Proxy for Request Event form — used by birdiefriends_portal.html"""
        try:
            url = (f"https://api.jotform.com/form/233113019726045/submissions"
                   f"?apiKey={JOTFORM_API_KEY}&limit=500&orderby=created_at"
                   f'&filter=%7B%22status%3Ane%22%3A%5B%22DELETED%22%2C%22ARCHIVED%22%5D%7D')
            with urlopen(Request(url, method="GET"), timeout=30) as r:
                body = r.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors(); self.end_headers(); self.wfile.write(body)
        except Exception as ex:
            self._json(500, {"error": str(ex)})

    # ── Portal: fetch all Registration submissions ────────────
    def _portal_registrations(self):
        """Proxy for Event Registration form — used by birdiefriends_portal.html"""
        try:
            url = (f"https://api.jotform.com/form/233103072261037/submissions"
                   f"?apiKey={JOTFORM_API_KEY}&limit=1000&orderby=created_at"
                   f'&filter=%7B%22status%3Ane%22%3A%5B%22DELETED%22%2C%22ARCHIVED%22%5D%7D')
            with urlopen(Request(url, method="GET"), timeout=30) as r:
                body = r.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors(); self.end_headers(); self.wfile.write(body)
        except Exception as ex:
            self._json(500, {"error": str(ex)})

    # ── GitHub Pages deploy ───────────────────────────────────
    def _github_deploy(self):
        try:
            length  = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            pages   = payload.get("pages", {})
            if not pages:
                html = payload.get("html","")
                if not html: raise Exception("No HTML content received.")
                pages = {"index.html": html}

            # ── Preview mode: save locally instead of pushing ──
            if TEST_PREVIEW_MODE:
                out_dir = os.path.join(script_dir, PREVIEW_FOLDER)
                os.makedirs(out_dir, exist_ok=True)
                print(f"  [PREVIEW] Saving {len(pages)} file(s) to {PREVIEW_FOLDER}/")
                for filename, content in pages.items():
                    dest = os.path.join(out_dir, filename)
                    with open(dest, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"  [PREVIEW] Saved: {PREVIEW_FOLDER}/{filename}")
                self._json(200, {
                    "success": True,
                    "preview": True,
                    "url":     f"http://localhost:{PORT}/{PREVIEW_FOLDER}/",
                    "files":   list(pages.keys()),
                })
                return

            # ── Production: push to GitHub Pages ──────────────
            print(f"  Deploying → GitHub Pages: {list(pages.keys())}")
            for filename, content in pages.items():
                self._gh_put(f"docs/{filename}", content, f"Deploy {filename}")
                print(f"  ✅ {filename}")

            self._json(200, {"success": True, "url": "https://birdiefriends.com"})

        except HTTPError as e:
            err = e.read().decode()
            print(f"  ❌ GitHub {e.code}: {err}")
            self._json(e.code, {"success": False, "error": f"GitHub {e.code}: {err}"})
        except Exception as ex:
            print(f"  ❌ Deploy error: {ex}")
            self._json(500, {"success": False, "error": str(ex)})

    # ── Landing page deploy ───────────────────────────────────
    def _deploy_landing(self):
        try:
            lp = os.path.join(script_dir, LANDING_PAGE_FILE)
            if not os.path.isfile(lp):
                raise Exception(f"Landing page not found: {LANDING_PAGE_FILE}")
            with open(lp,"r",encoding="utf-8") as f: content = f.read()
            print("  Deploying landing page → docs/index.html")
            self._gh_put("docs/index.html", content, "Deploy landing page")
            print("  ✅ Landing page deployed → birdiefriends.com")
            self._json(200, {"success": True, "url": "https://birdiefriends.com"})
        except HTTPError as e:
            self._json(e.code, {"success": False, "error": e.read().decode()})
        except Exception as ex:
            self._json(500, {"success": False, "error": str(ex)})

    # ── Portal deploy (portal.html + manifest.json + sw.js) ──
    def _deploy_portal(self):
        try:
            deployed = []
            for fname, gh_path in [
                ("birdiefriends_portal.html", "docs/portal.html"),
                ("manifest.json",             "docs/manifest.json"),
                ("sw.js",                     "docs/sw.js"),
            ]:
                fp = os.path.join(script_dir, fname)
                if not os.path.isfile(fp):
                    raise Exception(f"File not found: {fname}")
                with open(fp, "r", encoding="utf-8") as f:
                    content = f.read()
                print(f"  Deploying {fname} → {gh_path}")
                self._gh_put(gh_path, content, f"Deploy {fname}")
                deployed.append(gh_path)
                print(f"  ✅ {gh_path}")
            print("  ✅ Portal deployed → birdiefriends.com/portal.html")
            self._json(200, {"success": True, "url": "https://birdiefriends.com/portal.html", "deployed": deployed})
        except HTTPError as e:
            self._json(e.code, {"success": False, "error": e.read().decode()})
        except Exception as ex:
            self._json(500, {"success": False, "error": str(ex)})

    def _gh_put(self, filepath, content, message):
        sha     = self._gh_sha(filepath)
        encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        data    = {"message": message, "content": encoded, "branch": GITHUB_BRANCH}
        if sha: data["sha"] = sha
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filepath}"
        req = Request(url, data=json.dumps(data).encode(), headers={
            "Authorization":        f"Bearer {GITHUB_TOKEN}",
            "Content-Type":         "application/json",
            "Accept":               "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }, method="PUT")
        with urlopen(req, timeout=60) as r: return json.loads(r.read())

    def _gh_sha(self, filepath):
        try:
            url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filepath}?ref={GITHUB_BRANCH}"
            req = Request(url, headers={
                "Authorization":        f"Bearer {GITHUB_TOKEN}",
                "Accept":               "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            })
            with urlopen(req, timeout=15) as r:
                return json.loads(r.read()).get("sha")
        except HTTPError as e:
            if e.code == 404:
                return None   # genuinely a new file — no sha needed
            print(f"  ⚠️  SHA lookup failed ({e.code}) for {filepath}: {e.read().decode()}")
            raise
        except Exception as ex:
            print(f"  ⚠️  SHA lookup failed for {filepath}: {ex}")
            raise

    # ── Google Sheets push ────────────────────────────────────
    def _sheets_push(self):
        try:
            # Preflight
            if not GOOGLE_AVAILABLE:
                raise Exception("Google API libraries not installed.\nRun: pip install google-auth google-auth-httplib2 google-api-python-client --break-system-packages")
            key_path = os.path.join(script_dir, SHEETS_KEY_FILE)
            if not os.path.isfile(key_path):
                raise Exception(f"Service account key not found: {SHEETS_KEY_FILE}\nPlace it in: {script_dir}")
            if not SHEETS_ID:
                raise Exception("Google Sheet ID not configured.\nSet SHEETS_ID in launch_golf_scorer.py")

            # Parse payload
            length  = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            season     = payload.get("season", "2026")
            sd         = payload.get("seriesData", {})
            gs_version = payload.get("gsVersion", "")
            if not sd: raise Exception("No series data received.")

            print(f"  Pushing {season} data to Google Sheets... (GS {gs_version})")

            # Auth
            creds  = service_account.Credentials.from_service_account_file(
                key_path, scopes=["https://www.googleapis.com/auth/spreadsheets"])
            svc    = gbuild("sheets","v4",credentials=creds,cache_discovery=False)
            sheets = svc.spreadsheets()

            # Build sheet data
            sheet_data = build_sheets_data(season, sd, gs_version)

            # Get/create sheets
            meta     = sheets.get(spreadsheetId=SHEETS_ID).execute()
            existing = {s["properties"]["title"]: s["properties"]["sheetId"]
                       for s in meta["sheets"]}

            requests = []
            for tab_name, rows in sheet_data.items():
                if tab_name not in existing:
                    # Create new sheet
                    requests.append({"addSheet": {"properties": {"title": tab_name}}})

            if requests:
                sheets.batchUpdate(spreadsheetId=SHEETS_ID,
                                   body={"requests": requests}).execute()
                # Refresh sheet IDs
                meta     = sheets.get(spreadsheetId=SHEETS_ID).execute()
                existing = {s["properties"]["title"]: s["properties"]["sheetId"]
                           for s in meta["sheets"]}

            # Write data to each sheet
            update_requests = []
            for tab_name, rows in sheet_data.items():
                sheet_id = existing.get(tab_name)
                if sheet_id is None: continue

                # Compute actual column count from widest row
                ncols = max((len(r.get("values", [])) for r in rows), default=1)
                nrows = len(rows)

                # Resize grid first so it can hold all columns
                update_requests.append({
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": sheet_id,
                            "gridProperties": {
                                "rowCount":    max(nrows + 5, 50),
                                "columnCount": max(ncols + 2, 26)
                            }
                        },
                        "fields": "gridProperties.rowCount,gridProperties.columnCount"
                    }
                })

                # Clear existing content
                update_requests.append({
                    "updateCells": {
                        "range":  {"sheetId": sheet_id},
                        "fields": "userEnteredValue,userEnteredFormat"
                    }
                })

                # Write rows with explicit column bounds
                update_requests.append({
                    "updateCells": {
                        "range":  {"sheetId": sheet_id,
                                   "startRowIndex": 0, "startColumnIndex": 0,
                                   "endRowIndex": nrows, "endColumnIndex": ncols},
                        "rows":   rows,
                        "fields": "userEnteredValue,userEnteredFormat"
                    }
                })

                # Freeze rows/cols
                freeze_cols = 3 if tab_name == "Raw Data" else 2
                update_requests.append({
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": sheet_id,
                            "gridProperties": {
                                "frozenRowCount":    3 if tab_name == "Raw Data" else 2,
                                "frozenColumnCount": freeze_cols
                            }
                        },
                        "fields": "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
                    }
                })

            if update_requests:
                sheets.batchUpdate(spreadsheetId=SHEETS_ID,
                                   body={"requests": update_requests}).execute()

            sheet_url = f"https://docs.google.com/spreadsheets/d/{SHEETS_ID}"
            print(f"  ✅ Google Sheets updated → {sheet_url}")
            self._json(200, {"success": True, "url": sheet_url})

        except Exception as ex:
            print(f"  ❌ Sheets error: {ex}")
            self._json(500, {"success": False, "error": str(ex)})


# ── Sheet data builder (outside class for clarity) ────────────
def build_sheets_data(season, sd, gs_version=""):
    """Build all sheet tabs as Sheets API row/cell objects."""

    events     = sorted(sd.get("events",[]), key=lambda e: e.get("date",""))
    evt_names  = [e["name"] for e in events]
    ph_all     = sd.get("playerHistory", {})
    players    = sorted(ph_all.keys())

    # ── Color helpers ─────────────────────────────────────────
    def rgb(h):
        h = h.lstrip("#")
        return {"red":int(h[0:2],16)/255,"green":int(h[2:4],16)/255,"blue":int(h[4:6],16)/255}

    GD = rgb("085041"); GM = rgb("0f7a5e"); GLD= rgb("FAC775")
    WH = rgb("FFFFFF"); RA = rgb("f2f8f5")
    PB = rgb("e8f5e9"); PF = rgb("1a6b30")
    NB = rgb("fff0f0"); NF = rgb("a32d2d")
    AB = rgb("fff8e8"); AF = rgb("7a4a00")
    EA = rgb("f0faf6"); EB = rgb("fafffe")
    EH = rgb("0a5c47"); EH2= rgb("147a60")
    GR = rgb("888888"); DM = rgb("aaaaaa")
    BK = rgb("1a1a1a")

    def fmt(fg=None,bg=None,bold=False,italic=False,align="LEFT",
            numfmt=None,sz=10):
        f = {
            "textFormat":{
                "bold":bold,"italic":italic,
                "foregroundColor":fg or BK,
                "fontFamily":"Calibri","fontSize":sz
            },
            "horizontalAlignment":align,
            "verticalAlignment":"MIDDLE",
        }
        if bg: f["backgroundColor"] = bg
        if numfmt: f["numberFormat"] = {"type":"NUMBER","pattern":numfmt}
        return f

    def cv(v, **kw):
        """Create a cell with value and format."""
        f  = fmt(**kw)
        if isinstance(v,(int,float)):
            uev = {"numberValue": v}
        elif v is None or v == "":
            uev = {"stringValue": ""}
        else:
            uev = {"stringValue": str(v)}
        return {"userEnteredValue": uev, "userEnteredFormat": f}

    def hc(v, bg=None, fg=None, bold=True, align="LEFT", sz=10):
        return cv(v, fg=fg or (GLD if bg in [EH,EH2] else WH if bg else WH),
                  bg=bg or GD, bold=bold, align=align, sz=sz)

    def rc(v, bg):
        """Result cell — green/red/neutral."""
        if v is None: return cv("Base", fg=GR, bg=bg, italic=True, align="RIGHT")
        if v>0: return cv(v, fg=PF, bg=PB, bold=True, align="RIGHT", numfmt="+0.0;-0.0;0.0")
        if v<0: return cv(v, fg=NF, bg=NB, align="RIGHT", numfmt="+0.0;-0.0;0.0")
        return cv(v, fg=GR, bg=bg, align="RIGHT", numfmt="0.0")

    def ac(v, bg):
        """Adj cell — amber/red/neutral."""
        if v is None or v=="": return cv("—", fg=GR, bg=bg, align="RIGHT")
        if v>0: return cv(v, fg=AF, bg=AB, align="RIGHT", numfmt="+0.0;-0.0;0.0")
        if v<0: return cv(v, fg=NF, bg=NB, align="RIGHT", numfmt="+0.0;-0.0;0.0")
        return cv(v, fg=GR, bg=bg, align="RIGHT")

    def pc(v, bg, dim=False):
        """Performance cell."""
        if dim or v is None: return cv("—" if v is None else v, fg=DM, bg=bg, align="RIGHT")
        if v>0: return cv(v, fg=PF, bg=PB, bold=True, align="RIGHT", numfmt="+0.0;-0.0;0.0")
        if v<0: return cv(v, fg=NF, bg=NB, align="RIGHT", numfmt="+0.0;-0.0;0.0")
        return cv(v, bg=bg, align="RIGHT", numfmt="0.0")

    def row(*cells):
        return {"values": list(cells)}

    # ── Series performance calculator ─────────────────────────
    def calc_perf(evts):
        scorable = [e for e in evts if e.get("result") is not None]
        if not scorable: return None, None, None
        s = sorted(scorable, key=lambda e: -(e.get("result") or 0))
        best4 = s[:4]; rest = s[4:]
        asgn  = sum(e.get("quota",0) or 0 for e in best4)
        achv  = sum(e.get("actual",0) or 0 for e in best4)
        if rest:
            asgn += sum(e.get("quota",0) or 0 for e in rest)/len(rest)
            achv += sum(e.get("actual",0) or 0 for e in rest)/len(rest)
        return round(achv-asgn,1), round(asgn,1), round(achv,1)

    # ────────────────────────────────────────────────────────────
    # SHEET 1: Raw Data
    # ────────────────────────────────────────────────────────────
    FIXED = 7
    raw = []

    # Row 1: Title
    ver_suffix = f"  ·  GS {gs_version}" if gs_version else ""
    title_cells = [hc(f"{season} BirdieFriends Championship Series — Raw Data{ver_suffix}", sz=13)]
    title_cells += [hc("") for _ in range(FIXED-1 + len(events)*5)]
    raw.append(row(*title_cells))

    # Row 2: Group headers
    grp = [hc("Player"),hc("Tee",align="CENTER"),hc("Played",align="CENTER"),
           hc("Performance",align="RIGHT"),hc("Assigned",align="RIGHT"),
           hc("Achieved",align="RIGHT"),hc("")]
    for i,ev in enumerate(events):
        short = ev["name"].replace("2026 BF","").replace("2025 BF","").strip()
        ebg   = EH if i%2==0 else EH2
        grp.append(hc(short, bg=ebg, align="CENTER", sz=10))
        grp += [hc("", bg=ebg) for _ in range(4)]
    raw.append(row(*grp))

    # Row 3: Sub-headers
    sub = [hc("",bg=GM) for _ in range(FIXED)]
    for i in range(len(events)):
        ebg = EH if i%2==0 else EH2
        for h in ["HCP","Quota","Adj","Achvd","Result"]:
            sub.append(hc(h, bg=ebg, align="RIGHT", sz=9))
    raw.append(row(*sub))

    # Data rows
    for idx,name in enumerate(players):
        ph   = ph_all[name]
        evts = ph.get("events",[])
        bg   = WH if idx%2==0 else RA
        dim  = len(evts) < 4
        perf, asgn, achv = calc_perf(evts)
        flt  = ph.get("seriesFlight") or ph.get("tee","")

        r = [
            cv(name, fg=DM if dim else BK, bg=bg, bold=not dim, italic=dim),
            cv(flt,  fg=DM if dim else GR, bg=bg, align="CENTER"),
            cv(len(evts), fg=DM if dim else GR, bg=bg, align="CENTER"),
            pc(perf, bg, dim),
            cv(asgn if asgn is not None else "—", fg=DM if dim else GR, bg=bg,
               align="RIGHT", numfmt="0.0") if asgn else cv("—",fg=DM,bg=bg,align="RIGHT"),
            cv(achv if achv is not None else "—", fg=DM if dim else GR, bg=bg,
               align="RIGHT", numfmt="0.0") if achv else cv("—",fg=DM,bg=bg,align="RIGHT"),
            cv("", bg=bg),
        ]
        for i,evname in enumerate(evt_names):
            evbg = EA if i%2==0 else EB
            ev   = next((e for e in evts if e.get("eventName")==evname), None)
            if ev:
                hcp   = ev.get("hcp")
                quota = ev.get("quota")
                adj   = ev.get("quotaAdj")
                actual= ev.get("actual","")
                result= ev.get("result")
                r += [
                    cv(hcp if hcp is not None else "—", fg=DM if dim else GR,
                       bg=evbg, align="RIGHT", numfmt="0.0") if hcp is not None
                       else cv("—", fg=DM, bg=evbg, align="RIGHT"),
                    cv(quota if quota is not None else "Base", fg=DM if dim else BK,
                       bg=evbg, bold=not dim, align="RIGHT", numfmt="0.0") if quota is not None
                       else cv("Base", fg=GR, bg=evbg, italic=True, align="RIGHT"),
                    ac(adj, evbg),
                    cv(actual, fg=DM if dim else BK, bg=evbg, bold=not dim,
                       align="RIGHT", numfmt="0"),
                    rc(result, evbg),
                ]
            else:
                r += [cv("", bg=evbg) for _ in range(5)]
        raw.append(row(*r))

    # ────────────────────────────────────────────────────────────
    # STANDINGS helper
    # ────────────────────────────────────────────────────────────
    def standings_rows(title, flight_filter=None):
        rows = []
        hdrs = ["#","Player","Flight","Played","Performance","Assigned","Achieved"]
        alns = ["CENTER","LEFT","CENTER","CENTER","RIGHT","RIGHT","RIGHT"]

        # Title
        tc = [hc(title,sz=12)] + [hc("") for _ in range(len(hdrs)-1)]
        rows.append(row(*tc))
        # Header
        rows.append(row(*[hc(h,bg=GM,align=a) for h,a in zip(hdrs,alns)]))

        # Sort players
        plist = []
        for name in players:
            ph   = ph_all[name]
            evts = ph.get("events",[])
            flt  = ph.get("seriesFlight") or ph.get("tee","")
            if flight_filter and flt != flight_filter: continue
            perf, asgn, achv = calc_perf(evts)
            plist.append((name,perf,asgn,achv,len(evts),flt,len(evts)>=4))
        plist.sort(key=lambda x: (not x[6], -(x[1] or -999)))

        rank = 0
        for idx,(name,perf,asgn,achv,played,flt,qual) in enumerate(plist):
            bg = WH if idx%2==0 else RA
            if qual: rank+=1
            rows.append(row(
                cv("—" if not qual else rank, fg=DM if not qual else GR, bg=bg, align="CENTER"),
                cv(name, fg=DM if not qual else BK, bg=bg, bold=qual, italic=not qual),
                cv(flt,  fg=DM if not qual else GR, bg=bg, align="CENTER"),
                cv(played, fg=DM if not qual else GR, bg=bg, align="CENTER"),
                pc(perf, bg, not qual),
                cv(asgn if asgn else "—", fg=DM if not qual else GR, bg=bg,
                   align="RIGHT", numfmt="0.0") if asgn else cv("—",fg=DM,bg=bg,align="RIGHT"),
                cv(achv if achv else "—", fg=DM if not qual else GR, bg=bg,
                   align="RIGHT", numfmt="0.0") if achv else cv("—",fg=DM,bg=bg,align="RIGHT"),
            ))
        return rows

    return {
        "Raw Data": raw,
        "Standings": standings_rows(f"{season} BirdieFriends Championship — Overall Standings"),
        "Green Flight": standings_rows(f"{season} BirdieFriends — Green Tees", "Green"),
        "Combo Flight": standings_rows(f"{season} BirdieFriends — Combo Tees", "Combo"),
        "Gold Flight":  standings_rows(f"{season} BirdieFriends — Gold Tees",  "Gold"),
    }


# ── Startup ───────────────────────────────────────────────────

# ── GitHub Auto-Pull: fetch latest GolfScorer HTML ───────────
def _pull_latest_gs():
    """Pull latest BF_Golf_Scorer_8.html from GitHub library before serving."""
    import urllib.request, base64, json as _json
    gh_path = "source/BF_Golf_Scorer_8.html"
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{gh_path}?ref={GITHUB_BRANCH}"
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "BFGolfScorer-Launcher"
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = _json.loads(r.read())
        gh_content = base64.b64decode(data["content"]).decode("utf-8")
        local_path = os.path.join(script_dir, "BF_Golf_Scorer_8.html")
        with open(local_path, "w", encoding="utf-8") as f:
            f.write(gh_content)
        # Extract version for display
        import re
        m = re.search(r"GS_VERSION = '([^']+)'", gh_content)
        ver = m.group(1) if m else "unknown"
        return True, ver
    except Exception as ex:
        return False, str(ex)

_pull_ok, _pull_info = _pull_latest_gs()

url = f"http://localhost:{PORT}/{html_file}"
key_found    = os.path.isfile(os.path.join(script_dir, SHEETS_KEY_FILE))
landing_found= os.path.isfile(os.path.join(script_dir, LANDING_PAGE_FILE))

print("=" * 55)
print("  BF Golf Scorer  —  Local Server")
print("=" * 55)
if _pull_ok:
    # Re-detect html_file after pull (in case name changed)
    html_files = sorted([f for f in os.listdir(script_dir)
                         if f.endswith(".html") and "Golf_Scorer" in f and "STABLE" not in f])
    if html_files:
        html_file = html_files[-1]
    print(f"  Serving:  {html_file}")
    print(f"  Updated:  ✅ Pulled from GitHub ({_pull_info})")
else:
    print(f"  Serving:  {html_file}")
    print(f"  Updated:  ⚠️  GitHub pull failed — using local file ({_pull_info})")
print(f"  URL:      {url}")
if TEST_PREVIEW_MODE:
    print(f"  Mode:     ⚠️  PREVIEW (saves to {PREVIEW_FOLDER}/ — no GitHub push)")
else:
    print(f"  Site:     https://birdiefriends.com")
print(f"  Stop:     Ctrl+C")
print("=" * 55)
print(f"\n  ✅ Jotform API configured")
print(f"  ✅ GitHub Pages → birdiefriends.com")
print(f"  {'✅' if landing_found else '⚠ '} Landing page: {LANDING_PAGE_FILE}")
portal_found = os.path.isfile(os.path.join(script_dir, "birdiefriends_portal.html"))
print(f"  {'✅' if portal_found else '⚠ '} Player portal: birdiefriends_portal.html")
print(f"  {'✅' if GOOGLE_AVAILABLE else '⚠ '} Google API libraries {'found' if GOOGLE_AVAILABLE else 'NOT installed'}")
print(f"  {'✅' if key_found else '⚠ '} Sheets key: {SHEETS_KEY_FILE} {'found' if key_found else 'NOT found'}")
print(f"  {'✅' if SHEETS_ID else '⚠ '} Sheet ID: {'configured' if SHEETS_ID else 'NOT set in launcher'}")
print()

# ── Threaded server ────────────────────────────────────────────
# Dev-64 fix: the original socketserver.TCPServer handles ONE request
# at a time. GS fires several proxy calls close together (GHIN Name
# map on every panel open/Apply per Dev-59, plus portal events/regs,
# sheets/netlify status, groupings, scorecard submissions) — while the
# server is still busy on one call, any others queue up, and if a
# single call ever hangs on the network the whole server freezes for
# everyone until the process is killed. That's the "failed to fetch,
# need to relaunch" pattern. ThreadingMixIn handles each request on
# its own thread so one slow/stuck call can't block the rest, and
# allow_reuse_address=True also means a quick relaunch is less likely
# to hit "port already in use" from a not-yet-released socket.
class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

try:
    httpd = ThreadedHTTPServer(("", PORT), ProxyHandler)
except OSError as ex:
    print("=" * 55)
    print(f"  ❌ COULD NOT START — port {PORT} is already in use.")
    print(f"     {ex}")
    print()
    print(f"  This almost always means an OLD Golf Scorer server is still")
    print(f"  running in the background. Chrome would be talking to THAT")
    print(f"  one — not this freshly GitHub-pulled instance — which is")
    print(f"  exactly how you can end up looking at a stale version.")
    print()
    print(f"  Fix: open Task Manager, end any other 'python.exe' process,")
    print(f"  then run Launch_Golf_Scorer.bat again.")
    print("=" * 55)
    input("\n  Press Enter to close...")
    sys.exit(1)

with httpd:
    print(f"  Server running → {url}\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped. Goodbye!")
