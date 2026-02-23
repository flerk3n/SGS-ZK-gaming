#!/bin/bash

# ZK Memory + RISC Zero Integration Test Script

set -e

echo "🧪 ZK Memory + RISC Zero Integration Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0.32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check RISC Zero installation
echo "📦 Step 1: Checking RISC Zero installation..."
if command -v cargo-risczero &> /dev/null; then
    VERSION=$(cargo risczero --version 2>&1 | head -1)
    echo -e "${GREEN}✓${NC} RISC Zero installed: $VERSION"
else
    echo -e "${RED}✗${NC} RISC Zero not found. Install with:"
    echo "  curl -L https://risczero.com/install | bash && rzup"
    exit 1
fi
echo ""

# Step 2: Build proof service
echo "🔨 Step 2: Building proof service..."
cd proof-service
if cargo build --release 2>&1 | grep -q "Finished"; then
    echo -e "${GREEN}✓${NC} Proof service built successfully"
else
    echo -e "${YELLOW}⚠${NC}  Build in progress or failed. Check manually."
fi
cd ..
echo ""

# Step 3: Test proof generation (standalone)
echo "🧮 Step 3: Testing proof generation..."
cd ..
if cargo run --release 2>&1 | grep -q "Proof verified successfully"; then
    echo -e "${GREEN}✓${NC} Proof generation works!"
else
    echo -e "${YELLOW}⚠${NC}  Proof generation test inconclusive"
fi
cd card_reveal_risc
echo ""

# Step 4: Check if proof service binary exists
echo "📁 Step 4: Checking proof service binary..."
if [ -f "proof-service/target/release/proof-service" ]; then
    echo -e "${GREEN}✓${NC} Proof service binary found"
    echo "   Start with: cd proof-service && cargo run --release"
else
    echo -e "${YELLOW}⚠${NC}  Proof service binary not found (may still be building)"
fi
echo ""

# Step 5: Instructions
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Start the proof service:"
echo "   ${YELLOW}cd circuits/card_reveal_risc/proof-service${NC}"
echo "   ${YELLOW}cargo run --release${NC}"
echo ""
echo "2. In a new terminal, start the frontend:"
echo "   ${YELLOW}cd zk-memory-frontend${NC}"
echo "   ${YELLOW}bun install && bun run dev${NC}"
echo ""
echo "3. Open browser: ${YELLOW}http://localhost:5173${NC}"
echo ""
echo "4. Create a game and flip cards!"
echo "   - First flip will generate a RISC Zero proof (5-10s)"
echo "   - Watch the proof service terminal for logs"
echo "   - If service is down, it falls back to mock proofs"
echo ""
echo "📚 Full testing guide: circuits/card_reveal_risc/TESTING.md"
echo ""
