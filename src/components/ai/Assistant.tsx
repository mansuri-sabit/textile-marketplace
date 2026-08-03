"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Columns3,
  Mic,
  Send,
  ShoppingCart,
  Square,
  TriangleAlert,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  ASSISTANT_NAME,
  ASSISTANT_ROLE,
  AssistantAvatar,
} from "@/components/ai/AssistantAvatar";
import { useSpeechInput, useSpeechOutput } from "@/components/ai/useSpeech";
import { Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { cn, formatPrice } from "@/lib/cn";
import { cdnImage } from "@/lib/image";
import { useAssistant } from "@/store/assistant";
import { useCart } from "@/store/cart";
import { useSession } from "@/store/session";

/**
 * The marketplace assistant.
 *
 * Product cards are rendered from the rows the server retrieved, never parsed
 * out of the model's prose — so the things a buyer can click are always real
 * catalog entries at real prices, whatever the model wrote above them. When the
 * model is unreachable the server still answers from retrieval and flags it,
 * and this panel says so rather than pretending.
 */

type AssistantProduct = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  images?: string[];
  pricePerUnit: number;
  unit: string;
  stock: number;
  minimumOrderQuantity: number;
  specifications?: { gsm?: number; composition?: string };
  supplier?: { businessName?: string };
};

/** What the assistant did, beyond talking. */
type AssistantAction =
  | { type: "added_to_cart"; product: string; quantity: number; unit: string; itemCount: number }
  | { type: "sign_in_required"; product: string; quantity: number }
  | { type: "cart_failed"; product: string; reason: string };

type AssistantResponse = {
  reply: string;
  products: AssistantProduct[];
  mode: "search" | "product" | "compare";
  searchUrl?: string;
  suggestions: string[];
  generated: boolean;
  action?: AssistantAction;
};

type Turn = {
  role: "user" | "assistant";
  content: string;
  products?: AssistantProduct[];
  searchUrl?: string;
  generated?: boolean;
  action?: AssistantAction;
};

const OPENERS = [
  "Lightweight cotton for summer shirting",
  "GOTS certified fabric under ₹200 a metre",
  "Something with drape for occasion wear",
];

