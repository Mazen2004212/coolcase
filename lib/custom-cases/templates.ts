import { z } from "zod";
import { resolvePublicMediaUrl } from "@/lib/storage/public-media-core";

export const namedCaseScripts = ["LATIN", "ARABIC", "BOTH"] as const;
export const namedCaseFontKeys = ["INTER", "GEORGIA", "ARIAL", "TAHOMA"] as const;
export const namedCaseAlignments = ["left", "center", "right"] as const;
export const namedCaseTransforms = ["NONE", "UPPERCASE", "LOWERCASE"] as const;

export type NamedCaseScript = (typeof namedCaseScripts)[number];
export type NamedCaseFontKey = (typeof namedCaseFontKeys)[number];
export type NamedCaseAlignment = (typeof namedCaseAlignments)[number];
export type NamedCaseTransform = (typeof namedCaseTransforms)[number];

export type NamedCaseTextStyle = {
  fontKey: NamedCaseFontKey; fontSize: number; fontWeight: number; textColor: string;
  textX: number; textY: number; textRotation: number; textAlign: NamedCaseAlignment;
};
export type ArabicNamedCaseTextStyle = Omit<NamedCaseTextStyle, "fontKey"> & { fontKey: "ARIAL" | "TAHOMA" };

export const FIXED_NAMED_CASE_TEMPLATE_ID = "9f625d2c-8433-4fcc-8daf-4c09c594108a";
export const FIXED_NAMED_CASE_IMAGE = "/assets/custom-cases/named/named-case-example.png";
export const FIXED_NAMED_CASE_STORAGE_PATH = "custom-case-templates/named-case-fixed-base.png";
export const FIXED_NAMED_CASE_MAX_CHARACTERS = 7;

export const namedCaseColorOptions = [
  { value: "#9FC5F8", label: "Powder blue" },
  { value: "#221B78", label: "Deep navy" },
  { value: "#111111", label: "Black" },
  { value: "#FFFFFF", label: "White" },
  { value: "#D94B70", label: "Rose" },
  { value: "#7A4BA3", label: "Purple" },
] as const;
export const namedCaseColorValues = namedCaseColorOptions.map(option => option.value) as [string, ...string[]];

export function namedCaseColorLabel(value: unknown) {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  return namedCaseColorOptions.find(option => option.value === normalized)?.label
    ?? (normalized || "Not specified");
}

export function validateNamedCaseColor(value: string | undefined, label: string) {
  const normalized = value?.toUpperCase() ?? "";
  return namedCaseColorValues.includes(normalized)
    ? { ok: true as const, color: normalized }
    : { ok: false as const, error: `Choose a valid ${label} name color.` };
}

export const namedCaseFonts: Record<NamedCaseFontKey, { label: string; family: string; supportsArabic: boolean }> = {
  INTER: { label: "Modern Sans", family: "var(--font-geist), Arial, sans-serif", supportsArabic: false },
  GEORGIA: { label: "Editorial Serif", family: "Georgia, 'Times New Roman', serif", supportsArabic: false },
  ARIAL: { label: "Classic Sans", family: "Arial, Tahoma, sans-serif", supportsArabic: true },
  TAHOMA: { label: "Arabic Sans", family: "Tahoma, Arial, sans-serif", supportsArabic: true },
};

export type NamedCaseTemplate = {
  id: string;
  name: string;
  slug: string;
  image_path: string;
  is_active: boolean;
  sort_order: number;
  allowed_script: NamedCaseScript;
  max_characters: number;
  font_key: NamedCaseFontKey;
  font_size: number;
  font_weight: number;
  text_color: string;
  text_x: number;
  text_y: number;
  text_rotation: number;
  text_align: NamedCaseAlignment;
  text_transform: NamedCaseTransform;
  english_max_characters: number;
  english_font_key: NamedCaseFontKey;
  english_font_size: number;
  english_font_weight: number;
  english_text_color: string;
  english_text_x: number;
  english_text_y: number;
  english_text_rotation: number;
  english_text_align: NamedCaseAlignment;
  english_text_transform: NamedCaseTransform;
  arabic_max_characters: number;
  arabic_font_key: NamedCaseFontKey;
  arabic_font_size: number;
  arabic_font_weight: number;
  arabic_text_color: string;
  arabic_text_x: number;
  arabic_text_y: number;
  arabic_text_rotation: number;
  arabic_text_align: NamedCaseAlignment;
  created_at?: string;
  updated_at?: string;
};

