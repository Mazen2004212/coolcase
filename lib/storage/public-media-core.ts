export type PublicMediaBackend = "supabase" | "s3";
export type PublicMediaCategory = "products" | "custom-case-templates" | "collections";

export type PublicMediaObject = {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
};

export type PublicMediaDriver = {
  put(key: string, object: PublicMediaObject): Promise<void>;
  delete(key: string): Promise<void>;
};

export type PublicMediaDrivers = {
  supabase: PublicMediaDriver;
  s3: PublicMediaDriver;
};

export function parsePublicMediaBackend(value: string | undefined): PublicMediaBackend {
  const backend = value?.trim().toLowerCase() || "supabase";
  if (backend !== "supabase" && backend !== "s3") {
    throw new Error("PUBLIC_MEDIA_BACKEND must be either 'supabase' or 's3'.");
  }
  return backend;
}

export function isS3PublicMediaPath(path: string): boolean {
  return path.startsWith("/media/");
}

function historicalSupabaseKey(path: string): string | null {
  if (!/^https?:\/\//i.test(path)) return null;
  try {
    const marker = "/storage/v1/object/public/product-assets/";
    const pathname = new URL(path).pathname;
    const index = pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(pathname.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}

export function resolvePublicMediaUrl(path: string, supabaseUrl: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-assets/${path}`;
}

export function createPublicMediaStore(
  backend: PublicMediaBackend,
  drivers: PublicMediaDrivers,
  createId: () => string = () => crypto.randomUUID(),
) {
  return {
    async upload(
      category: PublicMediaCategory,
      supabasePrefix: string,
      object: PublicMediaObject,
    ): Promise<string> {
      const id = createId();
      if (backend === "s3") {
        const key = `media/${category}/${id}.${object.extension}`;
        await drivers.s3.put(key, object);
        return `/${key}`;
      }

      const key = `${supabasePrefix.replace(/^\/+|\/+$/g, "")}/${id}.${object.extension}`;
      await drivers.supabase.put(key, object);
      return key;
    },

    async delete(storedPath: string): Promise<void> {
      if (isS3PublicMediaPath(storedPath)) {
        await drivers.s3.delete(storedPath.slice(1));
        return;
      }
      const legacyKey = historicalSupabaseKey(storedPath);
      if (legacyKey) await drivers.supabase.delete(legacyKey);
      else if (!/^https?:\/\//i.test(storedPath)) await drivers.supabase.delete(storedPath);
    },
  };
}
