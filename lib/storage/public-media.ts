import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createPublicMediaStore,
  parsePublicMediaBackend,
  type PublicMediaCategory,
  type PublicMediaDriver,
  type PublicMediaObject,
} from "@/lib/storage/public-media-core";

const PRODUCT_ASSETS_BUCKET = "product-assets";
let s3Client: S3Client | undefined;

function getS3Config() {
  const bucket = process.env.AWS_PUBLIC_MEDIA_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  if (!bucket) throw new Error("AWS_PUBLIC_MEDIA_BUCKET is required when PUBLIC_MEDIA_BACKEND=s3.");
  if (!region) throw new Error("AWS_REGION is required when PUBLIC_MEDIA_BACKEND=s3.");
  s3Client ??= new S3Client({ region });
  return { bucket, client: s3Client };
}

function drivers(): { supabase: PublicMediaDriver; s3: PublicMediaDriver } {
  return {
    supabase: {
      async put(key, object) {
        const { error } = await createAdminClient().storage
          .from(PRODUCT_ASSETS_BUCKET)
          .upload(key, object.bytes, { contentType: object.contentType, upsert: false });
        if (error) throw new Error(`Public media upload failed: ${error.message}`);
      },
      async delete(key) {
        const { error } = await createAdminClient().storage.from(PRODUCT_ASSETS_BUCKET).remove([key]);
        if (error) throw new Error(`Public media deletion failed: ${error.message}`);
      },
    },
    s3: {
      async put(key, object) {
        const { bucket, client } = getS3Config();
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: object.bytes,
          ContentType: object.contentType,
          CacheControl: "public,max-age=31536000,immutable",
        }));
      },
      async delete(key) {
        const { bucket, client } = getS3Config();
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      },
    },
  };
}

function store() {
  return createPublicMediaStore(parsePublicMediaBackend(process.env.PUBLIC_MEDIA_BACKEND), drivers());
}

export async function uploadPublicMedia(input: {
  category: PublicMediaCategory;
  supabasePrefix: string;
  object: PublicMediaObject;
}): Promise<string> {
  return store().upload(input.category, input.supabasePrefix, input.object);
}

export async function deletePublicMedia(storedPath: string): Promise<void> {
  return store().delete(storedPath);
}
