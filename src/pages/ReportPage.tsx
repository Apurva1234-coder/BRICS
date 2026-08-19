import { AlertCircle, Camera, CheckCircle2, ImageUp, LocateFixed, MapPin, RotateCw, Send, ShieldAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCaptureGeolocation, isCaptureFixUsable, type CaptureLocationFix } from "../hooks/useGeolocation";
import { submitReport } from "../services/reportService";
import type { CaptureEvidence, PollutionReport } from "../types";
import { approxArea } from "../utils/geo";
import { compressImage, createAnalysisThumbnail, fileToBase64, fileToObjectUrl, sha256File } from "../utils/image";
import { MAX_DEMO_IMAGE_BYTES } from "../services/demoBrowserStorage";
import { useTranslation } from "react-i18next";

export function ReportPage({ onSubmitted }: { onSubmitted: (report: PollutionReport) => void }) {
  const { t } = useTranslation();
  const locationState = useCaptureGeolocation();
  const [preview, setPreview] = useState<string | null>(null);
  const [originalBase64, setOriginalBase64] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [imageHash, setImageHash] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [compressedImage, setCompressedImage] = useState<File | null>(null);
  const [captureEvidence, setCaptureEvidence] = useState<CaptureEvidence | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pendingCameraPhoto, setPendingCameraPhoto] = useState<{ file: File; photoCapturedAt: string } | null>(null);
  const [pendingUploadPhoto, setPendingUploadPhoto] = useState<{ file: File; photoCapturedAt: string } | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const fix = locationState.bestFix;
  const locationReady = isCaptureFixUsable(fix);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraReady(false);
    setCameraLoading(false);
  }

  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  useEffect(() => () => {
    stopCamera();
    locationState.stopTracking();
  }, []);

  // Ask for location as soon as the Capture workflow opens so the user is not
  // blocked later when taking or uploading evidence.
  useEffect(() => {
    locationState.startTracking();
    return () => locationState.stopTracking();
  }, [locationState.startTracking, locationState.stopTracking]);

  async function startCamera(preferredFacingMode: "environment" | "user" = "environment") {
    setCameraError(null);
    setCameraLoading(true);
    setCameraReady(false);
    locationState.startTracking();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("report.cameraUnavailable"));
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: preferredFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setFacingMode(preferredFacingMode);
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (error) {
      locationState.stopTracking();
      setCameraError(error instanceof Error ? error.message : t("report.cameraPermissionDenied"));
      setCameraLoading(false);
    }
  }

  async function switchCamera() {
    await startCamera(facingMode === "environment" ? "user" : "environment");
  }

  async function processCameraPhoto(file: File, evidence: CaptureEvidence) {
    setBusy(true);
    setMessage(t("report.processingPhoto"));
    setMessageTone("info");
    try {
      const compressed = await compressImage(file);
      if (compressed.size > MAX_DEMO_IMAGE_BYTES) throw new Error("The compressed photo is too large for this browser demo. Please capture a clearer, closer photo.");
      const thumbnail = await createAnalysisThumbnail(compressed);
      const bitmap = await createImageBitmap(compressed);
      clearPreview();
      setOriginalBase64(await fileToBase64(compressed));
      setImageBase64(await fileToBase64(thumbnail));
      setImageHash(await sha256File(compressed));
      setCompressedImage(compressed);
      setImageSize({ width: bitmap.width, height: bitmap.height });
      setCaptureEvidence(evidence);
      setPreview(fileToObjectUrl(compressed));
      setMessage(t("report.photoReady"));
    } catch {
      setMessage(t("report.photoProcessFailed"));
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function processUploadedPhoto(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Upload a JPG, PNG, or WebP image."); setMessageTone("error"); return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMessage("The selected image is too large. Choose an image under 12 MB."); setMessageTone("error"); return;
    }
    locationState.startTracking();
    const capturedAt = new Date().toISOString();
    const currentFix = locationState.bestFix;
    if (!currentFix || !isCaptureFixUsable(currentFix)) {
      setPendingUploadPhoto({ file, photoCapturedAt: capturedAt });
      setMessage("Photo selected. Waiting for a location fix…"); setMessageTone("info"); return;
    }
    await processCameraPhoto(file, {
      captureMethod: "uploaded_image",
      photoCapturedAt: capturedAt,
      captureLocation: { ...currentFix }
    });
    locationState.stopTracking();
  }

  async function captureCameraPhoto() {
    const video = videoRef.current;
    const fix: CaptureLocationFix | null = locationState.bestFix;
    const photoCapturedAt = new Date().toISOString();
    if (!video || !cameraReady || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError(t("report.cameraNotReady"));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return setCameraError(t("report.cameraNotReady"));
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return setCameraError(t("report.photoProcessFailed"));
    const file = new File([blob], `cleanair-camera-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    if (!fix || !isCaptureFixUsable(fix)) {
      setPendingCameraPhoto({ file, photoCapturedAt });
      setCameraError(null);
      setMessage(t("report.photoSavedWaitingForLocation"));
      setMessageTone("info");
      return;
    }
    const evidence: CaptureEvidence = {
      captureMethod: "live_camera",
      cameraFacingMode: facingMode,
      photoCapturedAt,
      captureLocation: { ...fix }
    };
    stopCamera();
    locationState.stopTracking();
    await processCameraPhoto(file, evidence);
  }

  useEffect(() => {
    if (!pendingCameraPhoto || !locationReady || !fix) return;
    const evidence: CaptureEvidence = {
      captureMethod: "live_camera",
      cameraFacingMode: facingMode,
      photoCapturedAt: pendingCameraPhoto.photoCapturedAt,
      captureLocation: { ...fix }
    };
    setPendingCameraPhoto(null);
    stopCamera();
    locationState.stopTracking();
    void processCameraPhoto(pendingCameraPhoto.file, evidence);
  }, [pendingCameraPhoto, locationReady, fix, facingMode]);

  useEffect(() => {
    if (!pendingUploadPhoto || !locationReady || !fix) return;
    const pending = pendingUploadPhoto;
    setPendingUploadPhoto(null);
    void processCameraPhoto(pending.file, { captureMethod: "uploaded_image", photoCapturedAt: pending.photoCapturedAt, captureLocation: { ...fix } }).finally(() => locationState.stopTracking());
  }, [pendingUploadPhoto, locationReady, fix]);

  function retake() {
    clearPreview();
    setOriginalBase64("");
    setImageBase64("");
    setImageHash("");
    setCompressedImage(null);
    setCaptureEvidence(null);
    setPendingUploadPhoto(null);
    setMessage(null);
    void startCamera(facingMode);
  }

  const submit = async () => {
    if (!captureEvidence || !imageHash || !imageBase64 || !originalBase64 || !compressedImage) {
      setMessage("Choose Capture Photo or Upload Photo before submitting.");
      setMessageTone("error");
      return;
    }
    setBusy(true);
    setMessage(t("common.loading"));
    setMessageTone("info");
    try {
      const report = await submitReport({
        originalBase64,
        imageBase64,
        imageMimeType: "image/jpeg",
        imageHash,
        ...imageSize,
        description,
        lat: captureEvidence.captureLocation.lat,
        lng: captureEvidence.captureLocation.lng,
        areaText: approxArea(captureEvidence.captureLocation.lat, captureEvidence.captureLocation.lng),
        captureEvidence,
        compressedImage
      });
      onSubmitted(report);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <p className="section-eyebrow mb-1">{t("nav.capture")}</p>
        <h1 className="text-[32px] font-black tracking-tight text-white">{t("report.title")}</h1>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-slate-400">{t("report.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-6 pb-24 lg:grid lg:grid-cols-12 lg:gap-8 lg:pb-0">
        <div className="order-1 lg:col-span-7">
          <div className="upload-zone block" style={{ minHeight: "320px" }}>
            <input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void processUploadedPhoto(selected); event.target.value = ""; }} />
            {preview ? (
              <div className="relative" style={{ minHeight: "320px" }}>
                <img src={preview} alt={t("report.uploadPhotoEvidence")} className="w-full rounded-2xl object-cover" style={{ minHeight: "320px", maxHeight: "480px" }} />
                <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-2xl bg-black/55 opacity-0 transition-opacity hover:opacity-100">
                  <button type="button" onClick={retake} className="primary-button min-h-[44px]" disabled={busy}><RotateCw size={14} /> {t("report.retakePhoto")}</button>
                  <button type="button" onClick={() => uploadInputRef.current?.click()} className="secondary-button min-h-[44px]" disabled={busy}><ImageUp size={14} /> Change upload</button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                  <Camera size={28} className="text-slate-500" strokeWidth={1.5} />
                </div>
                <h3 className="text-[17px] font-semibold text-white">{t("report.uploadPhotoEvidence")}</h3>
                <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-slate-500">{t("report.uploadDescription")}</p>
                <button type="button" onClick={() => void startCamera()} className="primary-button mt-6 min-h-[44px]" disabled={busy}>
                  <Camera size={14} /> {t("report.useCamera")}
                </button>
                <button type="button" onClick={() => uploadInputRef.current?.click()} className="secondary-button mt-3 min-h-[44px]" disabled={busy}>
                  <ImageUp size={14} /> Upload Photo
                </button>
                <p className="mt-4 text-[11px] text-slate-600">Capture a new photo or select an existing pollution image.</p>
              </div>
            )}
          </div>
        </div>

        <div className="order-2 space-y-5 lg:col-span-5">
          <div className="location-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-[15px] font-semibold text-white">{t("common.location")}</h3>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${locationReady ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400" : "border-orange-500/30 bg-orange-500/20 text-orange-400"}`}>
                  {locationReady ? t("report.locationLocked") : t("report.waitingForLocation")}
                </span>
              </div>
              <button type="button" onClick={locationState.retry} className="icon-button min-h-[44px] min-w-[44px]" title={t("common.retry")}>
                <LocateFixed size={14} />
              </button>
            </div>
            <div className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
              <MapPin size={16} className="mt-0.5 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-white">{fix ? approxArea(fix.lat, fix.lng) : t("report.waitingForLocation")}</p>
                <p className="mt-0.5 font-mono text-[12px] text-slate-500">{fix ? `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}` : "--"}</p>
              </div>
            </div>
            {fix && <p className="text-[12px] text-slate-500">{t("report.locationAccuracy", { meters: Math.round(fix.accuracyMeters) })}</p>}
            {locationState.error && <p className="text-[13px]" style={{ color: "var(--critical)" }}>{t("report.locationPermissionDenied")}</p>}
            {captureEvidence && <p className="text-[12px] text-emerald-400">{t("report.stationLocationCaptured")}</p>}
          </div>

          <div className="hidden gap-3 rounded-xl p-4 text-[13px] text-slate-400 lg:flex" style={{ background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.15)" }}>
            <ShieldAlert size={16} className="mt-0.5 shrink-0" style={{ color: "var(--moderate)" }} />
            <p className="leading-relaxed">{t("report.authenticityNotice")}</p>
          </div>
        </div>

        <div className="order-3 lg:col-span-7">
          <label className="section-eyebrow mb-2 block">{t("report.contextNote")}</label>
          <textarea className="field-input resize-none" style={{ minHeight: "120px" }} placeholder={t("report.contextPlaceholder")} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>

        <div className="order-4 lg:col-span-5">
          <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-0 right-0 z-[100] space-y-4 border-t border-white/10 bg-[#070b0a]/95 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md lg:static lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
            <button onClick={() => void submit()} disabled={busy || !captureEvidence} className="primary-button min-h-[44px] w-full justify-center">
              {busy ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> {t("common.loading")}</> : <><Send size={15} /> {t("report.submitReport")}</>}
            </button>
            {message && <div className="flex items-start gap-2.5 rounded-xl p-4 text-[13px] leading-relaxed" style={messageTone === "error" ? { background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" } : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "#94a3b8" }}>
              {messageTone === "error" ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />}{message}
            </div>}
          </div>
        </div>
      </div>

      {cameraOpen && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4">
        <div className="w-full max-w-3xl max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div><p className="text-sm font-bold text-white">{t("report.cameraCapture")}</p><p className="text-xs text-slate-500">{t("report.cameraDescription")}</p></div>
            <button type="button" onClick={() => { stopCamera(); locationState.stopTracking(); }} className="icon-button min-h-[44px] min-w-[44px]" title={t("common.close")}><X size={16} /></button>
          </div>
          <div className="relative flex justify-center bg-black">
            {cameraLoading && <p className="absolute inset-0 z-10 flex items-center justify-center text-slate-400">{t("report.startingCamera")}</p>}
            <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => { setCameraReady(true); setCameraLoading(false); }} className="w-full max-h-[70vh] object-contain" />
          </div>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <button type="button" onClick={() => void captureCameraPhoto()} className="primary-button" disabled={cameraLoading || !cameraReady || busy || Boolean(pendingCameraPhoto)}><Camera size={14} /> {pendingCameraPhoto ? t("report.photoSaved") : t("report.capturePhoto")}</button>
            <button type="button" onClick={() => void switchCamera()} className="secondary-button" disabled={cameraLoading}><RotateCw size={14} /> {t("report.switchCamera")}</button>
            <button type="button" onClick={() => { stopCamera(); locationState.stopTracking(); }} className="secondary-button">{t("common.cancel")}</button>
            {!locationReady && <span className="text-xs text-amber-300">{pendingCameraPhoto ? t("report.photoSavedWaitingForLocation") : t("report.captureNowLocationPending")}</span>}
          </div>
          {cameraError && <p className="px-4 pb-4 text-sm text-red-400">{cameraError}</p>}
        </div>
      </div>}
    </div>
  );
}
