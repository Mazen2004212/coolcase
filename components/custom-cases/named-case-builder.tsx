"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

import { PriceDisplay } from "@/components/ui/price-display";
import { addToLocalCart, setBuyNowItem } from "@/lib/cart/local-cart";
import {
  namedCaseColorOptions,
  renderNamedCaseText,
  templateArabicStyle,
  templateEnglishStyle,
  validateArabicName,
  validateEnglishName,
  type NamedCaseTemplate,
} from "@/lib/custom-cases/templates";
import {
  customCasePricing,
  formatPrice,
  materialIds,
  materialOptions,
  phoneBrands,
  phoneModels,
  type Material,
  type PhoneBrand,
} from "@/lib/data/product-options";

type StorefrontTemplate = NamedCaseTemplate & { imageUrl: string };

export function NamedCaseBuilder({ template }: { template: StorefrontTemplate }) {
  const router = useRouter();
  const [englishName, setEnglishName] = useState("");
  const [arabicName, setArabicName] = useState("");
  const [englishColor, setEnglishColor] = useState("#9FC5F8");
  const [arabicColor, setArabicColor] = useState("#221B78");
  const [englishTouched, setEnglishTouched] = useState(false);
  const [arabicTouched, setArabicTouched] = useState(false);
  const [material, setMaterial] = useState<Material>("silicon");
  const [brand, setBrand] = useState<PhoneBrand>("iPhone");
  const [model, setModel] = useState("");
  const [network, setNetwork] = useState<"4G" | "5G" | "">("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const englishValidation = useMemo(() => validateEnglishName(englishName, 7), [englishName]);
  const arabicValidation = useMemo(() => validateArabicName(arabicName, 7), [arabicName]);
  const englishRenderedText = englishValidation.ok
    ? renderNamedCaseText(englishValidation.text, template.english_text_transform)
    : englishName.trim().toLocaleUpperCase("en");
  const arabicRenderedText = arabicValidation.ok ? arabicValidation.text : arabicName.trim();
  const englishStyle = { ...templateEnglishStyle(template), textColor: englishColor };
  const arabicStyle = { ...templateArabicStyle(template), textColor: arabicColor };
  const pricing = customCasePricing[material];
  const brands = material === "acrylic" ? phoneBrands.filter(item => item === "iPhone") : phoneBrands;
  const ready = englishValidation.ok && arabicValidation.ok && Boolean(model) && Boolean(network);

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

  function buildItem() {
    setError("");
    setFeedback("");
    setEnglishTouched(true);
    setArabicTouched(true);
    if (!englishValidation.ok) { setError(englishValidation.error); return null; }
    if (!arabicValidation.ok) { setError(arabicValidation.error); return null; }
    if (!model) { setError("Choose your phone model."); return null; }
    if (!network) { setError("Choose 4G or 5G for the right fit."); return null; }

    return {
      kind: "custom" as const,
      customizationType: "NAMED_TEMPLATE" as const,
      productId: "named-custom-case",
      slug: "named-custom-case",
      productName: "Named Custom Case",
      material,
      phoneBrand: brand,
      phoneModel: model,
      networkType: network,
      quantity,
      discountedUnitPrice: pricing.discounted,
      originalUnitPrice: pricing.original,
      subtotal: quantity * pricing.discounted,
      templateId: template.id,
      templateName: template.name,
      templateImage: template.imageUrl,
      englishName: englishValidation.text,
      arabicName: arabicValidation.text,
      englishColor,
      arabicColor,
      englishRenderedText,
      arabicRenderedText,
      englishStyle,
      arabicStyle,
      englishLayout: "STACKED" as const,
    };
  }

  function add() {
    const item = buildItem();
    if (!item) return;
    try { addToLocalCart(item); setFeedback("Added to cart."); }
    catch { setError("We couldn’t save this case. Check that browser storage is available."); }
  }

  function buy() {
    const item = buildItem();
    if (!item) return;
    try { setBuyNowItem(item); router.push("/checkout?mode=buy-now"); }
    catch { setError("We couldn’t prepare Buy It Now."); }
  }

  return <div className="custom-builder-layout named-builder">
    <section className="custom-preview-panel" aria-label="Named case design example">
      <div className="named-case-reference">
        <Image src={template.imageUrl} alt="Named Custom Case design example" fill sizes="(max-width: 1023px) 100vw, 50vw" priority />
      </div>
      <p>Design example. Your submitted names and colors will be prepared after ordering.</p>
    </section>

    <section className="custom-builder-information">
      <p className="pdp-eyebrow">NAMED CUSTOM CASE</p>
      <h1>Make It Yours</h1>
      <p className="custom-builder-description">Personalize this signature design with one English and one Arabic name.</p>
      <div className="pdp-price"><PriceDisplay current={pricing.discounted} original={pricing.original} /></div>

      <fieldset>
        <legend>01 <span>Add your names</span></legend>
        <label className="named-text-field"><span>English Name <small>{[...englishName].length}/7</small></span><input lang="en" dir="ltr" value={englishName} maxLength={7} placeholder="Name" aria-invalid={englishTouched && !englishValidation.ok} aria-describedby="english-name-error" onBlur={() => setEnglishTouched(true)} onChange={event => { setEnglishName(event.target.value); setError(""); }} /></label>
        {englishTouched && !englishValidation.ok ? <p id="english-name-error" className="pdp-feedback pdp-feedback-error">{englishValidation.error}</p> : null}
        <label className="named-text-field"><span>Arabic Name <small>{[...arabicName].length}/7</small></span><input lang="ar" dir="rtl" value={arabicName} maxLength={7} placeholder="أسمك" aria-invalid={arabicTouched && !arabicValidation.ok} aria-describedby="arabic-name-error" onBlur={() => setArabicTouched(true)} onChange={event => { setArabicName(event.target.value); setError(""); }} /></label>
        {arabicTouched && !arabicValidation.ok ? <p id="arabic-name-error" className="pdp-feedback pdp-feedback-error">{arabicValidation.error}</p> : null}
        <div className="named-color-fields">
          <ColorChoices legend="English Name Color" name="english-name-color" value={englishColor} onChange={setEnglishColor} />
          <ColorChoices legend="Arabic Name Color" name="arabic-name-color" value={arabicColor} onChange={setArabicColor} />
        </div>
      </fieldset>

      <fieldset><legend>02 <span>Choose your material</span></legend><div className="pdp-materials">{materialIds.map(id => <label key={id}><input type="radio" name="named-material" checked={material === id} onChange={() => changeMaterial(id)} /><span className="pdp-material-card"><span className="pdp-material-image"><Image src={materialOptions[id].optionImage.src} alt={materialOptions[id].optionImage.alt} fill sizes="120px" /></span><strong>{materialOptions[id].label}</strong><small>{formatPrice(customCasePricing[id].discounted)}</small></span></label>)}</div></fieldset>
      <fieldset><legend>03 <span>Find your phone fit</span></legend><div className="pdp-device-selects"><label>Phone brand<select value={brand} onChange={event => { setBrand(event.target.value as PhoneBrand); setModel(""); setNetwork(""); }}>{brands.map(item => <option key={item}>{item}</option>)}</select></label><label>Phone model<select value={model} onChange={event => { setModel(event.target.value); setNetwork(""); }}><option value="" disabled>Select your model</option>{phoneModels[brand].map(item => <option key={item}>{item}</option>)}</select></label></div></fieldset>
      <fieldset className="pdp-network"><legend>04 <span>Network version</span></legend><div className="pdp-network-options">{(["4G", "5G"] as const).map(value => <label key={value}><input type="radio" name="named-network" checked={network === value} onChange={() => setNetwork(value)} /><span>{value}</span></label>)}</div></fieldset>
      <fieldset><legend>05 <span>Quantity</span></legend><div className="pdp-bag-row"><div className="pdp-quantity" role="group" aria-label="Quantity"><button type="button" disabled={quantity === 1} onClick={() => setQuantity(value => value - 1)} aria-label="Decrease quantity"><Minus /></button><output>{quantity}</output><button type="button" disabled={quantity === 99} onClick={() => setQuantity(value => value + 1)} aria-label="Increase quantity"><Plus /></button></div><button type="button" className="pdp-add" disabled={!ready} onClick={add}>Add to Cart <span>{formatPrice(quantity * pricing.discounted)}</span></button></div></fieldset>
      {!ready ? <p className="cc-helper" role="status">{!englishValidation.ok ? "Enter a valid English name." : !arabicValidation.ok ? "Enter a valid Arabic name." : !model ? "Choose your phone model to continue." : "Choose your network version to continue."}</p> : null}
      <button type="button" className="pdp-buy-now" disabled={!ready} onClick={buy}>Buy It Now</button>
      <p className="pdp-feedback pdp-feedback-error" role="alert">{error}</p><p className="pdp-feedback" role="status">{feedback} {feedback ? <Link href="/cart">View Cart →</Link> : null}</p>
    </section>
  </div>;
}

function ColorChoices({ legend, name, value, onChange }: { legend: string; name: string; value: string; onChange: (value: string) => void }) {
  return <fieldset className="named-color-picker"><legend>{legend}</legend><div>{namedCaseColorOptions.map(option => <label key={option.value} title={option.label}><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} /><span style={{ backgroundColor: option.value }} aria-hidden="true" /><span className="sr-only">{option.label}</span></label>)}</div></fieldset>;
}
