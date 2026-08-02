"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Link2, Loader2, Star, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { cdnImage } from "@/lib/image";

/**
 * Browser-direct upload to Cloudinary.
 *
 * The file never passes through a route handler: we ask the server for a
 * short-lived signature and POST the bytes straight to Cloudinary. That
 * sidesteps the serverless request-body limit entirely and keeps a 5 MB image
 * out of the function's memory.
 *
 * The signature covers exactly `timestamp` and `folder`, so the upload body
 * must send those two and nothing else signed, or Cloudinary rejects it.
 */

type Signature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

const MAX_IMAGES = 8;
const MAX_BYTES = 8 * 1024 * 1024;

export function ImageUploader({
  images,
  onChange,
  error,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  error?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);

  const room = MAX_IMAGES - images.length;

  async function upload(files: FileList) {
    const picked = Array.from(files).slice(0, room);
    if (!picked.length) return;

    const tooBig = picked.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setProblem(`"${tooBig.name}" is over 8 MB. Resize it and try again.`);
      return;
    }

    setProblem(null);
    setUploading(picked.length);

    try {
      const sig = await api.post<Signature>("/api/supplier/upload-signature");
      const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;

      const uploaded: string[] = [];
      for (const file of picked) {
        const body = new FormData();
        body.append("file", file);
        body.append("api_key", sig.apiKey);
        body.append("timestamp", String(sig.timestamp));
        body.append("signature", sig.signature);
        body.append("folder", sig.folder);

        const res = await fetch(endpoint, { method: "POST", body });
        if (!res.ok) throw new Error("Cloudinary rejected the upload");

        const json = await res.json();
        uploaded.push(json.secure_url as string);
        setUploading((n) => n - 1);
      }

      onChange([...images, ...uploaded]);
    } catch (err) {
      // Uploads are optional infrastructure — a deployment without Cloudinary
      // keys should still let a supplier list a product by pasting a URL.
      if (err instanceof ApiError && err.code === "UPLOADS_UNAVAILABLE") {
        setProblem(
          "Image uploads are not configured on this deployment. Paste an image URL instead.",
        );
        setShowManual(true);
      } else {
        setProblem("That upload failed. Try again, or paste an image URL.");
      }
    } finally {
      setUploading(0);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function addManual() {
    const url = manualUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setProblem("Enter a full image URL starting with http.");
      return;
    }
    setProblem(null);
    setManualUrl("");
    onChange([...images, url]);
  }

  function makePrimary(index: number) {
    const next = [...images];
    const [moved] = next.splice(index, 1);
    onChange([moved, ...next]);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((src, i) => (
          <div
            key={src}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-lg border bg-raised",
              i === 0 ? "border-indigo-400" : "border-line",
            )}
          >
            <Image
              src={cdnImage(src, { width: 240, height: 240 })}
              alt={i === 0 ? "Primary image" : `Image ${i + 1}`}
              fill
              sizes="120px"
              className="object-cover"
            />

            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white">
                Primary
              </span>
            )}

            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => makePrimary(i)}
                  className="grid size-7 place-items-center rounded-lg bg-surface/90 text-ink-muted backdrop-blur hover:text-indigo-600"
                  aria-label="Make this the primary image"
                >
                  <Star className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(images.filter((_, n) => n !== i))}
                className="ml-auto grid size-7 place-items-center rounded-lg bg-surface/90 text-ink-muted backdrop-blur hover:text-rose-500"
                aria-label="Remove this image"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        {Array.from({ length: uploading }).map((_, i) => (
          <div
            key={`pending-${i}`}
            className="grid aspect-square place-items-center rounded-lg border border-dashed border-line bg-raised"
          >
            <Loader2 className="size-5 animate-spin text-ink-subtle" />
          </div>
        ))}

        {room > 0 && uploading === 0 && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="grid aspect-square place-items-center rounded-lg border border-dashed border-line text-ink-subtle transition-colors hover:border-line-strong hover:text-ink"
          >
            <span className="flex flex-col items-center gap-1.5 text-xs">
              <ImagePlus className="size-5" />
              Add
            </span>
          </button>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && upload(e.target.files)}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-subtle">
        <span>
          {images.length}/{MAX_IMAGES} · the first image is what buyers see in
          the grid
        </span>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="inline-flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline"
        >
          <Link2 className="size-3" />
          {showManual ? "Hide URL field" : "Paste a URL instead"}
        </button>
      </div>

      {showManual && (
        <div className="flex gap-2">
          <input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addManual();
              }
            }}
            placeholder="https://…"
            aria-label="Image URL"
            className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <Button type="button" size="sm" variant="secondary" onClick={addManual}>
            Add
          </Button>
        </div>
      )}

      {(problem || error) && (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs font-medium text-rose-500"
        >
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          {problem ?? error}
        </p>
      )}
    </div>
  );
}
