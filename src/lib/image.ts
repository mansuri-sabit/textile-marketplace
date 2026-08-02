/**
 * Client-safe Cloudinary URL transforms.
 *
 * Serving a 1200px master into a 300px grid cell is the single biggest source
 * of wasted bytes on a catalog page, and the brief calls out loading
 * performance explicitly. Injecting the transform into the delivery URL lets
 * Cloudinary do the resize and format negotiation at the edge.
 */
export function cdnImage(
  source: string | undefined,
  opts: { width: number; height?: number; crop?: "fill" | "limit" } = { width: 600 },
): string {
  if (!source) return "";

  const marker = "/upload/";
  const at = source.indexOf(marker);
  if (at === -1) return source;

  const crop = opts.crop ?? (opts.height ? "fill" : "limit");
  const dims = opts.height
    ? `w_${opts.width},h_${opts.height},c_${crop}`
    : `w_${opts.width},c_${crop}`;

  return (
    source.slice(0, at + marker.length) +
    `${dims},q_auto,f_auto,dpr_auto/` +
    source.slice(at + marker.length)
  );
}

/**
 * A tiny, heavily blurred version of the same image, inlined as the blur
 * placeholder so a slow connection sees the right colours immediately instead
 * of a grey box.
 */
export function cdnBlur(source: string | undefined): string {
  return cdnImage(source, { width: 24 }).replace("q_auto", "q_10,e_blur:400");
}
