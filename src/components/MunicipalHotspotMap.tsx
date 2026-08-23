import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { PollutionReport } from "../types";
import { reportPhotoUrl } from "../utils/mediaUrl";

function RefreshMap({ lat, lng, recenter }: { lat: number; lng: number; recenter: number }) {
  const map = useMap();
  useEffect(() => { const timer = window.setTimeout(() => map.invalidateSize(), 0); return () => window.clearTimeout(timer); }, [map]);
  useEffect(() => { map.setView([lat, lng], 16); }, [lat, lng, recenter, map]);
  return null;
}

export function MunicipalHotspotMap({ report, recenter, onTilesError }: { report: PollutionReport; recenter: number; onTilesError: () => void }) {
  return <MapContainer center={[report.lat, report.lng]} zoom={16} scrollWheelZoom className="h-[300px] w-full md:h-[400px]" aria-label="Reported hotspot map">
    <RefreshMap lat={report.lat} lng={report.lng} recenter={recenter} />
    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: onTilesError }} />
    <CircleMarker center={[report.lat, report.lng]} radius={12} pathOptions={{ color: "#34d399", fillColor: "#10b981", fillOpacity: 0.85 }}>
      <Popup><div className="space-y-1 text-sm"><b>{report.areaText}</b><p className="capitalize">{report.gemini.pollution_type.replace(/_/g, " ")} hotspot</p><p>Hotspot Score: {report.hotspotScore}</p><p>Status: {report.status}</p><p>Reported: {new Date(report.createdAt).toLocaleString()}</p>{report.captureEvidence?.captureLocation?.accuracyMeters && <p>GPS Accuracy: {Math.round(report.captureEvidence.captureLocation.accuracyMeters)} m</p>}<img src={reportPhotoUrl(report)} alt="Citizen before evidence" className="mt-2 h-20 w-28 rounded object-cover" /></div></Popup>
    </CircleMarker>
  </MapContainer>;
}
