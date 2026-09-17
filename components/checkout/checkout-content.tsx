"use client";

import { ArrowLeft, ArrowRight, Check, Copy, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  submitCheckout,
  uploadCustomDesign,
} from "@/app/checkout/actions";

import { saveCheckoutAddress } from "@/lib/account/actions";
import { splitCityArea } from "@/lib/account/address";
import {
  LOCAL_CART_KEY,
  LOCAL_CART_CHANGE_EVENT,
  getLocalCartServerSnapshot,
  getLocalCartSnapshot,
  subscribeToLocalCart,
  type StoredCartItem,
} from "@/lib/cart/local-cart";

import {
  CHECKOUT_SHIPPING_FEE,
  INSTAPAY_TRANSFER_NUMBER,
  WHATSAPP_DISPLAY_NUMBER,
  deliveryCities,
  getWhatsAppUrl,
  type CheckoutFormValues,
  type CheckoutPaymentMethod,
} from "@/lib/checkout/order-draft";

import {
  formatPrice,
  materialOptions,
} from "@/lib/data/product-options";

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

  return (
    <div className="checkout-item-image">
      {failed ? (
        <span>
          <ImageIcon aria-hidden="true" />
          <small>Preview unavailable</small>
        </span>
      ) : (
        <Image
          src={item.image}
          alt={
            item.kind === "custom"
              ? "Your uploaded custom case design"
              : `${item.productName} phone case`
          }
          fill
          sizes="72px"
          unoptimized={item.kind === "custom"}
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
}: {
  items: StoredCartItem[];
  subtotal: number;
  total: number;
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

      <div className="checkout-summary-items">
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

              {item.kind === "custom" ? (
                <span>Custom design</span>
              ) : null}

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

      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>

        <div>
          <dt>Shipping</dt>
          <dd>{formatPrice(CHECKOUT_SHIPPING_FEE)}</dd>
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
        Final prices are validated server-side at order submission.
      </small>
    </aside>
  );
}

function WhatsAppButton({
  total,
}: {
  total: number;
}) {
  return (
    <a
      className="checkout-whatsapp"
      href={getWhatsAppUrl(total)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Send InstaPay transaction screenshot to Coolcase on WhatsApp (opens in a new tab)"
    >
      Send Screenshot on WhatsApp
      <ArrowRight aria-hidden="true" />
    </a>
  );
}

function Completion({
  email,
  paymentMethod,
  total,
  orderNumber,
}: {
  email: string;
  paymentMethod: CheckoutPaymentMethod;
  total: number;
  orderNumber: string;
}) {
  const instaPay = paymentMethod === "INSTAPAY";

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
          : "Your order has been received and is pending approval."}
      </h2>

      {instaPay ? (
        <div className="checkout-success-whatsapp">
          <h3>Transfer completed?</h3>

          <p>
            Send your transaction screenshot to us on WhatsApp:
          </p>

          <a
            href={getWhatsAppUrl(total)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {WHATSAPP_DISPLAY_NUMBER}
          </a>

          <WhatsAppButton total={total} />
        </div>
      ) : null}

      <p>
        Once Coolcase{" "}
        {instaPay
          ? "verifies the transaction and approves your order"
          : "approves your order"}
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

export function CheckoutContent({
  customer,
}: {
  customer?: CheckoutCustomer;
}) {
  const cart = useSyncExternalStore(
    subscribeToLocalCart,
    getLocalCartSnapshot,
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
    } | null>(null);

  const [copied, setCopied] =
    useState(false);

  const [
    submissionError,
    setSubmissionError,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

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

  const total =
    subtotal +
    (cart.items.length
      ? CHECKOUT_SHIPPING_FEE
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
        total={total}
      />
    );
  }

  if (!cart.items.length) {
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

        if (item.kind === "custom") {
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
          LOCAL_CART_KEY
        );

        window.dispatchEvent(
          new Event(
            LOCAL_CART_CHANGE_EVENT
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

  async function copyTransferNumber() {
    try {
      await navigator.clipboard.writeText(
        INSTAPAY_TRANSFER_NUMBER
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1800
      );
    } catch {
      setCopied(false);
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
                  aria-invalid={
                    Boolean(
                      errors.fullName
                    )
                  }
                  {...register(
                    "fullName",
                    {
                      required:
                        "Full name is required",
                    }
                  )}
                />

                {errors.fullName ? (
                  <small role="alert">
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
                  aria-invalid={
                    Boolean(
                      errors.phone
                    )
                  }
                  {...register(
                    "phone",
                    {
                      required:
                        "Phone is required",
                    }
                  )}
                />

                {errors.phone ? (
                  <small role="alert">
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
                  aria-invalid={
                    Boolean(
                      errors.email
                    )
                  }
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
                  <small role="alert">
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
                        aria-invalid={
                          Boolean(
                            errors.governorate
                          )
                        }
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
                        <small role="alert">
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
                        aria-invalid={
                          Boolean(
                            errors.city
                          )
                        }
                        {...register(
                          "city",
                          required(
                            "City"
                          )
                        )}
                      />

                      {errors.city ? (
                        <small role="alert">
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
                      aria-invalid={
                        Boolean(
                          errors.city
                        )
                      }
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
                      <small role="alert">
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
                    aria-invalid={
                      Boolean(
                        errors.area
                      )
                    }
                    {...register(
                      "area",
                      required(
                        "Area"
                      )
                    )}
                  />

                  {errors.area ? (
                    <small role="alert">
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
                    aria-invalid={
                      Boolean(
                        errors.street
                      )
                    }
                    {...register(
                      "street",
                      required(
                        "Street"
                      )
                    )}
                  />

                  {errors.street ? (
                    <small role="alert">
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
                    aria-invalid={
                      Boolean(
                        errors.building
                      )
                    }
                    {...register(
                      "building",
                      required(
                        "Building"
                      )
                    )}
                  />

                  {errors.building ? (
                    <small role="alert">
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
                    Pay when your order is delivered.
                  </small>
                </span>
              </label>

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
                    Transfer now, then verify via WhatsApp.
                  </small>
                </span>
              </label>
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
                  Pay when your order is delivered.
                </h3>

                <span>
                  Your order remains pending until reviewed and approved by Coolcase.
                </span>
              </div>
            ) : null}

            {paymentMethod ===
              "INSTAPAY" ? (
              <div className="checkout-payment-panel checkout-instapay">
                <p>
                  InstaPay payment
                </p>

                <h3>
                  Transfer{" "}
                  {formatPrice(
                    total
                  )}{" "}
                  to:
                </h3>

                <div className="checkout-transfer">
                  <strong>
                    {
                      INSTAPAY_TRANSFER_NUMBER
                    }
                  </strong>

                  <button
                    type="button"
                    onClick={
                      copyTransferNumber
                    }
                  >
                    <Copy aria-hidden="true" />
                    {copied
                      ? "Copied"
                      : "Copy Number"}
                  </button>
                </div>

                <ol>
                  <li>
                    Transfer the full total to{" "}
                    {
                      INSTAPAY_TRANSFER_NUMBER
                    }
                  </li>

                  <li>
                    Place your order
                  </li>

                  <li>
                    Send the transaction screenshot on WhatsApp
                  </li>

                  <li>
                    Coolcase admin reviews the payment
                  </li>

                  <li>
                    Once approved, your order becomes Confirmed
                  </li>

                  <li>
                    You receive a confirmation email
                  </li>
                </ol>

                <p>
                  Send the screenshot to{" "}
                  <a
                    href={getWhatsAppUrl(
                      total
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {
                      WHATSAPP_DISPLAY_NUMBER
                    }
                  </a>
                  . Verification is manual.
                </p>

                <WhatsAppButton
                  total={total}
                />
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
        />
      </div>
    </>
  );
}