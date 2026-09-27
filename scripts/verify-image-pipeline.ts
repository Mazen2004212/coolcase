import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { processUploadImage, type ImageUploadProfile } from '../lib/images/process-upload';

async function main() {
const width = 2500;
const height = 2500;
const source = await sharp(randomBytes(width * height * 3), {
  raw: { width, height, channels: 3 },
}).png({ compressionLevel: 0 }).toBuffer();

assert(source.byteLength >= 15 * 1024 * 1024 && source.byteLength <= 20 * 1024 * 1024);

async function createNoisePng(size: number) {
  return sharp(randomBytes(size * size * 3), { raw: { width: size, height: size, channels: 3 } })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

const paymentSource = await createNoisePng(1400);
const productSource = await createNoisePng(2000);

const bundle = await build({
  entryPoints: ['lib/images/client-preprocess.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'CoolcaseImages',
  platform: 'browser',
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const profiles: Array<{ client: 'custom-artwork' | 'payment-proof' | 'product'; server: ImageUploadProfile; ceiling: number; source: Buffer }> = [
  { client: 'custom-artwork', server: 'custom-artwork', ceiling: 3 * 1024 * 1024, source },
  { client: 'payment-proof', server: 'payment-proof', ceiling: 1024 * 1024, source: paymentSource },
  { client: 'product', server: 'product', ceiling: 1.5 * 1024 * 1024, source: productSource },
];

const results = [];

try {
  for (const profile of profiles) {
    const clientResult = await page.evaluate(async ({ base64, profileName }) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const input = new File([bytes], 'representative-large.png', { type: 'image/png' });
      const output = await CoolcaseImages.preprocessClientImage(input, profileName);
      const outputBytes = new Uint8Array(await output.arrayBuffer());
      let encoded = '';
      const chunk = 0x8000;
      for (let index = 0; index < outputBytes.length; index += chunk) {
        encoded += String.fromCharCode(...outputBytes.subarray(index, index + chunk));
      }
      return { bytes: output.size, type: output.type, base64: btoa(encoded) };
    }, { base64: profile.source.toString('base64'), profileName: profile.client });

    assert(clientResult.bytes <= profile.ceiling, `${profile.client} exceeded its client ceiling`);
    const clientBytes = Buffer.from(clientResult.base64, 'base64');
    const serverResult = await processUploadImage(new Uint8Array(clientBytes), clientResult.type, profile.server);
    assert(serverResult.storedBytes <= profile.ceiling, `${profile.server} exceeded its server ceiling`);
    results.push({
      profile: profile.client,
      originalBytes: profile.source.byteLength,
      clientBytes: clientResult.bytes,
      serverBytes: serverResult.storedBytes,
      serverWidth: serverResult.width,
      serverHeight: serverResult.height,
    });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

declare global {
  const CoolcaseImages: {
    preprocessClientImage(file: File, profile: 'custom-artwork' | 'payment-proof' | 'product'): Promise<File>;
  };
}
