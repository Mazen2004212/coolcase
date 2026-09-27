export type ClientImageProfile = "payment-proof" | "custom-artwork" | "product";

export const CLIENT_IMAGE_LIMITS = {
  "payment-proof": {
    maxLongEdge: 2000,
    targetBytes: 700 * 1024,
    hardCeilingBytes: 1024 * 1024,
    maxSourceBytes: 12 * 1024 * 1024,
  },
  "custom-artwork": {
    maxLongEdge: 4000,
    targetBytes: 2.5 * 1024 * 1024,
    hardCeilingBytes: 3 * 1024 * 1024,
    maxSourceBytes: 25 * 1024 * 1024,
  },
  product: {
    maxLongEdge: 2000,
    targetBytes: 1.5 * 1024 * 1024,
    hardCeilingBytes: 1.5 * 1024 * 1024,
    maxSourceBytes: 20 * 1024 * 1024,
  },
} as const;

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const SAFE_UPLOAD_ERROR = "This image is too large to upload. Please choose a smaller image.";

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image could not be read. Please choose a valid image file.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("This browser could not prepare the image.")),
      "image/webp",
      quality,
    );
  });
}

function webpName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "upload";
  return `${base}.webp`;
}

export async function preprocessClientImage(
  file: File,
  profile: ClientImageProfile,
): Promise<File> {
  const limits = CLIENT_IMAGE_LIMITS[profile];
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, WebP, or AVIF image.");
  }
  if (file.size > limits.maxSourceBytes) throw new Error(SAFE_UPLOAD_ERROR);

  const image = await decodeImage(file);
  try {
    const initialScale = Math.min(1, limits.maxLongEdge / Math.max(image.width, image.height));
    let width = Math.max(1, Math.round(image.width * initialScale));
    let height = Math.max(1, Math.round(image.height * initialScale));

    if (file.size <= limits.targetBytes && initialScale === 1) return file;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("This browser could not prepare the image.");

    const qualities = profile === "custom-artwork"
      ? [0.94, 0.9, 0.86, 0.82, 0.78]
      : [0.9, 0.84, 0.78, 0.72, 0.66];
    let best: Blob | undefined;

    for (let resizeAttempt = 0; resizeAttempt < 7; resizeAttempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, quality);
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= limits.targetBytes) {
          return new File([blob], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
        }
      }

      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }

    if (!best || best.size > limits.hardCeilingBytes) throw new Error(SAFE_UPLOAD_ERROR);
    return new File([best], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
  } finally {
    image.close();
  }
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
