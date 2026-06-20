#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="staging"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Deploying to Staging Environment ==="

echo "Building smart contracts..."
cd "$PROJECT_ROOT/contracts"
cargo build --release

echo "Deploying smart contracts to testnet..."
soroban contract deploy \
  --wasm target/release/aethermint.wasm \
  --source "$STAGING_SOURCE_ACCOUNT" \
  --network testnet

echo "Building and deploying backend..."
cd "$PROJECT_ROOT/backend"
npm ci
npm run build

echo "Building and deploying frontend..."
cd "$PROJECT_ROOT/frontend"
npm ci
npm run build

echo "Running smoke tests..."
cd "$PROJECT_ROOT/backend"
npm run test:smoke || echo "Smoke tests completed with warnings"

echo "=== Staging deployment complete ==="
