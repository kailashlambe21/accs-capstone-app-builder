const { Core } = require('@adobe/aio-sdk');
const libDb = require('@adobe/aio-lib-db');
const { getImsAccessToken } = require('../utils');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function main (params) {
  const logger = Core.Logger('assign-manual-badge', { level: params.LOG_LEVEL || 'info' });

  try {
    const { sku, label, action = 'add' } = params;

    if (!sku || typeof sku !== 'string' || !sku.trim()) {
      return { statusCode: 400, headers: JSON_HEADERS, body: { error: 'sku is required' } };
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      return { statusCode: 400, headers: JSON_HEADERS, body: { error: 'label is required' } };
    }
    if (action !== 'add' && action !== 'remove') {
      return { statusCode: 400, headers: JSON_HEADERS, body: { error: 'action must be "add" or "remove"' } };
    }

    const dbToken = await getImsAccessToken(params);
    const dbBase = await libDb.init({ token: dbToken, region: params.AIO_DB_REGION });
    const db = await dbBase.connect();

    // Confirm the label belongs to an active manual rule
    const rules = await db.collection('badge_rules')
      .find({ conditionType: 'manual', label: label.trim() })
      .toArray();
    if (rules.length === 0) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: { error: `No manual rule found with label "${label.trim()}"` },
      };
    }

    const skuKey = sku.trim();
    const badgeLabel = label.trim();
    const assignmentsCollection = db.collection('badge_assignments');
    const existing = await assignmentsCollection.find({ _id: skuKey }).toArray();
    const currentBadges = existing.length > 0 ? (existing[0].badges || []) : [];

    const newBadges = action === 'add'
      ? (currentBadges.includes(badgeLabel) ? currentBadges : [...currentBadges, badgeLabel])
      : currentBadges.filter((b) => b !== badgeLabel);

    const now = new Date().toISOString();
    if (existing.length > 0) {
      await assignmentsCollection.updateOne(
        { _id: skuKey },
        { $set: { badges: newBadges, evaluatedAt: now, evaluatedBy: 'manual_assignment' } },
      );
    } else {
      await assignmentsCollection.insertOne({
        _id: skuKey,
        badges: newBadges,
        evaluatedAt: now,
        evaluatedBy: 'manual_assignment',
      });
    }

    logger.info(`Manual badge "${badgeLabel}" ${action}ed for SKU ${skuKey}`);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: { sku: skuKey, badges: newBadges, action },
    };
  } catch (error) {
    logger.error(`assign-manual-badge failed: ${error?.message || String(error)}`);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: { error: 'assign-manual-badge failed', detail: error?.message },
    };
  }
}

exports.main = main;
