import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, '.aws-static');
const publicSource = path.join(root, 'public');
const nextStaticSource = path.join(root, '.next', 'static');

async function requireDirectory(directory, label) {
  const info = await stat(directory).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`${label} was not found. Run npm run build first.`);
}

await requireDirectory(publicSource, 'public/');
await requireDirectory(nextStaticSource, '.next/static/');

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, '_next'), { recursive: true });
await cp(publicSource, output, { recursive: true, force: true });
await cp(nextStaticSource, path.join(output, '_next', 'static'), { recursive: true, force: true });

console.log(`Prepared AWS static files in ${path.relative(root, output)}/`);
