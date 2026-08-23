import { useState, useEffect } from "react";
import { ImageOff, Camera } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PhotoEvidenceProps {
  src?: string;
  alt?: string;
  decorative?: boolean;
  variant?: "thumb" | "main" | "strip";
  mode?: "thumbnail" | "main" | "strip"; // legacy compat
  className?: string;
  thumbSize?: number;
}

export function PhotoEvidence({
  src,
  alt,
  decorative = false,
  variant,
  mode,
  className = "",
  thumbSize = 72
}: PhotoEvidenceProps) {
  const { t } = useTranslation();
  const [errored, setErrored] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const v = variant ?? (mode === "thumbnail" ? "thumb" : mode === "strip" ? "strip" : "main");

  // Reset error state when src changes
  useEffect(() => { setErrored(false); }, [src]);

  // Only treat as empty if truly empty — do NOT block blob: URLs
  const isEmpty = !src || src === "" || src === "/pwa-icon.svg" || src.endsWith("pwa-icon.svg");

  if (isEmpty || errored) {
    if (v === "thumb") {
      return (
        <div
          className={`flex items-center justify-center rounded-xl ${className}`}
          style={{ width: `${thumbSize}px`, height: `${thumbSize}px`, minWidth: `${thumbSize}px`, minHeight: `${thumbSize}px`, background: "var(--surface)", border: "1px solid var(--border)" }}
          role="img"
          aria-label={t("a11y.evidenceUnavailable")}
        >
          <Camera size={20} style={{ color: "rgba(255,255,255,0.15)" }} />
        </div>
      );
    }
    if (v === "strip") {
      return (
        <div
          className={`flex items-center justify-center rounded-lg ${className}`}
          style={{ width: "56px", height: "56px", background: "var(--surface)", border: "1px solid var(--border)" }}
          role="img"
          aria-label={t("a11y.evidenceUnavailable")}
        >
          <Camera size={14} style={{ color: "rgba(255,255,255,0.15)" }} />
        </div>
      );
    }
    // Main evidence stays compact when a URL is unavailable.
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl p-5 ${className}`}
        style={{ minHeight: "160px", background: "var(--surface)", border: "1px solid var(--border)" }}
        role="img"
        aria-label={t("a11y.evidenceUnavailable")}
      >
        <ImageOff size={28} style={{ color: "rgba(255,255,255,0.15)" }} />
        <span className="text-[14px] font-semibold text-slate-300">Evidence preview unavailable</span>
        <span className="max-w-xs text-center text-[12px] leading-relaxed text-slate-500">The report details and verification record are still available.</span>
        {src ? <button type="button" className="mt-1 text-[12px] font-semibold text-emerald-300 hover:text-emerald-200" onClick={() => { setErrored(false); setRetryKey((key) => key + 1); }}>Retry Image</button> : null}
      </div>
    );
  }

  if (v === "thumb") {
    return (
      <img
        src={src}
        alt={decorative ? "" : alt || t("a11y.evidenceImage")}
        className={`object-cover ${className}`}
        key={retryKey}
        style={{ width: `${thumbSize}px`, height: `${thumbSize}px`, minWidth: `${thumbSize}px`, minHeight: `${thumbSize}px` }}
        onError={() => setErrored(true)}
      />
    );
  }
  if (v === "strip") {
    return (
      <img
        src={src}
        alt={decorative ? "" : alt || t("a11y.evidenceImage")}
        className={`object-cover ${className}`}
        key={retryKey}
        style={{ width: "56px", height: "56px", minWidth: "56px", minHeight: "56px" }}
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <img
      key={retryKey}
      src={src}
      alt={decorative ? "" : alt || t("a11y.evidenceImage")}
      className={`object-cover ${className}`}
      onError={() => setErrored(true)}
    />
  );
}
