"use client";

import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight, Minus, Plus, Upload } from "lucide-react";
import { addToLocalCart } from "@/lib/cart/local-cart";
import { customCasePricing, formatPrice, materialIds, materialOptions, phoneBrands, phoneModels, type Material, type PhoneBrand } from "@/lib/data/product-options";
import { DeliveryTimeline } from "@/components/storefront/delivery-timeline";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function createStoredPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const source = String(reader.result);
      const image = new window.Image();
      image.onerror = () => reject(new Error("Invalid image"));
      image.onload = () => {
        const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Preview unavailable"));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.8));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

export function CustomCaseBuilder() {
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [material, setMaterial] = useState<Material>("silicon");
  const [brand, setBrand] = useState<PhoneBrand>("iPhone");
  const [model, setModel] = useState("");
  const [network, setNetwork] = useState<"4G" | "5G" | "">("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const brands = material === "acrylic" ? phoneBrands.filter((item) => item === "iPhone") : phoneBrands;
  const pricing = customCasePricing[material];

  function changeMaterial(next: Material) {
    setMaterial(next);
    setError("");
    setFeedback("");
    if (next === "acrylic" && brand !== "iPhone") {
      setBrand("iPhone");
      setModel("");
      setNetwork("");
    }
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(""); setFeedback("");
    if (!file) return;
    if (!acceptedTypes.has(file.type)) { setError("Choose a JPEG, PNG, or WebP image."); event.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024) { setError("Choose an image smaller than 10 MB."); event.target.value = ""; return; }
    try {
      setPreview(await createStoredPreview(file));
      setFileName(file.name);
    } catch {
      setError("We couldn’t read this image. Try another JPEG, PNG, or WebP file.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setFeedback("");
    if (!preview) return setError("Upload an image for your custom case.");
    if (!model) return setError("Choose your phone model.");
    if (!network) return setError("Choose 4G or 5G for the right fit.");
    try {
      addToLocalCart({ kind: "custom", productId: "custom-case", slug: "custom-case", productName: "Your Custom Case", material, phoneBrand: brand, phoneModel: model, networkType: network, quantity, discountedUnitPrice: pricing.discounted, originalUnitPrice: pricing.original, image: preview, uploadFileName: fileName, subtotal: quantity * pricing.discounted });
      setFeedback(`${quantity} × custom case added to your bag — ${materialOptions[material].label}, ${model}, ${network}. Your image is saved on this device.`);
    } catch {
      setError("We couldn’t save this custom case. Try a smaller image or check that browser storage is available.");
    }
  }

  return (
    <div className="custom-builder-layout">
      <section className="custom-preview-panel" aria-labelledby="custom-preview-title">
        <div className="custom-preview-image" data-uploaded={preview ? "true" : "false"}>
          <Image src={preview || "/assets/custom-cases/custom-case-upload-preview.png"} alt={preview ? "Your uploaded design preview" : "Example showing how to upload an image for a custom Coolcase"} fill priority sizes="(min-width: 1024px) 50vw, 100vw" unoptimized={Boolean(preview)} />
          <span id="custom-preview-title">{preview ? "Your Uploaded Design" : "Image Preview"}</span>
        </div>
        <p>This is an image preview, not a generated case render. Final placement is prepared during processing.</p>
      </section>
      <section className="custom-builder-information">
        <p className="pdp-eyebrow">Made by you / Finished by Coolcase</p>
        <h1>Your Custom Case</h1>
        <p className="custom-builder-description">Make your phone personal. Upload your own image and we’ll turn it into a Coolcase.</p>
        <div className="pdp-price"><strong>{formatPrice(pricing.discounted)}</strong><del><span className="sr-only">Original price </span>{formatPrice(pricing.original)}</del><span className="pdp-saving">Save {formatPrice(pricing.original - pricing.discounted)}</span></div>
        <form className="custom-builder-form" onSubmit={submit} noValidate>
          <label className="custom-upload-control">01 <span>Upload your image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /><strong><Upload size={17} aria-hidden="true" />{fileName || "Choose JPEG, PNG, or WebP"}</strong></label>
          <fieldset><legend>02 <span>Choose your material</span></legend><div className="pdp-materials">
            {materialIds.map((id) => <label key={id}><input type="radio" name="custom-material" value={id} checked={material === id} onChange={() => changeMaterial(id)} /><span className="pdp-material-card"><span className="pdp-material-image"><Image src={materialOptions[id].optionImage.src} alt={materialOptions[id].optionImage.alt} fill sizes="(min-width: 640px) 140px, 30vw" /></span><strong>{materialOptions[id].label}</strong><small>{formatPrice(customCasePricing[id].discounted)}</small></span></label>)}
          </div><p className="pdp-material-note" aria-live="polite">{materialOptions[material].note}</p>{material === "acrylic" ? <p className="pdp-compatibility-note">Acrylic cases are currently available for iPhone models only.</p> : null}</fieldset>
          <fieldset><legend>03 <span>Choose your phone</span></legend><div className="pdp-device-selects">
            <label>Phone brand<select value={brand} onChange={(event) => { setBrand(event.target.value as PhoneBrand); setModel(""); setNetwork(""); setFeedback(""); }}>
              {brands.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Phone model<select value={model} onChange={(event) => { setModel(event.target.value); setNetwork(""); setFeedback(""); }}><option value="" disabled>Select your model</option>{phoneModels[brand].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div></fieldset>
          <fieldset className="pdp-network"><legend>04 <span>Network version</span></legend><div className="pdp-network-options">{(["4G", "5G"] as const).map((value) => <label key={value}><input type="radio" name="custom-network" value={value} checked={network === value} onChange={() => { setNetwork(value); setFeedback(""); }} /><span>{value}</span></label>)}</div></fieldset>
          <div className="pdp-bag-row"><div className="pdp-quantity" role="group" aria-label="Quantity"><button type="button" aria-label="Decrease quantity" disabled={quantity === 1} onClick={() => setQuantity((value) => value - 1)}><Minus size={16} /></button><output aria-label="Selected quantity">{quantity}</output><button type="button" aria-label="Increase quantity" disabled={quantity === 99} onClick={() => setQuantity((value) => value + 1)}><Plus size={16} /></button></div>
            <button type="submit" className="pdp-add">Add to Cart <span>{formatPrice(quantity * pricing.discounted)}</span><ArrowRight size={18} aria-hidden="true" /></button></div>
          <p className="pdp-feedback pdp-feedback-error" role="alert">{error}</p><p className="pdp-feedback" role="status">{feedback}</p>
        </form>
        <DeliveryTimeline custom />
        <section className="custom-how-it-works"><p className="pdp-eyebrow">Your image. Your case.</p><h2>How it works</h2><ol><li>Upload your image</li><li>Choose material and phone</li><li>Add it to your cart</li><li>We prepare your custom case</li></ol></section>
      </section>
    </div>
  );
}
