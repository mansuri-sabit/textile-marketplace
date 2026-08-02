<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TextileMart — B2B fabric marketplace

Hackathon prototype. **Submission deadline: 7 August 2026.** Started 2 August 2026.

Deliverables are a **demo video** and a **live URL**. Source code submission is
explicitly *not* required — so a broken deploy scores zero and a beautiful repo
nobody opens scores nothing. Treat deployment and the demo path as first-class
work, not cleanup.

Judging weights product thinking, engineering quality, UX and performance above
feature count. Payments, escrow, logistics and admin dashboards are out of scope.

- Live: https://textile-marketplace-azure.vercel.app
- Repo: https://github.com/mansuri-sabit/textile-marketplace
- Brief: `../Tast.md` (outside this repo)

## Stack

Next.js 16.2 (App Router, Turbopack) · React 19 · Tailwind v4 · TypeScript ·
MongoDB Atlas + Mongoose 9 · jose for JWT · zustand · Cloudinary · Hugging Face.

One deployable, not a split frontend/backend. Next route handlers *are* the
Node backend the brief asks for, and a single deploy removes cross-domain
cookie work and a second cold-start surface that earn no marks.

## Commands

```bash
npm run dev              # localhost:3000
npm run build            # production build
npm run typecheck        # tsc --noEmit — run before every commit
npm run seed             # full seed; -- --wipe to reset first
npm run seed:verify      # counts, embedding dims, image reachability
npm run smoke            # all three suites (needs dev server running)
```

Smoke suites live in `scripts/` and assert against a live server:
`smoke:auth` (27), `smoke:products` (42), `smoke:commerce` (56),
`smoke:journey` (104). **229 assertions, all passing as of the last commit.**
They create throwaway accounts, supplier profiles and orders, and mutate data;
that is fine for a prototype.

`smoke:journey` asserts on rendered pages, not just APIs — every route it hits
returned a 404 before it existed. It also covers the token re-issue after
onboarding, which is the one failure mode that would strand a new account in a
redirect loop.

## Layout

```
src/
  app/
    (auth)/            login, register — split layout, no marketplace chrome
    api/               25 route handlers; thin, delegate to src/server
    products/          browse + detail
    onboarding/        buyer conversational setup
    suppliers/         public directory + storefronts
    cart/ checkout/    cart, two-step checkout, confirmation by checkout group
    orders/            buyer order list + detail with status timeline
    buyer/             dashboard + profile
    supplier/          onboarding, plus (console)/ — dashboard, inventory
                       CRUD, order management, business profile
    page.tsx           homepage
  server/              backend, kept entirely separate from UI
    constants/         marketplace vocabulary — categories, statuses, flow
    data/              seed catalog (43 base SKUs, 10 suppliers)
    lib/               db, env, tokens, cookies, password, pricing,
                       embeddings, cloudinary, pexels, slug, api
    middleware/        session.ts — getSession, requireBuyer, requireSupplier
    models/            User, SupplierProfile, Product, Cart, Order
    repositories/      product.repository — all catalog read queries
    services/          auth, product, cart, order, supplier
    validators/        zod schemas per domain
  components/{ui,layout,buyer,supplier,ai,onboarding}
  lib/                 client helpers: api-client, cn, image, serialize
  store/               zustand: session, cart
  types/               client-side API shapes
  proxy.ts             edge route guards (Next 16 renamed middleware.ts)
scripts/               seed, verify, smoke tests, seed-images.json
```

Server Components import services **directly** — no HTTP round trip to our own
API. Pass results through `serialize<T>()` before handing them to a Client
Component; Mongoose lean docs carry ObjectId and Date, which cannot cross the
boundary. `serialize` deliberately takes `unknown` and returns the caller's
declared type, because the round trip changes types (ObjectId → string).

## Decisions worth not re-litigating

**Auth.** Access + refresh JWTs in httpOnly, sameSite lax cookies. `jose`, not
`jsonwebtoken`, because the edge proxy verifies a token on every navigation and
`jsonwebtoken` needs Node crypto the edge lacks. Every token carries a unique
`jti`: `iat` is second-resolution, so without it two tokens minted in the same
second are byte-identical and refresh rotation is unobservable (a real bug the
smoke test caught). Login answers with one error code and always runs a real
bcrypt compare, so neither wording nor timing reveals which emails exist.
`refreshSession` re-checks `tokenVersion` against the DB so logout-everywhere
can kill unexpired tokens.

