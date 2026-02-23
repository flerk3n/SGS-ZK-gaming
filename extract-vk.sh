#!/bin/bash
# Extract Verification Key from Noir Circuit
# This script extracts the Groth16 verification key from the compiled Noir circuit

set -e

echo "=== Extracting Verification Key for ZK Memory Circuit ==="
echo ""

# Check if bb (Barretenberg CLI) is installed
if ! command -v bb &> /dev/null; then
    echo "❌ Error: bb (Barretenberg CLI) is not installed"
    echo ""
    echo "Install it with:"
    echo "  npm install -g @aztec/aztec.js"
    echo ""
    echo "Or use the Noir CLI directly:"
    echo "  nargo backend install acvm-backend-barretenberg"
    echo ""
    echo "Alternative: Install from Noir toolchain"
    echo "  The bb binary comes with Noir installation"
    echo "  Check: ~/.nargo/backends/acvm-backend-barretenberg/bb"
    echo ""
    exit 1
fi

echo "✓ Barretenberg CLI found"

# Check if circuit file exists
CIRCUIT_FILE="circuits/card_reveal/target/card_reveal.json"
if [ ! -f "$CIRCUIT_FILE" ]; then
    echo "❌ Error: Circuit file not found: $CIRCUIT_FILE"
    echo ""
    echo "Compile it with:"
    echo "  cd circuits/card_reveal && nargo compile && cd ../.."
    echo ""
    exit 1
fi

echo "✓ Circuit file found: $CIRCUIT_FILE"

# Extract verification key
OUTPUT_FILE="contracts/zk-memory/vk.bin"
echo ""
echo "Extracting verification key..."
bb write_vk -b "$CIRCUIT_FILE" -o "$OUTPUT_FILE"

if [ -f "$OUTPUT_FILE" ]; then
    VK_SIZE=$(wc -c < "$OUTPUT_FILE")
    echo ""
    echo "✅ Verification key extracted successfully!"
    echo "   File: $OUTPUT_FILE"
    echo "   Size: $VK_SIZE bytes"
    echo ""
    echo "Next steps:"
    echo "  1. Update contracts/zk-memory/src/lib.rs to embed the VK"
    echo "  2. Uncomment the BN254 verification code"
    echo "  3. Rebuild and deploy: bun run build zk-memory && bun run deploy zk-memory"
else
    echo ""
    echo "❌ Error: Failed to extract verification key"
    exit 1
fi
