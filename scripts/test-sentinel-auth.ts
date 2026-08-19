import "dotenv/config";
import { getSentinelHubAuthStatus, testTokenCheck } from "../server/services/sentinelHubAuthService.js";

const before = await getSentinelHubAuthStatus();
if (!before.enabled) {
  console.log(JSON.stringify({
    enabled: false,
    provider: before.provider,
    configured: false,
    configurationValid: before.configurationValid,
    authenticationSuccessful: false,
    authenticationStatus: "disabled",
    authenticationErrorCode: before.authenticationErrorCode,
    baseEndpointHost: before.baseEndpointHost,
    tokenEndpointHost: before.tokenEndpointHost
  }, null, 2));
  process.exit(0);
}

const check = await testTokenCheck(true);
const after = await getSentinelHubAuthStatus();
const output = {
  enabled: after.enabled,
  provider: after.provider,
  configured: after.configured,
  configurationValid: after.configurationValid,
  authenticationSuccessful: check.ok,
  authenticationStatus: check.status,
  authenticationErrorCode: check.ok ? null : check.errorCode || null,
  baseEndpointHost: after.baseEndpointHost,
  tokenEndpointHost: after.tokenEndpointHost,
  tokenExpiresInSeconds: check.ok ? check.tokenExpiresInSeconds : undefined,
  ...(check.ok ? {} : {
    note: check.status === "network_error" || check.status === "timeout"
      ? "Run this verification from the host machine when sandbox networking is restricted."
      : check.status === "authentication_failed"
        ? "The provider rejected the configured OAuth client."
        : "Sentinel provider configuration or authentication requires attention."
  })
};
console.log(JSON.stringify(output, null, 2));
if (check.ok) process.exit(0);
process.exit(check.status === "network_error" || check.status === "timeout" ? 2 : 1);
