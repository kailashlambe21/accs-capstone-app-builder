const { Core } = require('@adobe/aio-sdk');
const libDb = require('@adobe/aio-lib-db');
const { v4: uuidv4 } = require('uuid');
const { getImsAccessToken } = require('../utils');

const VALID_CONDITION_TYPES = [
  'inventory_below',
  'created_within_days',
  'has_special_price',
  'price_below',
  'price_above',
  'price_between',
  'manual',
];

function triggerEvaluateAll (logger) {
  try {
    // Fire-and-forget: kick off full re-evaluation after a rule change
    const openwhisk = require('openwhisk');
    const ow = openwhisk();
    ow.actions.invoke({ name: 'badge-management/evaluate-all', blocking: false, params: {} })
      .catch((err) => logger.warn(`evaluate-all invoke failed: ${err.message}`));
  } catch (err) {
    logger.warn(`Could not trigger evaluate-all: ${err.message}`);
  }
}

async function main (params) {
  const logger = Core.Logger('save-badge-rule', { level: params.LOG_LEVEL || 'info' });

  try {
    const { _id, label, conditionType, threshold, thresholdMax, priority, active } = params;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'label is required' } };
    }
    if (!conditionType || !VALID_CONDITION_TYPES.includes(conditionType)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: `conditionType must be one of: ${VALID_CONDITION_TYPES.join(', ')}` },
      };
    }

    const dbToken = await getImsAccessToken(params);
    const dbBase = await libDb.init({ token: dbToken, region: params.AIO_DB_REGION });
    const db = await dbBase.connect();
    const collection = db.collection('badge_rules');

    const now = new Date().toISOString();
    let savedRule;

    if (_id) {
      const updates = {
        label: label.trim(),
        conditionType,
        threshold: threshold != null ? Number(threshold) : null,
        thresholdMax: thresholdMax != null ? Number(thresholdMax) : null,
        priority: priority != null ? Number(priority) : 0,
        active: active !== false && active !== 'false',
        updatedAt: now,
      };
      await collection.updateOne({ _id }, { $set: updates });
      savedRule = { _id, ...updates };
      logger.info(`Updated badge rule: ${_id}`);
    } else {
      const newRule = {
        _id: uuidv4(),
        label: label.trim(),
        conditionType,
        threshold: threshold != null ? Number(threshold) : null,
        thresholdMax: thresholdMax != null ? Number(thresholdMax) : null,
        priority: priority != null ? Number(priority) : 0,
        active: active !== false && active !== 'false',
        createdAt: now,
        updatedAt: now,
      };
      await collection.insertOne(newRule);
      savedRule = newRule;
      logger.info(`Created badge rule: ${newRule._id}`);
    }

    triggerEvaluateAll(logger);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { rule: savedRule },
    };
  } catch (error) {
    logger.error(`Failed to save badge rule: ${error?.message || String(error)}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Failed to save badge rule' },
    };
  }
}

exports.main = main;
