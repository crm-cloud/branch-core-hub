/**
 * Client-side image compression utility for device sync.
 * Resizes to max 640x640, compresses to JPEG under 200KB.
 */

const MAX_DIMENSION = 640;
const MAX_SIZE_BYTES = 200 * 1024; // 200KB
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.3;

export async function compressImageForDevice(file: File): Promise<{
  blob: Blob;
  base64: string;
  width: number;
  height: number;
  sizeKB: number;
}> {
  const img = await loadImage(file);
  const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // Iteratively compress until under MAX_SIZE_BYTES
  let quality = INITIAL_QUALITY;
  let blob: Blob;

  do {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob.size <= MAX_SIZE_BYTES) break;
    quality -= 0.1;
  } while (quality >= MIN_QUALITY);

  // If still too large, reduce dimensions further
  if (blob.size > MAX_SIZE_BYTES) {
    const scale = Math.sqrt(MAX_SIZE_BYTES / blob.size);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);
    canvas.width = newW;
    canvas.height = newH;
    ctx.drawImage(img, 0, 0, newW, newH);
    blob = await canvasToBlob(canvas, 'image/jpeg', MIN_QUALITY);
  }

  const base64 = await blobToBase64(blob);

  return {
    blob,
    base64,
    width: canvas.width,
    height: canvas.height,
    sizeKB: Math.round(blob.size / 1024),
  };
}

export async function compressImageFile(file: File): Promise<File> {
  const { blob } = await compressImageForDevice(file);
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function calculateDimensions(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = Math.min(max / w, max / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to blob failed'))),
      type,
      quality
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Return just the base64 part without the data URL prefix
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
