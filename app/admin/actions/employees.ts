'use server';

import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission, ALL_PERMISSIONS } from '@/lib/admin/permissions';
import { revalidatePath } from 'next/cache';

export async function fetchEmployees() {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, 'employees.manage')) {
    throw new Error('Unauthorized');
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('admin_staff')
    .select(`
      user_id,
      role,
      permissions,
      is_active,
      created_at,
      profiles (
        email,
        full_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch employees', error);
    throw new Error('Failed to fetch employees');
  }

  type StaffDbRow = {
    user_id: string;
    role: string;
    permissions: string[] | null;
    is_active: boolean;
    created_at: string;
    profiles: { email: string | null; full_name: string | null } | null;
  };

  return (data as unknown as StaffDbRow[]).map((row) => ({
    id: row.user_id,
    email: row.profiles?.email ?? '',
    name: row.profiles?.full_name || 'Unknown',
    role: row.role,
    permissions: row.permissions || [],
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

function canManageRole(currentRole: string, targetRole: string) {
  if (currentRole === 'OWNER') return true;
  if (currentRole === 'MANAGER' && targetRole === 'ORDER_STAFF') return true;
  return false;
}

function validatePermissions(rawPermissions: string[]) {
  const permissions = rawPermissions.filter(permission =>
    ALL_PERMISSIONS.includes(
      permission as (typeof ALL_PERMISSIONS)[number],
    ),
  );

  return permissions.length === rawPermissions.length
    ? permissions
    : null;
}

function managerCanGrantPermissions(
  currentRole: string,
  currentPermissions: string[],
  requestedPermissions: string[],
) {
  return (
    currentRole !== 'MANAGER' ||
    requestedPermissions.every(permission =>
      currentPermissions.includes(permission),
    )
  );
}

export async function createEmployee(formData: FormData) {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, 'employees.manage') || !staff) {
    return { success: false, error: 'You do not have permission to create this employee.' };
  }

  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');
  const role = String(formData.get('role') ?? '');
  const rawPermissions = formData
    .getAll('permissions')
    .map(value => String(value));

  if (fullName.length < 2 || fullName.length > 120) {
    return { success: false, error: 'Enter a valid full name.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Enter a valid email address.' };
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { success: false, error: 'Password does not meet the required security rules.' };
  }
  if (password !== confirmPassword) {
    return { success: false, error: 'Temporary passwords do not match.' };
  }

  if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'ORDER_STAFF') {
    return { success: false, error: 'Invalid employee role.' };
  }

  const permissions = validatePermissions(rawPermissions);
  if (!permissions) {
    return { success: false, error: 'Invalid permissions provided.' };
  }

  if (!canManageRole(staff.role, role)) {
    return { success: false, error: 'You do not have permission to create this employee.' };
  }
  if (!managerCanGrantPermissions(staff.role, staff.permissions, permissions)) {
    return {
      success: false,
      error: 'Managers may only grant permissions they personally possess.',
    };
  }

  const supabase = createAdminClient();
  const bootstrapToken = randomUUID();

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existingProfile) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const { error: tokenError } = await supabase
    .from('staff_signup_tokens')
    .insert({
      token: bootstrapToken,
      created_by: staff.userId,
    });
  if (tokenError) {
    console.error('[admin employees] Could not issue staff bootstrap token:', tokenError.message);
    return { success: false, error: 'Employee account could not be provisioned. Please try again.' };
  }

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        coolcase_staff_bootstrap_token: bootstrapToken,
      },
      app_metadata: { coolcase_account_type: 'staff' },
    });

  // The trigger consumes valid tokens. This also removes an unused token when
  // Auth rejects the request before the database insert.
  await supabase.from('staff_signup_tokens').delete().eq('token', bootstrapToken);

  if (authError || !authData.user) {
    const duplicate =
      authError?.code === 'email_exists' ||
      authError?.code === 'user_already_exists' ||
      authError?.message.toLowerCase().includes('already');

    if (!duplicate && authError) {
      console.error('[admin employees] Auth account creation failed:', authError.message);
    }

    const invalidPassword =
      authError?.status === 422 ||
      authError?.message.toLowerCase().includes('password');

    return {
      success: false,
      error: duplicate
        ? 'An account with this email already exists.'
        : invalidPassword
          ? 'Password does not meet the required security rules.'
        : 'Failed to create the employee account.',
    };
  }

  const userId = authData.user.id;
  const trustedStaffMarker =
    authData.user.app_metadata?.coolcase_account_type === 'staff';

  if (!trustedStaffMarker) {
    console.error('[admin employees] Auth user missing trusted staff marker:', userId);
    await supabase.auth.admin.deleteUser(userId);
    return {
      success: false,
      error: 'Employee account could not be provisioned. Please try again.',
    };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: fullName, email, phone: null, role: 'ADMIN' })
    .eq('id', userId);

  if (profileError) {
    console.error('[admin employees] Failed to promote staff profile:', profileError.message);
    await supabase.auth.admin.deleteUser(userId);
    return {
      success: false,
      error: 'Employee account could not be provisioned. Please try again.',
    };
  }

  const { error: staffError } = await supabase
    .from('admin_staff')
    .insert({
      user_id: userId,
      role,
      permissions,
      is_active: true,
      created_by: staff.userId,
    });

  if (staffError) {
    console.error('[admin employees] Failed to create staff record:', staffError.message);
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(userId);
    if (cleanupError) {
      console.error('[admin employees] Failed to clean up Auth user:', cleanupError.message);
    }
    return {
      success: false,
      error: 'Employee account could not be provisioned. Please try again.',
    };
  }

  revalidatePath('/admin/employees');
  return { success: true, email };
}

export async function updateEmployee(userId: string, formData: FormData) {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, 'employees.manage') || !staff) {
    return { success: false, error: 'Unauthorized' };
  }

  const role = formData.get('role') as string;
  const rawPermissions = formData.getAll('permissions') as string[];
  const isActive = formData.get('is_active') === 'true';

  if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'ORDER_STAFF') {
    return { success: false, error: 'Invalid role provided.' };
  }

  const permissions = validatePermissions(rawPermissions);
  if (!permissions) {
    return { success: false, error: 'Invalid permissions provided.' };
  }

  const supabase = createAdminClient();
  
  const { data: targetStaff } = await supabase.from('admin_staff').select('role').eq('user_id', userId).single();
  if (!targetStaff) return { success: false, error: 'Employee not found.' };

  if (!canManageRole(staff.role, targetStaff.role) || !canManageRole(staff.role, role)) {
    return { success: false, error: 'You do not have permission to manage this role.' };
  }
  if (!managerCanGrantPermissions(staff.role, staff.permissions, permissions)) {
    return {
      success: false,
      error: 'Managers may only grant permissions they personally possess.',
    };
  }

  if (targetStaff.role === 'OWNER' && (role !== 'OWNER' || !isActive)) {
    const { count } = await supabase.from('admin_staff').select('*', { count: 'exact', head: true }).eq('role', 'OWNER').eq('is_active', true);
    if (count && count <= 1) {
      return { success: false, error: 'Cannot downgrade or deactivate the last active OWNER.' };
    }
  }

  const { error } = await supabase
    .from('admin_staff')
    .update({
      role,
      permissions,
      is_active: isActive,
    })
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/employees');
  return { success: true };
}

export async function deactivateEmployee(userId: string) {
  const staff = await getStaffProfile();
  if (!requirePermission(staff, 'employees.manage') || !staff) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = createAdminClient();
  
  const { data: targetStaff } = await supabase.from('admin_staff').select('role').eq('user_id', userId).single();
  if (!targetStaff) return { success: false, error: 'Employee not found.' };

  if (!canManageRole(staff.role, targetStaff.role)) {
    return { success: false, error: 'You do not have permission to deactivate this role.' };
  }

  if (targetStaff.role === 'OWNER') {
    const { count } = await supabase.from('admin_staff').select('*', { count: 'exact', head: true }).eq('role', 'OWNER').eq('is_active', true);
    if (count && count <= 1) {
      return { success: false, error: 'Cannot deactivate the last active OWNER.' };
    }
  }

  const { error } = await supabase
    .from('admin_staff')
    .update({ is_active: false })
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/employees');
  return { success: true };
}
