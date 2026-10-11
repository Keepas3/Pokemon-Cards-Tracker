"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { storedImageSrc } from "@/lib/images/rules";

/**
 * A set logo. The card catalog serves each logo as .png and .webp, but a few sets
 * only have one of the two, so this tries .png, then .webp, then shows `fallback`
 * (the set's name) rather than a broken image. Both come from our own saved copy of the logo.
 */
export default function LogoImage({ src, className, fallback }: { src: string; className?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState<string[]>([]);
  const current = [src, src.replace(/\.png$/, ".webp")].find((c) => !failed.includes(c));
  if (!current) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={storedImageSrc(current)} alt="" loading="lazy" className={className} onError={() => setFailed((f) => [...f, current])} />
  );
}
