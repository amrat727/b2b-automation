# b2b-automation

Playwright + TypeScript tests for the **Pilot B2B agent portal** (`https://b2b.nexgenpilot.com`).
The ERP back office has its own repository: `erp-automation`.

## Setup
```bash
npm install
npx playwright install chromium
```
Copy `.env.example` to `.env` and fill in the QA agent login (never commit `.env`):
```
B2B_URL=https://b2b.nexgenpilot.com
B2B_COMPANY=
B2B_USERNAME=
B2B_PASSWORD=
```
Without a `.env` here, the `B2B_*` values of `../erp-automation/.env` are used.

## Run
| Command | What |
|---|---|
| `npm test` | everything |
| `npm run test:login` | login page and sign-in |
| `npm run test:booking` | booking journey: search → book on credit → booking and money → cancel |
| `npm run test:smoke` | quick health check |
| `npm run report` | open the last HTML report |

## Structure
```
tests/
  auth.setup.ts     signs the QA agent in once, saves playwright/.auth/b2b.json
  login/            login page and sign-in checks
  booking/          booking journey (real QA bookings, cancelled at the end)
scripts/probes/     read-only helpers used while exploring screens (writes are blocked)
env.ts              settings from .env
```

## Test data rules
- Standing QA agent **AG-00035 "QA Auto B2B Agent"** (company `sb`), credit AED 50,000.
- Bookings use guests named **"QA Auto …"** and are **always cancelled** by the test.
- Bugs go to Jira project **KAN** (piloterp.atlassian.net), epic **Agent (B2B)**, label `agent-b2b-portal`.
