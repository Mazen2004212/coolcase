'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getCustomer } from '@/lib/auth/user';

const BUCKET = 'product-assets';

// â”€â”€â”€ Auth guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function requireAdmin() {
  // In demo mode (local dev only) server actions bypass auth check.
  if (process.env.ADMIN_DEMO_MODE === 'true') return;
  const customer = await getCustomer();
  if (!customer || customer.profile?.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return customer;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function revalidateCatalog(slug?: string) {
  revalidatePath('/', 'layout');           // homepage + all pages
  revalidatePath('/shop');
  revalidatePath('/collections');
  revalidatePath('/search');
  if (slug) revalidatePath(`/products/${slug}`);
}

// â”€â”€â”€ Image upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/** Magic byte signatures for image format verification */
function verifyMagicBytes(buf: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/png')  return buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4E&&buf[3]===0x47;
  if (mimeType === 'image/jpeg') return buf[0]===0xFF&&buf[1]===0xD8&&buf[2]===0xFF;
  if (mimeType === 'image/webp') return buf[0]===0x52&&buf[1]===0x49&&buf[2]===0x46&&buf[3]===0x46&&buf[8]===0x57&&buf[9]===0x45&&buf[10]===0x42&&buf[11]===0x50;
  if (mimeType === 'image/avif') return buf[4]===0x66&&buf[5]===0x74&&buf[6]===0x79&&buf[7]===0x70;
  return false;
}

export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<{ storagePath: string; imageId: string } | { error: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) return { error: 'No file provided.' };
    if (file.size > MAX_SIZE) return { error: 'File exceeds the 5 MB limit.' };
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) return { error: 'Only JPEG, PNG, WebP, and AVIF images are allowed.' };

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!verifyMagicBytes(bytes, file.type)) return { error: 'File content does not match its declared type.' };

    const imageUuid = crypto.randomUUID();
    const storagePath = `products/${productId}/${imageUuid}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

    // Count existing images to set display_order
    const { count } = await supabase
      .from('product_images')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);

    const { data: img, error: imgError } = await supabase
      .from('product_images')
      .insert({
        product_id:    productId,
        storage_path:  storagePath,
        alt_text:      file.name.replace(/\.[^.]+$/, ''),
        display_order: count ?? 0,
        is_primary:    (count ?? 0) === 0, // first image is primary
      })
      .select('id')
      .single();

    if (imgError) {
      // Clean up orphaned storage object
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return { error: `Could not save image metadata: ${imgError.message}` };
    }

    return { storagePath, imageId: img.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export async function deleteProductImage(
  imageId: string,
  storagePath: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { error: dbError } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId);
    if (dbError) return { error: dbError.message };

    // Best-effort storage cleanup â€” don't fail if already gone
    await supabase.storage.from(BUCKET).remove([storagePath]);

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export async function updateImageMetadata(
  imageId: string,
  altText: string,
  displayOrder: number,
  isPrimary: boolean,
  productId: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    // If marking as primary, clear other primary images first
    if (isPrimary) {
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId)
        .neq('id', imageId);
    }

    const { error } = await supabase
      .from('product_images')
      .update({ alt_text: altText, display_order: displayOrder, is_primary: isPrimary })
      .eq('id', imageId);

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// â”€â”€â”€ Product CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ProductInput = {
  name: string;
  slug: string;
  categoryId: string | null;
  shortDescription: string;
  description: string;
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  displayOrder: number;
  siliconePriceOverride: number | null;
  acrylicPriceOverride: number | null;
  doubleLayerPriceOverride: number | null;
};

export async function createProduct(
  input: ProductInput
): Promise<{ id: string } | { error: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    if (!input.name.trim()) return { error: 'Product name is required.' };
    if (!isValidSlug(input.slug)) return { error: 'Slug must be lowercase letters, numbers, and hyphens.' };

    const { data, error } = await supabase
      .from('products')
      .insert({
        name:                      input.name.trim(),
        slug:                      input.slug.trim(),
        category_id:               input.categoryId || null,
        short_description:         input.shortDescription || null,
        description:               input.description || null,
        is_active:                 input.isActive,
        is_available:              input.isAvailable,
        is_featured:               input.isFeatured,
        display_order:             input.displayOrder,
        silicone_price_override:   input.siliconePriceOverride || null,
        acrylic_price_override:    input.acrylicPriceOverride || null,
        double_layer_price_override: input.doubleLayerPriceOverride || null,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') return { error: 'A product with this slug already exists.' };
      return { error: error.message };
    }

    revalidateCatalog(input.slug);
    return { id: data.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    if (input.slug && !isValidSlug(input.slug)) return { error: 'Invalid slug format.' };

    type ProductUpdate = {
      name?: string; slug?: string; category_id?: string | null;
      short_description?: string | null; description?: string | null;
      is_active?: boolean; is_available?: boolean; is_featured?: boolean;
      display_order?: number;
      silicone_price_override?: number | null;
      acrylic_price_override?: number | null;
      double_layer_price_override?: number | null;
    };
    const update: ProductUpdate = {};
    if (input.name !== undefined) update.name = input.name.trim();
    if (input.slug !== undefined) update.slug = input.slug.trim();
    if (input.categoryId !== undefined) update.category_id = input.categoryId || null;
    if (input.shortDescription !== undefined) update.short_description = input.shortDescription || null;
    if (input.description !== undefined) update.description = input.description || null;
    if (input.isActive !== undefined) update.is_active = input.isActive;
    if (input.isAvailable !== undefined) update.is_available = input.isAvailable;
    if (input.isFeatured !== undefined) update.is_featured = input.isFeatured;
    if (input.displayOrder !== undefined) update.display_order = input.displayOrder;
    if (input.siliconePriceOverride !== undefined) update.silicone_price_override = input.siliconePriceOverride || null;
    if (input.acrylicPriceOverride !== undefined) update.acrylic_price_override = input.acrylicPriceOverride || null;
    if (input.doubleLayerPriceOverride !== undefined) update.double_layer_price_override = input.doubleLayerPriceOverride || null;

    const { error } = await supabase.from('products').update(update).eq('id', id);
    if (error) {
      if (error.code === '23505') return { error: 'A product with this slug already exists.' };
      return { error: error.message };
    }

    revalidateCatalog(input.slug);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export async function setProductAvailability(
  id: string,
  isAvailable: boolean,
  slug: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase.from('products').update({ is_available: isAvailable }).eq('id', id);
    if (error) return { error: error.message };
    revalidateCatalog(slug);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export async function setProductActive(
  id: string,
  isActive: boolean,
  slug: string
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase.from('products').update({ is_active: isActive }).eq('id', id);
    if (error) return { error: error.message };
    revalidateCatalog(slug);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export async function deleteProduct(id: string, slug: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    // Get all product images to clean up Storage
    const { data: images } = await supabase
      .from('product_images')
      .select('id, storage_path')
      .eq('product_id', id);

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return { error: error.message };

    // Clean up storage objects (best-effort)
    if (images && images.length > 0) {
      await supabase.storage.from(BUCKET).remove(images.map(i => i.storage_path));
    }

    revalidateCatalog(slug);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// â”€â”€â”€ Fetch helpers for admin UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchAdminProducts() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name, short_description, description,
      is_available, is_active, is_featured, display_order,
      silicone_price_override, acrylic_price_override, double_layer_price_override,
      created_at, updated_at,
      categories ( id, name, slug ),
      product_images (
        id, storage_path, alt_text, display_order, is_primary
      )
    `)
    .order('display_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAdminProduct(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name, short_description, description,
      is_available, is_active, is_featured, display_order,
      silicone_price_override, acrylic_price_override, double_layer_price_override,
      created_at, updated_at,
      categories ( id, name, slug ),
      product_images (
        id, storage_path, alt_text, display_order, is_primary
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchCategories() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return data ?? [];
}

