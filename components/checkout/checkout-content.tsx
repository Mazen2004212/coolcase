"use client";

import { ArrowLeft, ArrowRight, Check, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  submitCheckout,
  uploadCustomDesign,
  validateCheckoutCoupon,
} from "@/app/checkout/actions";

import { saveCheckoutAddress } from "@/lib/account/actions";
import { splitCityArea } from "@/lib/account/address";
import {
  LOCAL_CART_KEY,
  LOCAL_CART_CHANGE_EVENT,
  LOCAL_BUY_NOW_KEY,
  LOCAL_BUY_NOW_CHANGE_EVENT,
  getLocalCartServerSnapshot,
  getCartSnapshotDefault,
  subscribeToLocalCart,
  getBuyNowSnapshot,
  subscribeToBuyNow,
  type StoredCartItem,
} from "@/lib/cart/local-cart";

import {
  INSTAPAY_TRANSFER_NUMBER,
  WHATSAPP_DISPLAY_NUMBER,
  deliveryCities,
  type CheckoutFormValues,
  type CheckoutPaymentMethod,
} from "@/lib/checkout/order-draft";

import {
  formatPrice,
  materialOptions,
} from "@/lib/data/product-options";
import { TransferDetails } from "@/components/payment/transfer-details";
import { DiscountRow } from "@/components/ui/price-display";
import { PaymentProofUpload } from "@/components/payment/payment-proof-upload";
import { namedCaseColorLabel } from "@/lib/custom-cases/templates";

export type CheckoutSavedAddress = {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  governorate: string;
  city_area: string;
  street_name: string;
  building_number: string;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  is_default: boolean;
};

export type CheckoutCustomer = {
  fullName: string;
  phone: string;
  email: string;
  addresses: CheckoutSavedAddress[];
};

