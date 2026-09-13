import { existsSync } from "node:fs";
import { join, normalize } from "node:path";

export function publicAssetExists(publicPath: string) {
  const relativePath = normalize(publicPath).replace(/^[/\\]+/, "");
  const publicDirectory = join(process.cwd(), "public");
  const resolvedPath = join(publicDirectory, relativePath);

  return resolvedPath.startsWith(publicDirectory) && existsSync(resolvedPath);
}
