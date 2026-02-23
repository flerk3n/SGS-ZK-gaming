// ZK Memory Proof Service - RISC Zero Backend
// Generates and verifies card reveal proofs

use axum::{
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use methods::{CARD_REVEAL_GUEST_ELF, CARD_REVEAL_GUEST_ID};
use risc0_zkvm::{default_prover, ExecutorEnv, Receipt};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use flate2::Compression;
use flate2::write::GzEncoder;
use std::io::Write;

#[derive(Debug, Deserialize)]
struct ProofRequest {
    deck: Vec<u8>,
    salt: String,
    position: u32,
    revealed_value: u8,
}

#[derive(Debug, Serialize)]
struct ProofResponse {
    proof: String,        // Hex-encoded receipt
    journal: String,      // Hex-encoded journal
    commitment: String,   // Hex-encoded commitment
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Build CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        .route("/", get(health_check))
        .route("/health", get(health_check))
        .route("/generate-proof", post(generate_proof))
        .route("/verify-proof", post(verify_proof))
        .layer(cors);

    // Start server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    println!("🚀 ZK Memory Proof Service running on http://{}", addr);
    println!("📝 Endpoints:");
    println!("   GET  /health - Health check");
    println!("   POST /generate-proof - Generate ZK proof");
    println!("   POST /verify-proof - Verify ZK proof");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "service": "zk-memory-proof-service",
        "version": "0.1.0"
    }))
}

async fn generate_proof(
    Json(request): Json<ProofRequest>,
) -> Result<Json<ProofResponse>, (StatusCode, Json<ErrorResponse>)> {
    println!("📥 Received proof request for position {}", request.position);

    // Validate inputs
    if request.deck.len() != 4 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Deck must have exactly 4 cards".to_string(),
            }),
        ));
    }

    if request.position >= 4 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Position must be 0-3".to_string(),
            }),
        ));
    }

    // Convert deck to array
    let deck: [u8; 4] = request.deck.try_into().map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid deck format".to_string(),
            }),
        )
    })?;

    // Compute commitment
    let mut hasher = Sha256::new();
    hasher.update(&deck);
    hasher.update(request.salt.as_bytes());
    let commitment: [u8; 32] = hasher.finalize().into();

    println!("🔐 Commitment: {}", hex::encode(&commitment));

    // Build executor environment
    let env = ExecutorEnv::builder()
        .write(&deck)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to write deck: {}", e),
                }),
            )
        })?
        .write(&request.salt)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to write salt: {}", e),
                }),
            )
        })?
        .write(&request.position)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to write position: {}", e),
                }),
            )
        })?
        .write(&request.revealed_value)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to write revealed_value: {}", e),
                }),
            )
        })?
        .write(&commitment)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to write commitment: {}", e),
                }),
            )
        })?
        .build()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to build environment: {}", e),
                }),
            )
        })?;

    println!("⚙️  Generating proof...");

    // Generate proof
    let prover = default_prover();
    let prove_info = prover.prove(env, CARD_REVEAL_GUEST_ELF).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to generate proof: {}", e),
            }),
        )
    })?;

    let receipt = prove_info.receipt;

    println!("✅ Proof generated! Cycles: {}", prove_info.stats.total_cycles);

    // Serialize receipt and journal
    let receipt_bytes = bincode::serialize(&receipt).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to serialize receipt: {}", e),
            }),
        )
    })?;

    let journal_bytes = receipt.journal.bytes.clone();

    Ok(Json(ProofResponse {
        proof: hex::encode(&receipt_bytes),
        journal: hex::encode(&journal_bytes),
        commitment: hex::encode(&commitment),
    }))
}

#[derive(Debug, Deserialize)]
struct VerifyRequest {
    proof: String, // Hex-encoded receipt
}

#[derive(Debug, Serialize)]
struct VerifyResponse {
    valid: bool,
    message: String,
}

async fn verify_proof(
    Json(request): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, (StatusCode, Json<ErrorResponse>)> {
    println!("🔍 Verifying proof...");

    // Decode receipt
    let receipt_bytes = hex::decode(&request.proof).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Invalid hex encoding: {}", e),
            }),
        )
    })?;

    let receipt: Receipt = bincode::deserialize(&receipt_bytes).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Failed to deserialize receipt: {}", e),
            }),
        )
    })?;

    // Verify proof
    match receipt.verify(CARD_REVEAL_GUEST_ID) {
        Ok(_) => {
            println!("✅ Proof verified successfully!");
            Ok(Json(VerifyResponse {
                valid: true,
                message: "Proof is valid".to_string(),
            }))
        }
        Err(e) => {
            println!("❌ Proof verification failed: {}", e);
            Ok(Json(VerifyResponse {
                valid: false,
                message: format!("Proof verification failed: {}", e),
            }))
        }
    }
}
