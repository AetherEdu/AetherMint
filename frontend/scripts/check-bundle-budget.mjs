#!/usr/bin/env node
// Performance budget check for the AetherMint frontend (issue #273).
//
// Measures the gzipped "first load" JavaScript for each built route from the
// Next.js build manifests and compares the largest route against a configurable
// budget (default: 200 KB gzipped).
//
// Usage:
//   npm run build            # produce .next/ output first
//   npm run bundle-budget    # measure and report
//
// Flags / env:
//   --enforce                 fail (exit 1) when a route exceeds the budget
//   --budget=<kb>             override the KB budget
//   BUNDLE_BUDGET_ENFORCE=1   same as --enforce
//   BUNDLE_BUDGET_KB=<kb>     same as --budget
//
// Config: frontend/performance-budget.json
//   { "maxInitialJsGzipKb": 200, "enforce": false, "ignoreRoutes": [...] }
//
// Dependency-free: uses only Node built-ins so it runs in CI without install.

import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(scriptDir, "..");
const nextDir = join(frontendRoot, ".next");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadConfig() {
  const defaults = { maxInitialJsGzipKb: 200, enforce: false, ignoreRoutes: [] };
  const configPath = join(frontendRoot, "performance-budget.json");
  let config = defaults;
  if (existsSync(configPath)) {
    try {
      config = { ...defaults, ...readJson(configPath) };
    } catch (err) {
      console.warn("Could not parse performance-budget.json, using defaults:", err.message);
    }
  }
  const budgetArg = process.argv.find((a) => a.startsWith("--budget="));
  if (process.env.BUNDLE_BUDGET_KB) config.maxInitialJsGzipKb = Number(process.env.BUNDLE_BUDGET_KB);
  if (budgetArg) config.maxInitialJsGzipKb = Number(budgetArg.split("=")[1]);
  if (process.env.BUNDLE_BUDGET_ENFORCE === "1" || process.env.BUNDLE_BUDGET_ENFORCE === "true") {
    config.enforce = true;
  }
  if (process.argv.includes("--enforce")) config.enforce = true;
  return config;
}

const gzipCache = new Map();
function gzipBytes(relFile) {
  if (gzipCache.has(relFile)) return gzipCache.get(relFile);
  const abs = join(nextDir, relFile);
  let size = 0;
  if (existsSync(abs)) {
    size = gzipSync(readFileSync(abs), { level: 9 }).length;
  }
  gzipCache.set(relFile, size);
  return size;
}

function isJs(f) {
  return typeof f === "string" && f.endsWith(".js");
}

function firstLoadForRoutes() {
  const routes = new Map();

  // Pages Router: .next/build-manifest.json
  const pagesManifestPath = join(nextDir, "build-manifest.json");
  if (existsSync(pagesManifestPath)) {
    const m = readJson(pagesManifestPath);
    const polyfills = (m.polyfillFiles || []).filter(isJs);
    const appShared = (m.pages && m.pages["/_app"] ? m.pages["/_app"] : []).filter(isJs);
    const shared = [...polyfills, ...appShared];
    for (const [route, files] of Object.entries(m.pages || {})) {
      if (route === "/_app") continue;
      routes.set(route, new Set([...shared, ...files.filter(isJs)]));
    }
  }

  // App Router: .next/app-build-manifest.json
  const appManifestPath = join(nextDir, "app-build-manifest.json");
  if (existsSync(appManifestPath)) {
    const m = readJson(appManifestPath);
    for (const [route, files] of Object.entries(m.pages || {})) {
      routes.set(route, new Set(files.filter(isJs)));
    }
  }

  return routes;
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(1) + " KB";
}

function main() {
  if (!existsSync(nextDir)) {
    console.error('No .next build output found. Run "npm run build" before "npm run bundle-budget".');
    process.exit(1);
  }

  const config = loadConfig();
  const budgetBytes = config.maxInitialJsGzipKb * 1024;
  const ignore = new Set(config.ignoreRoutes || []);
  const routes = firstLoadForRoutes();

  if (routes.size === 0) {
    console.error("Could not read any build manifest (build-manifest.json / app-build-manifest.json).");
    process.exit(1);
  }

  const rows = [];
  for (const [route, files] of routes) {
    if (ignore.has(route)) continue;
    let total = 0;
    for (const f of files) total += gzipBytes(f);
    rows.push({ route, bytes: total, over: total > budgetBytes });
  }
  rows.sort((a, b) => b.bytes - a.bytes);

  const routeWidth = Math.max(12, ...rows.map((r) => r.route.length));
  console.log("");
  console.log("First Load JS (gzipped) vs budget of " + config.maxInitialJsGzipKb + " KB");
  console.log("-".repeat(routeWidth + 20));
  for (const r of rows) {
    const flag = r.over ? "  OVER" : "  ok";
    console.log(r.route.padEnd(routeWidth) + "  " + formatKb(r.bytes).padStart(10) + flag);
  }
  console.log("-".repeat(routeWidth + 20));

  const over = rows.filter((r) => r.over);
  const worst = rows[0];
  console.log("Largest route: " + worst.route + " at " + formatKb(worst.bytes));
  console.log(over.length + " of " + rows.length + " routes exceed the " + config.maxInitialJsGzipKb + " KB budget.");

  if (over.length > 0 && config.enforce) {
    console.error("Performance budget exceeded (enforce mode).");
    process.exit(1);
  }
  if (over.length > 0) {
    console.log('Report-only mode: not failing the build. Set "enforce": true (or --enforce) to gate.');
  }
  process.exit(0);
}

main();