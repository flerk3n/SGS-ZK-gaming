Quickstart
Fork the repo, deploy contracts to testnet, and start building in a two-player sandbox.

Prerequisites
Install the toolchain below before you begin.

Bun (v1.0+)
Rust & Cargo (v1.84+)
Stellar CLI (v21.0+)
wasm32v1-none target
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --locked stellar-cli --features opt
rustup target add wasm32v1-none
Fork + clone
Start by forking the repository and cloning your fork locally.

git clone https://github.com/jamesbachini/Stellar-Game-Studio
cd Stellar-Game-Studio
bun install
One-command setup
Build contracts, deploy to testnet, and generate bindings.

bun run setup
What happens during setup?
Builds all Soroban contracts
Deploys contracts to Stellar testnet
Generates TypeScript bindings
Creates or reuses admin + player testnet wallets (funded via friendbot)
Writes contract IDs + dev wallet secrets to the root .env
Start a game frontend
Create a game and launch the dev wallet sandbox.

bun run create my-game
bun run dev:game my-game
Dev wallet switching
The dev frontend auto-connects Player 1 and lets you switch to Player 2 instantly, using the same wallet switcher as the original studio.


Create a New Game
Scaffold a Soroban contract and a standalone frontend that integrates with Game Hub.

Overview
The create script produces a Soroban contract and a standalone frontend in<game>-frontend/. You can host the frontend anywhere once you are ready to publish.

Files you will modify
contracts/<game-name>/ - New contract source
<game-name>-frontend/src/games/<game-name>/ - Game UI + service files
<game-name>-frontend/src/App.tsx - Dev entry point
Step 1: Run the create script
bun run create my-game
If my-game-frontend/ already exists, add --force to overwrite it.

Step 2: Implement Game Hub integration
Your contract must call start_game and end_game on the Game Hub contract. Use the client interface below.

For testnet, bun run deploy will reuse the shared mock Game Hub contract (CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG) when it exists, or deploy a new mock if that contract is unavailable.

#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );

    fn end_game(env: Env, session_id: u32, player1_won: bool);
}
Two-player constraint
Game Hub enforces two-player sessions. Require auth for both players when starting the game.

Step 3: Build, deploy, and generate bindings
Once your contract is listed in the workspace, the scripts handle the rest.

bun run setup
# or
bun run build my-game
bun run deploy my-game
bun run bindings my-game
Step 4: Run the dev frontend
bun run dev:game my-game
The dev frontend uses testnet wallets with a built-in player switcher so you can test two-player flows quickly.

Step 5: Update bindings in the frontend
After regenerating bindings, copy them into your frontend module.

bun run bindings my-game
cp bindings/my_game/src/index.ts my-game-frontend/src/games/my-game/bindings.ts

Import a Game
Bring an existing Soroban game into the workflow with minimal wiring.

Step 1: Add contract files
cp -r /path/to/game-contract contracts/imported-game
Step 2: Add to the workspace
[workspace]
members = [
  "contracts/mock-game-hub",
  "contracts/twenty-one",
  "contracts/number-guess",
  "contracts/imported-game",
]
Step 3: Scaffold a frontend shell
bun run create imported-game
Step 4: Copy in your UI + bindings
Drop your UI module into the generated frontend and update bindings.

cp -r /path/to/game-ui imported-game-frontend/src/games/imported-game
bun run bindings imported-game
cp bindings/imported_game/src/index.ts imported-game-frontend/src/games/imported-game/bindings.ts

Publish a Game
Deploy on mainnet and ship a production-ready frontend.

Step 1: Deploy your contract to mainnet
bun run build my-game
stellar contract install --wasm target/wasm32v1-none/release/my_game.wasm --source-account <ADMIN_SECRET> --network mainnet
stellar contract deploy --wasm-hash <WASM_HASH> --source-account <ADMIN_SECRET> --network mainnet -- \
  --admin <ADMIN_ADDRESS> --game-hub <GAME_HUB_MAINNET_CONTRACT_ID>
Step 2: Register your game with Game Hub
The mainnet Game Hub only accepts outcomes from approved games. The admin must calladd_game with your contract ID and developer address.

stellar contract invoke --id <GAME_HUB_MAINNET_CONTRACT_ID> --source-account <GAME_HUB_ADMIN_SECRET> --network mainnet -- \
  add_game --game_id <YOUR_GAME_CONTRACT_ID> --developer <YOUR_DEVELOPER_ADDRESS>
Step 3: Build the production frontend
The publish script creates a standalone frontend, injects a runtime config, and swaps in the standalone wallet hook.

bun run publish my-game --build
# Optional: choose a custom output directory
bun run publish my-game --out ../my-game-frontend --build
Step 4: Configure runtime settings
Update public/game-studio-config.js in the published output with mainnet values.

window.__STELLAR_GAME_STUDIO_CONFIG__ = {
  rpcUrl: "https://soroban-mainnet.stellar.org",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  contractIds: {
    "my-game": "<YOUR_MAINNET_CONTRACT_ID>"
  },
  simulationSourceAddress: "<OPTIONAL_FUNDED_ADDRESS>"
};
Step 5: Deploy the frontend
If you used --build, the static files are indist/<game>-frontend/dist. Deploy the output to any static host.

# Vercel
vercel --prod

# Cloudflare Pages
wrangler pages deploy dist

