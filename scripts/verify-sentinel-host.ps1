param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Test-Path ".env")) {
  Write-Error "Missing .env. Create it from .env.example and keep credentials local."
  exit 1
}

$tsx = Join-Path $projectRoot "node_modules\.bin\tsx.cmd"
if (-not (Test-Path $tsx)) {
  Write-Error "Missing project-local tsx binary. Install project dependencies first."
  exit 1
}

function Invoke-SentinelCheck([string]$scriptPath) {
  & $tsx $scriptPath
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# The scripts emit only safe provider status, never OAuth credentials or tokens.
Invoke-SentinelCheck "scripts\test-sentinel-auth.ts"
$env:SENTINEL_DEBUG_RESPONSE_DETAILS = "true"
Invoke-SentinelCheck "scripts\verify-sentinel-live.ts"
Invoke-SentinelCheck "scripts\verify-sentinel-e2e.ts"
Write-Host "Sentinel host verification completed."
exit 0
