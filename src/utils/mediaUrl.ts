/**
 * Resolves a media URL that might be a relative /media/... path from the
 * Express dev server. In production, these are absolute CDN URLs already.
 */
export function resolveMediaUrl(url: string | undefined | null): string | undefined {
  const value = url?.trim();
  if (!value) return undefined;
  if (value.startsWith("blob:") || value.startsWith("data:") || value.startsWith("https:") || value.startsWith("http:") || value.startsWith("/demo/") || value.startsWith("/media/")) return value;
  return value;
}

/** Returns the best available display URL for a report's primary photo. */
export function reportPhotoUrl(report: {
  imageUrl?: string;
  media?: { displayUrl?: string; publicUrl?: string }[];
}): string | undefined {
  return resolveMediaUrl(report.media?.[0]?.displayUrl || report.media?.[0]?.publicUrl || report.imageUrl);
}
