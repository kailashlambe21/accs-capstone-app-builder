# ACCS Capstone — PDP Badge Management

An Adobe App Builder extension for Adobe Commerce that enables merchandisers to create and manage promotional badges (e.g. *New Arrival*, *Limited Offer*, *Best Seller*) on the Product Display Page — without code deployments or per-product editing.

---

## Overview

Badge rules are defined once in the Commerce Admin. Assignments are pre-computed and stored in App Builder DB, keyed by SKU. The storefront PDP does a single fast DB lookup via API Mesh — no rule evaluation at request time.

Badge assignments are re-evaluated at exactly three points:

| Trigger | When | Scope |
|---|---|---|
| Badge rule saved | Merchandiser creates or updates a rule | All products × all rules |
| Product saved | `catalog_product_save_after` I/O Event | That SKU only |
| Re-evaluate Badges button | Merchandiser manually triggers full sync | All products × all rules |

---

## Architecture

```
Merchandiser saves badge rule
        ↓
App Builder: evaluate-all → assess every product → write badge_assignments to DB

Product saved in Commerce
        ↓
I/O Event → App Builder: evaluate-sku → assess that SKU → update DB entry

PDP loads
        ↓
App Builder: get-badge-for-sku → single DB lookup by SKU → return badges → render on PDP
```

### Extensions

| Extension | Purpose |
|---|---|
| `commerce/extensibility/1` | 8 runtime actions (badge CRUD, evaluation engine, storefront API, event consumer) |
| `commerce/backend-ui/1` | Admin UI SDK — Badge Rules & Badge Assignments pages |

---

## Runtime Actions

| Action | Type | Purpose |
|---|---|---|
| `get-badge-rules` | web GET | List all badge rules |
| `save-badge-rule` | web POST | Create or update a rule, triggers `evaluate-all` |
| `delete-badge-rule` | web DELETE | Delete a rule by ID |
| `evaluate-all` | web POST | Evaluate all products against all rules, write to DB |
| `evaluate-sku` | web POST | Evaluate one SKU against all rules, update DB entry |
| `get-badge-products` | web GET | Return badge → products or SKU → badges mapping |
| `get-badge-for-sku` | web GET (CORS) | Return active badges for one SKU (storefront/PDP) |
| `product-event-consumer` | non-web (event) | I/O Event consumer: product save → `evaluate-sku` |

---

## DB Collections (`aio-lib-db`)

| Collection | Stores |
|---|---|
| `badge_rules` | Rule definitions: label, conditionType, threshold, priority, active |
| `badge_assignments` | Pre-computed SKU → active badges (keyed by SKU) |
| `badge_eval_log` | Audit log per evaluation run |

### Condition Types

- `inventory_below` — stock quantity below threshold
- `created_within_days` — product created within N days
- `has_special_price` — product has a special/sale price
- `manual` — manually assigned badge

---

## Admin UI

Registered under **Badge Management** in Commerce Admin navigation:

| Screen | Purpose |
|---|---|
| Badge Rules | CRUD — add, edit, delete rules. "Re-evaluate Badges" triggers a full sync |
| Badge Assignments | Read-only — badge ↔ products overview, searchable by SKU |

---

## Project Structure

```
src/
├── commerce-extensibility-1/
│   └── actions/
│       └── badges/
│           ├── save-badge-rule/
│           ├── get-badge-rules/
│           ├── delete-badge-rule/
│           ├── evaluate-all/
│           ├── evaluate-sku/
│           ├── get-badge-products/
│           ├── get-badge-for-sku/
│           └── product-event-consumer/
└── commerce-backend-ui-1/
    └── web-src/src/components/
        ├── BadgeRulesPage.js
        └── BadgeAssignmentsPage.js
```

---

## Prerequisites

- Node.js >= 18
- AIO CLI (`npm install -g @adobe/aio-cli`)
- Adobe IMS access with App Builder entitlement
- Adobe Commerce instance with I/O Events configured

---

## Setup

```bash
# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Fill in required variables (see Environment Variables below)

# Deploy to App Builder
aio app deploy
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `IMS_OAUTH_S2S_CLIENT_ID` | IMS service-to-service client ID |
| `IMS_OAUTH_S2S_CLIENT_SECRET` | IMS service-to-service client secret |
| `IMS_OAUTH_S2S_SCOPES` | IMS scopes |
| `AIO_DB_REGION` | App Builder DB region |
| `COMMERCE_BASE_URL` | Adobe Commerce base URL |
| `COMMERCE_CONSUMER_KEY` | Commerce REST API OAuth consumer key |
| `COMMERCE_CONSUMER_SECRET` | Commerce REST API OAuth consumer secret |
| `COMMERCE_ACCESS_TOKEN` | Commerce REST API OAuth access token |
| `COMMERCE_ACCESS_TOKEN_SECRET` | Commerce REST API OAuth access token secret |

---

## API Mesh

`mesh.json` wires `get-badge-for-sku` into an API Mesh GraphQL endpoint so the EDS storefront PDP can query badge data alongside product data in a single GraphQL request.

```graphql
query {
  badgesForSku(sku: "SKU-123") {
    sku
    badges
  }
}
```

---

## Tech Stack

- **Adobe App Builder** — serverless runtime actions
- **aio-lib-db** — persistent key-value store for rules and assignments
- **Admin UI SDK (`@adobe/uix-guest`)** — Commerce Admin UI extension points
- **Adobe I/O Events** — `catalog_product_save_after` event subscription
- **API Mesh** — GraphQL gateway for storefront badge queries
- **React + React Spectrum** — Admin UI components