/**
 * Convert the Custom Case data URL stored in the local cart
 * back into a File so it can be sent to the server upload action.
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, encoded] = dataUrl.split(",");

  if (!header || !encoded) {
    throw new Error("Invalid custom design image.");
  }

  const mimeMatch = header.match(
    /^data:(image\/(?:png|jpeg|webp));base64$/i
  );

  if (!mimeMatch) {
    throw new Error(
      "Unsupported custom design image. Please use JPEG, PNG, or WebP."
    );
  }

  const mime = mimeMatch[1];
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, {
    type: mime,
  });
}

function CheckoutItemImage({
  item,
}: {
  item: StoredCartItem;
}) {
  const [failed, setFailed] = useState(false);
  const image = item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.templateImage : item.image;

  return (
    <div className="checkout-item-image">
      {failed ? (
        <span>
          <ImageIcon aria-hidden="true" />
          <small>Preview unavailable</small>
        </span>
      ) : (
        <Image
          src={image}
          alt={
            item.kind === "custom"
              ? (item.customizationType === "NAMED_TEMPLATE" ? "Named Custom Case design example" : "Your uploaded custom case design")
              : `${item.productName} phone case`
          }
          fill
          sizes="72px"
          unoptimized={item.kind === "custom" && item.customizationType === "UPLOAD_DESIGN"}
          onError={() => setFailed(true)}
        />
      )}

      <b aria-label={`Quantity ${item.quantity}`}>
        {item.quantity}
      </b>
    </div>
  );
}

function CheckoutSummary({
  items,
  subtotal,
  total,
  shippingFee,
  appliedCoupon,
  couponCode,
  setCouponCode,
  handleApplyCoupon,
  validatingCoupon,
  couponError,
  setAppliedCoupon,
}: {
  items: StoredCartItem[];
  subtotal: number;
  total: number;
  shippingFee: number;
  appliedCoupon: { code: string; discountAmount: number } | null;
  couponCode: string;
  setCouponCode: (v: string) => void;
  handleApplyCoupon: () => void;
  validatingCoupon: boolean;
  couponError: string;
  setAppliedCoupon: (v: null | { code: string; discountAmount: number }) => void;
}) {
  return (
    <aside
      className="checkout-summary"
      aria-labelledby="checkout-summary-heading"
    >
      <p>Order / Summary</p>

      <h2 id="checkout-summary-heading">
        YOUR ORDER
      </h2>

      <details className="cc-summary-details"><summary>Order summary <strong>{formatPrice(total)}</strong></summary><div className="cc-summary-content"><div className="checkout-summary-items">
        {items.map((item, index) => (
          <article
            key={`${item.productId}-${item.material}-${item.phoneModel}-${item.networkType}-${index}`}
          >
            <CheckoutItemImage item={item} />

            <div>
              <h3>{item.productName}</h3>

              <p>
                {materialOptions[item.material].label}
              </p>

              {item.kind === "custom" ? item.customizationType === "NAMED_TEMPLATE" ? (
                <dl className="checkout-named-details">
                  <div><dt>English Name</dt><dd lang="en">{item.englishName}</dd></div>
                  <div><dt>Arabic Name</dt><dd lang="ar" dir="rtl">{item.arabicName}</dd></div>
                  <div><dt>English Color</dt><dd>{namedCaseColorLabel(item.englishColor)}</dd></div>
                  <div><dt>Arabic Color</dt><dd>{namedCaseColorLabel(item.arabicColor)}</dd></div>
                </dl>
              ) : <span>Custom design</span> : null}

              <p>
                {item.phoneModel} / {item.networkType}
              </p>
            </div>

            <strong>
              {formatPrice(
                item.discountedUnitPrice * item.quantity
              )}
            </strong>
          </article>
        ))}
      </div>

      <section aria-labelledby="coupon-heading" className="checkout-coupon-section">
        <h2 id="coupon-heading" className="sr-only">Coupon</h2>
        {!appliedCoupon ? (
          <div className="checkout-coupon-row">
            <label className="sr-only" htmlFor="checkout-coupon">Coupon code</label><input
              id="checkout-coupon" type="text"
              placeholder="Coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              disabled={validatingCoupon}
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={validatingCoupon || !couponCode.trim()}
            >
              {validatingCoupon ? "Applying…" : "Apply"}
            </button>
          </div>
        ) : (
          <div className="cc-feedback" data-tone="success" role="status">
            <div>
              <strong>{appliedCoupon.code}</strong> Applied
            </div>
            <button
              type="button"
              onClick={() => {
                setAppliedCoupon(null);
                setCouponCode("");
              }}
              style={{ textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
            >
              Remove
            </button>
          </div>
        )}
        {couponError ? <p role="alert" style={{ color: "#ef4444", fontSize: "14px", marginTop: "8px", marginBottom: 0 }}>{couponError}</p> : null}
      </section>

      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>

        {appliedCoupon ? (
          <DiscountRow label={`Coupon ${appliedCoupon.code}`} amount={appliedCoupon.discountAmount}/>
        ) : null}

        <div>
          <dt>Shipping</dt>
          <dd>{formatPrice(shippingFee)}</dd>
        </div>

        <div className="checkout-total">
          <dt>Total</dt>
          <dd>{formatPrice(total)}</dd>
        </div>
      </dl>

      <p className="checkout-delivery">
        Estimated delivery: 7&ndash;10 days
      </p>

      <small>
        Your final total is confirmed when you place your order.
      </small>
      </div></details>
    </aside>
  );
}

function WhatsAppButton({

  whatsappNumber,
}: {
  whatsappNumber?: string;
}) {
  return (
    <a
      className="checkout-whatsapp"
      href={`https://wa.me/${(whatsappNumber || WHATSAPP_DISPLAY_NUMBER).replace(/\D/g, "")}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact Coolcase support on WhatsApp (opens in a new tab)"
    >
      Contact Support on WhatsApp
      <ArrowRight aria-hidden="true" />
    </a>
  );
}

function Completion({
  email,
  paymentMethod,
  total,
  paymentExpectedAmount,
  remainingCodAmount,
  orderNumber,
  orderId,
  storeSettings,
}: {
  email: string;
  paymentMethod: CheckoutPaymentMethod;
  total: number;
  paymentExpectedAmount: number;
  remainingCodAmount: number;
  orderNumber: string;
  orderId: string;
  storeSettings?: CheckoutStoreSettings;
}) {
  const instaPay = paymentMethod === "INSTAPAY";
  const codDeposit = paymentMethod === "COD";

  return (
    <section
      className="checkout-success"
      aria-labelledby="checkout-success-title"
    >
      <span>
        <Check aria-hidden="true" />
      </span>

      <p>Pending admin approval</p>

      <h1 id="checkout-success-title">
        ORDER RECEIVED
      </h1>

      {orderNumber ? (
        <p className="checkout-success-ref">
          Order reference:{" "}
          <strong>{orderNumber}</strong>
        </p>
      ) : null}

      <h2>
        {instaPay
          ? "Your order has been received and is pending payment verification and approval."
          : "Your order has been received. Upload the 50% deposit proof for verification and approval."}
      </h2>

      {instaPay || codDeposit ? (
        <div className="checkout-success-whatsapp">
          <h3>{instaPay ? "Complete your InstaPay payment" : "Pay your 50% COD deposit"}</h3>

          <p>
            Transfer the exact amount below, then upload your proof securely.
          </p>
          {codDeposit ? <><p>Order total: <strong>{formatPrice(total)}</strong></p><p>Remaining on delivery: <strong>{formatPrice(remainingCodAmount)}</strong></p></> : null}
          <TransferDetails amount={paymentExpectedAmount} recipient={storeSettings?.instapayNumber || INSTAPAY_TRANSFER_NUMBER} />
          <p>Upload the transaction screenshot below. Your order will not be confirmed until Coolcase verifies the payment.</p>
          <PaymentProofUpload orderId={orderId} initialStatus="PENDING" />
          <p>Need help? WhatsApp support remains available.</p>
          <WhatsAppButton whatsappNumber={storeSettings?.whatsapp} />
        </div>
      ) : null}

      <p>
        Once Coolcase{" "}
        {instaPay
          ? "verifies the transaction and approves your order"
          : "verifies the deposit and approves your order"}
        , we&apos;ll send a confirmation email to:
      </p>

      <strong>{email}</strong>

      <div className="checkout-success-delivery">
        <span>
          Estimated delivery after confirmation
        </span>
        <b>7&ndash;10 days</b>
      </div>

      <Link
        href="/shop"
        prefetch={false}
      >
        Continue Shopping
        <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}

function SavedAddressCard({
  address,
  checked,
  onChange,
}: {
  address: CheckoutSavedAddress;
  checked: boolean;
  onChange: () => void;
}) {
  const location = splitCityArea(address.city_area);

  return (
    <label className="checkout-saved-card">
      <input
        type="radio"
        name="savedAddress"
        value={address.id}
        checked={checked}
        onChange={onChange}
      />

      <span>
        {address.is_default ? (
          <b>Default</b>
        ) : null}

        <strong>
          {address.label || "Saved Address"}
        </strong>

        <small>
          {address.recipient_name} / {address.phone}
        </small>

        <small>
          {address.street_name}, Building{" "}
          {address.building_number}
        </small>

        <small>
          {location.area}
          {location.city
            ? `, ${location.city}`
            : ""}
          , {address.governorate}
        </small>

        {address.floor ? (
          <small>
            Floor {address.floor}
            {address.apartment
              ? `, Apartment ${address.apartment}`
              : ""}
          </small>
        ) : null}

        {address.landmark ? (
          <small>
            Landmark: {address.landmark}
          </small>
        ) : null}
      </span>
    </label>
  );
}

export type CheckoutStoreSettings = {
  instapayNumber: string;
  whatsapp: string;
  codEnabled: boolean;
  instapayEnabled: boolean;
};

export type CheckoutContentProps = {
  customer?: CheckoutCustomer;
  shippingFee: number;
  mode?: string;
  storeSettings?: CheckoutStoreSettings;
};

export function CheckoutContent({
  customer,
  shippingFee,
  storeSettings,
  mode,
}: CheckoutContentProps) {
  const isBuyNow = mode === "buy-now";
  
  const cart = useSyncExternalStore(
    isBuyNow ? subscribeToBuyNow : subscribeToLocalCart,
    isBuyNow ? getBuyNowSnapshot : getCartSnapshotDefault,
    getLocalCartServerSnapshot
  );

  const defaultAddress =
    customer?.addresses.find(
      (address) => address.is_default
    ) ||
    customer?.addresses[0];

  const [addressMode, setAddressMode] =
    useState<"saved" | "new">(
      defaultAddress ? "saved" : "new"
    );

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] = useState(
    defaultAddress?.id || ""
  );

  const [completion, setCompletion] =
    useState<{
      email: string;
      paymentMethod: CheckoutPaymentMethod;
      orderNumber: string;
      orderId: string;
      total: number;
      paymentExpectedAmount: number;
      remainingCodAmount: number;
    } | null>(null);



  const [
    submissionError,
    setSubmissionError,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);

  useEffect(() => {
    const handleCartChange = () => {
      setAppliedCoupon(null);
      setCouponCode("");
    };

    window.addEventListener(LOCAL_CART_CHANGE_EVENT, handleCartChange);

    return () => {
      window.removeEventListener(LOCAL_CART_CHANGE_EVENT, handleCartChange);
    };
  }, []);

  async function handleApplyCoupon() {
    setCouponError("");
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const res = await validateCheckoutCoupon(
        couponCode,
        cart.items.map((item) => ({
          productId: item.productId,
          material: item.material,
          phoneBrand: item.phoneBrand,
          phoneModel: item.phoneModel,
          networkType: item.networkType,
          quantity: item.quantity,
          isCustom: item.kind === "custom",
          customizationType: item.kind === "custom" ? item.customizationType : undefined,
          customTemplateId: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.templateId : undefined,
          englishName: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.englishName : undefined,
          arabicName: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.arabicName : undefined,
          englishColor: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.englishColor : undefined,
          arabicColor: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.arabicColor : undefined,
        }))
      );
      if (!res.ok) {
        setCouponError(res.error);
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          code: res.code,
          discountAmount: res.discountAmount,
        });
        setCouponCode(res.code);
      }
    } catch {
      setCouponError("Failed to apply coupon.");
    } finally {
      setValidatingCoupon(false);
    }
  }

  const {
    register,
    handleSubmit,
    control,
    formState: {
      errors,
    },
  } = useForm<CheckoutFormValues>({
    defaultValues: {
      fullName: customer?.fullName || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
      governorate: "",
      city: "",
      area: "",
      street: "",
      building: "",
      floor: "",
      apartment: "",
      landmark: "",
      deliveryNotes: "",
    },
  });

  const paymentMethod = useWatch({
    control,
    name: "paymentMethod",
  });

  const subtotal =
    cart.items.reduce(
      (sum, item) =>
        sum +
        item.discountedUnitPrice *
        item.quantity,
      0
    );

  let finalDiscount = 0;
  if (appliedCoupon) {
    finalDiscount = appliedCoupon.discountAmount;
    if (finalDiscount > subtotal) {
      finalDiscount = subtotal;
    }
  }

  const total =
    subtotal - finalDiscount +
    (cart.items.length
      ? shippingFee
      : 0);

  const hasUnavailableItem = false;

  const manualAddress =
    !customer ||
    addressMode === "new";

  const selectedAddress =
    customer?.addresses.find(
      (address) =>
        address.id === selectedAddressId
    );

  if (completion) {
    return (
      <Completion
        {...completion}
        total={completion.total}
        storeSettings={storeSettings}
      />
    );
  }

  if (!cart.items.length) {
    if (isBuyNow) {
      return (
        <section className="checkout-blocked">
          <p>Checkout</p>
          <h1>BUY NOW SESSION EXPIRED</h1>
          <span>
            The selected product is no longer available for immediate checkout.
          </span>
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Return to Shop
          </Link>
        </section>
      );
    }
    return (
      <section className="checkout-blocked">
        <p>Checkout</p>

        <h1>YOUR CART IS EMPTY</h1>

        <span>
          Add a case before continuing to checkout.
        </span>

        <Link href="/cart">
          <ArrowLeft aria-hidden="true" />
          Return to Cart
        </Link>
      </section>
    );
  }

  if (hasUnavailableItem) {
    return (
      <section className="checkout-blocked">
        <p>Checkout paused</p>

        <h1>ITEM UNAVAILABLE</h1>

        <span>
          One or more items in your cart are currently unavailable.
          Please remove them before continuing.
        </span>

        <Link href="/cart">
          <ArrowLeft aria-hidden="true" />
          Return to Cart
        </Link>
      </section>
    );
  }

  async function submit(
    values: CheckoutFormValues
  ) {
    setSubmissionError("");
    setSubmitting(true);

    try {
      let savedAddressId:
        | string
        | undefined;

      let resolvedGov =
        values.governorate;

      let resolvedCity =
        values.city;

      let resolvedArea =
        values.area;

      let resolvedStreet =
        values.street;

      let resolvedBuilding =
        values.building;

      let resolvedFloor =
        values.floor;

      let resolvedApartment =
        values.apartment;

      let resolvedLandmark =
        values.landmark;

      if (
        customer &&
        addressMode === "saved"
      ) {
        if (!selectedAddress) {
          setSubmissionError(
            "Choose a saved address or deliver to a new address."
          );
          return;
        }

        savedAddressId =
          selectedAddress.id;

        const location =
          splitCityArea(
            selectedAddress.city_area
          );

        resolvedGov =
          selectedAddress.governorate;

        resolvedCity =
          location.city;

        resolvedArea =
          location.area;

        resolvedStreet =
          selectedAddress.street_name;

        resolvedBuilding =
          selectedAddress.building_number;

        resolvedFloor =
          selectedAddress.floor || "";

        resolvedApartment =
          selectedAddress.apartment || "";

        resolvedLandmark =
          selectedAddress.landmark || "";
      }

      if (
        customer &&
        addressMode === "new" &&
        values.saveAddress
      ) {
        const saved =
          await saveCheckoutAddress({
            label: "Home",
            governorate:
              values.governorate,
            city: values.city,
            area: values.area,
            street: values.street,
            building: values.building,
            floor: values.floor,
            apartment:
              values.apartment,
            landmark:
              values.landmark,
          });

        if (!saved.ok) {
          setSubmissionError(
            saved.message ||
            "We couldn't save this address."
          );
          return;
        }
      }

      /**
       * Build checkout items.
       *
       * Custom cases must upload their design first.
       * uploadCustomDesign() returns the customer_uploads UUID
       * that becomes order_items.custom_design_upload_id.
       */
      const checkoutItems: Parameters<
        typeof submitCheckout
      >[0]["items"] = [];

      for (const item of cart.items) {
        let customDesignUploadId:
          | string
          | undefined;

        if (item.kind === "custom" && item.customizationType === "UPLOAD_DESIGN") {
          let file: File;

          try {
            file = dataUrlToFile(
              item.image,
              item.uploadFileName
            );
          } catch (error) {
            setSubmissionError(
              error instanceof Error
                ? error.message
                : "Could not prepare your custom design image."
            );
            return;
          }

          const formData = new FormData();
          formData.append("file", file);

          const upload = await uploadCustomDesign(formData);

          if (!upload.ok) {
            setSubmissionError(upload.error);
            return;
          }

          customDesignUploadId = upload.uploadId;

        }

        checkoutItems.push({
          productId:
            item.productId,
          material:
            item.material,
          phoneBrand:
            item.phoneBrand,
          phoneModel:
            item.phoneModel,
          networkType:
            item.networkType,
          quantity:
            item.quantity,
          isCustom:
            item.kind === "custom",
          customizationType: item.kind === "custom" ? item.customizationType : undefined,
          customTemplateId: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.templateId : undefined,
          englishName: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.englishName : undefined,
          arabicName: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.arabicName : undefined,
          englishColor: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.englishColor : undefined,
          arabicColor: item.kind === "custom" && item.customizationType === "NAMED_TEMPLATE" ? item.arabicColor : undefined,
          customDesignUploadId,
        });
      }

      const result =
        await submitCheckout({
          customerName:
            values.fullName.trim(),

          customerPhone:
            values.phone.trim(),

          customerEmail:
            values.email.trim(),

          governorate:
            resolvedGov ||
            resolvedCity ||
            "Cairo",

          city:
            resolvedCity ||
            resolvedArea,

          area:
            resolvedArea,

          street:
            resolvedStreet,

          building:
            resolvedBuilding,

          floor:
            resolvedFloor ||
            undefined,

          apartment:
            resolvedApartment ||
            undefined,

          landmark:
            resolvedLandmark ||
            undefined,

          deliveryNotes:
            values.deliveryNotes?.trim() ||
            undefined,

          paymentMethod:
            values.paymentMethod as
            | "COD"
            | "INSTAPAY",

          items:
            checkoutItems,

          savedAddressId,

          couponCode:
            appliedCoupon?.code,
        });

      if (!result.ok) {
        setSubmissionError(
          result.error
        );
        return;
      }

      // Clear cart only after confirmed server-side order creation.
      try {
        window.localStorage.removeItem(
          isBuyNow ? LOCAL_BUY_NOW_KEY : LOCAL_CART_KEY
        );

        window.dispatchEvent(
          new Event(
            isBuyNow ? LOCAL_BUY_NOW_CHANGE_EVENT : LOCAL_CART_CHANGE_EVENT
          )
        );
      } catch {
        // Cart cleanup failure must not invalidate a completed order.
      }

      setCompletion({
        email:
          values.email.trim(),

        paymentMethod:
          values.paymentMethod as CheckoutPaymentMethod,

        orderNumber:
          result.orderNumber,
        orderId:
          result.orderId,
        total: result.totalAmount,
        paymentExpectedAmount: result.paymentExpectedAmount,
        remainingCodAmount: result.remainingCodAmount,
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error(
        "[checkout] unexpected submission error:",
        error
      );

      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Something went wrong while placing your order. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const required = (
    label: string
  ) => ({
    validate: (
      value: string
    ) =>
      !manualAddress ||
      value.trim().length > 0 ||
      `${label} is required`,
  });

  return (
    <>
      <header className="checkout-heading">
        <div>
          <p>
            {customer
              ? "Customer checkout"
              : "Guest checkout"}
          </p>

          <h1>CHECKOUT</h1>
        </div>

        <Link href="/cart">
          <ArrowLeft aria-hidden="true" />
          Back to Cart
        </Link>
      </header>

      <div className="checkout-layout">
        <form
          className="checkout-form"
          onSubmit={handleSubmit(
            submit
          )}
          noValidate
        >
          <section
            aria-labelledby="customer-details-heading"
          >
            <div className="checkout-section-heading">
              <span>01</span>

              <div>
                <h2 id="customer-details-heading">
                  Customer Details
                </h2>

                <p>
                  {customer
                    ? "Prefilled from your account. Changes apply to this checkout only."
                    : "Where we can reach you about your order."}
                </p>
              </div>
            </div>

            <div className="checkout-fields">
              <label className="checkout-field checkout-field-wide">
                Full Name

                <input
                  autoComplete="name"
                  aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "checkout-error-fullName" : undefined}
                  {...register(
                    "fullName",
                    {
                      required:
                        "Full name is required",
                    }
                  )}
                />

                {errors.fullName ? (
                  <small id="checkout-error-fullName" role="alert">
                    {
                      errors.fullName
                        .message
                    }
                  </small>
                ) : null}
              </label>

              <label className="checkout-field">
                Phone Number

                <input
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "checkout-error-phone" : undefined}
                  {...register(
                    "phone",
                    {
                      required:
                        "Phone is required",
                    }
                  )}
                />

                {errors.phone ? (
                  <small id="checkout-error-phone" role="alert">
                    {
                      errors.phone
                        .message
                    }
                  </small>
                ) : null}
              </label>

              <label className="checkout-field">
                Email Address

                <input
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "checkout-error-email" : undefined}
                  {...register(
                    "email",
                    {
                      required:
                        "Email is required",
                      pattern: {
                        value:
                          /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message:
                          "Enter a valid email address",
                      },
                    }
                  )}
                />

                {errors.email ? (
                  <small id="checkout-error-email" role="alert">
                    {
                      errors.email
                        .message
                    }
                  </small>
                ) : (
                  <em>
                    We&apos;ll send confirmation here after approval.
                  </em>
                )}
              </label>
            </div>
          </section>

          <section
            aria-labelledby="delivery-address-heading"
          >
            <div className="checkout-section-heading">
              <span>02</span>

              <div>
                <h2 id="delivery-address-heading">
                  Delivery Address
                </h2>

                <p>
                  {customer
                    ? "Where should we deliver your order?"
                    : "Tell us exactly where your case should arrive."}
                </p>
              </div>
            </div>

            {customer ? (
              <fieldset className="checkout-address-mode">
                <legend className="sr-only">
                  Delivery address source
                </legend>

                {customer.addresses.length ? (
                  <label>
                    <input
                      type="radio"
                      checked={
                        addressMode ===
                        "saved"
                      }
                      onChange={() =>
                        setAddressMode(
                          "saved"
                        )
                      }
                    />

                    <span>
                      Use a saved address
                    </span>
                  </label>
                ) : null}

                <label>
                  <input
                    type="radio"
                    checked={
                      addressMode ===
                      "new"
                    }
                    onChange={() =>
                      setAddressMode(
                        "new"
                      )
                    }
                  />

                  <span>
                    Deliver to a new address
                  </span>
                </label>
              </fieldset>
            ) : null}

            {customer &&
              addressMode ===
              "saved" ? (
              <>
                <div className="checkout-saved-list">
                  {customer.addresses.map(
                    (address) => (
                      <SavedAddressCard
                        key={
                          address.id
                        }
                        address={
                          address
                        }
                        checked={
                          selectedAddressId ===
                          address.id
                        }
                        onChange={() =>
                          setSelectedAddressId(
                            address.id
                          )
                        }
                      />
                    )
                  )}
                </div>

                <div className="checkout-fields checkout-notes-only">
                  <label className="checkout-field checkout-field-wide">
                    Delivery Notes{" "}
                    <span>
                      Optional
                    </span>

                    <textarea
                      rows={3}
                      {...register(
                        "deliveryNotes"
                      )}
                    />
                  </label>
                </div>
              </>
            ) : null}

            {manualAddress ? (
              <div className="checkout-fields">
                {customer ? (
                  <>
                    <label className="checkout-field">
                      Governorate

                      <select
                        defaultValue=""
                        aria-invalid={Boolean(errors.governorate)} aria-describedby={errors.governorate ? "checkout-error-governorate" : undefined}
                        {...register(
                          "governorate",
                          required(
                            "Governorate"
                          )
                        )}
                      >
                        <option value="">
                          Choose governorate
                        </option>
                        <option>
                          Cairo
                        </option>
                        <option>
                          Giza
                        </option>
                      </select>

                      {errors.governorate ? (
                  <small id="checkout-error-governorate" role="alert">
                          {
                            errors
                              .governorate
                              .message
                          }
                        </small>
                      ) : null}
                    </label>

                    <label className="checkout-field">
                      City

                      <input
                        autoComplete="address-level2"
                        aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "checkout-error-city" : undefined}
                        {...register(
                          "city",
                          required(
                            "City"
                          )
                        )}
                      />

                      {errors.city ? (
                  <small id="checkout-error-city" role="alert">
                          {
                            errors.city
                              .message
                          }
                        </small>
                      ) : null}
                    </label>
                  </>
                ) : (
                  <label className="checkout-field">
                    City

                    <select
                      autoComplete="address-level2"
                      aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "checkout-error-city" : undefined}
                      {...register(
                        "city",
                        required(
                          "City"
                        )
                      )}
                    >
                      <option value="">
                        Choose Cairo or Giza
                      </option>

                      {deliveryCities.map(
                        (city) => (
                          <option
                            key={
                              city
                            }
                          >
                            {city}
                          </option>
                        )
                      )}
                    </select>

                    {errors.city ? (
                  <small id="checkout-error-city" role="alert">
                        {
                          errors.city
                            .message
                        }
                      </small>
                    ) : null}
                  </label>
                )}

                <label className="checkout-field">
                  Area

                  <input
                    autoComplete="address-level3"
                    aria-invalid={Boolean(errors.area)} aria-describedby={errors.area ? "checkout-error-area" : undefined}
                    {...register(
                      "area",
                      required(
                        "Area"
                      )
                    )}
                  />

                  {errors.area ? (
                  <small id="checkout-error-area" role="alert">
                      {
                        errors.area
                          .message
                      }
                    </small>
                  ) : null}
                </label>

                <label className="checkout-field checkout-field-wide">
                  Street Name

                  <input
                    autoComplete="street-address"
                    aria-invalid={Boolean(errors.street)} aria-describedby={errors.street ? "checkout-error-street" : undefined}
                    {...register(
                      "street",
                      required(
                        "Street"
                      )
                    )}
                  />

                  {errors.street ? (
                  <small id="checkout-error-street" role="alert">
                      {
                        errors.street
                          .message
                      }
                    </small>
                  ) : null}
                </label>

                <label className="checkout-field">
                  Building Number

                  <input
                    aria-invalid={Boolean(errors.building)} aria-describedby={errors.building ? "checkout-error-building" : undefined}
                    {...register(
                      "building",
                      required(
                        "Building"
                      )
                    )}
                  />

                  {errors.building ? (
                  <small id="checkout-error-building" role="alert">
                      {
                        errors.building
                          .message
                      }
                    </small>
                  ) : null}
                </label>

                <label className="checkout-field">
                  Floor{" "}
                  <span>
                    Optional
                  </span>

                  <input
                    {...register(
                      "floor"
                    )}
                  />
                </label>

                <label className="checkout-field">
                  Apartment{" "}
                  <span>
                    Optional
                  </span>

                  <input
                    {...register(
                      "apartment"
                    )}
                  />
                </label>

                <label className="checkout-field checkout-field-wide">
                  Landmark{" "}
                  <span>
                    Optional
                  </span>

                  <input
                    {...register(
                      "landmark"
                    )}
                  />
                </label>

                <label className="checkout-field checkout-field-wide">
                  Delivery Notes{" "}
                  <span>
                    Optional
                  </span>

                  <textarea
                    rows={3}
                    {...register(
                      "deliveryNotes"
                    )}
                  />
                </label>

                {customer ? (
                  <label className="checkout-save-address">
                    <input
                      type="checkbox"
                      {...register(
                        "saveAddress"
                      )}
                    />

                    Save this address to my account
                  </label>
                ) : null}
              </div>
            ) : null}
          </section>

          <section
            aria-labelledby="payment-method-heading"
          >
            <div className="checkout-section-heading">
              <span>03</span>

              <div>
                <h2 id="payment-method-heading">
                  Payment Method
                </h2>

                <p>
                  Choose how you&apos;d like to pay.
                </p>
              </div>
            </div>

            <fieldset className="checkout-payment">
              <legend className="sr-only">
                Payment method
              </legend>

              {storeSettings?.codEnabled !== false && (
                <label>
                  <input
                    type="radio"
                    value="COD"
                    {...register(
                      "paymentMethod",
                      {
                        required:
                          "Choose a payment method",
                      }
                    )}
                  />

                  <span>
                    <b>
                      Cash on Delivery
                    </b>

                    <small>
                      50% deposit now, remaining balance on delivery.
                    </small>
                  </span>
                </label>
              )}

              {storeSettings?.instapayEnabled !== false && (
                <label>
                  <input
                    type="radio"
                    value="INSTAPAY"
                    {...register(
                      "paymentMethod",
                      {
                        required:
                          "Choose a payment method",
                      }
                    )}
                  />

                  <span>
                    <b>
                      InstaPay
                    </b>

                    <small>
                      Place your order first, then transfer and upload proof.
                    </small>
                  </span>
                </label>
              )}
            </fieldset>

            {errors.paymentMethod ? (
              <p
                className="checkout-payment-error"
                role="alert"
              >
                {
                  errors.paymentMethod
                    .message
                }
              </p>
            ) : null}

            {paymentMethod ===
              "COD" ? (
              <div className="checkout-payment-panel">
                <p>
                  Cash on Delivery
                </p>

                <h3>
                  Cash on Delivery requires a 50% deposit.
                </h3>

                <span>
                  To confirm your Cash on Delivery order, transfer the deposit and upload the payment proof.
                </span>
                <p>Order total: <strong>{formatPrice(total)}</strong></p>
                <p>50% deposit: <strong>{formatPrice(Number((total * 0.5).toFixed(2)))}</strong></p>
                <p>Pay on delivery: <strong>{formatPrice(Number((total - Number((total * 0.5).toFixed(2))).toFixed(2)))}</strong></p>
              </div>
            ) : null}

            {paymentMethod ===
              "INSTAPAY" ? (
              <div className="checkout-payment-panel checkout-instapay">
                <h3>Pay after placing your order</h3>
                <ol><li>Place your order.</li><li>We will show the final payable amount and official InstaPay number.</li><li>Transfer that exact amount.</li><li>Upload your payment proof securely.</li><li>Wait for payment review.</li></ol>
                <p>No transfer is needed before your order is created.</p>
              </div>
            ) : null}
          </section>

          {submissionError ? (
            <p
              className="checkout-form-error"
              role="alert"
            >
              {submissionError}
            </p>
          ) : null}

          <button
            type="submit"
            className="checkout-submit"
            disabled={submitting}
          >
            {submitting
              ? "Placing Order..."
              : "Place Order"}

            <ArrowRight aria-hidden="true" />
          </button>
        </form>

        <CheckoutSummary
          items={cart.items}
          subtotal={subtotal}
          total={total}
          shippingFee={shippingFee}
          appliedCoupon={appliedCoupon}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          handleApplyCoupon={handleApplyCoupon}
          validatingCoupon={validatingCoupon}
          couponError={couponError}
          setAppliedCoupon={setAppliedCoupon}
        />
      </div>
    </>
  );
}
