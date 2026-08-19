import { readFile } from "node:fs/promises";

const map = await readFile("src/components/LocalLeafletMap.tsx", "utf8");
const workspace = await readFile("src/components/MapWorkspace.tsx", "utf8");
const toolbar = await readFile("src/components/CpcbLayerPanel.tsx", "utf8");
const nearby = await readFile("src/pages/NearbyPage.tsx", "utf8");

const required = [
  [workspace, "isAirMode", "Workspace must know when Air mode is active"],
  [workspace, "${isAirMode ? \"hidden\" : \"\"}", "Ranked rail must be hidden in Air mode"],
  [workspace, "onModeChange={setMapMode}", "Map mode must be lifted to the workspace"],
  [map, "type PublicMapMode = \"situations\" | \"reports\" | \"air\"", "Public modes must be Situations, Reports, and Air"],
  [map, "dedupePhysicalStations", "CPCB/OpenAQ physical stations must be deduplicated"],
  [map, "mode === \"air\" ? allStationPoints.filter", "Air must filter stations to AQI-ready stations"],
  [map, "status === \"indicative_available\"", "Indicative AQI must be visible without an opt-in"],
  [map, "zoom <= 5 ? 6 : 1.5", "National and regional zooms must aggregate stations"],
  [map, "zoom >= 9", "Local zoom must show individual stations"],
  [map, "StationClusterMarker", "Clusters must be distinct from station selection"],
  [map, "×${count}", "Cluster labels must visibly represent station count"],
  [map, "Median", "Cluster median must be displayed separately from count"],
  [map, "aqiQualityLabel", "Individual markers must carry AQI quality metadata"],
  [toolbar, "processingAqi", "Partial national coverage must be disclosed"],
  [toolbar, "selectedDisplayStations", "AQI display count must be visible"],
  [map, "setLegendOpen(false)", "Mode changes must close the legend"],
  [map, "stateAqiLabelIcon", "State-code marker labels must be removed"],
  [toolbar, "aqiStationDisclaimer", "The AQI station disclaimer must be visible"]
  , [nearby, "getAqiStatus", "Nearby must poll current AQI status"]
  , [nearby, "setMapLayer(refreshedMap)", "Nearby must replace the map when AQI coverage changes"]
  , [nearby, "setTimeout(() => void poll(), 3500)", "AQI polling must continue while synchronization is active"]
];

for (const [source, token, message] of required) {
  if (token === "stateAqiLabelIcon") {
    if (source.includes(token)) throw new Error(message);
  } else if (!source.includes(token)) {
    throw new Error(message);
  }
}

if (/cpcb-station-missing|<span>—<\/span>/.test(map)) throw new Error("Missing stations must not render grey minus markers");
if (/metrics\[[^\]]+\]\s*\|\|\s*0/.test(map)) throw new Error("Missing station metrics must not become zero");
if (toolbar.includes("selectedMetric") || toolbar.includes("setSelectedMetric") || toolbar.includes("role=\"menu\"")) throw new Error("Public Air controls must remain AQI-only");
if (workspace.includes("<SituationRail") && !workspace.includes("${isAirMode ? \"hidden\" : \"\"}")) throw new Error("Situation rail is not guarded by Air mode");

console.log("Air map layout assertions passed.");
