"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { useProductMaterial } from "@/components/product/product-material-context";
import { addToLocalCart, setBuyNowItem } from "@/lib/cart/local-cart";
import { formatPrice, materialIds, materialOptions, phoneModels, type Material, type MaterialPrice, type PhoneBrand } from "@/lib/data/product-options";

import { useRouter } from "next/navigation";

// Lean product shape — decoupled from StorefrontProduct
export type PurchaseProduct = {
  id: string;
  slug: string;
  name: string;
  available: boolean;
  images: Array<{ src: string; alt: string }>;
  pricing: Record<Material, MaterialPrice>;
  supportedBrands: readonly PhoneBrand[];
  materialsEnabled: Record<Material, boolean>;
};

export function ProductPurchase({ product }: { product: PurchaseProduct }) {
  const router = useRouter();
  const { material, setMaterial } = useProductMaterial();
  const [brand, setBrand] = useState<PhoneBrand | "">("");
  const [model, setModel] = useState("");
  const [network, setNetwork] = useState<"4G" | "5G" | "">("");
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const price = product.pricing[material];
  const brands = material === "acrylic" ? product.supportedBrands.filter((item) => item === "iPhone") : product.supportedBrands;

  function changeMaterial(next: Material) {
    setMaterial(next);
    setFeedback("");
    if (next === "acrylic" && brand !== "iPhone") {
      setBrand("");
      setModel("");
      setNetwork("");
    }
  }

  function handleAction(mode: "cart" | "buy-now") {
    if (!product.available || !brand || !model || !network) return;
    try {
      const item = { kind: "product" as const, productId: product.id, slug: product.slug, productName: product.name, material, phoneBrand: brand, phoneModel: model, networkType: network, quantity, discountedUnitPrice: price.discounted, originalUnitPrice: price.original, image: product.images[0]?.src ?? '', subtotal: quantity * price.discounted };
      
      if (mode === "buy-now") {
        setBuyNowItem(item);
        setFailed(false);
        router.push("/checkout?mode=buy-now");
      } else {
        addToLocalCart(item, "cart");
        setFailed(false);
        setFeedback("Added to cart.");
      }
    } catch {
      setFailed(true);
      setFeedback("We couldn't save this selection. Check that browser storage is available and your bag has fewer than 99 of this configuration, then try again.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    handleAction(action === "buy-now" ? "buy-now" : "cart");
  }

  return (
    <form className="pdp-purchase" onSubmit={submit} onChange={() => setFeedback("")}>
      <div className="pdp-price" aria-live="polite" aria-atomic="true">
        <strong>{formatPrice(price.discounted)}</strong>
        {price.original > price.discounted && (
          <>
            <del><span className="sr-only">Original price </span>{formatPrice(price.original)}</del>
            <span className="pdp-saving">Save {formatPrice(price.original - price.discounted)}</span>
          </>
        )}
      </div>
      <fieldset disabled={!product.available}>
        <legend>01 <span>Choose your material</span></legend>
        <div className="pdp-materials">
          {materialIds.filter(id => product.materialsEnabled[id]).map((id) => (
            <label key={id}>
              <input type="radio" name="material" value={id} checked={material === id} onChange={() => changeMaterial(id)} />
              <span className="pdp-material-card">
                <span className="pdp-material-image"><Image src={materialOptions[id].optionImage.src} alt={materialOptions[id].optionImage.alt} fill sizes="(min-width: 640px) 140px, 30vw" /></span>
                <strong>{materialOptions[id].label}</strong>
                <small>{formatPrice(product.pricing[id].discounted)}</small>
              </span>
            </label>
          ))}
        </div>
        <p className="pdp-material-note" aria-live="polite">{materialOptions[material].note}</p>
        {material === "acrylic" ? <p className="pdp-compatibility-note">Acrylic cases are currently available for iPhone models only.</p> : null}
      </fieldset>
      <fieldset disabled={!product.available}>
        <legend>02 <span>Find your phone fit</span></legend>
        <div className="pdp-device-selects">
          <label>Phone brand
            <select required value={brand} onChange={(event) => { setBrand(event.target.value as PhoneBrand); setModel(""); setNetwork(""); }}>
              <option value="" disabled>Select your phone brand</option>
              {brands.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Phone model
            <select required value={model} disabled={!brand} onChange={(event) => { setModel(event.target.value); setNetwork(""); }}>
              <option value="" disabled>Select your model</option>
              {(brand ? phoneModels[brand] : []).map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset className="pdp-network" disabled={!product.available}>
        <legend>03 <span>Network version</span></legend>
        <div className="pdp-network-options">
          {(["4G", "5G"] as const).map((value) => (
            <label key={value}><input type="radio" name="network" value={value} required checked={network === value} onChange={() => setNetwork(value)} /><span>{value}</span></label>
          ))}
        </div>
        <p>Match the version in your phone&apos;s settings for the right fit.</p>
      </fieldset>
      <div className="pdp-bag-row">
        <div className="pdp-quantity" role="group" aria-label="Quantity">
          <button type="button" aria-label="Decrease quantity" disabled={!product.available || quantity === 1} onClick={() => { setQuantity((value) => value - 1); setFeedback(""); }}><Minus size={16} /></button>
          <output aria-label="Selected quantity" aria-live="polite">{quantity}</output>
          <button type="button" aria-label="Increase quantity" disabled={!product.available || quantity === 99} onClick={() => { setQuantity((value) => value + 1); setFeedback(""); }}><Plus size={16} /></button>
        </div>
        <button className="pdp-add" type="submit" name="action" value="cart" disabled={!product.available}>
          {product.available ? <>Add to Cart</> : "Sold Out"}
        </button>
        <button className="pdp-buy-now" type="submit" name="action" value="buy-now" disabled={!product.available}>
          {product.available ? <>Buy It Now</> : "Sold Out"}
        </button>
      </div>
      <p className={`pdp-feedback ${failed ? "pdp-feedback-error" : ""}`} role="status">{feedback} {feedback === "Added to cart." && <Link href="/cart">View Cart →</Link>}</p>
      <div className="pdp-purchase-note"><Check size={15} aria-hidden="true" /><span>Your design. Your material. Your phone.</span></div>
    </form>
  );
}
