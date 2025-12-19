#!/bin/bash

set -e

echo "🔨 Building all packages..."
npm run build

echo ""
echo "📦 Publishing packages..."

# Core package
echo "📤 Publishing @extable/core..."
cd packages/core
npm publish
cd ../..

# Sequence package
echo "📤 Publishing @extable/sequence..."
cd packages/sequence
npm publish
cd ../..

# React package
echo "📤 Publishing @extable/react..."
cd packages/react
npm publish
cd ../..

# Vue package
echo "📤 Publishing @extable/vue..."
cd packages/vue
npm publish
cd ../..

echo ""
echo "✅ All packages published successfully!"
