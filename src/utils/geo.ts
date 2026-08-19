export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function approxArea(lat: number, lng: number): string {
  if (lat > 18.55 && lng > 73.7 && lng < 73.85) return "PCMC / West Pune";
  if (lat > 18.45 && lat < 18.58 && lng > 73.8 && lng < 73.95) return "Pune city";
  if (lat > 18.9 && lat < 19.3 && lng > 72.75 && lng < 73.05) return "Mumbai";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function cleanAreaText(areaText: string | undefined, lat?: number, lng?: number): string {
  const text = areaText?.trim();

  if (
    !text ||
    /^default map center$/i.test(text) ||
    /^location not set$/i.test(text)
  ) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return approxArea(lat as number, lng as number);
    }
    return "Location needs confirmation";
  }

  return text;
}
