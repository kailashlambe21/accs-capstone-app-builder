# Dev Plan — PDP Badge Management

## Project Structure

```
src/
├── commerce-extensibility-1/
│   └── actions/
│       └── badges/
│           ├── save-badge-rule/index.js
│           ├── get-badge-rules/index.js
│           ├── delete-badge-rule/index.js
│           ├── evaluate-all/index.js
│           ├── evaluate-sku/index.js
│           ├── get-badge-products/index.js
│           ├── get-badge-for-sku/index.js
│           └── product-event-consumer/index.js
└── commerce-backend-ui-1/
    └── web-src/src/components/
        ├── BadgeRulesPage.js
        └── BadgeAssignmentsPage.js
```

---

## DB Collections (aio-lib-db)

### `badge_rules`
```json
{
  "_id": "uuid",
  "label": "Limited Offer",
  "conditionType": "inventory_below | created_within_days | has_special_price | manual",
  "threshold": 10,
  "priority": 1,
  "active": true,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

### `badge_assignments`
```json
{
  "_id": "SKU-001",
  "badges": ["Limited Offer", "New Arrival"],
  "evaluatedAt": "ISO timestamp",
  "evaluatedBy": "rule_save | product_save | manual_refresh"
}
```

### `badge_eval_log`
```json
{
  "_id": "uuid",
  "trigger": "rule_save | product_save | manual_refresh",
  "sku": "SKU-001",
  "eventId": "optional",
  "correlationId": "uuid",
  "badgesBefore": ["New Arrival"],
  "badgesAfter": ["Limited Offer", "New Arrival"],
  "duration_ms": 142,
  "timestamp": "ISO timestamp"
}
```

---

## Actions

### 1. `get-badge-rules`
- **Type:** web action (GET)
- **Auth:** IMS S2S
- **DB:** read `badge_rules` collection → return all
- **Called by:** Badge Rules page on load

### 2. `save-badge-rule`
- **Type:** web action (POST)
- **Auth:** IMS S2S
- **DB:** upsert into `badge_rules` (create if no `_id`, update if `_id` present)
- **After save:** invoke `evaluate-all` asynchronously
- **Called by:** Badge Rules page — Save button

### 3. `delete-badge-rule`
- **Type:** web action (DELETE)
- **Auth:** IMS S2S
- **DB:** delete from `badge_rules` by `_id`
- **Called by:** Badge Rules page — Delete action

### 4. `evaluate-all`
- **Type:** web action (POST) — can also be called internally
- **Auth:** IMS S2S
- **Logic:**
  1. Fetch all active rules from `badge_rules`
  2. Paginate all products from Commerce REST `GET /V1/products` (page size 100)
  3. For each product, evaluate all rules → collect matching badge labels
  4. Write result to `badge_assignments` (upsert by SKU)
  5. Write entry to `badge_eval_log`
- **Called by:** `save-badge-rule` (post-save), Re-evaluate Badges button

### 5. `evaluate-sku`
- **Type:** web action (POST)
- **Auth:** IMS S2S
- **Logic:**
  1. Fetch all active rules from `badge_rules`
  2. Fetch product data from Commerce by SKU
  3. Evaluate rules → collect matching badge labels
  4. Upsert `badge_assignments` for that SKU
  5. Write entry to `badge_eval_log`
- **Called by:** `product-event-consumer`

### 6. `get-badge-products`
- **Type:** web action (GET)
- **Auth:** IMS S2S
- **Params:** optional `badge` (filter by badge label) or `sku` (filter by SKU)
- **DB:** query `badge_assignments`
  - No params → return all assignments
  - `badge` param → return SKUs where badges array contains that label
  - `sku` param → return badges for that SKU
- **Called by:** Badge Assignments page

### 7. `get-badge-for-sku`
- **Type:** web action (GET), CORS-enabled (called from storefront)
- **Auth:** none (public) or API key
- **Params:** `sku` (required)
- **DB:** `badge_assignments.find({ _id: sku })`
- **Returns:** `{ sku, badges: [] }`
- **Called by:** EDS storefront PDP

### 8. `product-event-consumer`
- **Type:** non-web action (event consumer)
- **Event:** `catalog_product_save_after`
- **Logic:** extract SKU from event payload → call `evaluate-sku`
- **Logging:** structured log with SKU, eventId, correlationId

---

## Admin UI SDK

### Menu Structure
```
Badge Management (parent)
├── Badge Rules       → /badge-rules
└── Badge Assignments → /badge-assignments
```

### Badge Rules Page (`BadgeRulesPage.js`)
- TableView listing all rules (label, condition, threshold, priority, active)
- Add / Edit via dialog (form fields)
- Delete with confirmation
- "Re-evaluate Badges" button → calls `evaluate-all`

### Badge Assignments Page (`BadgeAssignmentsPage.js`)
- Two views: By Badge (default) | By SKU (search)
- By Badge: list of badges, each with count + expandable SKU list
- By SKU: search input → shows active badges for that product

---

## Config Changes (`app.commerce.config.js`)

- Replace order-enrichment menu items with:
  - Parent: `badge_management::apps` → "Badge Management"
  - Child 1: `badge_management::badge_rules` → "Badge Rules"
  - Child 2: `badge_management::badge_assignments` → "Badge Assignments"
- Register I/O Event: `observer.catalog_product_save_after` → `badge-management/product-event-consumer`
- Remove: validate-product webhook, order-event-consumer event

---

## Build Order

1. `save-badge-rule` + `get-badge-rules` + `delete-badge-rule` (rules CRUD)
2. `evaluate-all` + `evaluate-sku` (evaluation engine)
3. `get-badge-products` + `get-badge-for-sku` (read actions)
4. `product-event-consumer` (event consumer)
5. Update `app.commerce.config.js` + `extension-manifest.json` + `Constants.js`
6. `BadgeRulesPage.js` (Admin UI — Screen 1)
7. `BadgeAssignmentsPage.js` (Admin UI — Screen 2)
8. Wire `ExtensionRegistration.js` and `App.js` to new screens

---

## Auth Pattern (reuse from cohort reference)

```js
// Same pattern as src/commerce-extensibility-1/actions/labs/get-enriched-orders/index.js
const dbToken = await getImsAccessToken(params);
const dbBase = await libDb.init({ token: dbToken, region: params.AIO_DB_REGION });
const db = await dbBase.connect();
```

## Environment Variables Required
- `IMS_OAUTH_S2S_CLIENT_ID`
- `IMS_OAUTH_S2S_CLIENT_SECRET`
- `IMS_OAUTH_S2S_SCOPES`
- `AIO_DB_REGION`
- `COMMERCE_BASE_URL`
- `COMMERCE_CONSUMER_KEY` (for Commerce REST API)
- `COMMERCE_CONSUMER_SECRET`
- `COMMERCE_ACCESS_TOKEN`
- `COMMERCE_ACCESS_TOKEN_SECRET`
