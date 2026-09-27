import Image from "next/image";
import type { CSSProperties } from "react";

type BrandLogoProps = {
  priority?: boolean;
  width?: number;
  height?: number;
  className?: string;
};

type LogoStyle = CSSProperties & {
  "--brand-logo-width": string;
  "--brand-logo-height": string;
};

export function BrandLogo({
  priority = false,
  width = 142,
  height = 30,
  className,
}: BrandLogoProps) {
  const style: LogoStyle = {
    "--brand-logo-width": `${width}px`,
    "--brand-logo-height": `${height}px`,
  };

  return (
    <span className={`brand-logo-frame${className ? ` ${className}` : ""}`} style={style}>
      <Image
        className="brand-logo-image"
        src="/assets/logo/coolcase-logo.png"
        alt="Coolcase"
        width={1122}
        height={1402}
        priority={priority}
      />
    </span>
  );
}
