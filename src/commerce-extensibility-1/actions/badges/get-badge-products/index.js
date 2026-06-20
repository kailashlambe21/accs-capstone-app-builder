const { Core } = require('@adobe/aio-sdk');
const libDb = require('@adobe/aio-lib-db');
const { getImsAccessToken } = require('../utils');

async function main (params) {
  const logger = Core.Logger('get-badge-products', { level: params.LOG_LEVEL || 'info' });

  try {
    const dbToken = await getImsAccessToken(params);
    const dbBase = await libDb.init({ token: dbToken, region: params.AIO_DB_REGION });
    const db = await dbBase.connect();
    const collection = db.collection('badge_assignments');

    let assignments;

    if (params.sku) {
      const docs = await collection.find({ _id: params.sku.trim() }).toArray();
      assignments = docs;
    } else if (params.badge) {
      const label = params.badge.trim();
      const all = await collection.find({}).toArray();
      assignments = all.filter((doc) => Array.isArray(doc.badges) && doc.badges.includes(label));
    } else {
      assignments = await collection.find({}).toArray();
    }

    assignments.sort((a, b) => {
      const ta = a.evaluatedAt || '';
      const tb = b.evaluatedAt || '';
      return tb.localeCompare(ta);
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { assignments, total: assignments.length },
    };
  } catch (error) {
    logger.error(`Failed to fetch badge products: ${error?.message || String(error)}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Failed to fetch badge products' },
    };
  }
}

exports.main = main;
