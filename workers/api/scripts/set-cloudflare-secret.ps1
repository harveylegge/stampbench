# Puts PAYPAL_SECRET into the Cloudflare Pages project (stampbench).
#
# Same visible Notepad handoff as run-paypal-setup.ps1, because it is the one
# flow that survived contact with reality. The secret is piped straight into
# wrangler's stdin and the temp file is deleted; nothing is echoed.

$secretFile = Join-Path $env:USERPROFILE "paypal-secret.txt"

Write-Host ""
Write-Host "Opening Notepad. Paste your PayPal secret into it (same key as before),"
Write-Host "save with Ctrl+S and close Notepad."
Write-Host ""

Set-Content -Path $secretFile -Value "" -Encoding ascii
Start-Process -FilePath notepad.exe -ArgumentList $secretFile -Wait

if (-not (Test-Path $secretFile)) { Write-Host "File gone - nothing sent."; exit 1 }
$secret = (Get-Content -Path $secretFile -Raw).Trim() -replace '^﻿', ''
Remove-Item -Path $secretFile -Force

if (-not $secret) { Write-Host "File was empty - nothing sent. Run again."; exit 1 }
if ($secret -match '\s' -or $secret.Length -lt 40) {
  Write-Host ("Read length {0} with{1} whitespace - that looks like a bad paste. Run again." -f $secret.Length, $(if ($secret -match '\s') { "" } else { "out" }))
  exit 1
}

Write-Host ("Read a secret of length {0}. Sending to Cloudflare..." -f $secret.Length)
$secret | npx -y wrangler pages secret put PAYPAL_SECRET --project-name=stampbench
