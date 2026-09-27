'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission } from '@/lib/admin/permissions';
import { processUploadImage } from '@/lib/images/process-upload';
import { deletePublicMedia, uploadPublicMedia } from '@/lib/storage/public-media';
import { resolvePublicMediaUrl } from '@/lib/storage/public-media-core';

export type CollectionInput = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  collectionType: 'CUSTOM' | 'NEW_ARRIVALS';
  bannerImageUrl: string | null;
  removeBanner: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  productIds: string[];
};

async function requireCollectionsAdmin(permission: 'products.view' | 'products.manage') {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, permission)) throw new Error(`Unauthorized: missing ${permission}`);
  return staff;
}

function revalidateCollections(slug?: string) {
  revalidatePath('/', 'layout');
  revalidatePath('/collections');
  revalidatePath('/shop');
  revalidatePath('/search');
  if (slug) revalidatePath(`/collections/${slug}`);
}

function safeCollectionError(message: string): string {
  if (message.includes('collections_single_new_arrivals_idx')) {
    return 'The New Arrivals preset already exists. Edit the existing collection instead.';
  }
  if (message.includes('collections_slug_key') || message.includes('duplicate key')) {
    return 'A collection with this URL already exists.';
  }
  if (message.includes('Active products.manage')) return 'You do not have permission to manage collections.';
  if (message.includes('Collection slug')) return 'Slug must use lowercase letters, numbers, and hyphens only.';
  return 'The collection could not be saved. Please review the form and try again.';
}

export async function fetchAdminCollections() {
  await requireCollectionsAdmin('products.view');
  const supabase = createAdminClient();
  const [{ data: collections, error }, { data: memberships }] = await Promise.all([
    supabase.from('collections').select('*').order('sort_order').order('name'),
    supabase.from('collection_products').select('collection_id'),
  ]);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of memberships ?? []) counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
  return (collections ?? []).map(collection => ({
    ...collection,
    product_count: counts.get(collection.id) ?? 0,
    banner_url: collection.banner_image_url
      ? resolvePublicMediaUrl(collection.banner_image_url, process.env.NEXT_PUBLIC_SUPABASE_URL!)
      : null,
  }));
}

export async function fetchAdminCollection(id: string) {
  await requireCollectionsAdmin('products.view');
  const supabase = createAdminClient();
  const [{ data: collection, error }, { data: memberships }] = await Promise.all([
    supabase.from('collections').select('*').eq('id', id).maybeSingle(),
    supabase.from('collection_products').select('product_id, sort_order').eq('collection_id', id).order('sort_order'),
  ]);
  if (error) throw new Error(error.message);
  if (!collection) return null;
  return {
    ...collection,
    product_ids: (memberships ?? []).map(item => item.product_id),
    banner_url: collection.banner_image_url
      ? resolvePublicMediaUrl(collection.banner_image_url, process.env.NEXT_PUBLIC_SUPABASE_URL!)
      : null,
  };
}

export async function fetchCollectionProductOptions() {
  await requireCollectionsAdmin('products.view');
  const { data, error } = await createAdminClient()
    .from('products')
    .select('id, name, slug, is_active, is_available, product_images(id, storage_path, alt_text, display_order, is_primary)')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(product => {
    const image = [...product.product_images].sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.display_order - right.display_order)[0];
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      isActive: product.is_active,
      isAvailable: product.is_available,
      imageUrl: image ? resolvePublicMediaUrl(image.storage_path, process.env.NEXT_PUBLIC_SUPABASE_URL!) : null,
    };
  });
}

async function uploadBanner(formData: FormData): Promise<string | null> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 1.5 * 1024 * 1024) throw new Error('The banner exceeds the safe 1.5 MB upload limit.');
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, or AVIF banner.');
  }
  const processed = await processUploadImage(new Uint8Array(await file.arrayBuffer()), file.type, 'product');
  return uploadPublicMedia({
    category: 'collections',
    supabasePrefix: `collections/${crypto.randomUUID()}`,
    object: { bytes: processed.bytes, contentType: processed.mimeType, extension: processed.extension },
  });
}

export async function saveCollection(input: CollectionInput, bannerFormData?: FormData) {
  try {
    await requireCollectionsAdmin('products.manage');
    const previous = input.id
      ? await createAdminClient().from('collections').select('banner_image_url, slug').eq('id', input.id).maybeSingle()
      : null;
    const oldBanner = previous?.data?.banner_image_url ?? input.bannerImageUrl;
    let uploadedBanner: string | null = null;
    try {
      if (bannerFormData) uploadedBanner = await uploadBanner(bannerFormData);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'The banner could not be processed.' };
    }
    const banner = uploadedBanner ?? (input.removeBanner ? null : input.bannerImageUrl);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('save_collection', {
      // Generated Supabase types cannot express nullable PostgreSQL function arguments.
      p_collection_id: input.id as string,
      p_name: input.name,
      p_slug: input.slug,
      p_description: input.description,
      p_collection_type: input.collectionType,
      p_banner_image_url: banner as string,
      p_is_active: input.isActive,
      p_is_featured: input.isFeatured,
      p_sort_order: input.sortOrder,
      p_product_ids: input.productIds,
    });
    if (error) {
      if (uploadedBanner) await deletePublicMedia(uploadedBanner).catch(() => undefined);
      return { error: safeCollectionError(error.message) };
    }
    if (oldBanner && oldBanner !== banner) await deletePublicMedia(oldBanner).catch(() => undefined);
    revalidateCollections(input.slug);
    if (previous?.data?.slug && previous.data.slug !== input.slug) revalidatePath(`/collections/${previous.data.slug}`);
    return { id: data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unexpected collection error.' };
  }
}

export async function deleteCollection(id: string, slug: string) {
  try {
    await requireCollectionsAdmin('products.manage');
    const supabase = await createClient();
    const { data: bannerPath, error } = await supabase.rpc('delete_collection', { p_collection_id: id });
    if (error) return { error: safeCollectionError(error.message) };
    if (bannerPath) await deletePublicMedia(bannerPath).catch(() => undefined);
    revalidateCollections(slug);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unexpected collection error.' };
  }
}
