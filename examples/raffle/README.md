# AutoRaffle

## How It Works

1. Visitor opens the **checkout URL** (from `GET /api/status`) and enters name + email in the AutoPay checkout form
2. Visitor **subscribes for $1** — AutoPay collects subscriber info via the `fields` query param
3. AutoPay relayer sends a `policy.created` webhook → entry is tracked
4. On `charge.succeeded` → entry is confirmed with a tx hash
6. At the end of the day, draw a winner from the confirmed entries

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env: set WEBHOOK_SECRET

npm start
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Raffle info + checkout URL (includes `fields=name:r,email:r`) |
| `GET /api/entries` | Live entry board (wallets + confirmed status) |
| `POST /webhook` | AutoPay relayer webhook receiver |

## Testing

```bash
npm test
```
