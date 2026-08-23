# Troubleshooting

This document outlines common errors you might encounter while developing, testing, or demoing the CleanAir Sentinel application, and how to resolve them.

## 1. Map Not Loading or Showing Gray Tiles
**Error**: The Leaflet map shows a gray background, or tiles fail to load with a `403 Forbidden` error in the console.
**Solution**: 
- Ensure you have a valid internet connection (it loads tiles from OpenStreetMap).
- Check your `.env` for `VITE_MAP_PROVIDER=leaflet`.

## 2. API Returning 500 on Report Submission
**Error**: Submitting a report hangs or returns `Internal Server Error`.
**Solution**:
- Ensure `GEMINI_API_KEY` is set in your `.env`. The backend fails if the AI model cannot process the incoming text.
- If running locally, check if the `storage/` or `/tmp/media` folder is writable. The server needs to temporarily write uploaded images.

## 3. "No Sentinel Hub Token" or "Auth Failed"
**Error**: In the terminal, the backend logs `Sentinel Hub Auth Failed`.
**Solution**:
- Ensure `SENTINEL_HUB_CLIENT_ID` and `SENTINEL_HUB_CLIENT_SECRET` are correct.
- If you do not have a Sentinel account, the app will safely bypass this and mark the report as "Satellite evidence unavailable". This is completely expected and will not crash the app.

## 4. Port 8080 or 8787 is already in use
**Error**: `EADDRINUSE: address already in use :::8080`
**Solution**:
- Another process is using the port. Kill it, or change the `PORT` variable in your `.env`.

## 5. Cannot deploy to Cloud Run / Firebase Functions
**Error**: `Your project must be on the Blaze plan...`
**Solution**:
- To deploy the Express backend to Google Cloud or Firebase, Google strictly requires a Billing Account linked to the project.
- *Hackathon Fix*: Deploy the exact same repository to **Render** or **Netlify** for a completely free backend deployment that requires no credit card.

## 6. OpenAQ returns 401 Unauthorized

OpenAQ credentials are loaded from the repository-root `.env` by `dotenv/config` before the server imports its routes. The backend sends the trimmed value as `X-API-Key`; it does not use a bearer token or expose an OpenAQ frontend variable.

PowerShell variables are separate: `$key` is an ordinary shell variable, while `$env:OPENAQ_API_KEY` is inherited by Node child processes. A stale user or machine environment variable can override the repository `.env` value because dotenv does not normally overwrite an existing process variable.

Check only safe metadata, never the secret itself:

```powershell
function Get-KeyFingerprint([string]$value) {
  if (!$value) { return $null }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($value.Trim())
  $hash = [System.Security.Cryptography.SHA256]::HashData($bytes)
  return ([Convert]::ToHexString($hash)).ToLower().Substring(0, 12)
}

[PSCustomObject]@{
  EnvironmentLength = if ($env:OPENAQ_API_KEY) { $env:OPENAQ_API_KEY.Trim().Length } else { 0 }
  EnvironmentFingerprint = Get-KeyFingerprint $env:OPENAQ_API_KEY
}

npm run test:openaq-key
```

The diagnostic compares the inherited process value with the repository `.env` value by length and SHA-256 fingerprint only. It refuses to send a request when they conflict. For development-only proof, run `node scripts/test-openaq-key.mjs --source=dotenv` or `--source=process`.

After changing the key, stop the backend and close the terminal, open a fresh terminal, then run `npm run test:openaq-key`. Verify `/api/air-quality/openaq/status?check=true`. A direct 200 and backend 401 means the backend is stale or using a different process value. A 429 is rate limiting, not an invalid key.

If a stale user-level variable was intentionally created for this project, inspect or remove it without printing its value:

```powershell
$userKey = [Environment]::GetEnvironmentVariable("OPENAQ_API_KEY", "User")
[PSCustomObject]@{
  Configured = -not [string]::IsNullOrWhiteSpace($userKey)
  Length = if ($userKey) { $userKey.Trim().Length } else { 0 }
  Fingerprint = Get-KeyFingerprint $userKey
}
# Only remove it if you intentionally created it for this project:
[Environment]::SetEnvironmentVariable("OPENAQ_API_KEY", $null, "User")
```

Do not remove a machine-level variable unless you own and intend to change it. Always restart the backend after changing persistent environment variables.

## 7. National air coverage is partial

`GET /api/air-quality/national-status` separates CPCB pagination completeness from OpenAQ metadata/latest synchronization. A partial result is expected while the bounded OpenAQ snapshot is refreshing; the public map says “Coverage still synchronizing” and does not claim the visible count is the national total. Run `npm run verify:air-national` for a credential-free audit summary.

If CPCB stops with `repeated_page_before_total`, `empty_page_after_total`, or `hard_safety_cap_reached`, treat the snapshot as incomplete. Inspect the provider's effective `limit`, total, offset, and response behavior before changing the emergency cap.

## 8. A pollutant is missing or has no coloured marker

The normal map requires a finite, non-negative, timestamped average with compatible units and fresh/usable age. Maximum-only, minimum-only, stale, expired, invalid, and unknown-timestamp values remain excluded from current markers. CPCB `pollutant_avg` also has an unverified averaging period, so it is not treated as official-style AQI input. A missing pollutant can be a genuine source limitation, not an extraction failure.
