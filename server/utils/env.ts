export function validateEnv() {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is missing. Report verification requests will return a controlled unavailable response.");
  }
  if (!process.env.DATA_GOV_API_KEY) {
    console.warn("DATA_GOV_API_KEY is missing. CPCB/data.gov.in fallback will be skipped.");
  }
  if (!process.env.OPENAQ_API_KEY) {
    console.warn("OPENAQ_API_KEY is missing. OpenAQ supplementary station context will be skipped.");
  }
  if (!process.env.OPENAQ_BASE_URL) {
    process.env.OPENAQ_BASE_URL = "https://api.openaq.org/v3";
  }
  if (!process.env.OPENAQ_LOCATION_CACHE_TTL_MINUTES) {
    process.env.OPENAQ_LOCATION_CACHE_TTL_MINUTES = "1440";
  }
  if (!process.env.OPENAQ_LATEST_CACHE_TTL_MINUTES) {
    process.env.OPENAQ_LATEST_CACHE_TTL_MINUTES = "10";
  }
  if (!process.env.OPENAQ_HISTORY_CACHE_TTL_MINUTES) {
    process.env.OPENAQ_HISTORY_CACHE_TTL_MINUTES = "60";
  }
  if (!process.env.ENABLE_FIREBASE_STORAGE) {
    process.env.ENABLE_FIREBASE_STORAGE = "false";
  }
  if (!process.env.AQI_CURRENT_CACHE_TTL_MINUTES) process.env.AQI_CURRENT_CACHE_TTL_MINUTES = "10";
  if (!process.env.AQI_FORECAST_CACHE_TTL_MINUTES) process.env.AQI_FORECAST_CACHE_TTL_MINUTES = "30";
  if (!process.env.AQI_SEARCH_RADIUS_KM) process.env.AQI_SEARCH_RADIUS_KM = "25";
  if (!process.env.AQI_FRESH_HOURS) process.env.AQI_FRESH_HOURS = "3";
  if (!process.env.AQI_USABLE_HOURS) process.env.AQI_USABLE_HOURS = "12";
  if (!process.env.AQI_MAX_AGE_HOURS) process.env.AQI_MAX_AGE_HOURS = "24";
  if (!process.env.AQI_HISTORY_DAYS) process.env.AQI_HISTORY_DAYS = "7";
  if (!process.env.AQI_FORECAST_MIN_HISTORY_HOURS) process.env.AQI_FORECAST_MIN_HISTORY_HOURS = "72";
  if (!process.env.CPCB_CACHE_TTL_MINUTES) {
    process.env.CPCB_CACHE_TTL_MINUTES = "60";
  }
  if (!process.env.CPCB_PAGE_LIMIT) {
    process.env.CPCB_PAGE_LIMIT = "1000";
  }
  if (!process.env.CPCB_MAX_PAGES) {
    process.env.CPCB_MAX_PAGES = "25";
  }
  if (!process.env.CPCB_RESOURCE_ID) {
    process.env.CPCB_RESOURCE_ID = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";
  }
  if (!process.env.GEMINI_TIMEOUT_MS) {
    process.env.GEMINI_TIMEOUT_MS = "45000";
  }
  if (!process.env.GEMINI_MAX_RETRIES) {
    process.env.GEMINI_MAX_RETRIES = "2";
  }
  if (!process.env.GEMINI_THINKING_BUDGET) {
    process.env.GEMINI_THINKING_BUDGET = "0";
  }
  if (!process.env.API_RATE_LIMIT_PER_HOUR) {
    process.env.API_RATE_LIMIT_PER_HOUR = process.env.NODE_ENV === "production" ? "300" : "500";
  }
  if (!process.env.CPCB_RESOURCE_ID) {
    process.env.CPCB_RESOURCE_ID = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";
  }
  if (!process.env.GEMINI_TIMEOUT_MS) {
    process.env.GEMINI_TIMEOUT_MS = "45000";
  }
  if (!process.env.GEMINI_MAX_RETRIES) {
    process.env.GEMINI_MAX_RETRIES = "2";
  }
  if (!process.env.SENTINEL_HUB_BASE_URL) process.env.SENTINEL_HUB_BASE_URL = "https://services.sentinel-hub.com";
  if (!process.env.SENTINEL_HUB_TOKEN_URL) process.env.SENTINEL_HUB_TOKEN_URL = "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token";
  if (!process.env.SENTINEL_HUB_REQUEST_TIMEOUT_MS) process.env.SENTINEL_HUB_REQUEST_TIMEOUT_MS = "30000";
  if (!process.env.SENTINEL_HUB_MAX_ATTEMPTS) process.env.SENTINEL_HUB_MAX_ATTEMPTS = "3";
  if (!process.env.SENTINEL_HUB_VERIFY_CONCURRENCY) process.env.SENTINEL_HUB_VERIFY_CONCURRENCY = "1";
  if (!process.env.SENTINEL_HUB_DEFAULT_AOI_RADIUS_METERS) process.env.SENTINEL_HUB_DEFAULT_AOI_RADIUS_METERS = "500";
  if (!process.env.SENTINEL_HUB_MAX_AOI_RADIUS_METERS) process.env.SENTINEL_HUB_MAX_AOI_RADIUS_METERS = "1500";
  if (!process.env.SENTINEL_HUB_MAX_TILE_CLOUD_COVER) process.env.SENTINEL_HUB_MAX_TILE_CLOUD_COVER = "60";
  if (!process.env.SENTINEL_HUB_MAX_LOCAL_CLOUD_PERCENT) process.env.SENTINEL_HUB_MAX_LOCAL_CLOUD_PERCENT = "35";
  if (!process.env.SENTINEL_HUB_MIN_VALID_PIXEL_PERCENT) process.env.SENTINEL_HUB_MIN_VALID_PIXEL_PERCENT = "60";
  if (!process.env.SENTINEL_HUB_NEAR_WINDOW_DAYS) process.env.SENTINEL_HUB_NEAR_WINDOW_DAYS = "3";
  if (!process.env.SENTINEL_HUB_BASELINE_LOOKBACK_DAYS) process.env.SENTINEL_HUB_BASELINE_LOOKBACK_DAYS = "45";
  if (!process.env.SENTINEL_HUB_FOLLOWUP_DAYS) process.env.SENTINEL_HUB_FOLLOWUP_DAYS = "14";
  if (!process.env.SENTINEL_HUB_MAX_CATALOG_PAGES) process.env.SENTINEL_HUB_MAX_CATALOG_PAGES = "10";
  if (!process.env.SENTINEL_HUB_MAX_CANDIDATES) process.env.SENTINEL_HUB_MAX_CANDIDATES = "40";
  if (!process.env.SENTINEL_HUB_CACHE_TTL_MINUTES) process.env.SENTINEL_HUB_CACHE_TTL_MINUTES = "1440";
  if (!process.env.ENABLE_SENTINEL_DEBUG_ROUTES) process.env.ENABLE_SENTINEL_DEBUG_ROUTES = "false";
  if (!process.env.GEMINI_THINKING_BUDGET) {
    process.env.GEMINI_THINKING_BUDGET = "0";
  }
  if (!process.env.API_RATE_LIMIT_PER_HOUR) {
    process.env.API_RATE_LIMIT_PER_HOUR = process.env.NODE_ENV === "production" ? "300" : "500";
  }
  if (!process.env.REPORT_RATE_LIMIT_PER_HOUR) {
    process.env.REPORT_RATE_LIMIT_PER_HOUR = process.env.NODE_ENV === "production" ? "30" : "60";
  }
  if (!process.env.AI_RATE_LIMIT_PER_HOUR) {
    process.env.AI_RATE_LIMIT_PER_HOUR = "30";
  }
  if (!process.env.PORT) {
    process.env.PORT = "8787";
  }
  if (process.env.ENABLE_SENTINEL_HUB_VERIFICATION === "true") {
    if (!process.env.SENTINEL_HUB_CLIENT_ID || !process.env.SENTINEL_HUB_CLIENT_SECRET) {
      console.warn("ENABLE_SENTINEL_HUB_VERIFICATION is true but credentials are missing. Satellite verification will be disabled.");
    }
  }
}
