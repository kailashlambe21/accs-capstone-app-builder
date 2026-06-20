# Capstone Presentation — PDP Badge Management

## Problem Statement & Solution Journey

### Business Goal
Enable merchandisers to dynamically display promotional badges (e.g., *New Arrival*, *Limited Offer*, *Best Seller*) on the Product Display Page without requiring engineering involvement or code deployments.

---

### Iteration 1 — Product-Level Configuration (Product View Extension / Custom Attribute)

**Initial Approach:**
Our first instinct was to use the Commerce Admin product view extension or a custom product attribute, where a merchandiser opens each product and manually assigns badge details directly on the product edit form.

**Challenge:**
This works at small scale but becomes completely impractical for large catalogs. If a retailer has thousands of SKUs, opening and saving each product individually to assign or update a badge is not a viable workflow. Any time a badge rule changes — for example, changing the *Limited Offer* threshold from 10 units to 15 — the merchandiser would need to revisit every product manually. This approach does not scale.

---

### Iteration 2 — Generic Rule-Based Configuration

**Next Approach:**
We moved to a model inspired by Commerce's cart price rules — define badge rules once at a global level with conditions and thresholds (e.g., *inventory below 10 → show Limited Offer badge*), and those rules apply automatically across all products without opening individual products.

**Challenge:**
This solved the scalability problem on the configuration side, but introduced a new problem on the storefront side. Every time a shopper loads a Product Display Page, the system would need to fetch all active badge rules and evaluate them in real time against that specific product's data. With multiple rules and a high-traffic storefront, this real-time evaluation on every PDP load would directly increase page latency and degrade the shopper experience — which defeats the purpose of a high-performance headless storefront.

---

### Final Approach — Pre-Computed Badge Assignments with 3 Evaluation Triggers

**Solution:**
Separate the *evaluation* of badge rules from the *serving* of badge results. Badge assignments are pre-computed and stored in the App Builder DB (`badge_assignments` collection), keyed by SKU. The PDP never evaluates rules — it simply does a fast SKU lookup.

Evaluation is triggered at exactly three points, ensuring the data is always fresh without impacting PDP performance:

| Trigger | When it fires | Scope |
|---|---|---|
| **Badge rule saved** | Merchandiser creates or updates a badge rule in Admin | Re-evaluates all products against all rules |
| **Product saved** | A product is saved in Commerce Admin (I/O Event: `catalog_product_save_after`) | Re-evaluates that specific SKU only |
| **"Re-evaluate Badges" button** | Merchandiser manually triggers a full sync | Re-evaluates all products against all rules |

**Result:**
- PDP gets badge data via a single, fast DB lookup — zero rule evaluation at request time
- Catalog changes (inventory, price, product updates) automatically trigger re-evaluation via I/O Events
- Merchandisers have full control through the Admin UI SDK without touching individual products
- Evaluation results and audit logs are stored in App Builder DB, visible in the Admin Assignments page

---

### Architecture Summary

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

---

### Finalized Solution Scope

**App Builder Actions (8)**

| Action | Purpose |
|---|---|
| `get-badge-rules` | List all badge rules |
| `save-badge-rule` | Create or update a rule, triggers evaluate-all |
| `delete-badge-rule` | Delete a rule by ID |
| `evaluate-all` | Evaluate all products against all rules, write to DB |
| `evaluate-sku` | Evaluate one SKU against all rules, update DB entry |
| `get-badge-products` | Return badge → products or SKU → badges mapping |
| `get-badge-for-sku` | Return active badges for one SKU (PDP/storefront) |
| `product-event-consumer` | I/O Event consumer: product save → evaluate-sku |

**DB Collections (aio-lib-db)**

| Collection | Stores |
|---|---|
| `badge_rules` | Rule definitions (label, condition, threshold, priority, active) |
| `badge_assignments` | Pre-computed SKU → active badges |
| `badge_eval_log` | Audit log per evaluation run |

**Admin UI SDK Screens**

| Screen | Purpose |
|---|---|
| Badge Rules | CRUD — add, edit, delete rules. "Re-evaluate Badges" triggers full sync |
| Badge Assignments | Read-only — badge ↔ products overview, search by SKU |