**`src/proxy.ts` is UX, not security.** It redirects; every API route re-checks
via `requireRole`. Never move an authorisation decision into it alone.

**Orders split per supplier at checkout**, sharing a `checkoutGroupId`. Each
supplier sees only their own lines. The cart shows the split *before* the buyer
commits. Order line items are denormalised so a historical order still renders
after the product is renamed or deleted.

**Stock** is decremented with a conditional update per line (`stock >= quantity`)
and compensated on failure, not a transaction. The conditional update is atomic
where the race actually is, and this keeps checkout working without a replica
set. Cancelling an order returns stock.

**Order status** is constrained by `ORDER_STATUS_FLOW` in
`server/constants/marketplace.ts`: no skipping, no going backwards, `completed`
is terminal.

**Bulk pricing** lives in one helper (`server/lib/pricing.ts`) and is applied in
cart, checkout and the stored order. `AddToCart.tsx` mirrors it client-side so
the buyer sees the real unit price before committing — if you change one, change
both.

**`onboardingCompleted` is a token claim**, because `proxy.ts` runs at the edge
with no database access. Anything that changes it must call `reissueSession`
and re-set the cookies in the same response — otherwise the guard keeps acting
on the stale copy for up to 15 minutes and redirects a user who has already
finished straight back into onboarding. Both onboarding routes do this; a smoke
assertion pins it.

**Onboarding is a scripted chat, not a model call.** One engine
(`components/onboarding/ConversationalOnboarding.tsx`) drives both roles from a
step list. It is instant, works with no API quota, and cannot produce an enum
value the database would reject — and the transcript shape means the LLM
assistant can take the same screen over later without changing the interaction
model.

**Zod defaults belong to create schemas only.** `.partial()` does *not* strip
them, so `productInputSchema.partial()` used to apply `stock: 0` and `tags: []`
to any PATCH that omitted them — an unrelated field edit silently zeroed the
stock. `productShape` in `validators/product.ts` now holds the defaultless
shape; the create schema extends it with defaults, the update schema
`.partial()`s it. Any new update schema must be built the same way.

**`draft` is a decision, `out_of_stock` is a consequence.** Restocking never
republishes a listing the supplier deliberately unlisted — `updateStock` reads
the current status first and preserves `draft`.

**The assistant retrieves first and generates second.** Every question runs
through the same semantic search the catalog uses; the model is handed only
those rows and forbidden from going beyond them. Two consequences worth
keeping: product cards are rendered from the retrieved rows, never parsed out
of the reply, so a hallucinated fabric can never become a clickable card at a
fake price — and when no chat provider answers, retrieval already succeeded, so
`askAssistant` falls back to a deterministic reply and flags `generated: false`
rather than erroring. On demo day that beats any amount of prompt tuning.

Grounding is formatted as `key: value` records, not prose. Handed a fluent
one-line summary, an 8B model echoes it back verbatim instead of answering.
`[n]` markers are stripped from the reply server-side — a rule not to echo them
holds most of the time, and most of the time is not a standard worth shipping.

**Ownership is enforced inside query filters**, so another supplier's id matches
nothing and 404s rather than partially writing. An order that is not yours
returns the same 404 as one that does not exist, so order numbers cannot be
probed.

**Filter semantics live only in `product.repository.ts`** so the grid, the facet
counts and the AI assistant can never disagree about what a filter means. Facets
are computed against the other active filters. An unknown supplier slug returns
nothing rather than silently dropping the filter.

**Search.** `q` embeds the query and ranks by cosine against catalog vectors,
intersected with active filters; keyword regex is the fallback. The response
reports `mode` (`semantic` / `keyword` / `browse`) and the UI labels it honestly.
Embeddings are cached per isolate for 5 minutes; call
`invalidateEmbeddingCache()` after any catalog write. An exact in-memory scan
beats index setup at 105 products — Atlas Vector Search is the swap-in if the
catalog ever grows, and nothing above `semanticRank` would change.

**Embeddings** are generated once at seed time, never per request, to protect
the Hugging Face free-tier quota for demo day. `embeddingMeta` records provider
and dimension because HF (384) and OpenAI (1536) vectors are not comparable — a
provider switch requires a re-seed and the mismatch must be detectable.

**Images.** Catalog photography was fetched once from Pexels and re-hosted on
Cloudinary, so product pages never depend on a third-party rate limit at render
time. The mapping is cached in `scripts/seed-images.json` and committed — a
re-seed costs no quota and needs no Pexels key. Photographer credit is stored
per image and rendered on product pages; that was promised in the API
application, so keep it. Supplier uploads go browser-direct to Cloudinary via a
signed, supplier-only endpoint, which sidesteps the serverless body limit.

