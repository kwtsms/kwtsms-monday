# kwtSMS for monday.com

[![monday marketplace](https://img.shields.io/badge/monday.com-marketplace-0073ea?logo=monday&logoColor=fff)](https://monday.com/marketplace)
[![Node.js](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=fff)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=000)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4-000?logo=express&logoColor=fff)](https://expressjs.com/)
[![Jest](https://img.shields.io/badge/tests-jest-c21325?logo=jest&logoColor=fff)](https://jestjs.io/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A free monday.com marketplace app that sends one-way SMS through the kwtSMS gateway. Built for GCC customers who keep contacts on monday boards and want to text them without bouncing to a separate tool.

## Features

- **Account Settings** — login with kwtSMS credentials, set default sender ID / country prefix, manage templates, inspect delivery logs, configure bell notifications.
- **Item View tab** — send a single SMS from any item using Phone columns or assigned People on the item. Full per-item history on the timeline.
- **Right-click item action** — quick single-item send from the context menu with "From this item / Custom number" modes.
- **Bulk send** — board menu action over selected items: pick a phone source once (Phone column or People column), preview per-item resolution, send to many with per-batch dedup.
- **Board view** — free-form quick send to arbitrary numbers with recent-messages log scoped to the board.
- **Dashboard widget** — balance, sent today, sent this month, 7-day failure rate + stacked delivered/failed bar chart.
- **Integration recipes (automation)** — four triggers:
  - When an item is created
  - When a status column changes to a value
  - When any column changes
  - T-N days before a date column
- **Template placeholders** — `{item.name}`, `{item.id}`, `{item.url}`, `{item.group}`, `{item.created_at}`, `{item.updated_at}`, `{item.creator_name}`, `{item.creator_email}`, `{column.<Title>}` (case-insensitive), `{user.name}`, `{user.email}`, `{user.phone}`, `{user.title}`, `{user.location}`, `{board.name}`, `{board.url}`, `{date}`, `{time}`. Missing values substitute to empty — never ship a literal `{...}` in an SMS.

## Architecture

- **Runtime** — hosted on monday-code (Cloud Run). Node 20, Express 4, React 18 + Vibe.
- **Storage** — `SecureStorage` from `@mondaycom/apps-sdk` for credentials, config, templates, logs, and dedup indexes. Module-level in-process cache (10-60s TTL) fronts every read to keep the warm path fast.
- **Cold-start mitigation** — Express awaits `SecureStorage` GCP-identity warmup before opening the port; a 2-minute keep-alive refreshes the auth token before its 3-minute TTL; a `/api/prewarm` GET endpoint is hit by every iframe on mount so POSTs (non-idempotent) never race a cold instance.
- **Phone normalisation** — GCC-aware with `libphonenumber-js`: accepts bare national, `00`-prefixed, `+`-prefixed, Arabic-Indic and Persian digits, leading zero trim, first-valid-match fallback across coverage countries.
- **Dedup** — per-batch only (in-memory `Set<string>` keyed by phone + cleaned body + sender). No time window, no persisted deduplication — two manual sends to the same number minutes apart always go through.

## Project layout

```
src/
  core/              template-engine, normalize, verify, clean-message, send-pipeline, kwtsms-client, errors, notifications, writeback
  routes/api/        settings, templates, send, logs, stats
  routes/recipes/    item-created, status-to-value, column-changed, date-arrived
  routes/cron/       scheduled balance + coverage sync
  storage/           SecureStorage wrapper, per-domain stores (config, secret, template, log, dedup), in-process cache, request token context
  middleware/        monday session JWT verification
client/
  views/             AccountSettings, ItemView, ItemAction, BoardMenuBulk, BoardView, DashboardWidget
  components/        NewTemplateButton, PlaceholdersHelp
  utils/             phoneSources, templateContext, smsCount
tests/
  unit/              pure-function tests (template engine, normalize, verify, clean-message, errors)
  integration/       real kwtSMS API against test credentials (run manually; consumes balance)
```

## Local development

Requires Node 20 and the kwtSMS + monday credentials listed in `.env.test` (gitignored).

```bash
npm install
npm run build:server       # tsc → dist/
npm run build:client       # vite → dist-client/
npm run build              # both
npm test                   # unit only
npm run test:integration   # hits real kwtSMS API; consumes points
```

For deployment onto monday-code, `mapps code:push -i <draft-version-id>`.

## Scopes

- `boards:read` — read column values, items, boards for placeholder and phone resolution
- `boards:write` — write status column after a send
- `notifications:write` — post in-app bell notifications on zero balance / gateway offline
- `users:read` — resolve assigned People on items to their profile phone
- `updates:write` — post timeline updates from recipes

## Support

`support@kwtsms.com`
