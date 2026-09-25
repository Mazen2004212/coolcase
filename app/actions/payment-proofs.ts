'use server';

import 'server-only';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { processUploadImage } from '@/lib/images/process-upload';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const orderIdSchema = z.string().uuid();
const attachResultSchema = z.object({
  payment_id: z.string().uuid(),
  order_id: z.string().uuid(),
  status: z.literal('PENDING_VERIFICATION'),
  upload_id: z.string().uuid(),
  storage_path: z.string().min(1),
  uploaded_at: z.string(),
  previous_upload_id: z.string().uuid().nullable(),
  previous_storage_path: z.string().nullable(),
});

type ValidatedImage = {
  extension: 'jpg' | 'png' | 'webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
};

export type PaymentProofUploadResult =
  | { ok: true; status: 'PENDING_VERIFICATION' }
  | { ok: false; error: string };

function hasBytes(bytes: Uint8Array, offset: number, expected: readonly number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function validateImageSignature(bytes: Uint8Array): ValidatedImage | null {
  if (
    bytes.length >= 4 &&
    hasBytes(bytes, 0, [0xff, 0xd8, 0xff]) &&
    hasBytes(bytes, bytes.length - 2, [0xff, 0xd9])
  ) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }

  if (
    bytes.length >= 33 &&
    hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    hasBytes(bytes, 12, [0x49, 0x48, 0x44, 0x52]) &&
    hasBytes(bytes, bytes.length - 12, [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
  ) {
    return { extension: 'png', mimeType: 'image/png' };
  }

  const declaredWebpSize = bytes.length >= 8
    ? new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(0, true) + 8
    : 0;
  const webpChunk = bytes.length >= 16
    ? String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
    : '';

  if (
    bytes.length >= 20 &&
    hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50]) &&
    declaredWebpSize === bytes.length &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(webpChunk)
  ) {
    return { extension: 'webp', mimeType: 'image/webp' };
  }

  return null;
}

function safeDisplayFilename(value: string) {
  const sanitized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f/\\]/g, '_')
    .trim();

  return (sanitized || 'payment-proof').slice(0, 180);
}

async function cleanupNewUpload(uploadId: string | null, storagePath: string | null) {
  const admin = createAdminClient();

  if (storagePath) {
    const { error } = await admin.storage.from('payment-proofs').remove([storagePath]);
    if (error) console.error('[payment-proof] object cleanup failed:', error.message);
  }

  if (uploadId) {
    const { error } = await admin.from('customer_uploads').delete().eq('id', uploadId);
    if (error) console.error('[payment-proof] metadata cleanup failed:', error.message);
  }
}

async function cleanupSupersededUpload(uploadId: string, storagePath: string) {
  const admin = createAdminClient();
  const { count, error: referenceError } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('payment_proof_upload_id', uploadId);

  if (referenceError || (count ?? 0) > 0) {
    if (referenceError) {
      console.error('[payment-proof] replacement reference check failed:', referenceError.message);
    }
    return;
  }

  const { error: objectError } = await admin.storage
    .from('payment-proofs')
    .remove([storagePath]);
  if (objectError) {
    console.error('[payment-proof] superseded object cleanup failed:', objectError.message);
    return;
  }

  const { error: metadataError } = await admin
    .from('customer_uploads')
    .delete()
    .eq('id', uploadId)
    .eq('upload_type', 'PAYMENT_PROOF');
  if (metadataError) {
    console.error('[payment-proof] superseded metadata cleanup failed:', metadataError.message);
  }
}

export async function uploadPaymentProof(
  orderIdInput: string,
  formData: FormData
): Promise<PaymentProofUploadResult> {
  const parsedOrderId = orderIdSchema.safeParse(orderIdInput);
  if (!parsedOrderId.success) return { ok: false, error: 'Invalid order.' };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return { ok: false, error: 'Please sign in again.' };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, customer_id, status, payment_method')
    .eq('id', parsedOrderId.data)
    .eq('customer_id', user.id)
    .maybeSingle();

  if (orderError || !order) return { ok: false, error: 'Order not found.' };
  if (!['INSTAPAY', 'CASH_ON_DELIVERY'].includes(order.payment_method)) {
    return { ok: false, error: 'Payment proof is not available for this order.' };
  }
  if (!['PENDING_ADMIN_APPROVAL', 'PENDING_CONFIRMATION'].includes(order.status)) {
    return { ok: false, error: 'This order no longer accepts payment proofs.' };
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('status')
    .eq('order_id', order.id)
    .maybeSingle();
  if (paymentError || !payment) return { ok: false, error: 'Payment record not found.' };
  if (!['PENDING', 'REJECTED'].includes(payment.status)) {
    return {
      ok: false,
      error:
        payment.status === 'PENDING_VERIFICATION'
          ? 'Payment proof is already awaiting review.'
          : 'This payment does not accept another proof.',
    };
  }

  const value = formData.get('file');
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false, error: 'Choose a payment screenshot to upload.' };
  }
  if (value.size > MAX_PROOF_BYTES) {
    return { ok: false, error: 'Payment proof must be 5 MiB or smaller.' };
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type)) {
    return { ok: false, error: 'Use a JPEG, PNG, or WebP image.' };
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  const detected = validateImageSignature(bytes);
  if (!detected || detected.mimeType !== value.type) {
    return { ok: false, error: 'The file content does not match a supported image format.' };
  }

  let processed;
  try {
    processed = await processUploadImage(bytes, value.type, 'payment-proof');
  } catch (error) {
    console.error('[payment-proof] image processing rejected upload:', error instanceof Error ? error.message : error);
    return { ok: false, error: 'The payment proof is not a valid supported image.' };
  }

  const admin = createAdminClient();
  const storagePath = `${user.id}/${randomUUID()}.${processed.extension}`;
  let uploadId: string | null = null;

  const { error: storageError } = await admin.storage
    .from('payment-proofs')
    .upload(storagePath, processed.bytes, {
      contentType: processed.mimeType,
      cacheControl: '0',
      upsert: false,
    });
  if (storageError) return { ok: false, error: 'Could not upload the payment proof.' };

  const { data: upload, error: metadataError } = await admin
    .from('customer_uploads')
    .insert({
      user_id: user.id,
      upload_type: 'PAYMENT_PROOF',
      storage_path: storagePath,
      original_filename: safeDisplayFilename(value.name),
      mime_type: processed.mimeType,
      file_size_bytes: processed.storedBytes,
    })
    .select('id')
    .single();

  if (metadataError || !upload) {
    await cleanupNewUpload(null, storagePath);
    return { ok: false, error: 'Could not record the payment proof.' };
  }
  uploadId = upload.id;

  const { data: attachData, error: attachError } = await supabase.rpc(
    'attach_payment_proof',
    { p_order_id: order.id, p_upload_id: uploadId }
  );

  const parsedAttach = attachResultSchema.safeParse(attachData);
  if (attachError || !parsedAttach.success) {
    await cleanupNewUpload(uploadId, storagePath);
    return { ok: false, error: attachError?.message || 'Could not attach the payment proof.' };
  }

  const previousId = parsedAttach.data.previous_upload_id;
  const previousPath = parsedAttach.data.previous_storage_path;
  if (previousId && previousPath) {
    await cleanupSupersededUpload(previousId, previousPath);
  }

  revalidatePath(`/account/orders/${order.id}`);
  return { ok: true, status: 'PENDING_VERIFICATION' };
}
