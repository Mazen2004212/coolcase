'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { getCustomer } from '@/lib/auth/user';
import { sendOrderStatusEmail } from '@/lib/orders/email';
import type { Json } from '@/lib/supabase/database.types';

// ─── Supported materials and their DB enum values ────────────────────────────

const DB_MATERIAL: Record<
  string,
  'SILICONE' | 'ACRYLIC' | 'DOUBLE_LAYER'
> = {
  silicon: 'SILICONE',
  acrylic: 'ACRYLIC',
  'double-layer': 'DOUBLE_LAYER',
};

const NETWORK_MAP: Record<
  string,
  'FOUR_G' | 'FIVE_G'
> = {
  '4G': 'FOUR_G',
  '5G': 'FIVE_G',
};

const IPHONE_MODELS_PREFIX = 'iPhone';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckoutItem = {
  productId: string;
  material: string;
  phoneBrand: string;
  phoneModel: string;
  customPhoneModel?: string;
  networkType: string;
  quantity: number;
  isCustom?: boolean;
  customDesignUploadId?: string;
};

export type CheckoutInput = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  governorate: string;
  city: string;
  area: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  deliveryNotes?: string;
  paymentMethod: 'COD' | 'INSTAPAY';
  items: CheckoutItem[];
  savedAddressId?: string;
};

export type CheckoutResult =
  | {
      ok: true;
      orderNumber: string;
      orderId: string;
    }
  | {
      ok: false;
      error: string;
    };

// ─── Pricing ─────────────────────────────────────────────────────────────────

type PricingMap = Record<
  string,
  {
    selling: number;
    original: number;
  }
>;

async function loadPricing(
  supabase: ReturnType<typeof createAdminClient>
): Promise<PricingMap> {
  const { data } = await supabase
    .from('store_settings')
    .select('key, value')
    .in('key', [
      'silicone_selling_price',
      'silicone_original_price',
      'acrylic_selling_price',
      'acrylic_original_price',
      'double_layer_selling_price',
      'double_layer_original_price',
      'custom_selling_price',
      'custom_original_price',
      'shipping_fee',
    ]);

  const s = Object.fromEntries(
    (data ?? []).map(row => [
      row.key,
      Number(row.value),
    ])
  );

  return {
    silicon: {
      selling:
        s.silicone_selling_price ?? 180,
      original:
        s.silicone_original_price ?? 230,
    },

    acrylic: {
      selling:
        s.acrylic_selling_price ?? 225,
      original:
        s.acrylic_original_price ?? 299,
    },

    'double-layer': {
      selling:
        s.double_layer_selling_price ?? 399,
      original:
        s.double_layer_original_price ?? 460,
    },

    custom: {
      selling:
        s.custom_selling_price ?? 239,
      original:
        s.custom_original_price ?? 289,
    },

    shipping: {
      selling:
        s.shipping_fee ?? 50,
      original:
        s.shipping_fee ?? 50,
    },
  };
}

// ─── Failed checkout custom-upload cleanup ────────────────────────────────────

/**
 * Removes Custom Case uploads that were uploaded before checkout,
 * but never became linked to a successfully-created order.
 *
 * Security rules:
 * - only operates on upload IDs supplied by this checkout
 * - upload must belong to the current authenticated customer
 * - guest checkout only matches guest uploads (user_id IS NULL)
 * - linked uploads are NEVER deleted
 */
