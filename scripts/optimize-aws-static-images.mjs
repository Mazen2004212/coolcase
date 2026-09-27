import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(process.cwd(), ".aws-static");

const SUPPORTED = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
]);

const MIN_SIZE = 100 * 1024; // skip images below 100 KB

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function optimizeImage(file) {
  const relativePath = path.relative(ROOT, file).replaceAll("\\", "/");
  if (/^assets\/(hero|banners|auth)\//.test(relativePath)) {
    const size = (await stat(file)).size;
    return { file, before: size, after: size, skipped: "campaign-artwork" };
  }

  const extension = path.extname(file).toLowerCase();

  if (!SUPPORTED.has(extension)) {
    return null;
  }

  const before = (await stat(file)).size;

  if (before < MIN_SIZE) {
    return {
      file,
      before,
      after: before,
      skipped: "small",
    };
  }

  const input = await readFile(file);

  let pipeline = sharp(input, {
    failOn: "error",
    animated: false,
    limitInputPixels: 100_000_000,
  }).rotate();

  let output;

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      output = await pipeline
        .jpeg({
          quality: 84,
          mozjpeg: true,
          chromaSubsampling: "4:2:0",
        })
        .toBuffer();
      break;

    case ".png":
      output = await pipeline
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true,
          quality: 90,
          effort: 10,
        })
        .toBuffer();
      break;

    case ".webp":
      output = await pipeline
        .webp({
          quality: 84,
          alphaQuality: 95,
          smartSubsample: true,
          effort: 6,
        })
        .toBuffer();
      break;

    case ".avif":
      output = await pipeline
        .avif({
          quality: 58,
          effort: 6,
        })
        .toBuffer();
      break;

    default:
      return null;
  }

  /*
   * Never replace the original staged image unless optimization
   * actually makes it smaller.
   */
  if (output.length >= before) {
    return {
      file,
      before,
      after: before,
      skipped: "not-smaller",
    };
  }

  await writeFile(file, output);

  return {
    file,
    before,
    after: output.length,
    saved: before - output.length,
  };
}

async function main() {
  const rootInfo = await stat(ROOT).catch(() => null);

  if (!rootInfo?.isDirectory()) {
    throw new Error(
      ".aws-static was not found. Run npm run build and npm run aws:static:prepare first."
    );
  }

  const files = await walk(ROOT);

  let totalBefore = 0;
  let totalAfter = 0;
  let optimized = 0;
  let skipped = 0;

  const results = [];

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();

    if (!SUPPORTED.has(extension)) continue;

    try {
      const result = await optimizeImage(file);

      if (!result) continue;

      totalBefore += result.before;
      totalAfter += result.after;

      if (result.saved) {
        optimized += 1;
      } else {
        skipped += 1;
      }

      results.push(result);
    } catch (error) {
      console.warn(
        `SKIP ${path.relative(ROOT, file)}: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  results
    .filter((result) => result.saved)
    .sort((a, b) => b.saved - a.saved)
    .forEach((result) => {
      console.log(
        `OPTIMIZED ${path.relative(ROOT, result.file)}: ` +
        `${formatBytes(result.before)} -> ${formatBytes(result.after)} ` +
        `(${formatBytes(result.saved)} saved)`
      );
    });

  console.log("");
  console.log("AWS static image optimization complete");
  console.log("--------------------------------------");
  console.log(`Optimized: ${optimized}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Before:    ${formatBytes(totalBefore)}`);
  console.log(`After:     ${formatBytes(totalAfter)}`);
  console.log(
    `Saved:     ${formatBytes(totalBefore - totalAfter)}`
  );

  if (totalBefore > 0) {
    console.log(
      `Reduction: ${(
        ((totalBefore - totalAfter) / totalBefore) *
        100
      ).toFixed(1)}%`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
