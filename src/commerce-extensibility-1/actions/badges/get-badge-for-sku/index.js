const { Core } = require('@adobe/aio-sdk');
const libDb = require('@adobe/aio-lib-db');
const { getImsAccessToken } = require('../utils');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function main (params) {
  const logger = Core.Logger('get-badge-for-sku', { level: params.LOG_LEVEL || 'info' });

  try {
    const { sku } = params;

    if (!sku || typeof sku !== 'string' || !sku.trim()) {
      return { statusCode: 400, headers: JSON_HEADERS, body: { error: 'sku is required' } };
    }

    const dbToken = await getImsAccessToken(params);
    const dbBase = await libDb.init({ token: dbToken, region: params.AIO_DB_REGION });
    const db = await dbBase.connect();

    const docs = await db.collection('badge_assignments').find({ _id: sku.trim() }).toArray();
    const badges = docs.length > 0 ? (docs[0].badges || []) : [];

    logger.info(`Badges for SKU ${sku}: [${badges.join(', ')}]`);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: { sku: sku.trim(), badges },
    };
  } catch (error) {
    logger.error(`Failed to get badges for SKU: ${error?.message || String(error)}`);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: { error: 'Failed to get badges for SKU' },
    };
  }
}

exports.main = main;
