import { AppError } from "../lib/api";
import { connectDB } from "../lib/db";
import { chat, ChatUnavailableError, type ChatMessage } from "../lib/chat";
import { Product, SupplierProfile, User } from "../models";
import { productQuerySchema } from "../validators/product";
import { addItem } from "./cart.service";
import { getSimilarProducts, listProducts } from "./product.service";
import type { AssistantInput } from "../validators/assistant";

/**
 * The marketplace assistant.
 *
 * Every answer is **retrieved first, generated second**. We run the buyer's
 * question through the same semantic search the catalog uses, then hand the
 * model only those rows and forbid it from going beyond them. Two things fall
 * out of that:
 *
 * 1. The product cards the UI renders come from the database, not from the
 *    model's text — so a hallucinated fabric cannot reach the buyer as a card
 *    they could click and add to a cart.
 * 2. If the model is unavailable (HF quota, timeout, a bad deploy), the
 *    retrieval still succeeded, so we answer from it deterministically instead
 *    of showing an error. On demo day that difference matters more than any
 *    amount of prompt tuning.
 */

const MAX_HISTORY = 6;
/**
 * Four, matching what the panel shows as cards.
 *
 * Grounding on more than is displayed lets the model name a fabric the buyer
 * cannot see or click, which reads as a hallucination even though it is not.
 * Keeping the two equal also shortens the prompt, and the reply lands faster
 * for it — worth having on a live demo.
 */
const RETRIEVE_LIMIT = 4;

type RetrievedProduct = {
  _id: unknown;
  name: string;
  slug: string;
  category: string;
  fabricType: string;
  pricePerUnit: number;
  unit: string;
  stock: number;
  minimumOrderQuantity: number;
  specifications?: {
    gsm?: number;
    composition?: string;
    weave?: string;
    finish?: string;
    certifications?: string[];
  };
  supplier?: { _id?: unknown; businessName?: string; address?: { city?: string } };
};

/**
 * A supplier as the assistant may describe them. Contact details are absent by
 * construction — a buyer never gets a direct line to a supplier, and the
 * assistant is not a loophole around that.
 */
type RetrievedSupplier = {
  businessName: string;
  businessType?: string;
  description?: string;
  address?: { city?: string; state?: string };
  categories?: string[];
  fabricTypes?: string[];
  minimumOrderQuantity?: number;
  yearEstablished?: number;
  verified?: boolean;
  rating?: number;
  ratingCount?: number;
};

export type AssistantMode = "search" | "product" | "compare";

/**
 * What the assistant did, beyond talking.
 *
 * The brief's own walkthrough asks for this: "it can add some certain item to
 * the shopping cart — that can be agentic AI". The model only ever *proposes*
 * an action by index into the grounding block; the server resolves that index,
 * re-checks MOQ and stock through the normal cart service, and reports what
 * actually happened. A model cannot add a fabric that was not retrieved, nor
 * bypass a single rule the Add to Cart button obeys.
 */
export type AssistantAction =
  | { type: "added_to_cart"; product: string; quantity: number; unit: string; itemCount: number }
  | { type: "sign_in_required"; product: string; quantity: number }
  | { type: "cart_failed"; product: string; reason: string };

/**
 * One fabric as labelled key/value data.
 *
 * Deliberately not prose: an 8B model handed a fluent one-line summary tends to
 * echo it back verbatim instead of answering. Formatting the grounding as an
 * obvious data record makes copying it read as wrong, and the reply comes out
 * as sentences.
 */
function factLine(p: RetrievedProduct, index: number): string {
  const spec = p.specifications ?? {};
  const attrs = [
    `category: ${p.category} / ${p.fabricType}`,
    spec.gsm ? `gsm: ${spec.gsm}` : null,
    spec.composition ? `composition: ${spec.composition}` : null,
    spec.weave ? `weave: ${spec.weave}` : null,
    spec.finish ? `finish: ${spec.finish}` : null,
    `price: ₹${p.pricePerUnit} per ${p.unit}`,
    `moq: ${p.minimumOrderQuantity} ${p.unit}`,
    `stock: ${p.stock > 0 ? `${p.stock} ${p.unit}` : "none, out of stock"}`,
    p.supplier?.businessName
      ? `supplier: ${p.supplier.businessName}${p.supplier.address?.city ? ` (${p.supplier.address.city})` : ""}`
      : null,
    spec.certifications?.length
      ? `certifications: ${spec.certifications.join(", ")}`
      : null,
  ].filter(Boolean);

  return `[${index + 1}] ${p.name}\n    ${attrs.join("\n    ")}`;
}

