/**
 * Auth smoke test — run against a live dev server:
 *   npm run dev
 *   node scripts/smoke-auth.cjs
 *
 * Covers registration, validation, duplicate handling, login (including the
 * user-enumeration cases), session reads, refresh rotation, logout, and the
 * proxy route guards. Creates throwaway accounts on each run.
 */
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const stamp = Date.now();
const buyer = {
  name: "Test Buyer",
  email: `buyer${stamp}@example.com`,
  password: "Passw0rd123",
  role: "buyer",
};

let jar = {};

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => k + "=" + v)
    .join("; ");
}

function absorb(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    const k = pair.slice(0, idx);
    const v = pair.slice(idx + 1);
    if (v === "") delete jar[k];
    else jar[k] = v;
  }
}

async function call(method, path, body, opts = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: opts.redirect || "follow",
  });
  absorb(res);
  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("json") ? await res.json() : null;
  return { status: res.status, payload, location: res.headers.get("location") };
}

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log("  PASS  " + label);
  } else {
    fail++;
    console.log("  FAIL  " + label + (extra ? "  -> " + JSON.stringify(extra) : ""));
  }
}

(async () => {
  console.log("\n== validation ==");
  let r = await call("POST", "/api/auth/register", {
    name: "x",
    email: "not-an-email",
    password: "short",
    role: "buyer",
  });
  check("weak/invalid input -> 422", r.status === 422, r.payload);
  check(
    "returns field-level errors",
    Array.isArray(r.payload?.error?.details) && r.payload.error.details.length >= 3,
    r.payload?.error?.details,
  );

  r = await call("POST", "/api/auth/register", { ...buyer, role: "hacker" });
  check("invalid role rejected -> 422", r.status === 422);

  console.log("\n== register ==");
  r = await call("POST", "/api/auth/register", buyer);
  check("register -> 201", r.status === 201, r.payload);
  check("user returned", r.payload?.data?.user?.email === buyer.email);
  check("no passwordHash leaked", !JSON.stringify(r.payload).includes("passwordHash"));
  check("access cookie set", Boolean(jar.mkt_at));
  check("refresh cookie set", Boolean(jar.mkt_rt));
  check("onboarding starts false", r.payload?.data?.user?.onboardingCompleted === false);

  r = await call("POST", "/api/auth/register", buyer);
  check("duplicate email -> 409", r.status === 409, r.payload);

  console.log("\n== session ==");
  r = await call("GET", "/api/auth/me");
  check("me -> 200 with user", r.status === 200 && r.payload?.data?.user?.role === "buyer", r.payload);

  console.log("\n== route guards (proxy) ==");
  r = await call("GET", "/supplier", null, { redirect: "manual" });
  check("buyer hitting /supplier redirected", r.status >= 300 && r.status < 400 && (r.location || "").includes("/"), r.status);

  r = await call("GET", "/cart", null, { redirect: "manual" });
  check(
    "incomplete onboarding -> /onboarding",
    (r.location || "").includes("/onboarding"),
    r.location,
  );

  console.log("\n== logout ==");
  r = await call("POST", "/api/auth/logout");
  check("logout -> 200", r.status === 200);
  check("cookies cleared", !jar.mkt_at && !jar.mkt_rt, jar);

  r = await call("GET", "/api/auth/me");
  check("me after logout -> user null", r.payload?.data?.user === null, r.payload);

  r = await call("GET", "/cart", null, { redirect: "manual" });
  check(
    "anon on /cart -> /login with next",
    (r.location || "").includes("/login") && (r.location || "").includes("next="),
    r.location,
  );

  console.log("\n== login ==");
  r = await call("POST", "/api/auth/login", {
    email: buyer.email,
    password: "WrongPass123",
  });
  check("wrong password -> 401", r.status === 401, r.payload);
  check("generic error message", r.payload?.error?.code === "INVALID_CREDENTIALS");

  r = await call("POST", "/api/auth/login", {
    email: "nobody" + stamp + "@example.com",
    password: "WrongPass123",
  });
  check("unknown email -> same 401 code", r.status === 401 && r.payload?.error?.code === "INVALID_CREDENTIALS");

  r = await call("POST", "/api/auth/login", {
    email: buyer.email,
    password: buyer.password,
  });
  check("correct login -> 200", r.status === 200, r.payload);
  check("cookies reissued", Boolean(jar.mkt_at && jar.mkt_rt));

  console.log("\n== refresh ==");
  const before = jar.mkt_at;
  r = await call("POST", "/api/auth/refresh");
  check("refresh -> 200", r.status === 200, r.payload);
  check("new access token issued", jar.mkt_at !== before);

  jar = {};
  r = await call("POST", "/api/auth/refresh");
  check("refresh without cookie -> 401", r.status === 401, r.payload);

  console.log("\n== supplier role ==");
  const sup = { ...buyer, email: `sup${stamp}@example.com`, role: "supplier" };
  r = await call("POST", "/api/auth/register", sup);
  check("supplier register -> 201", r.status === 201);

  r = await call("GET", "/cart", null, { redirect: "manual" });
  check("supplier on /cart redirected to /supplier", (r.location || "").includes("/supplier"), r.location);

  console.log(`\n---- ${pass} passed, ${fail} failed ----\n`);
  process.exit(fail ? 1 : 0);
})();
