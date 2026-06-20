const { Core } = require('@adobe/aio-sdk');
const libDb = require('@adobe/aio-lib-db');
const { getImsAccessToken } = require('../utils');

async function main (params) {
  const logger = Core.Logger('delete-badge-rule', { level: params.LOG_LEVEL || 'info' });

  try {
    const { id } = params;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'id is required' } };
    }

    const dbToken = await getImsAccessToken(params);
    const dbBase = await libDb.init({ token: dbToken, region: params.AIO_DB_REGION });
    const db = await dbBase.connect();

    await db.collection('badge_rules').deleteOne({ _id: id.trim() });
    logger.info(`Deleted badge rule: ${id}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { deleted: true, id: id.trim() },
    };
  } catch (error) {
    logger.error(`Failed to delete badge rule: ${error?.message || String(error)}`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Failed to delete badge rule' },
    };
  }
}

exports.main = main;