async function buyerContext(buyerId?: string): Promise<string | null> {
  if (!buyerId) return null;

  const user = await User.findById(buyerId).select("buyerPreferences").lean();
  const p = user?.buyerPreferences;
  if (!p) return null;

  const parts = [
    p.businessType ? `a ${p.businessType}` : null,
    p.industry ? `in ${p.industry}` : null,
    p.interestedCategories?.length
      ? `usually buying ${p.interestedCategories.join(", ")}`
      : null,
    p.preferredFabricTypes?.length
      ? `preferring ${p.preferredFabricTypes.join(", ")} construction`
      : null,
    p.typicalOrderQuantity ? `ordering ${p.typicalOrderQuantity} at a time` : null,
    p.budgetRange ? `budget ${p.budgetRange}` : null,
    p.notes ? `Their note: "${p.notes}"` : null,
  ].filter(Boolean);

  return parts.length
    ? `The buyer is ${parts.join(", ")}. Weigh this when recommending, but never refuse a request that falls outside it.`
    : null;
}

/** The distinct suppliers behind the retrieved fabrics, so "tell me about this
 *  supplier" has something real to answer from. */
async function retrieveSuppliers(
  products: RetrievedProduct[],
): Promise<RetrievedSupplier[]> {
  const ids = [...new Set(products.map((p) => p.supplier?._id).filter(Boolean))];
  if (!ids.length) return [];

  return SupplierProfile.find({ _id: { $in: ids } })
    .select(
      "businessName businessType description address.city address.state categories fabricTypes minimumOrderQuantity yearEstablished verified rating ratingCount",
    )
    .lean() as unknown as Promise<RetrievedSupplier[]>;
}

function supplierFact(s: RetrievedSupplier): string {
  const attrs = [
    s.businessType ? `type: ${s.businessType}` : null,
    s.address?.city
      ? `based in: ${s.address.city}${s.address.state ? `, ${s.address.state}` : ""}`
      : null,
    s.yearEstablished ? `established: ${s.yearEstablished}` : null,
    s.verified ? "verified: yes" : null,
    s.rating ? `rating: ${s.rating.toFixed(1)} from ${s.ratingCount ?? 0}` : null,
    s.categories?.length ? `supplies: ${s.categories.join(", ")}` : null,
    s.fabricTypes?.length ? `construction: ${s.fabricTypes.join(", ")}` : null,
    s.minimumOrderQuantity ? `business moq: ${s.minimumOrderQuantity}` : null,
    s.description ? `about: ${s.description}` : null,
  ].filter(Boolean);

  return `${s.businessName}\n    ${attrs.join("\n    ")}`;
}

async function retrieve(input: AssistantInput): Promise<{
  products: RetrievedProduct[];
  mode: AssistantMode;
  searchUrl?: string;
}> {
  await connectDB();

  // Product Q&A: anchor on one fabric, with its nearest neighbours as context
  // so "is there anything lighter?" has something to answer from.
  if (input.productSlug) {
    const product = await Product.findOne({ slug: input.productSlug })
      .populate("supplier", "businessName address.city")
      .lean();

    if (product) {
      const similar = (await getSimilarProducts(input.productSlug, 3)) as unknown as RetrievedProduct[];
      return {
        products: [product as unknown as RetrievedProduct, ...similar],
        mode: "product",
      };
    }
  }

  if (input.compareSlugs?.length) {
    const products = (await Product.find({ slug: { $in: input.compareSlugs } })
      .populate("supplier", "businessName address.city")
      .lean()) as unknown as RetrievedProduct[];

    if (products.length) return { products, mode: "compare" };
  }

  const question = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const query = productQuerySchema.parse({ q: question, limit: String(RETRIEVE_LIMIT) });
  const listing = await listProducts(query);

  return {
    products: listing.products as unknown as RetrievedProduct[],
    mode: "search",
    searchUrl: question ? `/products?q=${encodeURIComponent(question)}` : "/products",
  };
}

