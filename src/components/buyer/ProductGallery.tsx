"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { cdnBlur, cdnImage } from "@/lib/image";

export function ProductGallery({
  images,
  alt,
  credits,
}: {
  images: string[];
  alt: string;
  credits?: Array<{ photographer: string; sourceUrl: string }>;
}) {
  const [active, setActive] = useState(0);
  const current = images[active];
  const credit = credits?.[active];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-raised">
        {current && (
          <Image
            src={cdnImage(current, { width: 1000, height: 1000 })}
            alt={alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            placeholder="blur"
            blurDataURL={cdnBlur(current)}
            priority
            className="object-cover"
          />
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {images.map((image, i) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-current={i === active}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                i === active ? "border-indigo-500" : "border-line hover:border-line-strong",
              )}
            >
              <Image
                src={cdnImage(image, { width: 200, height: 200 })}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {credit && (
        <p className="mt-3 text-[11px] text-ink-subtle">
          Photo by{" "}
          <a
            href={credit.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-ink-muted"
          >
            {credit.photographer}
          </a>{" "}
          on Pexels
        </p>
      )}
    </div>
  );
}
