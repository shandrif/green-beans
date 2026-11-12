# Green Beans — Sample to PO tracking

Web app for Half Million Coffee that records and tracks every green bean sample
from the moment Procurement receives it until the PO is handed over to Oracle.
PRs and POs are **created in Oracle**; this app only records their references.

## Workflow

| # | Stage | Owner | Moves on when |
|---|---|---|---|
| 1 | Sample registration | Procurement | Submitted to Roasting |
| 2 | Roasting evaluation (2–3 days) | Roasting | Approved (rejected → closed with reason) |
| 3 | NPD review (cupping optional) | NPD | Approved (rejected → closed with reason) |
| 4 | Negotiation & supplier confirmation | Procurement | Supplier confirmed |
| 5 | PR request to Warehouse | Procurement | Request sent |
| 6 | Purchase Requisition (PR) recorded | Warehouse | PR number saved |
| 7 | Purchase Order (PO) recorded | Procurement | PO saved → **Handed to Oracle** |

Rules enforced by the API: stages open in order, only the owning department (or an
admin) can fill a stage, rejections need a reason, and a rejected sample can be
resubmitted by Procurement as a new linked sample. Every action is in the audit log.

All stages, fields, labels (English + Arabic) and SLA days live in
[`shared/workflow.ts`](shared/workflow.ts) — change fields there and both the API
validation and the forms update.

## Stack

- React 19 + Vite + Tailwind 4 (HM brand tokens in `src/index.css`), English/Arabic with RTL
- Hono API on Cloudflare Workers (`worker/`), same Worker serves the front end
- Cloudflare D1 (database, `migrations/`) and R2 (attachments)
- Own email/password login (PBKDF2, HttpOnly session cookie), roles:
  Admin, Procurement, Roasting, NPD, Warehouse, Viewer

## Develop

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open http://localhost:5173 and create the first admin.

## Deploy

```bash
npm run db:migrate:remote
npm run deploy
npx wrangler secret put SETUP_KEY   # one-time key needed to create the first admin
```

Then open the Worker URL, enter the setup key and create the admin account. The admin
adds users and assigns each one a department; new users must change their temporary
password on first sign-in.
