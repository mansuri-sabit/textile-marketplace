import { connectDB } from "../lib/db";
import { chat, ChatUnavailableError, type ChatMessage } from "../lib/chat";
import { Product, User } from "../models";
import { productQuerySchema } from "../validators/product";
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
const RETRIEVE_LIMIT = 6;

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
  supplier?: { businessName?: string; address?: { city?: string } };
};

export type AssistantMode = "search" | "product" | "compare";

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
  mode: AssistantMode,
  preferences: string | null,
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
    preferences ? `\n${preferences}` : "",
    "",
    "CATALOG:",
    facts || "(no fabrics matched)",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Removes grounding artefacts that leak into the prose. The `[n]` markers are
 * there to keep the model's references unambiguous, and a rule not to echo them
 * holds most of the time — but "most of the time" is not a standard worth
 * shipping when a regex settles it.
 */
function cleanReply(text: string): string {
  return text
    .replace(/\[(\d+)\]\s*/g, "")
    .replace(/^\s*(?:CATALOG|Answer)\s*:\s*/i, "")
    .trim();
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

  const facts = products.map(factLine).join("\n");
  const preferences = await buyerContext(input.buyerId);

  // Only the tail of the conversation is sent. The grounding block is rebuilt
  // every turn anyway, so older turns add tokens without adding accuracy.
  const history: ChatMessage[] = input.messages
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }));

  let reply: string;
  let grounded = true;
  let provider: string | null = null;

  try {
    const result = await chat([
      { role: "system", content: systemPrompt(facts, mode, preferences) },
      ...history,
    ]);
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
  };
}