async function cleanupCustomUploads(
  supabase: ReturnType<typeof createAdminClient>,
  uploadIds: string[],
  customerId: string | null
): Promise<void> {
  try {
    const ids = [
      ...new Set(
        uploadIds.filter(
          (id): id is string =>
            typeof id === 'string' &&
            id.length > 0
        )
      ),
    ];

    if (!ids.length) {
      return;
    }

    const baseQuery = supabase
      .from('customer_uploads')
      .select(
        'id, user_id, storage_path'
      )
      .in('id', ids)
      .eq(
        'upload_type',
        'CUSTOM_CASE_DESIGN'
      );

    const {
      data: uploads,
      error: lookupError,
    } = customerId
      ? await baseQuery.eq(
          'user_id',
          customerId
        )
      : await baseQuery.is(
          'user_id',
          null
        );

    if (lookupError) {
      console.error(
        '[checkout] custom upload cleanup lookup failed:',
        lookupError
      );
      return;
    }

    if (!uploads?.length) {
      return;
    }

    const candidateIds = uploads.map(
      upload => upload.id
    );

    // Never delete an upload already attached
    // to an order item.
    const {
      data: linkedItems,
      error: linkedLookupError,
    } = await supabase
      .from('order_items')
      .select(
        'custom_design_upload_id'
      )
      .in(
        'custom_design_upload_id',
        candidateIds
      );

    if (linkedLookupError) {
      console.error(
        '[checkout] linked upload lookup failed:',
        linkedLookupError
      );
      return;
    }

    const linkedIds = new Set(
      (linkedItems ?? [])
        .map(
          item =>
            item.custom_design_upload_id
        )
        .filter(
          (id): id is string =>
            Boolean(id)
        )
    );

    const safeUploads = uploads.filter(
      upload =>
        !linkedIds.has(upload.id)
    );

    if (!safeUploads.length) {
      return;
    }

    const safeIds = safeUploads.map(
      upload => upload.id
    );

    const storagePaths =
      safeUploads.map(
        upload =>
          upload.storage_path
      );

    /*
     * Delete DB metadata first.
     *
     * If an order started referencing the upload
     * between our lookup and this delete,
     * the FK should prevent deletion.
     */
    const { error: deleteError } =
      await supabase
        .from('customer_uploads')
        .delete()
        .in('id', safeIds);

    if (deleteError) {
      console.error(
        '[checkout] custom upload metadata cleanup failed:',
        deleteError
      );
      return;
    }

    const { error: storageError } =
      await supabase.storage
        .from('custom-designs')
        .remove(storagePaths);

    if (storageError) {
      console.error(
        '[checkout] custom upload storage cleanup failed:',
        storageError
      );
    }
  } catch (error) {
    console.error(
      '[checkout] unexpected custom upload cleanup error:',
      error
    );
  }
}

// ─── Main server action ──────────────────────────────────────────────────────

