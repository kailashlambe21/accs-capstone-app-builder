const { Core } = require('@adobe/aio-sdk');
const libDb = require('@adobe/aio-lib-db');
const { v4: uuidv4 } = require('uuid');
const { getImsAccessToken, commerceHeaders, evaluateRules } = require('../utils');

async function fetchProduct (sku, accessToken, params) {
  const baseUrl = String(params.COMMERCE_API_BASE_URL || '').replace(/\/$/, '');
  const encodedSku = encodeURIComponent(sku);
  const url = /api\.commerce\.adobe\.com/i.test(baseUrl)
    ? `${baseUrl}/V1/products/${encodedSku}`
    : `${baseUrl}/rest/default/V1/products/${encodedSku}`;

  const res = await fetch(url, { headers: commerceHeaders(accessToken, params) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Commerce API error ${res.status} for SKU ${sku}: ${text}`);
  }
  return res.json();
}

async function main (params) {
  const logger = Core.Logger('evaluate-sku', { level: params.LOG_LEVEL || 'info' });
  const startMs = Date.now();

  try {
    const { sku, trigger = 'product_save', eventId } = params;

    if (!sku || typeof sku !== 'string' || !sku.trim()) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'sku is required' } };
    }

    const accessToken = await getImsAccessToken(params);
    const dbBase = await libDb.init({ token: accessToken, region: params.AIO_DB_REGION });
    const db = await dbBase.connect();

    const rulesCollection = db.collection('badge_rules');
    const assignmentsCollection = db.collection('badge_assignments');
    const logCollection = db.collection('badge_eval_log');

    const allRules = await rulesCollection.find({}).toArray();
    const activeRules = allRules.filter((r) => r.active);
    const manualBadgeLabels = new Set(activeRules.filter((r) => r.conditionType === 'manual').map((r) => r.label));

    const product = await fetchProduct(sku.trim(), accessToken, params);

    const existingDocs = await assignmentsCollection.find({ _id: sku }).toArray();
    const badgesBefore = existingDocs.length > 0 ? (existingDocs[0].badges || []) : [];

    const autoBadges = evaluateRules(activeRules, product);
    const preservedManual = badgesBefore.filter((b) => manualBadgeLabels.has(b));
    const badgesAfter = [...new Set([...autoBadges, ...preservedManual])];
    const evaluatedAt = new Date().toISOString();

    if (existingDocs.length > 0) {
      await assignmentsCollection.updateOne(
        { _id: sku },
        { $set: { badges: badgesAfter, evaluatedAt, evaluatedBy: trigger } },
      );
    } else {
      await assignmentsCollection.insertOne({
        _id: sku,
        badges: badgesAfter,
        evaluatedAt,
        evaluatedBy: trigger,
      });
    }

    await logCollection.insertOne({
      _id: uuidv4(),
      trigger,
      sku,
      eventId: eventId || null,
      correlationId: uuidv4(),
      badgesBefore,
      badgesAfter,
      duration_ms: Date.now() - startMs,
      timestamp: evaluatedAt,
    });

    logger.info(`evaluate-sku done for ${sku}: [${badgesAfter.join(', ')}]`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { sku, badges: badgesAfter, evaluatedAt },
    };
  } catch (error) {
    logger.error(`evaluate-sku failed: ${error?.message || String(error)}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'evaluate-sku failed', detail: error?.message },
    };
  }
}

exports.main = main;
