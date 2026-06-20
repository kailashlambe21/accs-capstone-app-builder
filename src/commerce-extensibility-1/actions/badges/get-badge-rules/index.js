const { Core } = require('@adobe/aio-sdk');
const libDb = require('@adobe/aio-lib-db');
const { getImsAccessToken } = require('../utils');

async function main (params) {
  const logger = Core.Logger('get-badge-rules', { level: params.LOG_LEVEL || 'info' });

  try {
    const dbToken = await getImsAccessToken(params);
    const dbBase = await libDb.init({ token: dbToken, region: params.AIO_DB_REGION });
    const db = await dbBase.connect();

    const rules = await db.collection('badge_rules').find({}).toArray();
    rules.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { rules },
    };
  } catch (error) {
    logger.error(`Failed to fetch badge rules: ${error?.message || String(error)}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Failed to fetch badge rules' },
    };
  }
}

exports.main = main;