export async function submitCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const supabase =
    createAdminClient();

  /*
   * These uploads have already been created by
   * uploadCustomDesign() before submitCheckout()
   * is called.
   */
  const customUploadIds = [
    ...new Set(
      (input.items ?? [])
        .map(
          item =>
            item.customDesignUploadId
        )
        .filter(
          (id): id is string =>
            Boolean(id)
        )
    ),
  ];

  /*
   * Undefined means that authentication ownership
   * has not yet been resolved.
   *
   * We do not attempt cleanup if getCustomer()
   * itself fails because we cannot safely determine
   * whether these uploads belong to a guest or user.
   */
  let resolvedCustomerId:
    | string
    | null
    | undefined;

  try {
    const customer =
      await getCustomer();

    const customerId =
      customer?.user.id ?? null;

    resolvedCustomerId =
      customerId;

    const failCheckout = async (
      error: string
    ): Promise<CheckoutResult> => {
      await cleanupCustomUploads(
        supabase,
        customUploadIds,
        customerId
      );

      return {
        ok: false,
        error,
      };
    };

    // ─── Basic input validation ──────────────────────────────────────────────

    if (
      !input.customerName?.trim()
    ) {
      return await failCheckout(
        'Full name is required.'
      );
    }

    if (
      !input.customerPhone?.trim()
    ) {
      return await failCheckout(
        'Phone number is required.'
      );
    }

    if (
      !input.customerEmail?.trim()
    ) {
      return await failCheckout(
        'Email address is required.'
      );
    }

    if (
      !input.street?.trim()
    ) {
      return await failCheckout(
        'Street address is required.'
      );
    }

    if (
      !input.building?.trim()
    ) {
      return await failCheckout(
        'Building number is required.'
      );
    }

    if (!input.paymentMethod) {
      return await failCheckout(
        'Payment method is required.'
      );
    }

    if (!input.items?.length) {
      return await failCheckout(
        'Your cart is empty.'
      );
    }

    if (
      input.items.length > 50
    ) {
      return await failCheckout(
        'Too many items in cart.'
      );
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailRegex.test(
        input.customerEmail
      )
    ) {
      return await failCheckout(
        'Enter a valid email address.'
      );
    }

    const dbPaymentMethod =
      input.paymentMethod === 'COD'
        ? 'CASH_ON_DELIVERY'
        : 'INSTAPAY';

    // ─── Authoritative pricing ───────────────────────────────────────────────

    const pricing =
      await loadPricing(
        supabase
      );

    const shippingFee =
      pricing.shipping.selling;

    const orderItems: Json[] =
      [];

    let subtotal = 0;

    // ─── Validate and price items ────────────────────────────────────────────

    for (
      const item of input.items
    ) {
      if (
        !Number.isInteger(
          item.quantity
        ) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        return await failCheckout(
          `Invalid quantity for item: ${item.quantity}.`
        );
      }

      const materialKey =
        item.material;

      if (
        ![
          'silicon',
          'acrylic',
          'double-layer',
        ].includes(
          materialKey
        )
      ) {
        return await failCheckout(
          `Unsupported material: ${materialKey}.`
        );
      }

      if (
        materialKey ===
          'acrylic' &&
        !item.phoneBrand.startsWith(
          IPHONE_MODELS_PREFIX
        )
      ) {
        return await failCheckout(
          'Acrylic cases are only available for iPhone models.'
        );
      }

      if (
        !['4G', '5G'].includes(
          item.networkType
        )
      ) {
        return await failCheckout(
          `Invalid network type: ${item.networkType}.`
        );
      }

      if (
        !item.phoneModel?.trim()
      ) {
        return await failCheckout(
          'Phone model is required.'
        );
      }

      const dbMaterial =
        DB_MATERIAL[
          materialKey
        ];

      const dbNetwork =
        NETWORK_MAP[
          item.networkType
        ];

      let productId:
        | string
        | null = null;

      let productNameSnapshot =
        'Custom Case';

      let productImageSnapshot:
        | string
        | null = null;

      let unitPrice: number;

      // ─── Custom Case ───────────────────────────────────────────────────────

      if (item.isCustom) {
        if (
          !item.customDesignUploadId
        ) {
          return await failCheckout(
            'Custom case design upload is required.'
          );
        }

        unitPrice =
          pricing.custom.selling;
      } else {
        // ─── Standard product ────────────────────────────────────────────────

        if (!item.productId) {
          return await failCheckout(
            'Product ID is required for standard items.'
          );
        }

        const {
          data: product,
          error: productError,
        } = await supabase
          .from('products')
          .select(`
            id,
            name,
            is_active,
            is_available,
            silicone_price_override,
            acrylic_price_override,
            double_layer_price_override,
            product_images(
              storage_path,
              is_primary
            )
          `)
          .eq(
            'id',
            item.productId
          )
          .maybeSingle();

        if (
          productError ||
          !product
        ) {
          return await failCheckout(
            'One or more products could not be found.'
          );
        }

        if (
          !product.is_active
        ) {
          return await failCheckout(
            `"${product.name}" is no longer available in the store.`
          );
        }

        if (
          !product.is_available
        ) {
          return await failCheckout(
            `"${product.name}" is currently sold out.`
          );
        }

        productId =
          product.id;

        productNameSnapshot =
          product.name;

        // Pick primary image for snapshot
        const images =
          product.product_images ??
          [];

        const primaryImg =
          images.find(
            (
              img: {
                is_primary: boolean;
              }
            ) =>
              img.is_primary
          ) ?? images[0];

        if (primaryImg) {
          const SUPABASE_URL =
            process.env
              .NEXT_PUBLIC_SUPABASE_URL!;

          productImageSnapshot =
            `${SUPABASE_URL}/storage/v1/object/public/product-assets/${primaryImg.storage_path}`;
        }

        // Per-product override or global price
        const overrideKey = {
          silicon:
            'silicone_price_override',
          acrylic:
            'acrylic_price_override',
          'double-layer':
            'double_layer_price_override',
        }[
          materialKey
        ] as keyof typeof product;

        const override =
          product[
            overrideKey
          ] as
            | number
            | null;

        unitPrice =
          override ??
          pricing[
            materialKey
          ]?.selling ??
          pricing.silicon
            .selling;
      }

      const lineTotal =
        unitPrice *
        item.quantity;

      subtotal +=
        lineTotal;

      orderItems.push({
        product_id:
          productId,

        product_name_snapshot:
          productNameSnapshot,

        product_image_snapshot:
          productImageSnapshot,

        material:
          dbMaterial,

        phone_model:
          item.phoneModel.trim(),

        custom_phone_model:
          item.customPhoneModel?.trim() ||
          null,

        network_type:
          dbNetwork,

        /*
         * Standard products must never link
         * a custom design upload even if a
         * manipulated client sends an ID.
         */
        custom_design_upload_id:
          item.isCustom
            ? item.customDesignUploadId ??
              null
            : null,

        unit_price:
          unitPrice,

        quantity:
          item.quantity,

        line_total:
          lineTotal,
      });
    }

    const totalAmount =
      subtotal +
      shippingFee;

    const cityArea =
      [
        input.area?.trim(),
        input.city?.trim(),
      ]
        .filter(Boolean)
        .join(', ') ||
      input.city?.trim() ||
      'N/A';

    const governorate =
      input.governorate?.trim() ||
      'Cairo';

    // ─── Atomic order creation RPC ───────────────────────────────────────────

    const {
      data: rpcResult,
      error: rpcError,
    } = await supabase.rpc(
      'create_order',
      {
        p_customer_id:
          customerId,

        p_customer_name:
          input.customerName.trim(),

        p_customer_phone:
          input.customerPhone.trim(),

        p_customer_email:
          input.customerEmail
            .trim()
            .toLowerCase(),

        p_governorate:
          governorate,

        p_city_area:
          cityArea,

        p_street_name:
          input.street.trim(),

        p_building_number:
          input.building.trim(),

        p_floor:
          input.floor?.trim() ||
          null,

        p_apartment:
          input.apartment?.trim() ||
          null,

        p_landmark:
          input.landmark?.trim() ||
          null,

        p_delivery_notes:
          input.deliveryNotes?.trim() ||
          null,

        p_subtotal_amount:
          subtotal,

        p_shipping_amount:
          shippingFee,

        p_total_amount:
          totalAmount,

        p_payment_method:
          dbPaymentMethod,

        /*
         * Keep this as the actual JSON array.
         * Do NOT JSON.stringify().
         */
        p_items:
          orderItems,

        p_address_id:
          input.savedAddressId ||
          null,
      }
    );

    if (rpcError) {
      console.error(
        '[checkout] create_order RPC error:',
        rpcError
      );

      return await failCheckout(
        'Order could not be created. Please try again.'
      );
    }

    const result =
      rpcResult as {
        order_id: string;
        order_number: string;
      };

    // ─── Email: best effort only ─────────────────────────────────────────────

    await sendOrderStatusEmail({
      orderId:
        result.order_id,

      recipientEmail:
        input.customerEmail
          .trim()
          .toLowerCase(),

      status:
        'Pending Approval',

      customerName:
        input.customerName.trim(),

      orderReference:
        result.order_number,

      total:
        totalAmount,

      paymentMethod:
        input.paymentMethod ===
        'COD'
          ? 'COD'
          : 'InstaPay',
    }).catch(error =>
      console.error(
        '[checkout] email send failed:',
        error
      )
    );

    return {
      ok: true,
      orderNumber:
        result.order_number,
      orderId:
        result.order_id,
    };
  } catch (err) {
    console.error(
      '[checkout] unexpected error:',
      err
    );

    /*
     * If authentication ownership was resolved,
     * clean up any unlinked pre-checkout uploads.
     *
     * Successfully linked uploads are protected
     * by cleanupCustomUploads().
     */
    if (
      resolvedCustomerId !==
      undefined
    ) {
      await cleanupCustomUploads(
        supabase,
        customUploadIds,
        resolvedCustomerId
      );
    }

    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.',
    };
  }
}

