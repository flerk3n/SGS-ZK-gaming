#!/bin/bash
# Quick Start - Test ZK Memory with Mock Proofs
# This gets you up and running quickly without VK extraction

set -e

echo "========================================="
echo "  ZK Memory - Quick Start"
echo "  Testing with Mock Proofs"
echo "========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Copy compiled circuit
echo -e "${YELLOW}Step 1: Copying compiled Noir circuit...${NC}"
if [ ! -f "circuits/card_reveal/target/card_reveal.json" ]; then
    echo "❌ Error: Circuit not compiled"
    echo "Run: cd circuits/card_reveal && nargo compile && cd ../.."
    exit 1
fi

cp circuits/card_reveal/target/card_reveal.json \
   zk-memory-frontend/src/games/zk-memory/card_reveal.json

if [ -f "zk-memory-frontend/src/games/zk-memory/card_reveal.json" ]; then
    CIRCUIT_SIZE=$(wc -c < "zk-memory-frontend/src/games/zk-memory/card_reveal.json")
    echo -e "${GREEN}✓ Circuit copied ($CIRCUIT_SIZE bytes)${NC}"
else
    echo "❌ Failed to copy circuit"
    exit 1
fi

# Step 2: Install Noir packages
echo ""
echo -e "${YELLOW}Step 2: Installing Noir packages...${NC}"
cd zk-memory-frontend
if bun add @noir-lang/noir_js@1.0.0-beta.19 @noir-lang/backend_barretenberg@0.36.0 2>/dev/null; then
    echo -e "${GREEN}✓ Noir packages installed${NC}"
else
    echo -e "${YELLOW}⚠ Packages may already be installed${NC}"
fi
cd ..

# Done!
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  ✅ Ready to Test!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Start the game:"
echo "  bun run dev:game zk-memory"
echo ""
echo "The game will use mock proofs (development mode)."
echo "This is perfect for testing the game flow!"
echo ""
echo "What to test:"
echo "  1. Create a game (multi-sig)"
echo "  2. Flip cards"
echo "  3. Find matches"
echo "  4. Complete the game"
echo ""
echo "Check browser console for:"
echo "  [Noir] Proof generated successfully!"
echo "  [Noir] Proof size: ~192 bytes"
echo ""
echo "For production deployment with real verification:"
echo "  See WORKAROUND_VK_EXTRACTION.md"
echo ""
