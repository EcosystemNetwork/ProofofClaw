#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# DM3 Delivery Service — Setup & Launch
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script installs dependencies and starts the DM3 delivery service node
# used for encrypted inter-agent messaging in Proof of Claw.
#
# Usage:
#   ./setup.sh              Install deps and start the service
#   ./setup.sh --port 3001  Start on a specific port (default: 3001)
#   ./setup.sh --check      Health check only
#   ./setup.sh --status     Show connected profiles and pending messages

set -euo pipefail

PORT="${PORT:-3001}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[DM3]${NC} $1"; }
ok()    { echo -e "${GREEN}[DM3]${NC} $1"; }
err()   { echo -e "${RED}[DM3]${NC} $1"; exit 1; }

# ── Parse args ────────────────────────────────────────────────────────────────
ACTION="start"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)  PORT="$2"; shift 2 ;;
    --check) ACTION="check"; shift ;;
    --status) ACTION="status"; shift ;;
    *) shift ;;
  esac
done

# ── Health check ──────────────────────────────────────────────────────────────
if [[ "$ACTION" == "check" ]]; then
  if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    HEALTH=$(curl -s "http://localhost:${PORT}/health")
    ok "Delivery service is running on port ${PORT}"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
  else
    err "Delivery service is not running on port ${PORT}"
  fi
  exit 0
fi

# ── Status ────────────────────────────────────────────────────────────────────
if [[ "$ACTION" == "status" ]]; then
  if ! curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    err "Delivery service is not running on port ${PORT}"
  fi
  ok "DM3 Delivery Service Status"
  echo ""
  echo "Health:"
  curl -s "http://localhost:${PORT}/health" | python3 -m json.tool 2>/dev/null
  echo ""
  exit 0
fi

# ── Install & Start ──────────────────────────────────────────────────────────
cd "$SCRIPT_DIR"

info "Installing dependencies..."
if ! command -v node &> /dev/null; then
  err "Node.js is required. Install it from https://nodejs.org"
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
  err "Node.js 18+ required (found v${NODE_VERSION})"
fi

npm install --silent

info "Starting DM3 delivery service on port ${PORT}..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  DM3 Delivery Service for Proof of Claw"
echo "═══════════════════════════════════════════════════════════"
echo "  HTTP API:   http://localhost:${PORT}"
echo "  WebSocket:  ws://localhost:${PORT}/ws"
echo ""
echo "  Endpoints:"
echo "    POST /messages              Receive DM3 envelope"
echo "    GET  /messages/incoming     Drain pending messages"
echo "    POST /profile               Register DM3 profile"
echo "    GET  /profile/:ensName      Look up profile"
echo "    GET  /health                Health check"
echo "    WS   /ws                    Real-time subscriptions"
echo "═══════════════════════════════════════════════════════════"
echo ""

PORT="$PORT" exec node server.js
