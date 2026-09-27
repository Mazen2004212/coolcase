import assert from "node:assert/strict";
import test from "node:test";
import { deriveCheckoutProgress } from "../lib/checkout/progress";

function states(input: Parameters<typeof deriveCheckoutProgress>[0]) {
  return deriveCheckoutProgress(input).map(({ state, current }) => ({ state, current }));
}

test("cart and information phases expose the current customer step", () => {
  assert.deepEqual(states({ phase: "CART" }), [
    { state: "active", current: true },
    { state: "waiting", current: false },
    { state: "waiting", current: false },
    { state: "waiting", current: false },
  ]);
  assert.deepEqual(states({ phase: "INFORMATION" }), [
    { state: "complete", current: false },
    { state: "active", current: true },
    { state: "waiting", current: false },
    { state: "waiting", current: false },
  ]);
});

test("required InstaPay and COD payment states remain on Payment", () => {
  for (const paymentStatus of ["PENDING", "PENDING_VERIFICATION", "REJECTED"]) {
    const result = states({
      phase: "ORDER",
      orderStatus: "PENDING_ADMIN_APPROVAL",
      paymentStatus,
    });
    assert.deepEqual(result.slice(0, 2).map((step) => step.state), ["complete", "complete"]);
    assert.deepEqual(result[2], { state: "active", current: true });
    assert.deepEqual(result[3], { state: "waiting", current: false });
  }
});

test("verified payment does not imply admin confirmation", () => {
  const result = states({
    phase: "ORDER",
    orderStatus: "PENDING_ADMIN_APPROVAL",
    paymentStatus: "VERIFIED",
  });
  assert.deepEqual(result[2], { state: "complete", current: true });
  assert.deepEqual(result[3], { state: "waiting", current: false });
});

test("confirmed and fulfillment orders complete checkout", () => {
  for (const orderStatus of ["CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) {
    const result = states({ phase: "ORDER", orderStatus, paymentStatus: "VERIFIED" });
    assert.ok(result.every((step) => step.state === "complete"));
    assert.equal(result[3]?.current, true);
  }
});

test("cancelled and rejected orders never show fake confirmation", () => {
  for (const orderStatus of ["CANCELLED", "REJECTED"]) {
    const unpaid = states({ phase: "ORDER", orderStatus, paymentStatus: "REJECTED" });
    assert.equal(unpaid[2]?.state, "terminated");
    assert.equal(unpaid[3]?.state, "terminated");

    const paid = states({ phase: "ORDER", orderStatus, paymentStatus: "VERIFIED" });
    assert.equal(paid[2]?.state, "complete");
    assert.equal(paid[3]?.state, "terminated");
  }
});

test("historical COD NOT_REQUIRED follows the actual order status", () => {
  const pending = states({
    phase: "ORDER",
    orderStatus: "PENDING_ADMIN_APPROVAL",
    paymentStatus: "NOT_REQUIRED",
  });
  assert.equal(pending[2]?.state, "complete");
  assert.equal(pending[3]?.state, "waiting");

  const confirmed = states({ phase: "ORDER", orderStatus: "CONFIRMED", paymentStatus: "NOT_REQUIRED" });
  assert.ok(confirmed.every((step) => step.state === "complete"));
});

test("missing or unverified payment never implies checkout completion", () => {
  for (const paymentStatus of [null, "PENDING", "PENDING_VERIFICATION", "REJECTED", "REFUNDED"]) {
    const result = states({ phase: "ORDER", orderStatus: "CONFIRMED", paymentStatus });
    assert.equal(result[2]?.state, "active");
    assert.equal(result[3]?.state, "waiting");
  }
});
