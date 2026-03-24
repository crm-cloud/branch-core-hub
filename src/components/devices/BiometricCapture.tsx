import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, X, AlertCircle } from "lucide-react";

interface BiometricCaptureProps {
  onCapture: (base64: string, blob: Blob) => void;
  onCancel?: () => void;
  maxSizeKB?: number;
}

const BiometricCapture = ({ onCapture, onCancel, maxSizeKB = 300 }: BiometricCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const startCamera = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions.");
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Crop to square from center
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 480, 480);

    // Compress iteratively
    let quality = 0.9;
    const maxBytes = maxSizeKB * 1024;

    const tryCompress = () => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (blob.size > maxBytes && quality > 0.3) {
            quality -= 0.1;
            tryCompress();
            return;
          }

          // If still too large, reduce dimensions
          if (blob.size > maxBytes) {
            canvas.width = 320;
            canvas.height = 320;
            ctx.drawImage(video, sx, sy, size, size, 0, 0, 320, 320);
            canvas.toBlob(
              (smallBlob) => {
                if (smallBlob) {
                  finalize(smallBlob);
                }
              },
              "image/jpeg",
              0.7
            );
          } else {
            finalize(blob);
          }
        },
        "image/jpeg",
        quality
      );
    };

    const finalize = (blob: Blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setCapturedImage(dataUrl);
        setCapturedBlob(blob);
        stopCamera();
      };
      reader.readAsDataURL(blob);
    };

    tryCompress();
  }, [stopCamera, maxSizeKB]);

  const retake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    startCamera();
  };

  const confirm = () => {
    if (!capturedImage || !capturedBlob) return;
    // Strip data URL prefix to get raw base64
    const base64 = capturedImage.split(",")[1] || capturedImage;
    onCapture(base64, capturedBlob);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-destructive/5 border border-destructive/20">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={startCamera}>
          Try Again
        </Button>
      </div>
    );
  }

  if (capturedImage) {
    return (
      <div className="space-y-3">
        <div className="relative aspect-square w-full max-w-[320px] mx-auto rounded-xl overflow-hidden border-2 border-primary/30">
          <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
          <div className="absolute bottom-2 right-2 bg-background/80 rounded-full px-2 py-0.5 text-[10px] font-mono">
            {capturedBlob ? `${Math.round(capturedBlob.size / 1024)}KB` : ""}
          </div>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={retake}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retake
          </Button>
          <Button size="sm" onClick={confirm}>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Use Photo
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={() => { stopCamera(); onCancel(); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (stream) {
    return (
      <div className="space-y-3">
        <div className="relative aspect-square w-full max-w-[320px] mx-auto rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {/* Face guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[60%] h-[75%] border-2 border-dashed border-primary/50 rounded-[40%]" />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2 justify-center">
          <Button onClick={capture}>
            <Camera className="h-4 w-4 mr-2" />
            Capture
          </Button>
          <Button variant="outline" onClick={() => { stopCamera(); onCancel?.(); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-muted-foreground/20">
      <Camera className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Capture face photo for biometric enrollment</p>
      <Button onClick={startCamera} disabled={isStarting}>
        <Camera className="h-4 w-4 mr-2" />
        {isStarting ? "Starting Camera..." : "Open Camera"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        📋 Fingerprints must be registered directly on the physical hardware terminal.
      </p>
    </div>
  );
};

export default BiometricCapture;
