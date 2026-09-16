"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { useProductMaterial } from "@/components/product/product-material-context";
import { addToLocalCart } from "@/lib/cart/local-cart";
import { formatPrice, materialIds, materialOptions, phoneModels, type Material, type MaterialPrice, type PhoneBrand } from "@/lib/data/product-options";

// Lean product shape — decoupled from StorefrontProduct
export type PurchaseProduct = {
  id: string;
  slug: string;
  name: string;
  available: boolean;
  images: Array<{ src: string; alt: string }>;
  pricing: Record<Material, MaterialPrice>;
  supportedBrands: readonly PhoneBrand[];
};

export function ProductPurchase({ product }: { product: PurchaseProduct }) {
  const { material, setMaterial } = useProductMaterial();
  const [brand, setBrand] = useState<PhoneBrand>("iPhone");
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
      setBrand("iPhone");
      setModel("");
      setNetwork("");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product.available || !model || !network) return;
    try {
      addToLocalCart({ kind: "product", productId: product.id, slug: product.slug, productName: product.name, material, phoneBrand: brand, phoneModel: model, networkType: network, quantity, discountedUnitPrice: price.discounted, originalUnitPrice: price.original, image: product.images[0]?.src ?? '', subtotal: quantity * price.discounted });
      setFailed(false);
      setFeedback(`${quantity} × ${product.name} added to your bag — ${materialOptions[material].label}, ${model}, ${network}. Saved on this device.`);
    } catch {
      setFailed(true);
      setFeedback("We couldn't save this selection. Check that browser storage is available and your bag has fewer than 99 of this configuration, then try again.");
    }
  }

  return (
    <form className="pdp-purchase" onSubmit={submit} onChange={() => setFeedback("")}>
      <div className="pdp-price" aria-live="polite" aria-atomic="true">
        <strong>{formatPrice(price.discounted)}</strong>
        <del><span className="sr-only">Original price </span>{formatPrice(price.original)}</del>
        <span className="pdp-saving">Save {formatPrice(price.original - price.discounted)}</span>
      </div>
      <fieldset disabled={!product.available}>
        <legend>01 <span>Choose your material</span></legend>
        <div className="pdp-materials">
          {materialIds.map((id) => (
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
            <select value={brand} onChange={(event) => { setBrand(event.target.value as PhoneBrand); setModel(""); setNetwork(""); }}>
              {brands.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Phone model
            <select required value={model} onChange={(event) => { setModel(event.target.value); setNetwork(""); }}>
              <option value="" disabled>Select your model</option>
              {phoneModels[brand].map((item) => <option key={item}>{item}</option>)}
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
        <button className="pdp-add" type="submit" disabled={!product.available}>{product.available ? <>Add to Cart <span>{formatPrice(quantity * price.discounted)}</span><ArrowRight size={18} aria-hidden="true" /></> : "Sold Out"}</button>
      </div>
      <p className={`pdp-feedback ${failed ? "pdp-feedback-error" : ""}`} role="status">{feedback}</p>
      <div className="pdp-purchase-note"><Check size={15} aria-hidden="true" /><span>Your design. Your material. Your phone.</span></div>
    </form>
  );
}
