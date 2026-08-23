import { getAirQualityMap } from "../server/services/airQualityService.js";
import { BRICS_COUNTRIES_CONFIG, findBricsCountry } from "../server/data/bricsCountries.js";

async function runTests() {
  console.log("=== Testing BRICS & Global Multi-Country Air Quality Engine ===");

  // 1. Test Country Config
  console.log("\n[Test 1] Verifying BRICS Countries configuration...");
  if (BRICS_COUNTRIES_CONFIG.length !== 11) {
    throw new Error(`Expected 11 BRICS countries, found ${BRICS_COUNTRIES_CONFIG.length}`);
  }
  for (const country of BRICS_COUNTRIES_CONFIG) {
    if (!country.iso2 || !country.iso3 || !country.name || !country.majorCities.length) {
      throw new Error(`Invalid country config for ${country.name}`);
    }
  }
  console.log(`✓ All ${BRICS_COUNTRIES_CONFIG.length} BRICS countries configured with cities.`);

  // 2. Test findBricsCountry helper
  console.log("\n[Test 2] Verifying findBricsCountry helper...");
  const brazilByIso2 = findBricsCountry("BR");
  const brazilByIso3 = findBricsCountry("BRA");
  const brazilByName = findBricsCountry("Brazil");
  if (!brazilByIso2 || brazilByIso2.iso3 !== "BRA" || brazilByIso3?.iso2 !== "BR" || brazilByName?.name !== "Brazil") {
    throw new Error("findBricsCountry lookup failed for Brazil");
  }
  console.log("✓ Country lookup works seamlessly by ISO-2, ISO-3, and full name.");

  // 3. Test Global BRICS Multi-Country Map
  console.log("\n[Test 3] Testing Global BRICS Map generation...");
  const globalMap = await getAirQualityMap({ global: true });
  if (!globalMap.points || globalMap.points.length === 0) {
    throw new Error("Global map returned zero points");
  }
  console.log(`✓ Global BRICS Map generated ${globalMap.points.length} monitoring points across member nations.`);
  const globalAqiSample = globalMap.points[0];
  console.log(`  Sample Station: ${globalAqiSample.name} (${globalAqiSample.city || "N/A"}) - AQI: ${globalAqiSample.metrics.aqi ?? "N/A"} (${globalAqiSample.category || "N/A"})`);

  // 4. Test Each BRICS Member Country
  console.log("\n[Test 4] Testing individual BRICS country AQI generation...");
  const countriesToTest = ["BRA", "RUS", "CHN", "ZAF", "EGY", "ETH", "IDN", "IRN", "ARE", "SAU"];
  for (const iso of countriesToTest) {
    const countryInfo = findBricsCountry(iso)!;
    const countryMap = await getAirQualityMap({ country: iso });
    if (!countryMap.points || countryMap.points.length === 0) {
      throw new Error(`No air quality points returned for country ${countryInfo.name} (${iso})`);
    }
    const sample = countryMap.points[0];
    const withAqi = countryMap.points.filter((p) => p.metrics.aqi !== undefined);
    console.log(`✓ ${countryInfo.flag} ${countryInfo.name} (${iso}): ${countryMap.points.length} stations, ${withAqi.length} with live AQI. Sample: "${sample.name}" -> AQI ${sample.metrics.aqi ?? "N/A"}`);
  }

  // 5. Test India Map with CPCB + OpenAQ fallback
  console.log("\n[Test 5] Testing India (IND) map generation...");
  const indiaMap = await getAirQualityMap({ country: "IND" });
  if (!indiaMap.points || indiaMap.points.length === 0) {
    throw new Error("India map returned zero points");
  }
  console.log(`✓ 🇮🇳 India (IND): ${indiaMap.points.length} monitoring stations loaded.`);

  console.log("\n=== ALL BRICS & GLOBAL AIR QUALITY TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
