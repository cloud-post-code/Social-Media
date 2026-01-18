#!/bin/bash
set -e

# Clean Vite cache before npm ci
echo "Cleaning Vite cache..."
rm -rf .vite node_modules/.vite dist || true

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build
echo "Building application..."
npm run build

echo "Build completed successfully!"