function systemPrompt(
  facts: string,
  supplierFacts: string,
  mode: AssistantMode,
  preferences: string | null,
  canAddToCart: boolean,
): string {
  const task =
    mode === "compare"
      ? "The buyer is comparing the fabrics below. Contrast them on weight, composition, price and minimum order, and say plainly which suits which use."
      : mode === "product"
        ? "The buyer is on the page for fabric 1. Answer about that fabric. The others are near alternatives you may mention if genuinely relevant."
        : "Recommend from the fabrics below, or answer the buyer's question about them.";

  return [
    "You are the sourcing assistant for TextileMart, a B2B fabric marketplace in India.",
    task,
    "",
    "Rules you must not break:",
    "- Use ONLY the CATALOG below. It is the complete set of fabrics available for this question.",
    "- Never invent a fabric, price, GSM, supplier or certification. If the catalog cannot answer, say so and suggest what to search for instead.",
    "- Name fabrics exactly as written. Do not number them or repeat the [n] markers.",
    "- Prices are per unit in Indian rupees. MOQ is the minimum order quantity.",
    "- Write plain sentences. Never reproduce the catalog's `key: value` layout — read the data, then explain it in your own words.",
    "- Two to four sentences, or a short list when comparing. No headings, no preamble, no markdown tables.",
    "- You are talking to a business buyer. Lead with construction, weight, price and MOQ, not adjectives.",
    "- Never give out a supplier's email address or phone number. Orders travel through the marketplace; you do not have those details and must not invent them.",
    preferences ? `\n${preferences}` : "",
    canAddToCart
      ? [
          "",
          "ADDING TO THE CART",
          "If — and only if — the buyer clearly asks you to add something to their cart or place it in their basket, finish your reply with a line in exactly this form:",
          "[[CART:n|quantity]]",
          "where n is the catalog number and quantity is a whole number in that fabric's unit. Use its MOQ when the buyer does not name a quantity, and never less than the MOQ.",
          "Say in words what you are adding. Never emit this marker for a question, a comparison, or a recommendation the buyer has not accepted.",
        ].join("\n")
      : "",
    "",
    "CATALOG:",
    facts || "(no fabrics matched)",
    supplierFacts ? `\nSUPPLIERS:\n${supplierFacts}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Pulls the action marker out of the reply, leaving the prose behind. */
const CART_MARKER = /\[\[CART:\s*(\d+)\s*\|\s*(\d+)\s*\]\]/;

function extractCartIntent(text: string): { index: number; quantity: number } | null {
  const match = text.match(CART_MARKER);
  if (!match) return null;
  return { index: Number(match[1]) - 1, quantity: Number(match[2]) };
}

/**
 * Removes grounding artefacts that leak into the prose. The `[n]` markers are
 * there to keep the model's references unambiguous, and a rule not to echo them
 * holds most of the time — but "most of the time" is not a standard worth
 * shipping when a regex settles it.
 */
function cleanReply(text: string): string {
  return text
    .replace(CART_MARKER, "")
    .replace(/\[(\d+)\]\s*/g, "")
    .replace(/^\s*(?:CATALOG|SUPPLIERS|Answer)\s*:\s*/i, "")
    .trim();
}

/**
 * Carries out an add-to-cart the model proposed.
 *
 * Everything is re-checked here: the index has to resolve to a fabric that was
 * actually retrieved, and `addItem` applies the same MOQ, stock and status
 * rules the Add to Cart button goes through. A refusal comes back as an action
 * the UI can explain, not as a thrown error — the reply itself is still useful.
 */
async function runCartIntent(
  intent: { index: number; quantity: number },
  products: RetrievedProduct[],
  buyerId?: string,
): Promise<AssistantAction | undefined> {
  const product = products[intent.index];
  if (!product) return undefined;

  const quantity = Math.max(
    intent.quantity || product.minimumOrderQuantity,
    product.minimumOrderQuantity,
  );

  if (!buyerId) {
    return { type: "sign_in_required", product: product.name, quantity };
  }

  try {
    const cart = await addItem(buyerId, {
      productId: String(product._id),
      quantity,
    });
    return {
      type: "added_to_cart",
      product: product.name,
      quantity,
      unit: product.unit,
      itemCount: cart.itemCount,
    };
  } catch (err) {
    return {
      type: "cart_failed",
      product: product.name,
      reason:
        err instanceof AppError ? err.message : "That could not be added to your cart.",
    };
  }
}

/** Deterministic answer for when no model is reachable. Never an error page. */
function fallbackReply(products: RetrievedProduct[], mode: AssistantMode): string {
  if (!products.length) {
    return "I could not find anything matching that in the catalog. Try describing the end use — for example, “lightweight cotton for summer shirting” — or browse by category.";
  }

  const top = products.slice(0, 3);
  const lead =
    mode === "compare"
      ? "Here is what the catalog holds for those fabrics:"
      : mode === "product"
        ? "Here are the details on record:"
        : `I found ${products.length} ${products.length === 1 ? "fabric" : "fabrics"} that match:`;

  const lines = top.map((p) => {
    const gsm = p.specifications?.gsm ? `${p.specifications.gsm} GSM, ` : "";
    return `• ${p.name} — ${gsm}₹${p.pricePerUnit}/${p.unit}, MOQ ${p.minimumOrderQuantity}`;
  });

  return [lead, ...lines].join("\n");
}

function followUps(products: RetrievedProduct[], mode: AssistantMode): string[] {
  if (mode === "product") {
    return [
      "What is this best used for?",
      "Show me something lighter",
      "How does it compare to the alternatives?",
    ];
  }
  if (mode === "compare") {
    return ["Which is better value in bulk?", "Which one ships from closer?"];
  }

  const category = products[0]?.category;
  return [
    category ? `Show me more ${category.toLowerCase()}` : "What is trending?",
    "Which of these is cheapest in bulk?",
    "Anything GOTS certified?",
  ].filter(Boolean);
}

export async function askAssistant(input: AssistantInput) {
  const { products, mode, searchUrl } = await retrieve(input);

  const [suppliers, preferences] = await Promise.all([
    retrieveSuppliers(products),
    buyerContext(input.buyerId),
  ]);

  const facts = products.map(factLine).join("\n");
  const supplierFacts = suppliers.map(supplierFact).join("\n");

  // Only the tail of the conversation is sent. The grounding block is rebuilt
  // every turn anyway, so older turns add tokens without adding accuracy.
  const history: ChatMessage[] = input.messages
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }));

  let reply: string;
  let grounded = true;
  let provider: string | null = null;
  let action: AssistantAction | undefined;

  try {
    const result = await chat([
      {
        role: "system",
        content: systemPrompt(
          facts,
          supplierFacts,
          mode,
          preferences,
          products.length > 0,
        ),
      },
      ...history,
    ]);

    const intent = extractCartIntent(result.text);
    if (intent) action = await runCartIntent(intent, products, input.buyerId);

    reply = cleanReply(result.text);
    provider = result.provider;
  } catch (err) {
    if (!(err instanceof ChatUnavailableError)) throw err;
    console.warn(`[assistant] falling back to retrieval-only: ${err.message}`);
    reply = fallbackReply(products, mode);
    grounded = false;
  }

  return {
    reply,
    // Cards are rendered from these rows, never parsed out of the reply text.
    products,
    mode,
    searchUrl,
    suggestions: followUps(products, mode),
    /** False when the answer came from retrieval alone, so the UI can say so. */
    generated: grounded,
    provider,
    /** Present when the assistant did something, not just said something. */
    action,
  };
}
