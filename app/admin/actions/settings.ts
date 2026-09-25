'use server';

import { revalidatePath } from 'next/cache';

import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission } from '@/lib/admin/permissions';
import { parsePositiveNumber, parseStoredBoolean } from '@/lib/settings/parsers';
import type { Json } from '@/lib/supabase/database.types';
import { createAdminClient } from '@/lib/supabase/server';

const GENERAL_KEYS = [
  'store_name',
  'support_email',
  'support_phone',
  'whatsapp_number',
  'cod_enabled',
  'instapay_enabled',
  'instapay_number',
  'email_sender_name',
] as const;

const PRICING_KEYS = [
  'silicone_original_price',
  'silicone_selling_price',
  'acrylic_original_price',
  'acrylic_selling_price',
  'double_layer_original_price',
  'double_layer_selling_price',
] as const;

const SHIPPING_KEYS = ['shipping_fee'] as const;

const generalKeySet = new Set<string>(GENERAL_KEYS);
const pricingKeySet = new Set<string>(PRICING_KEYS);
const shippingKeySet = new Set<string>(SHIPPING_KEYS);

const DEFAULT_VISIBILITY: Record<string, boolean> = {
  store_name: true,
  support_email: true,
  support_phone: true,
  whatsapp_number: true,
  cod_enabled: true,
  instapay_enabled: true,
  instapay_number: false,
  email_sender_name: false,
  silicone_original_price: true,
  silicone_selling_price: true,
  acrylic_original_price: true,
  acrylic_selling_price: true,
  double_layer_original_price: true,
  double_layer_selling_price: true,
  shipping_fee: true,
};

type SettingEntry = {
  key: string;
  value: unknown;
};

function validatePricing(values: Map<string, unknown>): string | null {
  const parsed = new Map<string, number>();

  for (const key of PRICING_KEYS) {
    const value = parsePositiveNumber(values.get(key));
    if (value === null || !Number.isSafeInteger(value)) {
      return `${key} must be a finite positive whole number.`;
    }
    parsed.set(key, value);
  }

  const pairs = [
    ['Silicone', 'silicone_original_price', 'silicone_selling_price'],
    ['Acrylic', 'acrylic_original_price', 'acrylic_selling_price'],
    ['Double Layer', 'double_layer_original_price', 'double_layer_selling_price'],
  ] as const;

  for (const [label, originalKey, sellingKey] of pairs) {
    const original = parsed.get(originalKey);
    const selling = parsed.get(sellingKey);
    if (original === undefined || selling === undefined || original < selling) {
      return `${label} original price cannot be lower than its selling price.`;
    }
  }

  return null;
}

export async function upsertSettings(
  entries: SettingEntry[],
): Promise<{ error?: string }> {
  try {
    const staff = await getStaffProfile();
    if (!staff) return { error: 'Unauthorized' };
    if (entries.length === 0) return { error: 'No settings were provided.' };

    let hasSettings = false;
    let hasShipping = false;
    const seenKeys = new Set<string>();

    for (const entry of entries) {
      if (seenKeys.has(entry.key)) {
        return { error: `Duplicate setting key: ${entry.key}` };
      }
      seenKeys.add(entry.key);

      if (generalKeySet.has(entry.key) || pricingKeySet.has(entry.key)) {
        hasSettings = true;
      } else if (shippingKeySet.has(entry.key)) {
        hasShipping = true;
      } else {
        return { error: `Invalid setting key: ${entry.key}` };
      }
    }

    if (hasSettings && !requirePermission(staff, 'settings.manage')) {
      return { error: 'Unauthorized: missing settings.manage' };
    }
    if (hasShipping && !requirePermission(staff, 'shipping.manage')) {
      return { error: 'Unauthorized: missing shipping.manage' };
    }

    const supabase = createAdminClient();
    const keysToRead = [
      ...new Set([
        ...seenKeys,
        ...PRICING_KEYS,
        'cod_enabled',
        'instapay_enabled',
      ]),
    ];

    const { data: currentSettings, error: currentError } = await supabase
      .from('store_settings')
      .select('key, value, is_public')
      .in('key', keysToRead);

    if (currentError) {
      console.error('[admin settings] Failed to load current settings:', currentError);
      return { error: 'Failed to validate current settings.' };
    }

    const currentValues = new Map<string, unknown>(
      (currentSettings ?? []).map(row => [row.key, row.value] as const),
    );
    for (const entry of entries) currentValues.set(entry.key, entry.value);

    const booleanEntries = entries.filter(
      entry => entry.key === 'cod_enabled' || entry.key === 'instapay_enabled',
    );
    if (booleanEntries.some(entry => typeof entry.value !== 'boolean')) {
      return { error: 'Payment method settings must be boolean values.' };
    }

    const codEnabled = parseStoredBoolean(currentValues.get('cod_enabled'), true);
    const instapayEnabled = parseStoredBoolean(
      currentValues.get('instapay_enabled'),
      true,
    );
    if (!codEnabled && !instapayEnabled) {
      return { error: 'You must have at least one payment method enabled.' };
    }

    if (entries.some(entry => pricingKeySet.has(entry.key))) {
      const pricingError = validatePricing(currentValues);
      if (pricingError) return { error: pricingError };
    }

    const shippingEntry = entries.find(entry => entry.key === 'shipping_fee');
    if (shippingEntry) {
      const fee = Number(shippingEntry.value);
      if (!Number.isSafeInteger(fee) || fee < 0) {
        return { error: 'Shipping fee must be a finite non-negative whole number.' };
      }
    }

    const visibility = new Map(
      (currentSettings ?? []).map(row => [row.key, row.is_public] as const),
    );
    const updatedAt = new Date().toISOString();
    const payload = entries.map(entry => ({
      key: entry.key,
      value: entry.value as Json,
      is_public:
        visibility.get(entry.key) ?? DEFAULT_VISIBILITY[entry.key] ?? false,
      updated_by: staff.userId,
      updated_at: updatedAt,
    }));

    const { error } = await supabase
      .from('store_settings')
      .upsert(payload, { onConflict: 'key' });

    if (error) {
      console.error('[admin settings] Failed to save settings:', error);
      return { error: `Failed to save settings: ${error.message}` };
    }

    revalidatePath('/', 'layout');
    revalidatePath('/admin/settings');
    revalidatePath('/admin/shipping');
    revalidatePath('/checkout');

    return {};
  } catch (error) {
    console.error('[admin settings] Unexpected settings error:', error);
    return {
      error: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
}

export async function fetchAllSettings(): Promise<
  Array<{
    key: string;
    value: unknown;
    isPublic: boolean;
    updatedAt: string;
  }>
> {
  const staff = await getStaffProfile();
  const canManageSettings = requirePermission(staff, 'settings.manage');
  const canManageShipping = requirePermission(staff, 'shipping.manage');

  if (!canManageSettings && !canManageShipping) {
    throw new Error('Unauthorized');
  }

  const allowedKeys = [
    ...(canManageSettings ? [...GENERAL_KEYS, ...PRICING_KEYS] : []),
    ...(canManageShipping ? SHIPPING_KEYS : []),
  ];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('store_settings')
    .select('key, value, is_public, updated_at')
    .in('key', allowedKeys)
    .order('key', { ascending: true });

  if (error) {
    console.error('[admin settings] Failed to fetch settings:', error);
    throw new Error(`Failed to load settings: ${error.message}`);
  }

  return (data ?? []).map(row => ({
    key: row.key,
    value: row.value,
    isPublic: row.is_public,
    updatedAt: row.updated_at,
  }));
}
