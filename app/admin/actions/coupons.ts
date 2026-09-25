'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/server';

export type CouponDiscountType =
    | 'PERCENTAGE'
    | 'FIXED';

export type AdminCoupon = {
    id: string;
    code: string;
    title: string;
    discountType: CouponDiscountType;
    discountValue: number;
    minimumSubtotal: number;
    isActive: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    usageLimit: number | null;
    perCustomerLimit: number | null;
    customerId: string | null;
    customerName: string | null;
    customerEmail: string | null;
    redemptionCount: number;
    createdAt: string;
    updatedAt: string;
};

export type CouponCustomerOption = {
    id: string;
    name: string;
    email: string;
};

export type SaveCouponInput = {
    id?: string;
    code: string;
    title: string;
    discountType: CouponDiscountType;
    discountValue: number;
    minimumSubtotal: number;
    isActive: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    usageLimit: number | null;
    perCustomerLimit: number | null;
    customerId: string | null;
};

import { getStaffProfile } from '@/lib/admin/user';
import { requirePermission } from '@/lib/admin/permissions';

async function requireAdmin(permission: string = 'coupons.view') {
    const staff = await getStaffProfile();

    if (!requirePermission(staff, permission)) {
        throw new Error(
            `Unauthorized: missing ${permission}`,
        );
    }

    return staff;
}

function normaliseCode(code: string) {
    return code
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
}

function nullablePositiveInteger(
    value: number | null,
    field: string,
) {
    if (value === null) {
        return;
    }

    if (
        !Number.isInteger(value) ||
        value <= 0
    ) {
        throw new Error(
            `${field} must be a positive whole number.`,
        );
    }
}

function validateCoupon(
    input: SaveCouponInput,
) {
    const code = normaliseCode(
        input.code,
    );

    if (!code) {
        throw new Error(
            'Coupon code is required.',
        );
    }

    if (!input.title.trim()) {
        throw new Error(
            'Coupon title is required.',
        );
    }

    if (
        input.discountType !==
        'PERCENTAGE' &&
        input.discountType !== 'FIXED'
    ) {
        throw new Error(
            'Invalid discount type.',
        );
    }

    if (
        !Number.isFinite(
            input.discountValue,
        ) ||
        input.discountValue <= 0
    ) {
        throw new Error(
            'Discount value must be greater than zero.',
        );
    }

    if (
        input.discountType ===
        'PERCENTAGE' &&
        input.discountValue > 100
    ) {
        throw new Error(
            'Percentage discount cannot exceed 100%.',
        );
    }

    if (
        !Number.isFinite(
            input.minimumSubtotal,
        ) ||
        input.minimumSubtotal < 0
    ) {
        throw new Error(
            'Minimum subtotal cannot be negative.',
        );
    }

    nullablePositiveInteger(
        input.usageLimit,
        'Usage limit',
    );

    nullablePositiveInteger(
        input.perCustomerLimit,
        'Per-customer limit',
    );

    if (
        input.startsAt &&
        input.expiresAt
    ) {
        const start = Date.parse(
            input.startsAt,
        );

        const end = Date.parse(
            input.expiresAt,
        );

        if (
            Number.isNaN(start) ||
            Number.isNaN(end)
        ) {
            throw new Error(
                'Invalid coupon date.',
            );
        }

        if (end <= start) {
            throw new Error(
                'Expiry must be after the start date.',
            );
        }
    }

    return code;
}

export async function fetchCouponCustomers(): Promise<
    CouponCustomerOption[]
> {
    await requireAdmin('coupons.view');

    const supabase =
        createAdminClient();

    const { data, error } =
        await supabase
            .from('profiles')
            .select(
                'id, full_name, email',
            )
            .eq('role', 'CUSTOMER')
            .order('full_name', {
                ascending: true,
            });

    if (error) {
        console.error(
            '[admin coupons] Failed to load customers:',
            error,
        );

        throw new Error(
            'Failed to load customers.',
        );
    }

    return (data ?? []).map(
        customer => ({
            id: customer.id,
            name:
                customer.full_name ||
                customer.email ||
                'Customer',
            email:
                customer.email || '',
        }),
    );
}

export async function fetchCoupons(): Promise<
    AdminCoupon[]