export function Assistant() {
  const open = useAssistant((s) => s.open);
  const productSlug = useAssistant((s) => s.productSlug);
  const openAssistant = useAssistant((s) => s.openAssistant);
  const close = useAssistant((s) => s.close);

  const role = useSession((s) => s.user?.role);
  const loadCart = useCart((s) => s.load);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(OPENERS);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const speech = useSpeechOutput();
  const mic = useSpeechInput({ onTranscript: setDraft });

  const send = useCallback(
    async (text: string, compareSlugs?: string[]) => {
      const question = text.trim();
      if (!question || busy) return;

      setDraft("");
      setError(null);
      setBusy(true);
      speech.cancel();

      const history: Turn[] = [...turns, { role: "user", content: question }];
      setTurns(history);

      try {
        const data = await api.post<AssistantResponse>("/api/assistant", {
          messages: history
            .slice(-10)
            .map((t) => ({ role: t.role, content: t.content })),
          productSlug,
          compareSlugs,
        });

        setTurns([
          ...history,
          {
            role: "assistant",
            content: data.reply,
            products: data.products,
            searchUrl: data.searchUrl,
            generated: data.generated,
            action: data.action,
          },
        ]);
        setSuggestions(data.suggestions ?? []);
        setCompare([]);

        // The assistant just wrote to the cart, so the header badge and the
        // cart page are both stale until the store re-reads it.
        if (data.action?.type === "added_to_cart") loadCart();

        speech.speak(data.reply);
      } catch (err) {
        setTurns(history);
        setError(
          err instanceof ApiError
            ? err.message
            : "The assistant is unreachable right now. Browsing and search still work.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, productSlug, speech, turns, loadCart],
  );

  // A question handed over by another component — a starter chip on a product
  // page — is asked once, then cleared so reopening does not repeat it.
  // Driven by a store subscription rather than an effect body: the seed only
  // ever arrives from a click, and this keeps the send out of render.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(
    () =>
      useAssistant.subscribe((state, previous) => {
        if (state.seed && state.seed !== previous.seed) {
          useAssistant.getState().consumeSeed();
          sendRef.current(state.seed);
        }
      }),
    [],
  );

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, open, busy]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Suppliers get the console, not a sourcing assistant.
  if (role === "supplier") return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => openAssistant()}
        className="group fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-indigo-600 py-1.5 pl-1.5 pr-2 text-sm font-medium text-white shadow-raised transition-transform hover:scale-105 sm:pr-4 dark:bg-indigo-500 dark:text-indigo-50"
        aria-label={`Ask ${ASSISTANT_NAME}, the sourcing assistant`}
      >
        <span className="relative">
          <AssistantAvatar className="size-9" ring />
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-indigo-600 bg-moss-500 dark:border-indigo-500" />
        </span>
        <span className="hidden pr-1 sm:inline">Ask {ASSISTANT_NAME}</span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-end p-0 sm:inset-auto sm:bottom-5 sm:right-5"
      role="dialog"
      aria-label="Sourcing assistant"
    >
      <div className="flex h-[85vh] w-full flex-col overflow-hidden rounded-t-card border border-line bg-surface shadow-raised sm:h-[600px] sm:w-[420px] sm:rounded-card">
        {/*
          The indigo scale inverts in dark mode, so the high numbers are the
          light end there — `dark:bg-indigo-900` rendered a near-white header
          under white text. `indigo-100` is the deep navy in dark, which keeps
          the header reading as a header at both themes.
        */}
        <header className="flex items-center gap-3 bg-indigo-600 px-4 py-3.5 dark:bg-indigo-100">
          <span className="relative shrink-0">
            <AssistantAvatar className="size-10" ring />
            {/* Online dot, as on the reference designs — the assistant is
                always available, and saying so sets the expectation. */}
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-indigo-600 bg-moss-500 dark:border-indigo-100" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-white">
              {ASSISTANT_NAME}
            </p>
            <p className="truncate text-[11px] leading-tight text-white/70">
              {speech.enabled && speech.voice
                ? speech.voice === "premium"
                  ? "Speaking · premium voice"
                  : "Speaking · browser voice"
                : productSlug
                  ? "Online · asking about this fabric"
                  : `Online · ${ASSISTANT_ROLE.toLowerCase()}`}
            </p>
          </div>

          {speech.supported && (
            <button
              type="button"
              onClick={() => {
                speech.setEnabled(!speech.enabled);
                speech.cancel();
              }}
              aria-pressed={speech.enabled}
              className={cn(
                "grid size-8 place-items-center rounded-lg transition-colors",
                speech.enabled
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
              aria-label={speech.enabled ? "Turn off spoken replies" : "Read replies aloud"}
            >
              {speech.enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={close}
            className="grid size-8 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close the assistant"
          >
            <X className="size-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/*
            Opening line first, then the openers as quick replies directly
            under it — the buyer meets a suggestion where they are reading,
            not pinned to the bottom of the panel where it reads as chrome.
          */}
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="rounded-2xl rounded-tl-sm border border-line bg-raised px-4 py-3 text-sm leading-relaxed text-ink">
                Hi, I&rsquo;m {ASSISTANT_NAME}.{" "}
                {productSlug
                  ? "Ask me anything about this fabric — weight, handling, what it suits, or how it compares to the alternatives."
                  : "Tell me what you're making and I'll find fabric for it. I only answer from the live catalog, so everything I show you is really in stock."}
              </p>
              <QuickReplies options={suggestions} onPick={send} disabled={busy} />
            </div>
          )}

          {turns.map((turn, i) =>
            turn.role === "user" ? (
              // w-fit so a two-word question is a two-word bubble; max-w stops
              // a long one from running the full width of the panel.
              <p
                key={i}
                className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2.5 text-sm leading-relaxed text-white dark:bg-indigo-500 dark:text-indigo-50"
              >
                {turn.content}
              </p>
            ) : (
              <div key={i} className="space-y-3">
                <p className="w-fit max-w-[92%] whitespace-pre-line rounded-2xl rounded-tl-sm border border-line bg-raised px-3.5 py-2.5 text-sm leading-relaxed text-ink">
                  {turn.content}
                </p>

                {turn.generated === false && (
                  <p className="text-[11px] text-ink-subtle">
                    Answered from catalog search — the language model was
                    unreachable.
                  </p>
                )}

                {turn.action && <ActionReceipt action={turn.action} onClose={close} />}

                {/* Follow-ups belong to the message that prompted them, so they
                    only appear under the latest reply. */}
                {i === turns.length - 1 && !busy && (
                  <QuickReplies options={suggestions} onPick={send} disabled={busy} />
                )}

                {turn.products && turn.products.length > 0 && (
                  <div className="space-y-2">
                    {/* Two by two. The server retrieves exactly these four, so
                        every fabric the reply can name is also one the buyer
                        can see and click. */}
                    <div className="grid grid-cols-2 gap-2">
                      {turn.products.slice(0, 4).map((product) => (
                        <ProductTile
                          key={product._id}
                          product={product}
                          selected={compare.includes(product.slug)}
                          onToggle={() =>
                            setCompare((c) =>
                              c.includes(product.slug)
                                ? c.filter((s) => s !== product.slug)
                                : c.length >= 4
                                  ? c
                                  : [...c, product.slug],
                            )
                          }
                        />
                      ))}
                    </div>

                    {turn.searchUrl && (
                      <Link
                        href={turn.searchUrl}
                        onClick={close}
                        className="flex items-center gap-1 pt-1 text-xs font-medium text-indigo-600 hover:underline"
                      >
                        See all results in the catalog
                        <ArrowRight className="size-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-1.5 px-1" aria-live="polite">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-ink-subtle"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
              <span className="sr-only">Thinking</span>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-500"
            >
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {compare.length >= 2 && (
          <div className="border-t border-line bg-indigo-50 px-4 py-2.5">
            <Button
              size="sm"
              className="w-full"
              onClick={() =>
                send(
                  `Compare these ${compare.length} fabrics for me.`,
                  compare,
                )
              }
              disabled={busy}
            >
              <Columns3 className="size-3.5" />
              Compare {compare.length} selected
            </Button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2 border-t border-line px-3 py-3"
        >
          {mic.supported && (
            <button
              type="button"
              onClick={() => (mic.listening ? mic.stop() : mic.start())}
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                mic.listening
                  ? "bg-clay-500 text-white"
                  : "text-ink-subtle hover:bg-raised hover:text-ink",
              )}
              aria-label={mic.listening ? "Stop listening" : "Ask by voice"}
            >
              {mic.listening ? <Square className="size-4" /> : <Mic className="size-4" />}
            </button>
          )}

          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={mic.listening ? "Listening…" : "Describe what you need…"}
            aria-label="Ask the assistant"
            className="h-10 flex-1 rounded-full border border-line bg-paper px-4 text-sm text-ink placeholder:text-ink-subtle focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />

          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0 rounded-full"
            disabled={!draft.trim() || busy}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/**
 * Quick replies, right-aligned so they read as things *you* would say — the
 * same side as your own messages. Wrapped rather than in a scrolling strip:
 * a suggestion the buyer cannot see is a suggestion that does not exist.
 */
function QuickReplies({
  options,
  onPick,
  disabled,
}: {
  options: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  if (!options.length) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2 pl-6">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          disabled={disabled}
          className="rounded-full border border-indigo-200 bg-surface px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/**
 * Confirms what the assistant actually did to the cart.
 *
 * Shown as a receipt rather than trusted from the prose: the server reports the
 * real outcome after re-checking MOQ and stock, so this can say "added" only
 * when a row genuinely changed.
 */
function ActionReceipt({
  action,
  onClose,
}: {
  action: AssistantAction;
  onClose: () => void;
}) {
  if (action.type === "added_to_cart") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-moss-500/30 bg-moss-50 px-3 py-2.5">
        <ShoppingCart className="size-4 shrink-0 text-moss-600" />
        <p className="min-w-0 flex-1 text-xs text-ink">
          Added{" "}
          <span className="font-medium tnum">
            {action.quantity} {action.unit}
          </span>{" "}
          of {action.product} to your cart.
        </p>
        <Link
          href="/cart"
          onClick={onClose}
          className="shrink-0 text-xs font-medium text-moss-600 hover:underline"
        >
          View cart
        </Link>
      </div>
    );
  }

  if (action.type === "sign_in_required") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-raised px-3 py-2.5">
        <ShoppingCart className="size-4 shrink-0 text-ink-subtle" />
        <p className="min-w-0 flex-1 text-xs text-ink">
          Sign in and I&rsquo;ll add {action.quantity} of {action.product} to
          your cart.
        </p>
        <Link
          href="/login"
          onClick={onClose}
          className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-ink">
      <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber-500" />
      <span>
        Could not add {action.product} — {action.reason}
      </span>
    </p>
  );
}

/**
 * One fabric in the assistant's result grid.
 *
 * The photograph carries most of the recognition in a panel this narrow, so it
 * leads; the compare toggle sits on the image rather than stealing a row of
 * text. Selecting for comparison must not navigate, hence a button over the
 * link rather than inside it.
 *
 * The add button goes through the same `cart` store as the product page, so MOQ
 * and stock are re-checked server-side exactly as they are there — the tile
 * cannot become a second, looser way into the cart.
 */
function ProductTile({
  product,
  selected,
  onToggle,
}: {
  product: AssistantProduct;
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const close = useAssistant((s) => s.close);
  const user = useSession((s) => s.user);
  const add = useCart((s) => s.add);
  const pending = useCart((s) => s.pending) === product._id;

  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const image = product.images?.[0];
  const soldOut =
    product.stock === 0 || product.stock < product.minimumOrderQuantity;

  async function addToCart() {
    setAddError(null);

    if (!user) {
      // Nothing on this card lets the buyer pick a quantity, so send them to
      // the full product page rather than back to a panel they must reopen.
      close();
      router.push(
        `/login?next=${encodeURIComponent(`/products/${product.slug}`)}`,
      );
      return;
    }

    try {
      // MOQ is the smallest quantity the server accepts, which makes it the
      // only sensible default for a one-tap add from a card this small.
      await add(product._id, product.minimumOrderQuantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (err) {
      setAddError(
        err instanceof ApiError ? err.message : "Could not add this to your cart.",
      );
    }
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border transition-colors",
        selected ? "border-indigo-400 bg-indigo-50" : "border-line bg-surface",
      )}
    >
      <Link href={`/products/${product.slug}`} onClick={close} className="block">
        <span className="relative block aspect-4/3 overflow-hidden bg-raised">
          {image && (
            <Image
              src={cdnImage(image, { width: 260, height: 195 })}
              alt=""
              fill
              sizes="180px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </span>

        <span className="block px-2 pb-1.5 pt-2">
          <span className="line-clamp-2 block text-[11px] font-medium leading-snug text-ink">
            {product.name}
          </span>
          <span className="mt-1 block text-[11px] font-semibold text-ink tnum">
            {formatPrice(product.pricePerUnit)}
            <span className="font-normal text-ink-subtle">/{product.unit}</span>
          </span>
          <span className="mt-0.5 block text-[10px] text-ink-subtle tnum">
            {product.specifications?.gsm ? `${product.specifications.gsm} GSM · ` : ""}
            MOQ {product.minimumOrderQuantity}
          </span>
        </span>
      </Link>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={addToCart}
          disabled={soldOut || pending}
          aria-label={`Add ${product.minimumOrderQuantity} ${product.unit} of ${product.name} to your cart`}
          className={cn(
            "flex h-7 w-full items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            added
              ? "bg-moss-50 text-moss-600"
              : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:text-indigo-50 dark:hover:bg-indigo-400",
          )}
        >
          {added ? (
            <>
              <Check className="size-3 shrink-0" />
              Added
            </>
          ) : (
            <>
              <ShoppingCart className="size-3 shrink-0" />
              {soldOut
                ? "Out of stock"
                : pending
                  ? "Adding…"
                  : `Add ${product.minimumOrderQuantity} ${product.unit}`}
            </>
          )}
        </button>

        {addError && (
          <p role="alert" className="mt-1 text-[10px] leading-snug text-rose-500">
            {addError}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={`Compare ${product.name}`}
        title="Add to comparison"
        className={cn(
          "absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full backdrop-blur transition-colors",
          selected
            ? "bg-indigo-600 text-white"
            : "bg-surface/85 text-ink-subtle hover:text-ink",
        )}
      >
        {selected ? <Check className="size-3.5" /> : <Columns3 className="size-3" />}
      </button>
    </div>
  );
}
