import assert from "node:assert/strict";

process.chdir("C:\\tmp");
process.env.OPENAQ_API_KEY = "  test-secret-key  ";
process.env.OPENAQ_BASE_URL = "https://example.test/v3///";
const { inspectOpenAqEnvironment } = await import("../server/config/openAqEnvironment.js");
const { buildOpenAqRequest, classifyOpenAqStatus, getOpenAqBaseUrl, getOpenAqApiKey, openAqKeyFingerprint, OpenAqError } = await import("../server/services/openAqAuthService.js");

assert.equal(getOpenAqApiKey(), "test-secret-key");
assert.equal(getOpenAqBaseUrl(), "https://example.test/v3");
const request = buildOpenAqRequest({ headers: { Authorization: "Bearer should-not-be-used", "X-API-Key": "wrong" } });
const headers = new Headers(request.headers);
assert.equal(headers.get("X-API-Key"), "test-secret-key");
assert.equal(headers.get("Authorization"), "Bearer should-not-be-used");
assert.notEqual(headers.get("Authorization"), `Bearer ${getOpenAqApiKey()}`);
assert.equal(openAqKeyFingerprint("test-secret-key"), openAqKeyFingerprint("test-secret-key"));
assert.notEqual(openAqKeyFingerprint("test-secret-key"), openAqKeyFingerprint("other-key"));
const conflict = inspectOpenAqEnvironment({ processKey: "process-key", dotenvKey: "dotenv-key" });
assert.equal(conflict.conflictDetected, true);
assert.equal(conflict.effectiveSource, "process_environment");
assert.equal(conflict.processEnvironment.fingerprint, openAqKeyFingerprint("process-key"));
assert.equal(conflict.dotenvFile.fingerprint, openAqKeyFingerprint("dotenv-key"));
const matching = inspectOpenAqEnvironment({ processKey: "same-key", dotenvKey: "same-key" });
assert.equal(matching.conflictDetected, false);
delete process.env.OPENAQ_API_KEY;
assert.throws(() => getOpenAqApiKey(), (error: unknown) => error instanceof OpenAqError && error.code === "OPENAQ_NOT_CONFIGURED");
for (const [status, code] of [[401, "OPENAQ_UNAUTHORIZED"], [403, "OPENAQ_FORBIDDEN"], [422, "OPENAQ_INVALID_REQUEST"], [429, "OPENAQ_RATE_LIMITED"], [408, "OPENAQ_TIMEOUT"], [500, "OPENAQ_SERVER_ERROR"]] as const) {
  assert.equal(classifyOpenAqStatus(status).code, code);
}
console.log("OpenAQ auth unit checks passed without a live API call.");
