import 'server-only';

/**
 * Authoritative server-side order status transition rules.
 *
 * The frontend (orders.tsx) also has a TRANSITIONS map — this is the server
 * authoritative version that must be enforced on every mutation.
 *
 * Rules:
 * - Normal forward path: PENDING_ADMIN_APPROVAL → CONFIRMED → PREPARING → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
 * - CANCELLED is reachable from any non-terminal status
 * - REJECTED is reachable from PENDING_ADMIN_APPROVAL only
 * - Terminal statuses (DELIVERED, CANCELLED, REJECTED) have no outbound transitions
 *
 * DB enum values use SCREAMING_SNAKE_CASE. Frontend labels use Title Case.
 */

export type DbOrderStatus =
  | 'PENDING_ADMIN_APPROVAL'
  | 'PENDING_CONFIRMATION'   // legacy — maps to PENDING_ADMIN_APPROVAL
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED';

const ALLOWED_TRANSITIONS: Partial<Record<DbOrderStatus, DbOrderStatus[]>> = {
  PENDING_ADMIN_APPROVAL:  ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  PENDING_CONFIRMATION:    ['CONFIRMED', 'REJECTED', 'CANCELLED'], // legacy alias
  CONFIRMED:               ['PREPARING', 'CANCELLED'],
  PREPARING:               ['SHIPPED', 'CANCELLED'],
  SHIPPED:                 ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY:        ['DELIVERED', 'CANCELLED'],
  // DELIVERED, CANCELLED, REJECTED are terminal — no outbound transitions
};

export const TERMINAL_STATUSES: DbOrderStatus[] = ['DELIVERED', 'CANCELLED', 'REJECTED'];

export function isTerminalStatus(status: DbOrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isTransitionAllowed(from: DbOrderStatus, to: DbOrderStatus): boolean {
  if (isTerminalStatus(from)) return false;
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function validateTransition(from: DbOrderStatus, to: DbOrderStatus): void {
  if (!isTransitionAllowed(from, to)) {
    throw new Error(
      `Invalid order status transition: ${from} → ${to}. ` +
      `Allowed from ${from}: ${(ALLOWED_TRANSITIONS[from] ?? []).join(', ') || 'none (terminal)'}`
    );
  }
}

/**
 * Maps DB status to the frontend-facing display label used by the Admin UI
 * and email templates.
 */
export function dbStatusToLabel(status: DbOrderStatus): string {
  const map: Record<string, string> = {
    PENDING_ADMIN_APPROVAL: 'Pending Approval',
    PENDING_CONFIRMATION:   'Pending Approval',
    CONFIRMED:              'Confirmed',
    PREPARING:              'Preparing',
    SHIPPED:                'Shipped',
    OUT_FOR_DELIVERY:       'Out for Delivery',
    DELIVERED:              'Delivered',
    CANCELLED:              'Cancelled',
    REJECTED:               'Rejected',
  };
  return map[status] ?? status;
}

/**
 * Maps the timestamp column name for a given terminal/milestone status.
 * Returns null if the status has no dedicated timestamp column.
 */
export function getStatusTimestampColumn(status: DbOrderStatus): string | null {
  const map: Partial<Record<DbOrderStatus, string>> = {
    CONFIRMED:        'confirmed_at',
    SHIPPED:          'shipped_at',
    DELIVERED:        'delivered_at',
    CANCELLED:        'cancelled_at',
    REJECTED:         'rejected_at',
  };
  return map[status] ?? null;
}
