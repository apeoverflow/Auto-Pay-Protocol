# Frontend — Environment Variables

All frontend env vars use the `VITE_` prefix (required by Vite).

## Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID for wallet connections | `demo-project-id` |
| `VITE_SUPABASE_URL` | Supabase project URL (for indexed policy/activity data) | — |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | — |
| `VITE_LIFI_API_KEY` | LiFi API key for cross-chain bridge widget | — |

## Notes

- **No contract addresses needed** — the frontend reads addresses from the auto-generated `src/config/deployments.ts` (created by `make sync` in contracts/).
- **No RPC URLs needed** — chain configs including RPCs are defined in `src/config/chains.ts`.
- **Supabase is optional** — without it, policy data falls back to on-chain event queries (limited to ~9k blocks).

## Environments

### Local Development

```env
VITE_WALLETCONNECT_PROJECT_ID=demo-project-id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_LIFI_API_KEY=your-lifi-key
```

### Production

```env
VITE_WALLETCONNECT_PROJECT_ID=<your-walletconnect-project-id>
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_LIFI_API_KEY=<your-lifi-key>
```
