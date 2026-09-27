"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { addToLocalCart, setBuyNowItem } from "@/lib/cart/local-cart";
import { customCasePricing, formatPrice, materialIds, materialOptions, phoneBrands, phoneModels, type Material, type PhoneBrand } from "@/lib/data/product-options";
import { DeliveryTimeline } from "@/components/storefront/delivery-timeline";
import { fileToDataUrl, preprocessClientImage } from "@/lib/images/client-preprocess";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function CustomCaseBuilder() {
  const router = useRouter();
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [material, setMaterial] = useState<Material>("silicon");
  const [brand, setBrand] = useState<PhoneBrand | "">("");
  const [model, setModel] = useState("");
  const [network, setNetwork] = useState<"4G" | "5G" | "">("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [processing, setProcessing] = useState(false);
  const brands = material === "acrylic" ? phoneBrands.filter((item) => item === "iPhone") : phoneBrands;
  const pricing = customCasePricing[material];

  function changeMaterial(next: Material) {
    setMaterial(next);
    setError("");
    setFeedback("");
    if (next === "acrylic" && brand !== "iPhone") {
      setBrand("");
      setModel("");
      setNetwork("");
    }
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(""); setFeedback("");
    if (!file) return;
    if (!acceptedTypes.has(file.type)) { setError("Choose a JPEG, PNG, or WebP image."); event.target.value = ""; return; }
    setProcessing(true);
    try {
      const processed = await preprocessClientImage(file, "custom-artwork");
      setPreview(await fileToDataUrl(processed));
      setFileName(processed.name);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "We couldn’t read this image. Try another JPEG, PNG, or WebP file.");
      event.target.value = "";
    } finally { setProcessing(false); }
  }

  function buildItem() {
    if (!preview) { setError("Upload an image for your custom case."); return null; }
    if (!brand) { setError("Choose your phone brand."); return null; }
    if (!model) { setError("Choose your phone model."); return null; }
    if (!network) { setError("Choose 4G or 5G for the right fit."); return null; }
    return { kind: "custom" as const, customizationType: "UPLOAD_DESIGN" as const, productId: "custom-case", slug: "custom-case-upload", productName: "Custom Case — Your Design", material, phoneBrand: brand, phoneModel: model, networkType: network, quantity, discountedUnitPrice: pricing.discounted, originalUnitPrice: pricing.original, image: preview, uploadFileName: fileName, subtotal: quantity * pricing.discounted };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setFeedback("");
    const item = buildItem();
    if (!item) return;
    try {
      addToLocalCart(item);
      setFeedback("Added to cart.");
    } catch {
      setError("We couldn’t save this custom case. Try a smaller image or check that browser storage is available.");
    }
  }

  function buyNow() {
    setError(""); setFeedback("");
    const item = buildItem();
    if (!item) return;
    try { setBuyNowItem(item); router.push("/checkout?mode=buy-now"); }
    catch { setError("We couldn’t prepare Buy It Now. Try a smaller image or check browser storage."); }
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
        <p className="pdp-eyebrow">CUSTOM CASE</p>
        <h1>Upload Your Design</h1>
        <p className="custom-builder-description">Make your phone personal. Upload your own image and we’ll turn it into a Coolcase.</p>
        <div className="pdp-price"><strong>{formatPrice(pricing.discounted)}</strong><del><span className="sr-only">Original price </span>{formatPrice(pricing.original)}</del><span className="pdp-saving">Save {formatPrice(pricing.original - pricing.discounted)}</span></div>
        <form className="custom-builder-form" onSubmit={submit} noValidate>
          <FileUploadField label="01 · Upload your image" guidance={`JPEG, PNG, or WebP · automatically prepared for secure upload. ${processing ? 'Preparing your image preview…' : ''}`} selectedFileName={fileName} accept="image/jpeg,image/png,image/webp" onChange={selectImage} disabled={processing} />
          <fieldset><legend>02 <span>Choose your material</span></legend><div className="pdp-materials">
            {materialIds.map((id) => <label key={id}><input type="radio" name="custom-material" value={id} checked={material === id} onChange={() => changeMaterial(id)} /><span className="pdp-material-card"><span className="pdp-material-image"><Image src={materialOptions[id].optionImage.src} alt={materialOptions[id].optionImage.alt} fill sizes="(min-width: 640px) 140px, 30vw" /></span><strong>{materialOptions[id].label}</strong><small>{formatPrice(customCasePricing[id].discounted)}</small></span></label>)}
          </div><p className="pdp-material-note" aria-live="polite">{materialOptions[material].note}</p>{material === "acrylic" ? <p className="pdp-compatibility-note">Acrylic cases are currently available for iPhone models only.</p> : null}</fieldset>
          <fieldset><legend>03 <span>Choose your phone</span></legend><div className="pdp-device-selects">
            <label>Phone brand<select required value={brand} onChange={(event) => { setBrand(event.target.value as PhoneBrand); setModel(""); setNetwork(""); setFeedback(""); }}>
              <option value="" disabled>Select your phone brand</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Phone model<select required value={model} disabled={!brand} onChange={(event) => { setModel(event.target.value); setNetwork(""); setFeedback(""); }}><option value="" disabled>Select your model</option>{(brand ? phoneModels[brand] : []).map((item) => <option key={item}>{item}</option>)}</select></label>
          </div></fieldset>
          <fieldset className="pdp-network"><legend>04 <span>Network version</span></legend><div className="pdp-network-options">{(["4G", "5G"] as const).map((value) => <label key={value}><input type="radio" name="custom-network" value={value} checked={network === value} onChange={() => { setNetwork(value); setFeedback(""); }} /><span>{value}</span></label>)}</div></fieldset>
          {(!preview || !brand || !model || !network) && <p className="cc-helper" role="status">{!preview ? "Upload your image to begin." : !brand ? "Choose your phone brand to continue." : !model ? "Choose your phone model to continue." : "Choose your network version to continue."}</p>}
          <fieldset><legend>05 <span>Quantity</span></legend><div className="pdp-bag-row"><div className="pdp-quantity" role="group" aria-label="Quantity"><button type="button" aria-label="Decrease quantity" disabled={quantity === 1} onClick={() => setQuantity((value) => value - 1)}><Minus size={16} /></button><output aria-label="Selected quantity">{quantity}</output><button type="button" aria-label="Increase quantity" disabled={quantity === 99} onClick={() => setQuantity((value) => value + 1)}><Plus size={16} /></button></div>
            <button type="submit" className="pdp-add" disabled={processing || !preview || !brand || !model || !network}>Add to Cart <span>{formatPrice(quantity * pricing.discounted)}</span><ArrowRight size={18} aria-hidden="true" /></button></div></fieldset>
          <button type="button" className="pdp-buy-now" disabled={!preview || !brand || !model || !network} onClick={buyNow}>Buy It Now</button>
          <p className="pdp-feedback pdp-feedback-error" role="alert">{error}</p><p className="pdp-feedback" role="status">{feedback} {feedback && <Link href="/cart">View Cart →</Link>}</p>
        </form>
        <DeliveryTimeline custom />
        <section className="custom-how-it-works"><p className="pdp-eyebrow">Your image. Your case.</p><h2>How it works</h2><ol><li>Upload your image</li><li>Choose material and phone</li><li>Add it to your cart</li><li>We prepare your custom case</li></ol></section>
      </section>
    </div>
  );
}