> {
    await requireAdmin('coupons.view');

    const supabase =
        createAdminClient();

    const [
        couponsResult,
        redemptionsResult,
        customersResult,
    ] = await Promise.all([
        supabase
            .from('coupons')
            .select(`
        id,
        code,
        title,
        discount_type,
        discount_value,
        minimum_subtotal,
        is_active,
        starts_at,
        expires_at,
        usage_limit,
        per_customer_limit,
        customer_id,
        created_at,
        updated_at
      `)
            .order('created_at', {
                ascending: false,
            }),

        supabase
            .from(
                'coupon_redemptions',
            )
            .select('coupon_id'),

        supabase
            .from('profiles')
            .select(
                'id, full_name, email',
            )
            .eq('role', 'CUSTOMER'),
    ]);

    if (couponsResult.error) {
        console.error(
            '[admin coupons] Failed to load coupons:',
            couponsResult.error,
        );

        throw new Error(
            'Failed to load coupons.',
        );
    }

    if (
        redemptionsResult.error
    ) {
        console.error(
            '[admin coupons] Failed to load redemptions:',
            redemptionsResult.error,
        );

        throw new Error(
            'Failed to load coupon usage.',
        );
    }

    if (customersResult.error) {
        console.error(
            '[admin coupons] Failed to load customers:',
            customersResult.error,
        );

        throw new Error(
            'Failed to load coupon customers.',
        );
    }

    const redemptionCounts =
        new Map<string, number>();

    for (
        const redemption of
        redemptionsResult.data ?? []
    ) {
        redemptionCounts.set(
            redemption.coupon_id,
            (redemptionCounts.get(
                redemption.coupon_id,
            ) ?? 0) + 1,
        );
    }

    const customers =
        new Map(
            (
                customersResult.data ?? []
            ).map(customer => [
                customer.id,
                customer,
            ]),
        );

    return (
        couponsResult.data ?? []
    ).map(coupon => {
        const customer =
            coupon.customer_id
                ? customers.get(
                    coupon.customer_id,
                )
                : null;

        return {
            id: coupon.id,
            code: coupon.code,
            title: coupon.title,

            discountType: coupon.discount_type as CouponDiscountType,

            discountValue:
                Number(
                    coupon.discount_value,
                ),

            minimumSubtotal:
                Number(
                    coupon.minimum_subtotal,
                ),

            isActive:
                coupon.is_active,

            startsAt:
                coupon.starts_at,

            expiresAt:
                coupon.expires_at,

            usageLimit:
                coupon.usage_limit,

            perCustomerLimit:
                coupon.per_customer_limit,

            customerId:
                coupon.customer_id,

            customerName:
                customer?.full_name ??
                null,

            customerEmail:
                customer?.email ?? null,

            redemptionCount:
                redemptionCounts.get(
                    coupon.id,
                ) ?? 0,

            createdAt:
                coupon.created_at,

            updatedAt:
                coupon.updated_at,
        };
    });
}

export async function fetchCoupon(
    id: string,
): Promise<AdminCoupon | null> {
    await requireAdmin('coupons.view');

    const supabase =
        createAdminClient();

    const {
        data: coupon,
        error,
    } = await supabase
        .from('coupons')
        .select(`
      id,
      code,
      title,
      discount_type,
      discount_value,
      minimum_subtotal,
      is_active,
      starts_at,
      expires_at,
      usage_limit,
      per_customer_limit,
      customer_id,
      created_at,
      updated_at
    `)
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error(
            '[admin coupons] Failed to load coupon:',
            error,
        );

        throw new Error(
            'Failed to load coupon.',
        );
    }

    if (!coupon) {
        return null;
    }

    const {
        count: redemptionCount,
        error:
        redemptionCountError,
    } = await supabase
        .from('coupon_redemptions')
        .select('*', {
            count: 'exact',
            head: true,
        })
        .eq('coupon_id', id);

    if (
        redemptionCountError
    ) {
        console.error(
            '[admin coupons] Failed to count redemptions:',
            redemptionCountError,
        );

        throw new Error(
            'Failed to load coupon usage.',
        );
    }

    let customerName:
        | string
        | null = null;

    let customerEmail:
        | string
        | null = null;

    if (coupon.customer_id) {
        const {
            data: customer,
            error: customerError,
        } = await supabase
            .from('profiles')
            .select(
                'full_name, email',
            )
            .eq(
                'id',
                coupon.customer_id,
            )
            .maybeSingle();

        if (customerError) {
            console.error(
                '[admin coupons] Failed to load assigned customer:',
                customerError,
            );

            throw new Error(
                'Failed to load assigned customer.',
            );
        }

        customerName =
            customer?.full_name ??
            null;

        customerEmail =
            customer?.email ??
            null;
    }

    return {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,

        discountType:
            coupon.discount_type as CouponDiscountType,

        discountValue:
            Number(
                coupon.discount_value,
            ),

        minimumSubtotal:
            Number(
                coupon.minimum_subtotal,
            ),

        isActive:
            coupon.is_active,

        startsAt:
            coupon.starts_at,

        expiresAt:
            coupon.expires_at,

        usageLimit:
            coupon.usage_limit,

        perCustomerLimit:
            coupon.per_customer_limit,

        customerId:
            coupon.customer_id,

        customerName,
        customerEmail,

        redemptionCount:
            redemptionCount ?? 0,

        createdAt:
            coupon.created_at,

        updatedAt:
            coupon.updated_at,
    };
}

