import { AlertCircle, Camera, Check, FlipHorizontal, RefreshCw, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, IconButton } from "./ui";

export interface CameraCaptureProps {
  onCapture: (file: File, previewUrl: string) => void;
  onClose: () => void;
}

type StreamState = "idle" | "requesting" | "active" | "captured" | "error";

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);

  // Stop all active MediaStream tracks
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore individual track stop errors
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup captured preview object URL to prevent memory leaks
  const cleanupPreviewUrl = useCallback(() => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
  }, [capturedPreviewUrl]);

  // Check available video devices
  const checkMultipleCameras = useCallback(async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoInputs.length > 1);
      }
    } catch {
      setHasMultipleCameras(false);
    }
  }, []);

  // Request camera access and attach stream to video element
  const startCamera = useCallback(async (mode: "user" | "environment") => {
    stopTracks();
    setErrorMessage(null);
    setStreamState("requesting");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStreamState("error");
      setErrorMessage(
        "Camera access is not supported by your browser. Please use the file upload option or switch to a modern browser."
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        // Try requesting with preferred facingMode and resolution
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (firstErr: any) {
        // If overconstrained or facingMode not supported, fallback to basic video request
        if (firstErr.name === "OverconstrainedError" || firstErr.name === "ConstraintNotSatisfiedError") {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Browser autoplay policy might need user interaction; muted attribute helps prevent this
        }
      }

      setStreamState("active");
      checkMultipleCameras();
    } catch (err: any) {
      setStreamState("error");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMessage("Camera permission was denied. Please allow camera access in your browser settings and try again.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMessage("No camera device was detected on your device. Please connect a webcam or use file upload.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setErrorMessage("Camera is currently in use by another application or tab. Please close other camera apps and retry.");
      } else if (err.name === "SecurityError") {
        setErrorMessage("Camera access is restricted in this context. Ensure you are using HTTPS or localhost.");
      } else {
        setErrorMessage(err.message || "Failed to start camera. Please verify device permissions or use file upload.");
      }
    }
  }, [stopTracks, checkMultipleCameras]);

  // Initial camera start on mount
  useEffect(() => {
    startCamera(facingMode);

    // Guaranteed cleanup when component unmounts
    return () => {
      stopTracks();
      cleanupPreviewUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch between front/back camera
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture current video frame onto canvas
  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || streamState !== "active") return;

    try {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setErrorMessage("Could not initialize image capture canvas context.");
        return;
      }

      // If user-facing front camera, mirror image for natural reflection feel
      if (facingMode === "user") {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setErrorMessage("Failed to generate image file from camera capture.");
            return;
          }

          const file = new File([blob], `camera-tryon-${Date.now()}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now()
          });

          const url = URL.createObjectURL(blob);

          setCapturedBlob(blob);
          setCapturedFile(file);
          setCapturedPreviewUrl(url);
          setStreamState("captured");

          // Stop video tracks while reviewing captured image
          stopTracks();
        },
        "image/jpeg",
        0.92
      );
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while capturing photo.");
    }
  };

  // Discard capture and return to live camera
  const handleRetake = () => {
    cleanupPreviewUrl();
    setCapturedBlob(null);
    setCapturedFile(null);
    startCamera(facingMode);
  };

  // Confirm and pass captured photo to Try-On pipeline
  const handleConfirm = () => {
    if (!capturedFile || !capturedPreviewUrl) return;
    stopTracks();
    onCapture(capturedFile, capturedPreviewUrl);
  };

  // Close modal and cleanly stop all camera tracks
  const handleClose = () => {
    stopTracks();
    cleanupPreviewUrl();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="relative flex max-h-[95vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Camera className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-950">Live Camera Try-On</h2>
              <p className="text-xs text-slate-500">Capture a photo to simulate virtual clothing fit</p>
            </div>
          </div>
          <IconButton label="Close camera" onClick={handleClose}>
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        {/* Camera Viewport / Preview Area */}
        <div className="relative flex min-h-[340px] sm:min-h-[400px] flex-1 items-center justify-center bg-slate-950">
          {/* Live Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full max-h-[460px] w-full object-cover ${
              facingMode === "user" ? "-scale-x-100" : ""
            } ${streamState === "active" ? "block" : "hidden"}`}
          />

          {/* Captured Snapshot Display */}
          {streamState === "captured" && capturedPreviewUrl && (
            <div className="relative h-full max-h-[460px] w-full">
              <img
                src={capturedPreviewUrl}
                alt="Captured Try-On Preview"
                className="h-full max-h-[460px] w-full object-cover"
              />
              <div className="absolute top-3 left-3 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                Photo Captured
              </div>
            </div>
          )}

          {/* Live Overlay Guide (when streaming) */}
          {streamState === "active" && (
            <>
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/30 border-dashed sm:inset-10" />
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-emerald-400 backdrop-blur-sm">
                <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                Live Camera
              </div>
            </>
          )}

          {/* Loading / Requesting State */}
          {streamState === "requesting" && (
            <div className="p-8 text-center text-white">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary-400" />
              <p className="mt-3 text-sm font-medium">Starting camera...</p>
              <p className="mt-1 text-xs text-slate-400">Please grant permission when prompted by your browser</p>
            </div>
          )}

          {/* Error State */}
          {streamState === "error" && (
            <div className="max-w-md p-6 text-center text-white">
              <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
              <h3 className="mt-2 text-base font-bold">Camera Unavailable</h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
              <div className="mt-5 flex justify-center gap-3">
                <Button
                  variant="secondary"
                  className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700 text-xs"
                  onClick={() => startCamera(facingMode)}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Camera
                </Button>
                <Button
                  variant="primary"
                  className="text-xs"
                  onClick={handleClose}
                >
                  Use File Upload
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          {streamState === "active" && (
            <div className="flex items-center justify-between">
              {/* Optional Camera Flip Button */}
              {hasMultipleCameras ? (
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
                >
                  <FlipHorizontal className="h-4 w-4" /> Switch Camera
                </button>
              ) : (
                <div />
              )}

              {/* Shutter Button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCapture}
                  className="group relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary-600 bg-white shadow-lg transition hover:scale-105 active:scale-95"
                  title="Capture Photo"
                >
                  <span className="h-10 w-10 rounded-full bg-primary-600 transition group-hover:bg-primary-700" />
                </button>
              </div>

              {/* Cancel Button */}
              <Button variant="secondary" onClick={handleClose} className="text-xs">
                Cancel
              </Button>
            </div>
          )}

          {streamState === "captured" && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={handleRetake} className="flex-1 sm:flex-none">
                <RefreshCw className="h-4 w-4" /> Retake Photo
              </Button>
              <Button onClick={handleConfirm} className="flex-1 sm:flex-none">
                <Check className="h-4 w-4" /> Use This Photo
              </Button>
            </div>
          )}

          {(streamState === "requesting" || streamState === "error") && (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
