import 'server-only';

import sharp, { type OutputInfo } from 'sharp';

export type ImageUploadProfile = 'payment-proof' | 'custom-artwork' | 'product';

type SupportedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

const FORMAT_BY_MIME: Record<SupportedMime, 'jpeg' | 'png' | 'webp' | 'avif'> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const PROFILE = {
  'payment-proof': { maxLongEdge: 1600, qualities: [80, 72, 64, 56], targetBytes: 700 * 1024, allowAvifInput: false },
  'custom-artwork': { maxLongEdge: 4000, qualities: [92, 88, 84, 80], targetBytes: 2 * 1024 * 1024, allowAvifInput: false },
  product: { maxLongEdge: 2000, qualities: [86, 80, 74, 68], targetBytes: 900 * 1024, allowAvifInput: true },
} as const;

export type ProcessedUploadImage = {
  bytes: Uint8Array;
  extension: 'webp';
  mimeType: 'image/webp';
  originalBytes: number;
  storedBytes: number;
  width: number;
  height: number;
};

export async function processUploadImage(
  input: Uint8Array,
  declaredMime: string,
  profile: ImageUploadProfile,
): Promise<ProcessedUploadImage> {
  const settings = PROFILE[profile];
  const allowed = settings.allowAvifInput
    ? ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    : ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowed.includes(declaredMime)) {
    throw new Error('UNSUPPORTED_IMAGE_TYPE');
  }

  const image = sharp(input, {
    failOn: 'error',
    limitInputPixels: 80_000_000,
    animated: false,
  });
  const metadata = await image.metadata();
  const expectedFormat = FORMAT_BY_MIME[declaredMime as SupportedMime];

  if (!metadata.format || metadata.format !== expectedFormat) {
    throw new Error('IMAGE_SIGNATURE_MISMATCH');
  }
  if (!metadata.width || !metadata.height) {
    throw new Error('INVALID_IMAGE_DIMENSIONS');
  }

  let output: { data: Buffer; info: OutputInfo } | null = null;
  for (const [index, quality] of settings.qualities.entries()) {
    output = await sharp(input, { failOn: 'error', limitInputPixels: 80_000_000, animated: false })
      .rotate()
      .resize({
        width: settings.maxLongEdge,
        height: settings.maxLongEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality,
        alphaQuality: profile === 'custom-artwork' ? 100 : 90,
        smartSubsample: true,
        effort: 5,
      })
      .toBuffer({ resolveWithObject: true });

    if (output.data.byteLength <= settings.targetBytes || index === settings.qualities.length - 1) break;
  }

  if (!output) throw new Error('IMAGE_PROCESSING_FAILED');

  return {
    bytes: output.data,
    extension: 'webp',
    mimeType: 'image/webp',
    originalBytes: input.byteLength,
    storedBytes: output.data.byteLength,
    width: output.info.width,
    height: output.info.height,
  };
}
