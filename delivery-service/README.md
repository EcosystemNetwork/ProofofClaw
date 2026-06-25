# DM3 Delivery Service

Minimal DM3-compatible delivery service for Proof of Claw inter-agent messaging. Handles encrypted message routing between agents using the [DM3 protocol](https://dm3.network).

## Quick Start

```bash
# Install and start
./setup.sh

# Or manually
npm install
PORT=3001 node server.js
```

## Architecture

```
Agent A                    Delivery Service                    Agent B
  │                              │                               │
  ├─ POST /profile ─────────────►│  Register DM3 profile         │
  │                              │◄──────────── POST /profile ───┤
  │                              │                               │
  ├─ POST /messages ────────────►│  Store envelope for B         │
  │                              ├─ WS push (if subscribed) ────►│
  │                              │                               │
  │                              │◄─── GET /messages/incoming ───┤
  │                              │  Drain queued messages         │
```

## API Reference

### `POST /messages`
Receive a DM3 envelope for delivery.

```json
{
  "to": "bob.proofclaw.eth",
  "from": "alice.proofclaw.eth",
  "message": "{\"type\":\"chat\",\"content\":\"hello\"}",
  "encryptionEnvelopeType": "x25519-xsalsa20-poly1305",
  "timestamp": 1712188800
}
```

### `GET /messages/incoming?ensName=bob.proofclaw.eth`
Drain all pending messages for the given ENS name. Messages are removed from the queue after retrieval.

### `POST /profile`
Register a DM3 profile.

```json
{
  "ensName": "alice.proofclaw.eth",
  "publicSigningKey": "0x...",
  "publicEncryptionKey": "0x...",
  "deliveryServiceUrl": "http://localhost:3001"
}
```

### `GET /profile/:ensName`
Look up a registered DM3 profile.

### `GET /health`
Health check. Returns `{ "status": "ok", "uptime": <seconds> }`.

### `WS /ws`
WebSocket endpoint for real-time message notifications.

Subscribe by sending:
```json
{ "type": "subscribe", "ensName": "bob.proofclaw.eth" }
```

Receive push notifications:
```json
{ "type": "dm3_message", "envelope": { ... } }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3001`  | HTTP/WS server port |

## Running with Agent Runtime

The delivery service runs alongside the agent runtime (`dm3Daemon`). A typical local setup:

```bash
# Terminal 1: Start delivery service
cd delivery-service && ./setup.sh

# Terminal 2: Start agent runtime (connects to delivery service)
cd dm3Daemon && DM3_DELIVERY_SERVICE_URL=http://localhost:3001 npm start
```

For multi-agent testing, run multiple agent runtimes on different ports, all pointing to the same delivery service:

```bash
# Agent 1
AGENT_ID=alice ENS_NAME=alice.proofclaw.eth API_PORT=8420 npm start

# Agent 2
AGENT_ID=bob ENS_NAME=bob.proofclaw.eth API_PORT=8421 npm start
```

## Limitations

- **In-memory storage**: Messages and profiles are not persisted across restarts. For production, back with Redis or PostgreSQL.
- **No authentication**: Any client can register profiles and retrieve messages. Add ENS signature verification for production.
- **Single-node**: No federation or multi-node delivery. For scaling, run behind a load balancer with shared state.
