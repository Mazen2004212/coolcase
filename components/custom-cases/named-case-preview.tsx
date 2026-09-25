import Image from "next/image";
import { namedCaseFonts, type NamedCaseTextStyle } from "@/lib/custom-cases/templates";

function layerStyle(style: NamedCaseTextStyle) {
  return {
    left: `${style.textX}%`, top: `${style.textY}%`, color: style.textColor,
    fontFamily: namedCaseFonts[style.fontKey].family,
    fontSize: `clamp(8px, ${style.fontSize / 6}cqw, ${style.fontSize}px)`,
    fontWeight: style.fontWeight, textAlign: style.textAlign,
    transform: `translate(-50%, -50%) rotate(${style.textRotation}deg)`,
  };
}

type Props = {
  image: string; imageAlt: string; priority?: boolean;
  englishText?: string; arabicText?: string;
  englishStyle?: NamedCaseTextStyle; arabicStyle?: NamedCaseTextStyle;
  englishStacked?: boolean;
  text?: string; style?: NamedCaseTextStyle;
};

export function NamedCasePreview({ image, imageAlt, priority = false, englishText, arabicText, englishStyle, arabicStyle, englishStacked = false, text, style }: Props) {
  return <div className="named-case-preview">
    <Image src={image} alt={imageAlt} fill priority={priority} unoptimized={image.startsWith("blob:") || image.startsWith("data:")} sizes="(min-width:1024px) 46vw, 100vw" />
    {englishStyle ? <span className="named-case-english" data-layout={englishStacked ? "stacked" : "line"} lang="en" dir="ltr" style={layerStyle(englishStyle)} aria-label={englishText}>{englishStacked ? [...(englishText ?? "")].map((character, index) => <span aria-hidden="true" key={`${character}-${index}`}>{character}</span>) : englishText}</span> : null}
    {arabicStyle ? <span className="named-case-arabic" lang="ar" dir="rtl" style={layerStyle(arabicStyle)}>{arabicText}</span> : null}
    {!englishStyle && style ? <span dir="auto" style={layerStyle(style)}>{text}</span> : null}
  </div>;
}
