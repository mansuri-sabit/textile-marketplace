import Image from "next/image";
import Link from "next/link";

/**
 * Auth pages get a focused split layout instead of the marketplace chrome —
 * the goal on these two screens is one action, not browsing.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-[#f2eee6] lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-12 xl:px-14">
        {/*
          auth-panel-fabrics.webp is the stack cut out of auth-panel-bg.jpg.
          That source sits on a pure-black backdrop, so a full-bleed crop can
          only ever be a dark panel — knocking it back over the cream instead
          turned the black into flat grey. The cutout drops the backdrop
          entirely, so the panel colour is the background and the stack sits on
          it at full strength. Regenerate from the jpg with sharp:
            .trim({background:'#000000',threshold:12}) then greyscale().
            linear(3,0) joined back on as the alpha channel, written as webp
          (the png of the same cutout is 948K against 189K).
          The panel is light in both themes, so the copy is pinned to dark
          values rather than the ink scale, which inverts.
        */}
        <Image
          src="/auth-panel-fabrics.webp"
          alt=""
          width={883}
          height={601}
          sizes="40vw"
          className="pointer-events-none absolute right-0 bottom-0 w-[64%] max-w-none select-none"
        />

        <div className="relative z-10 w-full pb-[38%]">
          <blockquote>
            <p className="font-display text-[26px] leading-snug text-[#1c1a17] xl:text-3xl">
              &ldquo;We stopped emailing swatch requests to eleven mills. Now we filter by
              GSM and place the order the same afternoon.&rdquo;
            </p>
            <footer className="mt-6 text-sm text-[#5c554a]">
              Sourcing lead, womenswear label
              <span className="mt-1 block text-xs text-[#7d7668]">
                Illustrative — this is a prototype
              </span>
            </footer>
          </blockquote>

          <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-[#1c1a17]/15 pt-8">
            {[
              { value: "105", label: "Fabrics listed" },
              { value: "10", label: "Verified mills" },
              { value: "12", label: "Categories" },
            ].map((s) => (
              <div key={s.label}>
                <dd className="font-display text-2xl text-[#1c1a17] tnum">{s.value}</dd>
                <dt className="mt-0.5 text-xs text-[#5c554a]">{s.label}</dt>
              </div>
            ))}
          </dl>

          <p className="mt-12 text-xs text-[#5c554a]">
            <Link href="/products" className="underline underline-offset-2">
              Browse without an account
            </Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
