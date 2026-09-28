# Launcher for paypal-setup.mjs — file-based secret handoff.
#
# Third iteration. The masked Read-Host prompt looked secure but was blind:
# a paste that silently failed produced the same black screen as one that
# worked, which cost two rotations and three 401s. This version lets the
# secret be pasted somewhere *visible* (Notepad), then reads, uses and
# deletes the file. The file lives outside the repo so it can never be
# committed, and it exists for seconds.

$secretFile = Join-Path $env:USERPROFILE "paypal-secret.txt"
$env:PAYPAL_CLIENT_ID = "BAA82jnc47ANdF8cKORbkSvbn2BFhZvciea0KXxSTd11G6XXMeGWm9h_NQ8vcs6XZq6ieOsipLte3gpgVM"

Write-Host ""
Write-Host "Opening Notepad. Paste your PayPal secret into it (you will SEE it paste),"
Write-Host "then save with Ctrl+S and close Notepad. The file deletes itself after use."
Write-Host ""

# Pre-create empty file so Notepad opens it directly and Ctrl+S needs no dialog.
Set-Content -Path $secretFile -Value "" -Encoding ascii
Start-Process -FilePath notepad.exe -ArgumentList $secretFile -Wait

if (-not (Test-Path $secretFile)) {
  Write-Host "The file is gone - nothing was run. Start again when ready."
  exit 1
}

# Trim everything invisible: BOM, spaces, newlines - stray whitespace from a
# paste is one of the classic causes of an invalid_client 401.
$secret = (Get-Content -Path $secretFile -Raw).Trim() -replace '^﻿', ''
Remove-Item -Path $secretFile -Force

if (-not $secret) {
  Write-Host "The file was empty - nothing was run. Start again and paste before saving."
  exit 1
}
if ($secret -match '\s') {
  Write-Host "The pasted secret contains spaces or line breaks in the middle - that is a"
  Write-Host "partial or doubled paste. Copy it again with the copy icon and retry."
  exit 1
}

# Sanity-check the shape without ever printing the value.
Write-Host ("Read a secret of length {0}. Running setup..." -f $secret.Length)
if ($secret.Length -lt 40) {
  Write-Host "That looks too short for a PayPal secret (~80 chars) - likely a partial copy."
  Write-Host "Copy it again with the copy icon and retry."
  exit 1
}

$env:PAYPAL_SECRET = $secret
node "$PSScriptRoot\paypal-setup.mjs" @args