export const namedCaseTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
  englishMaxCharacters: z.number().int().min(1).max(40),
  englishFontKey: z.enum(namedCaseFontKeys), englishFontSize: z.number().int().min(10).max(96),
  englishFontWeight: z.number().int().min(300).max(900).multipleOf(100), englishTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  englishTextX: z.number().min(0).max(100), englishTextY: z.number().min(0).max(100), englishTextRotation: z.number().min(-45).max(45),
  englishTextAlign: z.enum(namedCaseAlignments), englishTextTransform: z.enum(namedCaseTransforms),
  arabicMaxCharacters: z.number().int().min(1).max(40),
  arabicFontKey: z.enum(["ARIAL", "TAHOMA"]), arabicFontSize: z.number().int().min(10).max(96),
  arabicFontWeight: z.number().int().min(300).max(900).multipleOf(100), arabicTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  arabicTextX: z.number().min(0).max(100), arabicTextY: z.number().min(0).max(100), arabicTextRotation: z.number().min(-45).max(45),
  arabicTextAlign: z.enum(namedCaseAlignments),
});

const latinName = /^[\p{Script=Latin}\p{Mark}]+$/u;
const arabicName = /^[\p{Script=Arabic}\p{Mark}]+$/u;
const bothName = /^[\p{Script=Latin}\p{Script=Arabic}\p{Mark} ،.,'’\-\s]+$/u;

export function validateNamedCaseText(value: string, template: Pick<NamedCaseTemplate, "allowed_script" | "max_characters">) {
  const text = value.trim();
  if (!text) return { ok: false as const, error: "Enter the name or text for your case." };
  if ([...text].length > template.max_characters) return { ok: false as const, error: `Use ${template.max_characters} characters or fewer.` };
  const pattern = template.allowed_script === "LATIN" ? latinName : template.allowed_script === "ARABIC" ? arabicName : bothName;
  if (!pattern.test(text)) return { ok: false as const, error: template.allowed_script === "LATIN" ? "Use Latin letters and common name punctuation only." : template.allowed_script === "ARABIC" ? "Use Arabic letters and common name punctuation only." : "Use Arabic or Latin letters and common name punctuation only." };
  return { ok: true as const, text };
}

export function renderNamedCaseText(text: string, transform: NamedCaseTransform) {
  if (transform === "UPPERCASE") return text.toLocaleUpperCase("en");
  if (transform === "LOWERCASE") return text.toLocaleLowerCase("en");
  return text;
}

function validateName(value: string, max: number, pattern: RegExp, label: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return { ok: false as const, error: `Enter your name in ${label}.` };
  if ([...text].length > max) return { ok: false as const, error: `${label} name must use ${max} characters or fewer.` };
  if (!pattern.test(text)) return { ok: false as const, error: `Use ${label === "English" ? "English/Latin" : "Arabic"} letters only.` };
  return { ok: true as const, text };
}

export function validateEnglishName(value: string, max: number) { return validateName(value, max, latinName, "English"); }
export function validateArabicName(value: string, max: number) { return validateName(value, max, arabicName, "Arabic"); }

export function templateEnglishStyle(template: NamedCaseTemplate): NamedCaseTextStyle {
  return { fontKey: template.english_font_key, fontSize: template.english_font_size, fontWeight: template.english_font_weight, textColor: template.english_text_color, textX: Number(template.english_text_x), textY: Number(template.english_text_y), textRotation: Number(template.english_text_rotation), textAlign: template.english_text_align };
}
export function templateArabicStyle(template: NamedCaseTemplate): ArabicNamedCaseTextStyle {
  return { fontKey: template.arabic_font_key as "ARIAL" | "TAHOMA", fontSize: template.arabic_font_size, fontWeight: template.arabic_font_weight, textColor: template.arabic_text_color, textX: Number(template.arabic_text_x), textY: Number(template.arabic_text_y), textRotation: Number(template.arabic_text_rotation), textAlign: template.arabic_text_align };
}

export function productAssetUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return resolvePublicMediaUrl(path, base);
}
