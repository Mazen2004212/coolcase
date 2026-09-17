import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Public order tracking endpoint.
 * Verifies order ownership via order_number + email or phone before returning any data.
 * Uses the track_order DB RPC which excludes internal/admin-only fields.
 *
 * POST /api/track-order
 * Body: { orderNumber: string; contact: string }
 * contact = customer email OR phone used at checkout
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { orderNumber?: string; contact?: string };
    const orderNumber = String(body.orderNumber ?? '').trim();
    const contact     = String(body.contact ?? '').trim();

    if (!orderNumber || !contact) {
      return NextResponse.json(
        { error: 'Order number and contact information are required.' },
        { status: 400 }
      );
    }

    // Minimal sanity checks to avoid unnecessary DB calls
    if (orderNumber.length > 50 || contact.length > 320) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
    }

    // Use service-role to call the track_order RPC
    // The RPC is security definer and handles all data filtering internally
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('track_order', {
      p_order_number: orderNumber,
      p_contact:      contact,
    });

    if (error) {
      console.error('[api/track-order] RPC error:', error.message);
      return NextResponse.json(
        { error: 'Tracking lookup failed. Please try again.' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No order found with that reference and contact information.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ order: data });
  } catch (err) {
    console.error('[api/track-order] unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