// ─── Custom case image upload ─────────────────────────────────────────────────

const MAX_CUSTOM_SIZE =
  10 * 1024 * 1024;

const ALLOWED_CUSTOM_TYPES: Record<
  string,
  string
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Magic byte signatures
const MAGIC_BYTES: Record<
  string,
  number[][]
> = {
  'image/jpeg': [
    [
      0xff,
      0xd8,
      0xff,
    ],
  ],

  'image/png': [
    [
      0x89,
      0x50,
      0x4e,
      0x47,
    ],
  ],

  'image/webp': [
    [
      0x52,
      0x49,
      0x46,
      0x46,
    ],
  ],
};

function verifyCustomImageMagicBytes(
  bytes: Uint8Array,
  mimeType: string
): boolean {
  const signatures =
    MAGIC_BYTES[
      mimeType
    ];

  if (!signatures) {
    return false;
  }

  return signatures.some(
    signature =>
      signature.every(
        (
          byte,
          index
        ) =>
          bytes[index] ===
          byte
      )
  );
}

export type UploadCustomDesignResult =
  | {
      ok: true;
      uploadId: string;
      storagePath: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Uploads a custom case design before checkout.
 *
 * - Authenticated uploads:
 *   <user-id>/<uuid>.<ext>
 *
 * - Guest uploads:
 *   guests/<uuid>.<ext>
 *
 * The custom-designs bucket remains private.
 */
export async function uploadCustomDesign(
  formData: FormData
): Promise<UploadCustomDesignResult> {
  try {
    const file =
      formData.get(
        'file'
      ) as
        | File
        | null;

    if (
      !file ||
      file.size === 0
    ) {
      return {
        ok: false,
        error:
          'No file provided.',
      };
    }

    if (
      file.size >
      MAX_CUSTOM_SIZE
    ) {
      return {
        ok: false,
        error:
          'Image must be under 10 MB.',
      };
    }

    const ext =
      ALLOWED_CUSTOM_TYPES[
        file.type
      ];

    if (!ext) {
      return {
        ok: false,
        error:
          'Only JPEG, PNG, and WebP images are allowed.',
      };
    }

    const bytes =
      new Uint8Array(
        await file.arrayBuffer()
      );

    if (
      !verifyCustomImageMagicBytes(
        bytes,
        file.type
      )
    ) {
      return {
        ok: false,
        error:
          'File content does not match its declared type.',
      };
    }

    const supabase =
      createAdminClient();

    const customer =
      await getCustomer();

    const userId =
      customer?.user.id ??
      null;

    const fileUuid =
      crypto.randomUUID();

    const storagePath =
      userId
        ? `${userId}/${fileUuid}.${ext}`
        : `guests/${fileUuid}.${ext}`;

    // Upload into private Storage bucket
    const {
      error: uploadError,
    } =
      await supabase.storage
        .from(
          'custom-designs'
        )
        .upload(
          storagePath,
          bytes,
          {
            contentType:
              file.type,
            upsert: false,
          }
        );

    if (uploadError) {
      return {
        ok: false,
        error:
          `Upload failed: ${uploadError.message}`,
      };
    }

    // Register upload metadata
    const {
      data: upload,
      error: dbError,
    } = await supabase
      .from(
        'customer_uploads'
      )
      .insert({
        user_id:
          userId,

        storage_path:
          storagePath,

        original_filename:
          file.name.slice(
            0,
            255
          ),

        mime_type:
          file.type,

        file_size_bytes:
          file.size,

        upload_type:
          'CUSTOM_CASE_DESIGN',
      })
      .select('id')
      .single();

    if (
      dbError ||
      !upload
    ) {
      // Metadata creation failed:
      // remove the newly uploaded object.
      await supabase.storage
        .from(
          'custom-designs'
        )
        .remove([
          storagePath,
        ]);

      return {
        ok: false,
        error:
          'Could not register upload. Please try again.',
      };
    }

    return {
      ok: true,
      uploadId:
        upload.id,
      storagePath,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Unexpected error during upload.',
    };
  }
}