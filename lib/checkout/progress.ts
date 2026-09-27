export const checkoutProgressLabels = [
  "Cart",
  "Information",
  "Payment",
  "Confirmation",
] as const;

export type CheckoutProgressPhase = "CART" | "INFORMATION" | "ORDER";
export type CheckoutProgressState = "complete" | "active" | "waiting" | "terminated";

export type CheckoutProgressStep = {
  label: (typeof checkoutProgressLabels)[number];
  state: CheckoutProgressState;
  current: boolean;
};

type CheckoutProgressInput =
  | { phase: "CART" }
  | { phase: "INFORMATION" }
  | {
      phase: "ORDER";
      orderStatus: string;
      paymentStatus?: string | null;
    };

const acceptedOrderStatuses = new Set([
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
]);

const terminatedOrderStatuses = new Set(["CANCELLED", "REJECTED"]);
const completedPaymentStatuses = new Set(["VERIFIED", "NOT_REQUIRED"]);

export function deriveCheckoutProgress(input: CheckoutProgressInput): CheckoutProgressStep[] {
  if (input.phase === "CART") {
    return checkoutProgressLabels.map((label, index) => ({
      label,
      state: index === 0 ? "active" : "waiting",
      current: index === 0,
    }));
  }

  if (input.phase === "INFORMATION") {
    return checkoutProgressLabels.map((label, index) => ({
      label,
      state: index === 0 ? "complete" : index === 1 ? "active" : "waiting",
      current: index === 1,
    }));
  }

  const orderAccepted = acceptedOrderStatuses.has(input.orderStatus);
  const orderTerminated = terminatedOrderStatuses.has(input.orderStatus);
  const paymentComplete = completedPaymentStatuses.has(input.paymentStatus ?? "");
  const checkoutComplete = orderAccepted && paymentComplete;

  return [
    { label: "Cart", state: "complete", current: false },
    { label: "Information", state: "complete", current: false },
    {
      label: "Payment",
      state: paymentComplete ? "complete" : orderTerminated ? "terminated" : "active",
      current: !checkoutComplete && !orderTerminated,
    },
    {
      label: "Confirmation",
      state: checkoutComplete ? "complete" : orderTerminated ? "terminated" : "waiting",
      current: checkoutComplete,
    },
  ];
}