export async function saveCoupon(
    input: SaveCouponInput,
): Promise<
    | {
        ok: true;
        id: string;
    }
    | {
        ok: false;
        error: string;
    }
> {
    try {
        const admin =
            await requireAdmin('coupons.manage');

        const supabase =
            createAdminClient();

        const code =
            validateCoupon(input);

        const payload = {
            code,
            title:
                input.title.trim(),

            discount_type:
                input.discountType,

            discount_value:
                input.discountValue,

            minimum_subtotal:
                input.minimumSubtotal,

            is_active:
                input.isActive,

            starts_at:
                input.startsAt
                    ? new Date(
                        input.startsAt,
                    ).toISOString()
                    : null,

            expires_at:
                input.expiresAt
                    ? new Date(
                        input.expiresAt,
                    ).toISOString()
                    : null,

            usage_limit:
                input.usageLimit,

            per_customer_limit:
                input.perCustomerLimit,

            customer_id:
                input.customerId,
        };

        if (input.id) {
            const {
                data,
                error,
            } = await supabase
                .from('coupons')
                .update(payload)
                .eq('id', input.id)
                .select('id')
                .single();

            if (error) {
                if (
                    error.code === '23505'
                ) {
                    return {
                        ok: false,
                        error:
                            'A coupon with this code already exists.',
                    };
                }

                console.error(
                    '[admin coupons] Failed to update coupon:',
                    error,
                );

                return {
                    ok: false,
                    error:
                        'Failed to update coupon.',
                };
            }

            revalidatePath(
                '/admin/coupons',
            );

            revalidatePath(
                `/admin/coupons/${input.id}`,
            );

            revalidatePath(
                '/checkout',
            );

            return {
                ok: true,
                id: data.id,
            };
        }

        const {
            data,
            error,
        } = await supabase
            .from('coupons')
            .insert({
                ...payload,

                created_by:
                    admin?.userId,
            })
            .select('id')
            .single();

        if (error) {
            if (
                error.code === '23505'
            ) {
                return {
                    ok: false,
                    error:
                        'A coupon with this code already exists.',
                };
            }

            console.error(
                '[admin coupons] Failed to create coupon:',
                error,
            );

            return {
                ok: false,
                error:
                    'Failed to create coupon.',
            };
        }

        revalidatePath(
            '/admin/coupons',
        );

        revalidatePath(
            '/checkout',
        );

        return {
            ok: true,
            id: data.id,
        };
    } catch (error) {
        console.error(
            '[admin coupons] Unexpected save error:',
            error,
        );

        return {
            ok: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Unexpected error.',
        };
    }
}

export async function setCouponActive(
    id: string,
    isActive: boolean,
): Promise<
    | {
        ok: true;
    }
    | {
        ok: false;
        error: string;
    }
> {
    try {
        await requireAdmin('coupons.manage');

        const supabase =
            createAdminClient();

        const { error } =
            await supabase
                .from('coupons')
                .update({
                    is_active:
                        isActive,
                })
                .eq('id', id);

        if (error) {
            console.error(
                '[admin coupons] Failed to update coupon status:',
                error,
            );

            return {
                ok: false,
                error:
                    'Failed to update coupon status.',
            };
        }

        revalidatePath(
            '/admin/coupons',
        );

        revalidatePath(
            '/checkout',
        );

        return {
            ok: true,
        };
    } catch (error) {
        return {
            ok: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Unexpected error.',
        };
    }
}
