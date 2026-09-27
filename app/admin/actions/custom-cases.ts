'use server';

import { revalidatePath } from 'next/cache';
import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission } from '@/lib/admin/permissions';
import { createAdminClient } from '@/lib/supabase/server';
import { namedCaseTemplateInputSchema } from '@/lib/custom-cases/templates';
import { processUploadImage } from '@/lib/images/process-upload';
import { deletePublicMedia, uploadPublicMedia } from '@/lib/storage/public-media';

const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

async function requireProducts(permission: 'products.view' | 'products.manage') {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, permission)) throw new Error(`Unauthorized: missing ${permission}`);
  return staff;
}

function hasValidMagicBytes(bytes: Uint8Array, type: string) {
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/webp') return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (type === 'image/avif') return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  return false;
}

export async function fetchAdminCustomCaseTemplates() {
  await requireProducts('products.view');
  const { data, error } = await createAdminClient().from('custom_case_templates').select('*').order('sort_order').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAdminCustomCaseTemplate(id: string) {
  await requireProducts('products.view');
  const { data, error } = await createAdminClient().from('custom_case_templates').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveCustomCaseTemplate(id: string | null, input: unknown, formData?: FormData) {
  try {
    const staff = await requireProducts('products.manage');
    const parsed = namedCaseTemplateInputSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid template settings.' };

    const supabase = createAdminClient();
    const file = formData?.get('file');
    let imagePath: string | undefined;
    let previousImagePath: string | null = null;

    if (file instanceof File && file.size) {
      if (file.size > MAX_UPLOAD_BYTES) return { error: 'Image exceeds the safe 1.5 MB upload limit.' };
      if (!MIME.has(file.type)) return { error: 'Use JPEG, PNG, WebP, or AVIF.' };
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasValidMagicBytes(bytes, file.type)) return { error: 'Image content does not match its declared type.' };

      let processed;
      try {
        processed = await processUploadImage(bytes, file.type, 'product');
      } catch (error) {
        console.error('[custom-case-template] image processing rejected upload:', error instanceof Error ? error.message : error);
        return { error: 'The template image is not a valid supported image.' };
      }

      try {
        imagePath = await uploadPublicMedia({
          category: 'custom-case-templates',
          supabasePrefix: 'custom-case-templates',
          object: { bytes: processed.bytes, contentType: processed.mimeType, extension: processed.extension },
        });
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Upload failed.' };
      }
    }

    if (!id && !imagePath) return { error: 'Template image is required.' };
    if (id && imagePath) {
      const { data: existing } = await supabase.from('custom_case_templates').select('image_path').eq('id', id).maybeSingle();
      previousImagePath = existing?.image_path ?? null;
    }

    const p = parsed.data;
    const row = {
      name: p.name, slug: p.slug, is_active: p.isActive, sort_order: p.sortOrder,
      allowed_script: 'BOTH', max_characters: p.englishMaxCharacters,
      font_key: p.englishFontKey, font_size: p.englishFontSize, font_weight: p.englishFontWeight,
      text_color: p.englishTextColor, text_x: p.englishTextX, text_y: p.englishTextY,
      text_rotation: p.englishTextRotation, text_align: p.englishTextAlign, text_transform: p.englishTextTransform,
      english_max_characters: p.englishMaxCharacters, english_font_key: p.englishFontKey,
      english_font_size: p.englishFontSize, english_font_weight: p.englishFontWeight,
      english_text_color: p.englishTextColor, english_text_x: p.englishTextX, english_text_y: p.englishTextY,
      english_text_rotation: p.englishTextRotation, english_text_align: p.englishTextAlign,
      english_text_transform: p.englishTextTransform,
      arabic_max_characters: p.arabicMaxCharacters, arabic_font_key: p.arabicFontKey,
      arabic_font_size: p.arabicFontSize, arabic_font_weight: p.arabicFontWeight,
      arabic_text_color: p.arabicTextColor, arabic_text_x: p.arabicTextX, arabic_text_y: p.arabicTextY,
      arabic_text_rotation: p.arabicTextRotation, arabic_text_align: p.arabicTextAlign,
    };

    const result = id
      ? await supabase.from('custom_case_templates').update({ ...row, ...(imagePath ? { image_path: imagePath } : {}) }).eq('id', id).select('id').single()
      : await supabase.from('custom_case_templates').insert({ ...row, image_path: imagePath!, created_by: staff!.userId }).select('id').single();

    if (result.error) {
      if (imagePath) await deletePublicMedia(imagePath).catch(() => undefined);
      return { error: result.error.code === '23505' ? 'That slug is already in use.' : result.error.message };
    }

    if (previousImagePath && previousImagePath !== imagePath) {
      await deletePublicMedia(previousImagePath).catch(error => {
        console.error('[custom-case-template] previous image cleanup failed:', error instanceof Error ? error.message : error);
      });
    }

    revalidatePath('/admin/custom-cases');
    revalidatePath('/custom-cases/named');
    return { id: result.data.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unexpected error.' };
  }
}

export async function setCustomCaseTemplateActive(id: string, isActive: boolean) {
  try {
    await requireProducts('products.manage');
    const { error } = await createAdminClient().from('custom_case_templates').update({ is_active: isActive }).eq('id', id);
    if (error) return { error: error.message };
    revalidatePath('/admin/custom-cases');
    revalidatePath('/custom-cases/named');
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unexpected error.' };
  }
}
