import { Check } from "lucide-react";
import { deriveCheckoutProgress } from "@/lib/checkout/progress";

type CheckoutProgressProps =
  | { phase: "CART" }
  | { phase: "INFORMATION" }
  | {
      phase: "ORDER";
      orderStatus: string;
      paymentStatus?: string | null;
    };

export function CheckoutProgress(props: CheckoutProgressProps) {
  const steps = deriveCheckoutProgress(props);

  return (
    <nav className="checkout-progress" aria-label="Checkout progress">
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.label}
            data-state={step.state}
            data-current={step.current ? "true" : "false"}
            aria-current={step.current ? "step" : undefined}
          >
            <span className="checkout-progress-step">
              {step.state === "complete" ? <Check aria-hidden="true" /> : null}
              <span>{step.label}</span>
              <span className="sr-only"> — {step.state === "terminated" ? "stopped" : step.state}</span>
            </span>
            {index < steps.length - 1 ? (
              <span className="checkout-progress-separator" aria-hidden="true">›</span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
