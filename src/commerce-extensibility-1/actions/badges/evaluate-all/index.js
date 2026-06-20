const { Core } = require('@adobe/aio-sdk');
const libDb = require('@adobe/aio-lib-db');
const { v4: uuidv4 } = require('uuid');
const { getImsAccessToken, commerceHeaders, evaluateRules } = require('../utils');

const PRODUCTS_PAGE_SIZE = 100;

function productsUrl (baseUrl, page) {
  const b = baseUrl.replace(/\/$/, '');
  const sc = `searchCriteria[pageSize]=${PRODUCTS_PAGE_SIZE}&searchCriteria[currentPage]=${page}`;
  if (/api\.commerce\.adobe\.com/i.test(b)) return `${b}/V1/products?${sc}`;
  return `${b}/rest/default/V1/products?${sc}`;
}

async function fetchAllProducts (accessToken, params, logger) {
  const baseUrl = String(params.COMMERCE_API_BASE_URL || '').replace(/\/$/, '');
  const all = [];
  let page = 1;

  while (true) {
    const url = productsUrl(baseUrl, page);
    logger.info(`Fetching products page ${page}`);
    const res = await fetch(url, { headers: commerceHeaders(accessToken, params) });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Commerce API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const items = data.items || [];
    all.push(...items);
    if (items.length < PRODUCTS_PAGE_SIZE || all.length >= (data.total_count || 0)) break;
    page++;
  }

  logger.info(`Fetched ${all.length} products total`);
  return all;
}

async function upsertAssignment (collection, sku, badges, evaluatedBy) {
  const evaluatedAt = new Date().toISOString();
  const existing = await collection.find({ _id: sku }).toArray();
  if (existing.length > 0) {
    await collection.updateOne({ _id: sku }, { $set: { badges, evaluatedAt, evaluatedBy } });
  } else {
    await collection.insertOne({ _id: sku, badges, evaluatedAt, evaluatedBy });
  }
  return evaluatedAt;
}

async function main (params) {
  const logger = Core.Logger('evaluate-all', { level: params.LOG_LEVEL || 'info' });
  const trigger = params.trigger || 'manual_refresh';
  const correlationId = uuidv4();
  const startMs = Date.now();

  try {
    const accessToken = await getImsAccessToken(params);
    const dbBase = await libDb.init({ token: accessToken, region: params.AIO_DB_REGION });
    const db = await dbBase.connect();

    const rulesCollection = db.collection('badge_rules');
    const assignmentsCollection = db.collection('badge_assignments');
    const logCollection = db.collection('badge_eval_log');

    const allRules = await rulesCollection.find({}).toArray();
    const activeRules = allRules.filter((r) => r.active);
    logger.info(`Loaded ${activeRules.length} active rules`);

    const products = await fetchAllProducts(accessToken, params, logger);

    let processed = 0;
    let changed = 0;

    for (const product of products) {
      const sku = product.sku;
      if (!sku) continue;

      const existingDocs = await assignmentsCollection.find({ _id: sku }).toArray();
      const badgesBefore = existingDocs.length > 0 ? (existingDocs[0].badges || []) : [];

      const badgesAfter = evaluateRules(activeRules, product);
      const evaluatedAt = await upsertAssignment(assignmentsCollection, sku, badgesAfter, trigger);

      const badgesChanged =
        badgesBefore.length !== badgesAfter.length ||
        badgesAfter.some((b) => !badgesBefore.includes(b));

      if (badgesChanged) changed++;

      await logCollection.insertOne({
        _id: uuidv4(),
        trigger,
        sku,
        correlationId,
        badgesBefore,
        badgesAfter,
        duration_ms: Date.now() - startMs,
        timestamp: evaluatedAt,
      });

      processed++;
    }

    logger.info(`evaluate-all complete: ${processed} products, ${changed} badge changes`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { processed, changed, correlationId },
    };
  } catch (error) {
    logger.error(`evaluate-all failed: ${error?.message || String(error)}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'evaluate-all failed', detail: error?.message },
    };
  }
}

exports.main = main;
