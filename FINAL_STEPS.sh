#!/bin/bash
# Final Steps to Complete Noir Integration
# Run this script to complete the ZK Memory game with real Noir proofs

set -e

echo "========================================="
echo "  ZK Memory - Noir Integration"
echo "  Final Steps Automation"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Copy compiled circuit
echo -e "${YELLOW}Step 1: Copying compiled Noir circuit...${NC}"
if [ ! -f "circuits/card_reveal/target/card_reveal.json" ]; then
    echo -e "${RED}❌ Error: Circuit not compiled${NC}"
    echo "Run: cd circuits/card_reveal && nargo compile && cd ../.."
    exit 1
fi

cp circuits/card_reveal/target/card_reveal.json \
   zk-memory-frontend/src/games/zk-memory/card_reveal.json

if [ -f "zk-memory-frontend/src/games/zk-memory/card_reveal.json" ]; then
    CIRCUIT_SIZE=$(wc -c < "zk-memory-frontend/src/games/zk-memory/card_reveal.json")
    echo -e "${GREEN}✓ Circuit copied ($CIRCUIT_SIZE bytes)${NC}"
else
    echo -e "${RED}❌ Failed to copy circuit${NC}"
    exit 1
fi

# Step 2: Install Noir packages
echo ""
echo -e "${YELLOW}Step 2: Installing Noir packages...${NC}"
cd zk-memory-frontend
if bun add @noir-lang/noir_js@1.0.0-beta.19 @noir-lang/backend_barretenberg@0.36.0; then
    echo -e "${GREEN}✓ Noir packages installed${NC}"
else
    echo -e "${RED}❌ Failed to install packages${NC}"
    exit 1
fi
cd ..

# Step 3: Extract verification key
echo ""
echo -e "${YELLOW}Step 3: Extracting verification key...${NC}"
if ! command -v bb &> /dev/null; then
    echo -e "${YELLOW}⚠ Barretenberg CLI not found, installing...${NC}"
    npm install -g @aztec/bb
fi

bb write_vk \
  -b circuits/card_reveal/target/card_reveal.json \
  -o contracts/zk-memory/vk.bin

if [ -f "contracts/zk-memory/vk.bin" ]; then
    VK_SIZE=$(wc -c < "contracts/zk-memory/vk.bin")
    echo -e "${GREEN}✓ Verification key extracted ($VK_SIZE bytes)${NC}"
else
    echo -e "${RED}❌ Failed to extract verification key${NC}"
    exit 1
fi

# Step 4: Build contract
echo ""
echo -e "${YELLOW}Step 4: Building contract...${NC}"
if bun run build zk-memory; then
    echo -e "${GREEN}✓ Contract built successfully${NC}"
else
    echo -e "${RED}❌ Contract build failed${NC}"
    exit 1
fi

# Step 5: Deploy contract
echo ""
echo -e "${YELLOW}Step 5: Deploying contract to testnet...${NC}"
echo -e "${YELLOW}⚠ This will deploy a new contract instance${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if bun run deploy zk-memory; then
        echo -e "${GREEN}✓ Contract deployed${NC}"
    else
        echo -e "${RED}❌ Contract deployment failed${NC}"
        exit 1
    fi
else
    echo "Deployment skipped"
    exit 0
fi

# Step 6: Generate bindings
echo ""
echo -e "${YELLOW}Step 6: Generating bindings...${NC}"
if bun run bindings zk-memory; then
    echo -e "${GREEN}✓ Bindings generated${NC}"
else
    echo -e "${RED}❌ Bindings generation failed${NC}"
    exit 1
fi

# Step 7: Copy bindings to frontend
echo ""
echo -e "${YELLOW}Step 7: Copying bindings to frontend...${NC}"
cp bindings/zk_memory/src/index.ts \
   zk-memory-frontend/src/games/zk-memory/bindings.ts

if [ -f "zk-memory-frontend/src/games/zk-memory/bindings.ts" ]; then
    echo -e "${GREEN}✓ Bindings copied${NC}"
else
    echo -e "${RED}❌ Failed to copy bindings${NC}"
    exit 1
fi

# Done!
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  ✅ Integration Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Update zk-memory-frontend/public/game-studio-config.js with new contract ID"
echo "  2. Test the game: bun run dev:game zk-memory"
echo "  3. Check browser console for '[Noir] Proof generated successfully!'"
echo ""
echo "To enable real ZK verification:"
echo "  1. Edit contracts/zk-memory/src/lib.rs"
echo "  2. Uncomment VERIFICATION_KEY constant"
echo "  3. Uncomment verification code in verify_card_reveal_proof()"
echo "  4. Rebuild and redeploy"
echo ""
