# CleanAir Sentinel Agent Context

Use this file as the first-stop project context for future Codex work in this
repo.

## Current Task Context

- Repository: `AntiDynamic/cleanair-local-sentinel`
- Branch: `feature/accessibility-completion`
- Expected starting commit: `727ff2504f270dff5144f6768657ae789f3625ee`
- Focused task: add centralized, type-safe report DTOs and serializers before
  API route migration begins.
- Do not repeat the earlier security audit.
- Do not begin route authorization or report-route migration in this task.
- Do not push.

Before editing, verify:

```bash
git status
git branch --show-current
git rev-parse HEAD
git log --oneline --decorate -6
git diff --check
npm run typecheck
```

Preserve newer commits if HEAD has advanced.

## Existing Security Work To Preserve

The branch already contains:

- Firebase Bearer-token verification
- typed `req.auth`
- strict role resolution
- server-side demo role overrides
- reusable role middleware
- `GET /api/auth/me`
- legacy `POST /api/reports/:id/resolve` returning HTTP 410

Do not modify or revert those systems unless explicitly asked.

## Areas To Avoid For This DTO Task

Do not modify unrelated:

- frontend UI
- camera capture
- AQI
- Sentinel
- Gemini
- accessibility
- Municipal UI
- Officer UI
- notifications
- SLA
- map features
- `.codex-*.log` files
- generated `dist-server` files

## Relevant Files

Inspect these before implementing report DTOs:

- `src/types.ts`
- `server/types.ts`
- `server/routes/reports.ts`
- `server/services/reportStore.ts`
- `src/utils/mediaUrl.ts`
- `server/services/mediaStorageService.ts`

Likely new files:

- `server/dto/reportDtos.ts`
- `server/serializers/reportSerializers.ts`
- focused serializer tests, using the existing test tooling

## DTO Requirements

Create explicit public contracts. Do not expose the internal
`PollutionReport` shape directly, do not use `any`, do not use unknown field
spreading, and do not make `Omit<PollutionReport, ...>` the final public
contract.

Required DTOs:

- `PublicReportDto`
- `CitizenReportDto`
- `MunicipalReportDto`
- `OfficerReportDto`

Required serializers:

- `toPublicReportDto(report)`
- `toCitizenReportDto(report)`
- `toMunicipalReportDto(report)`
- `toOfficerReportDto(report)`
- array helpers if useful

Serializers must not mutate the original report object.

## Privacy Rules

Public DTO may expose only safe public report data:

- `id`
- approximate coordinates as `approximateLat` and `approximateLng`
- approximate locality
- pollution type, severity, priority, public status
- `createdAt`
- safe thumbnail or public image URL when available
- situation/hotspot relationship when available
- nearby/corroboration count when available

Public DTO must not expose exact coordinates, GPS accuracy, capture location,
citizen identity, user IDs, image hashes, storage paths/buckets, private logs,
private status-history notes, raw Gemini payloads, trust level, internal
evidence flags, Municipal/Officer actor IDs, private notes, or debug metadata.

Coordinate approximation should be deterministic: round latitude and longitude
to three decimal places. Keep stored coordinates unchanged.

Citizen DTO is for a user's own report and may expose own exact coordinates,
GPS accuracy when present, citizen-safe progress/status history, Municipal
progress, cleanup-proof state, after-cleanup image after submission, final
resolution information, evidence score, safe citizen evidence URL, and public
summary. It must not expose private Officer notes, auth metadata, raw hashes,
raw debug data, or unrestricted Gemini payloads.

Municipal DTO is for assigned field-work cases and may expose exact work
coordinates, GPS accuracy, locality, pollution type, priority, hotspot score,
before evidence URL, public description, assignment status/time/team display
name, workflow stage, Municipal progress history, cleanup proof, action taken,
cleanup note, and proof-submission state. It must not expose citizen UID,
private Officer notes, raw Gemini debugging payloads, raw image hashes, storage
implementation details, credentials, or unrelated action history.

Officer DTO may expose authorized operational context such as exact
coordinates, evidence, verification summary, evidence score, trust level,
priority, hotspot score, nearby reports, AQI/Sentinel context, assignment,
Municipal progress, cleanup proof, before/after data, action/status history,
resolution information, and internal review recommendation. It still must not
blindly return the database object or expose tokens, API keys, env config,
secret storage credentials, service-account data, or unnecessary private auth
claims.

## Status And Legacy Handling

Add reusable helpers where useful:

- `toCitizenFacingStatus(report)`
- `sanitizeCitizenStatusHistory(history)`
- `sanitizeMunicipalHistory(history)`

Citizen-facing statuses should map internal workflow terms into categories such
as `Submitted`, `In Progress`, `Cleanup Proof Submitted`, and `Resolved`.
Avoid exposing internal review terminology, internal trust flags, or internal
AI rejection states.

Serializers must tolerate missing legacy fields:

- `actionLog`
- `statusHistory`
- `cleanupProof`
- `resolutionProof`
- media
- GPS accuracy
- nearby data
- Sentinel data

Do not fabricate unknown data. Return `null` or omit optional values when the
source value is unknown.

## Test Expectations

Add focused deterministic serializer tests with fixtures containing exact
coordinates, GPS accuracy, `userId`, image hashes, media metadata, action logs,
status history, Gemini analysis, trust level, Municipal assignment, cleanup
proof, Officer resolution, Sentinel context, and AQI context.

Cover:

- public approximation and privacy exclusions
- citizen exact own evidence plus sanitized progress
- Municipal assigned-work fields plus privacy exclusions
- Officer operational fields plus secret/config exclusions
- incomplete legacy records do not throw and do not fabricate values
- original report object is not mutated

Use the existing test runner; do not add a large new framework just for this.

## Validation

For the DTO task, run:

```bash
npm run typecheck
npm run build
npm run smoke:test
git diff --check
```

Also run the new serializer tests. Do not claim a command passed unless it
actually ran.

## Commit

After required tests pass, commit with:

```bash
git commit -m "Add safe role-specific report DTO serializers"
```

Do not push.

Final report should include starting commit, files added/modified, DTO fields,
privacy-sensitive fields excluded, coordinate approximation method,
legacy-record handling, tests added, exact commands run, pass/fail/skipped
status, remaining limitations, commit SHA, and push status.
