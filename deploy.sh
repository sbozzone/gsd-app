#!/usr/bin/env bash
set -euo pipefail

echo "==> Applying D1 schema..."
wrangler d1 execute gsd-db --file=worker/schema.sql

echo "==> Deploying Worker..."
wrangler deploy

echo "==> Done."
