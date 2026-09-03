#requires -version 5.1
<#
BirdieFriends — local one-click publish tool.

v2 (fixes the "[object Object]" incident): the first version built the
request body with ConvertTo-Json, which mishandled the ~900KB portal.html
string and sent the literal text "[object Object]" as the file content
instead of the real HTML -- silently reported success and broke the live
site. This version builds the JSON body by hand (no ConvertTo-Json for the
content field) and -- critically -- reads back the file it just pushed and
byte-compares it to the local copy before ever printing "OK" or deleting
anything. If the live copy doesn't match, it says so loudly and leaves the
local file alone.

v3 (fixes a false-positive mismatch): v2's escaping collapsed CRLF line
endings to a plain \n, so a Windows-authored file with CRLF would push
correctly but then fail its own verification, since the check compared the
live copy against the original (still-CRLF) local file. Now \r and \n are
escaped independently, so line endings survive exactly as authored and
verification compares like for like.

v4 (Dev-73 carry-forward #7): added BF_Session_Log.md to $FileMap so future
session close-outs can be pushed straight from this tool instead of relying
on Claude's classifier-blocked automated /deploy. NOTE: this pushes whatever
the local BF_Session_Log.md file contains as the ENTIRE file -- it replaces
the live log wholesale, it does not append. Always make sure the local copy
already contains the full existing log plus the new entry (fetch-then-append)
before dropping it in this folder to push, never just the new entry alone.

v5 (Dev-74): added BF_Session_Bootstrap.md and deploy.html to $FileMap.
Both were being edited by Claude but had no push path -- dropping them in
this folder would have silently done nothing (not even a warning; only
files not in $FileMap are skipped, without individual notice). Added
alongside the AutoPush folder-connection fix: connecting this folder to a
Claude session now requires an explicit per-session grant (via the desktop
app's Add Folder control, or an explicitly-authorized folder request),
since it doesn't carry over between sessions any more than the device link
itself does.

v6 (Dev-78): the "CONTENT MISMATCH" verification failure was firing as a
false alarm on a real, correctly-landed push (BFE-Admin.html, 134KB) --
the raw CDN just hadn't caught up within the old 6-try/12s window. Widened
the retry window to 10 tries over ~41s with growing gaps, and reworded the
give-up message to say what it actually means (CDN lag, not necessarily a
bad push) instead of asserting a mismatch that may not be real.

v7 (Dev-75): added a self-archiving path for this tool's own source. Added
"bf_push_library.ps1" -> source/bf_push.ps1 to $FileMap so a SNAPSHOT of
this script (dropped under that different filename, never the live
bf_push.ps1) gets pushed to the repo library for durability/reference.
Deliberately NOT mapped under this file's own live name: this tool deletes
the local copy of anything it successfully pushes and verifies, and this
script cannot safely delete itself out from under the process running it.
To archive an update to this tool: save the new script content as
bf_push_library.ps1 next to the live bf_push.ps1/bf_push.bat in this same
folder, run bf_push.bat, confirm it pushes and verifies, then manually
replace the live bf_push.ps1 with the new version yourself (this tool will
never overwrite itself automatically). Also fixed the version banner below,
which had been stuck on "(v5)" for two versions.

v8 (Dev-78 follow-up): BF_Experiences.js's GitHub destination
(source/bf_experiences_worker.js) has a different basename than its local
$FileMap key -- every other entry's local name and destination basename
match, so this was the one place a mismatch could quietly happen, and it
did: Claude repeatedly dropped the file under its destination name,
"bf_experiences_worker.js", which this map didn't recognize, so it just sat
here unrecognized and undeleted (Brian had to clean it up by hand). Added
$CleanupExtras below: once a mapped file's real push verifies, any of its
listed residual filenames sitting in this same folder are deleted too, so a
stray copy from that mistake -- or a repeat of it -- disappears on its own
the next time the correct file is confirmed in the library, instead of
piling up.

Run this by double-clicking bf_push.bat in the same folder. Drop any of the
recognized files below into this same folder and it will push them to
GitHub via the PIN-gated Worker /deploy route, verify each one landed
correctly, and only then delete the local copy.
#>

$WorkerUrl = "https://birdiefriends-push.birdiefriends01.workers.dev/deploy"
$RawBase   = "https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main"
$Pin       = "7797"
$UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# Local filename (must sit next to this script) -> GitHub destination path(s).
$FileMap = [ordered]@{
    "portal.html"            = @("docs/portal.html", "source/portal.html")
    "portal_version.txt"     = @("docs/portal_version.txt", "source/portal_version.txt")
    "worker.js"              = @("source/worker.js")
    "guide.html"             = @("source/guide.html")
    "BF_Golf_Scorer_8.html"  = @("source/BF_Golf_Scorer_8.html")
    "BF_Operations_Guide.md" = @("source/BF_Operations_Guide.md")
    "BF_Experiences.js"      = @("source/bf_experiences_worker.js")
    "BFE-Admin.html"         = @("docs/BFE-Admin.html")
    "BF_Session_Log.md"      = @("source/BF_Session_Log.md")
    "BF_Golf_Scorer_Session_Starter_current.md" = @("source/BF_Golf_Scorer_Session_Starter_current.md")
    "BF_WallyCup_Spec.md"    = @("source/BF_WallyCup_Spec.md")
    "BF_Session_Bootstrap.md" = @("source/BF_Session_Bootstrap.md")
    "deploy.html"            = @("docs/deploy.html")
    # Dev-75: a snapshot filename for archiving THIS tool's own source -- never the
    # live bf_push.ps1 (see the v7 note above for why). Drop an updated copy of this
    # script under this exact filename to push it to the repo library.
    "bf_push_library.ps1"    = @("source/bf_push.ps1")
    "WallyCup_Results_Design_Reference.dc.html" = @("source/WallyCup_Results_Design_Reference.dc.html")
}

# Dev-78 follow-up (v8): local filenames known to be stray leftovers of a
# $FileMap key above -- e.g. dropped under a destination basename instead of
# the key this map actually watches for. Once the KEY's own push verifies
# (confirmed landed in the GitHub library), any of these sitting in this
# same folder are deleted too. Only ever acts after a real, verified push of
# the key itself -- never on its own, and never if that push fails.
$CleanupExtras = @{
    "BF_Experiences.js" = @("bf_experiences_worker.js")
}

# Build a JSON string literal by hand -- no ConvertTo-Json for large content.
# Order matters: escape backslashes first, then everything else, so the
# escape characters we insert don't get re-escaped.
function ConvertTo-JsonStringLiteral {
    param([Parameter(Mandatory)][string]$Text)
    # Escape \r and \n independently (not collapsed to a single \n) so
    # Windows CRLF line endings survive the round trip exactly as authored --
    # verification below compares byte-for-byte against the original file,
    # so anything this function normalizes away would show up as a false
    # "content mismatch" even on a perfectly good push (found Dev-73: a
    # 663-line CRLF file pushed correctly but read as "mismatched" because
    # this function used to collapse CRLF to LF before comparison).
    $t = $Text.Replace('\', '\\')
    $t = $t.Replace('"', '\"')
    $t = $t.Replace("`n", '\n')
    $t = $t.Replace("`r", '\r')
    $t = $t.Replace("`t", '\t')
    return $t
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Found = @()
foreach ($name in $FileMap.Keys) {
    if (Test-Path (Join-Path $ScriptDir $name)) { $Found += $name }
}

Write-Host "BirdieFriends publish tool (v8)" -ForegroundColor Cyan
Write-Host "Folder: $ScriptDir"
Write-Host ""

if ($Found.Count -eq 0) {
    Write-Host "No recognized files found next to this script." -ForegroundColor Yellow
    foreach ($name in $FileMap.Keys) { Write-Host "  - $name" }
    Read-Host "`nPress Enter to close"
    exit
}

Write-Host "Found these files to push:"
foreach ($name in $Found) {
    Write-Host ("  {0,-26} -> {1}" -f $name, ($FileMap[$name] -join ", "))
}
Write-Host ""
$confirm = Read-Host "Push these to birdiefriends.com now? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled. Nothing was pushed."
    Read-Host "`nPress Enter to close"
    exit
}

foreach ($name in $Found) {
    $fullPath = Join-Path $ScriptDir $name
    $content  = Get-Content -Raw -Encoding UTF8 -LiteralPath $fullPath

    $allVerified = $true

    foreach ($ghPath in $FileMap[$name]) {
        Write-Host ""
        Write-Host "Pushing $name -> $ghPath ..." -NoNewline

        $bodyJson = '{"pin":"' + $Pin + '","path":"' + $ghPath + `
            '","content":"' + (ConvertTo-JsonStringLiteral $content) + `
            '","message":"' + (ConvertTo-JsonStringLiteral "Local publish: $name -> $ghPath") + '"}'

        $pushOk = $false
        try {
            $resp = Invoke-RestMethod -Uri $WorkerUrl -Method Post `
                -ContentType "application/json; charset=utf-8" `
                -Headers @{ "User-Agent" = $UserAgent } `
                -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyJson))
            if ($resp.ok) {
                $pushOk = $true
                Write-Host " sent (commit $($resp.commitSha.Substring(0,7))), verifying..." -NoNewline
            } else {
                Write-Host " FAILED: $($resp | ConvertTo-Json -Compress)" -ForegroundColor Red
            }
        } catch {
            Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
            if ($_.Exception.Response) {
                try {
                    $stream = $_.Exception.Response.GetResponseStream()
                    $reader = New-Object System.IO.StreamReader($stream)
                    Write-Host "  Response: $($reader.ReadToEnd())" -ForegroundColor Red
                } catch {}
            }
        }

        if (-not $pushOk) { $allVerified = $false; continue }

        # Verify: re-fetch the raw file and byte-compare to what we sent.
        # GitHub's raw CDN can lag -- usually a couple seconds, but occasionally
        # much longer for bigger files or during busier periods (Dev-78: a
        # 134KB BFE-Admin.html push showed CONTENT MISMATCH here even though
        # the commit had actually landed clean -- the live file matched byte
        # for byte on a manual re-check a minute later. The old 6x2s=12s
        # window just wasn't long enough that time). Now retries longer, with
        # growing gaps between attempts, before actually giving up.
        $verified = $false
        $delays = @(2,2,3,3,5,5,5,8,8,10)  # 41s total across 10 tries
        foreach ($delay in $delays) {
            Start-Sleep -Seconds $delay
            try {
                $rawUrl = "$RawBase/$ghPath`?cb=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
                $fetched = Invoke-RestMethod -Uri $rawUrl -Headers @{ "User-Agent" = $UserAgent }
                if ($fetched -ceq $content) { $verified = $true; break }
            } catch {}
        }

        if ($verified) {
            Write-Host " VERIFIED" -ForegroundColor Green
        } else {
            Write-Host " COULD NOT VERIFY after $($delays.Count) tries (~$(($delays | Measure-Object -Sum).Sum)s) -- commit was accepted, but the raw CDN still isn't showing it yet. This is usually just CDN lag, not a bad push -- re-run this tool in a minute to confirm before assuming anything is wrong." -ForegroundColor Yellow
            $allVerified = $false
        }
    }

    if ($allVerified) {
        Remove-Item -LiteralPath $fullPath -Force
        Write-Host "  -> all destinations verified. Deleted local copy of $name." -ForegroundColor DarkGray

        # Dev-78 follow-up (v8): clean up any known-residual filenames for
        # this key now that its real push is confirmed in the library.
        if ($CleanupExtras.ContainsKey($name)) {
            foreach ($extra in $CleanupExtras[$name]) {
                $extraPath = Join-Path $ScriptDir $extra
                if (Test-Path $extraPath) {
                    Remove-Item -LiteralPath $extraPath -Force
                    Write-Host "  -> also removed residual '$extra' (superseded by this confirmed push)." -ForegroundColor DarkGray
                }
            }
        }
    } else {
        Write-Host "  -> KEEPING local copy of $name -- not all destinations verified. Fix and re-run." -ForegroundColor Yellow
    }
}

Write-Host ""
Read-Host "Done. Press Enter to close"
