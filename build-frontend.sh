#!/usr/bin/env sh
# Rebuild the React apps into backend/src/main/resources/public (needs Node.js 18+ and npm).
set -e
cd "$(dirname "$0")/frontend"
npm install
npm run build
