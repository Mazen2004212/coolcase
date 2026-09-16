'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCustomer } from '@/lib/auth/user';

async function requireAdmin() {
  const customer = await getCustomer();
  if (!customer || customer.profile?.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return customer;
}

/** Upsert one or more store_settings keys. Admin only. */
export async function upsertSettings(
  entries: Array<{ key: string; value: unknown; isPublic?: boolean }>
): Promise<{ error?: string }> {
  try {
    const customer = await requireAdmin();
    const supabase = await createClient();

    for (const entry of entries) {
      const { error } = await supabase
        .from('store_settings')
        .upsert(
          {
            key:        entry.key,
            value:      entry.value as import('@/lib/supabase/database.types').Json,
            is_public:  entry.isPublic ?? false,
            updated_by: customer.user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
      if (error) return { error: `Failed to save "${entry.key}": ${error.message}` };
    }

    revalidatePath('/', 'layout');
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

/** Fetch all settings (public + private). Admin-only. */
export async function fetchAllSettings(): Promise<
  Array<{ key: string; value: unknown; isPublic: boolean; updatedAt: string }>
> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('store_settings')
    .select('key, value, is_public, updated_at')
    .order('key', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    key:       r.key,
    value:     r.value,
    isPublic:  r.is_public,
    updatedAt: r.updated_at,
  }));
}