**Design tokens** in `globals.css`: warm neutrals rather than cold grey (a fabric
catalog reads better on paper tones), indigo primary as the dye this industry is
built on, clay as the single interrupting accent. Dark mode is class-driven with
a pre-paint inline script, so the toggle can override the OS setting without a
flash. Prices use `.tnum` so digits do not jitter.

## Environment

`.env` is git-ignored and already populated locally; `.env.example` is the
committed template. Vercel holds the same values **except** `NODE_ENV` (Vercel
sets it; overriding it breaks the production build).

Verified working: MongoDB Atlas, Hugging Face (chat 1.4s, embeddings 296ms/384d),
Cloudinary (free plan), Pexels (25k/month). Untested: Redis, Sarvam, OpenAI
fallback.

`MONGODB_URI` points at a cluster shared with another project, isolated by
`MONGODB_DB=textile_marketplace`. Atlas Network Access must allow `0.0.0.0/0`
for Vercel's dynamic IPs.

Secrets were reused from another project early on. `JWT_*` are freshly generated,
but **OpenAI, Sarvam, Cloudinary, Redis and Mongo credentials are shared with a
live production app** — never widen their blast radius, and never commit `.env`.
Scan staged files for `.env` before every commit.

## Demo accounts

```
buyer     buyer@demo.test              / Buyer123
supplier  supplier.meridian@demo.test  / Supplier123
```
Ten suppliers exist (`supplier.kanchi@`, `supplier.tirupur@`, …), same password.
The login screen has one-tap buttons for both, so a reviewer never has to type.

## Status

Done: backend (25 routes), catalog seed (105 products / 315 images / 105
embeddings / 10 suppliers), design system and shell, homepage, browse with
filters and semantic search, product detail, supplier directory, login and
register, conversational onboarding for both roles, the full buyer journey —
cart, two-step checkout, order confirmation, order list and detail with a
status timeline, dashboard and profile — and the supplier console: dashboard,
inventory CRUD with browser-direct image upload, order management driving
`ORDER_STATUS_FLOW`, and the business profile. The AI assistant covers all
seven asks in the brief: conversational chat, voice both ways, natural-language
search, recommendations personalised from `buyerPreferences`, comparison,
similar products and per-product Q&A.

**Both roles are clickable end to end.** `smoke:journey` sweeps every href in
the Navbar, Footer and supplier console and fails on any non-200; add to those
lists whenever a link is added.

Remaining, in priority order:

1. Mobile pass on a real device, deploy verification, demo video.
2. Optional polish: Sarvam is configured if Chrome's Hinglish speech
   recognition proves weak on demo day — it would slot in behind `useSpeech`
   without the panel changing.

Known lint debt: `Navbar.tsx` and `ThemeToggle.tsx` trip
`react-hooks/set-state-in-effect`. `next build` does not run eslint, so this
does not block the deploy, but `npm run lint` is red. Both are the
adjust-state-during-render fix already used in `CartView.tsx`.

The brief calls AI a bonus (line 192) while also making it core scope (lines
30–40). Treat it as core.

## Gotchas that already cost time

- **Restart the dev server after adding server modules.** Turbopack served stale
  code and semantic search silently fell back to keyword — three smoke tests red
  with no bug in the code.
- **Never run `next build` and `next dev` against the same `.next`.** The dev
  Turbopack cache gets corrupted and *every* route starts returning a 500
  (`Unable to open static sorted file … .sst`). It looks like the app is broken;
  it is not. Stop the dev server, delete `.next`, start it again.
- **Never edit files with PowerShell string replacement.** `Get-Content -Raw`
  reads UTF-8 as ANSI and mangles em-dashes and `₹` into mojibake. Use the Edit
  tool.
- **Commit messages: use `git commit -F <file>`.** Double quotes inside a
  PowerShell here-string break argument parsing and git receives fragments.
- **Mongoose 9 renamed `FilterQuery` to `QueryFilter`.**
- **Next 16 renamed `middleware.ts` to `proxy.ts`** and the exported function to
  `proxy`.
- `cart.items` is a Mongoose DocumentArray — assigning a plain array fails
  typecheck. Use `$pull` (which is also race-free).
- Zod v4: `.default()` must satisfy the *output* type, so a nested `.default([])`
  makes that key required in the parent's default.
