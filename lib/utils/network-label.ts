/**
 * Explicit display-label mapping for network_type values.
 *
 * DB stores: "FOUR_G" | "FIVE_G"
 * Cart/checkout may store: "4G" | "5G"
 *
 * In all cases the user-facing label must be "4G" or "5G".
 * Never derive this label by title-casing the enum name.
 */
const NETWORK_LABELS: Record<string, string> = {
  FOUR_G: '4G',
  FIVE_G: '5G',
  // Pass-through for values already in display form
  '4G': '4G',
  '5G': '5G',
};

/**
 * Returns the correct display label for a network_type value.
 * Falls back to the raw value if not recognised (avoids silent breakage
 * when new enum members are added).
 */
export function formatNetworkType(value: string): string {
  return NETWORK_LABELS[value] ?? value;
}
