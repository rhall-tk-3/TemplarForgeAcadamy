#!/usr/bin/env sh
set -eu

echo "[1/6] Installing dependencies"
npm install

echo "[2/6] Running test suite"
npm test

echo "[3/6] Verifying deployment structure"
node scripts/verify-deployment.js

echo "[4/6] Listing database migrations"
node scripts/list-migrations.js

echo "[5/6] Running smoke tests"
npm run smoke

echo "[6/6] Starting application"
npm start
