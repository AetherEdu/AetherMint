// Post-deploy smoke test for the AetherMint backend.
// Dependency-free Node ESM script. Run with: node scripts/smoke-test.mjs
//
// Environment variables:
//   SMOKE_BASE_URL    Base URL to test (falls back to BASE_URL, then http://localhost:3001)
//   SMOKE_TIMEOUT_MS  Per-request timeout in milliseconds (default 5000)

const BASE_URL =
  process.env.SMOKE_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:3001";

const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS) || 5000;

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(BASE_URL + path, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const latencyMs = Date.now() - started;
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await response.json() : await response.text();
    return { status: response.status, contentType, body, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

const checks = [
  {
    name: "GET /api/health returns healthy",
    run: async () => {
      const res = await request("/api/health");
      if (res.status !== 200) {
        throw new Error("expected status 200 but got " + res.status);
      }
      if (!res.body || res.body.status !== "healthy") {
        throw new Error("expected body status to be healthy");
      }
      return res.latencyMs;
    },
  },
  {
    name: "GET / returns running",
    run: async () => {
      const res = await request("/");
      if (res.status !== 200) {
        throw new Error("expected status 200 but got " + res.status);
      }
      if (!res.body || res.body.status !== "running") {
        throw new Error("expected body status to be running");
      }
      return res.latencyMs;
    },
  },
  {
    name: "GET /api/docs/json returns OpenAPI JSON",
    run: async () => {
      const res = await request("/api/docs/json");
      if (res.status !== 200) {
        throw new Error("expected status 200 but got " + res.status);
      }
      if (!res.contentType.includes("application/json")) {
        throw new Error("expected an application/json content type");
      }
      return res.latencyMs;
    },
  },
];

async function main() {
  console.log("Smoke test target: " + BASE_URL);
  console.log("Per-request timeout: " + TIMEOUT_MS + "ms");
  console.log("");

  let failures = 0;
  for (const check of checks) {
    try {
      const latencyMs = await check.run();
      console.log("PASS  " + check.name + "  (" + latencyMs + "ms)");
    } catch (error) {
      failures = failures + 1;
      const message = error && error.message ? error.message : String(error);
      console.log("FAIL  " + check.name + "  -> " + message);
    }
  }

  console.log("");
  const total = checks.length;
  const passed = total - failures;
  console.log("Summary: " + passed + "/" + total + " checks passed");

  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  console.error("Smoke test crashed: " + message);
  process.exit(1);
});