[CmdletBinding()]
param(
  [string]$ReportId,
  [string]$Photo,
  [double]$Lat,
  [double]$Lng,
  [string]$CapturedAt,
  [string]$PollutionType
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if ((Get-Location).Path -ne $repoRoot) { Set-Location $repoRoot }
if (-not (Test-Path (Join-Path $repoRoot "package.json"))) { throw "Run this script from the repository root or keep it inside scripts/." }

$envFile = Join-Path $repoRoot ".env"
if (-not (Test-Path $envFile)) { throw "Missing .env. Copy .env.example and configure Sentinel Hub credentials locally." }
$envValues = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') { $envValues[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'") }
}
if ([string]::IsNullOrWhiteSpace($envValues.SENTINEL_HUB_CLIENT_ID) -or [string]::IsNullOrWhiteSpace($envValues.SENTINEL_HUB_CLIENT_SECRET)) { throw "Sentinel Hub client credentials are missing from .env." }
if ($envValues.SENTINEL_HUB_CLIENT_ID -match 'your_|placeholder|account-id' -or $envValues.SENTINEL_HUB_CLIENT_SECRET -match 'your_|placeholder') { throw "Sentinel Hub credentials are still placeholders." }
$envValues.GetEnumerator() | ForEach-Object { Set-Item -Path "Env:$($_.Key)" -Value $_.Value }

if ($Photo -and -not (Test-Path -LiteralPath $Photo)) { throw "Photo does not exist: $Photo" }
if ($Photo -and ((-not $PSBoundParameters.ContainsKey("Lat")) -or (-not $PSBoundParameters.ContainsKey("Lng")) -or [string]::IsNullOrWhiteSpace($CapturedAt) -or [string]::IsNullOrWhiteSpace($PollutionType))) { throw "Explicit photo validation requires --Lat, --Lng, --CapturedAt, and --PollutionType." }

$arguments = @()
if ($ReportId) { $arguments += @("--report-id", $ReportId) }
if ($Photo) { $arguments += @("--photo", (Resolve-Path -LiteralPath $Photo).Path, "--lat", $Lat, "--lng", $Lng, "--captured-at", $CapturedAt, "--pollution-type", $PollutionType) }
npm run verify:sentinel-e2e -- @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
