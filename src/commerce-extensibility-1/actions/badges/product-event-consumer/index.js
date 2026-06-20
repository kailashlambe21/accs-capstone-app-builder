const { Core } = require('@adobe/aio-sdk');
const { v4: uuidv4 } = require('uuid');

async function main (params) {
  const logger = Core.Logger('product-event-consumer', { level: params.LOG_LEVEL || 'info' });

  const eventId = params.event_id || params.cloudEventsId || null;
  const eventData = params.data?.value || params.event?.data || params.data || {};
  const eventType = params.type || params.event_type || 'catalog_product_save_after';
  const correlationId = uuidv4();

  logger.info(JSON.stringify({ msg: 'Event received', eventType, eventId, correlationId }));

  // Extract SKU — try common locations in the catalog_product_save_after payload
  const sku = eventData.sku
    || eventData.product?.sku
    || eventData.entity?.sku
    || null;

  if (!sku) {
    logger.warn(JSON.stringify({
      msg: 'No SKU found in event payload, skipping',
      eventId,
      correlationId,
      eventDataKeys: Object.keys(eventData),
    }));
    // Return 200 so I/O Events does not retry — nothing to process
    return { statusCode: 200, body: { message: 'No SKU in payload, skipped', eventId, correlationId } };
  }

  logger.info(JSON.stringify({ msg: 'Invoking evaluate-sku', sku, eventId, correlationId }));

  try {
    const openwhisk = require('openwhisk');
    const ow = openwhisk();

    const activation = await ow.actions.invoke({
      name: 'badge-management/evaluate-sku',
      blocking: true,
      result: true,
      params: {
        sku,
        trigger: 'product_save',
        eventId,
        // Pass through all runtime credentials so evaluate-sku can reach IMS + DB + Commerce
        IMS_OAUTH_S2S_CLIENT_ID: params.IMS_OAUTH_S2S_CLIENT_ID,
        IMS_OAUTH_S2S_CLIENT_SECRET: params.IMS_OAUTH_S2S_CLIENT_SECRET,
        IMS_OAUTH_S2S_ORG_ID: params.IMS_OAUTH_S2S_ORG_ID,
        IMS_OAUTH_S2S_SCOPES: params.IMS_OAUTH_S2S_SCOPES,
        AIO_DB_REGION: params.AIO_DB_REGION,
        COMMERCE_API_BASE_URL: params.COMMERCE_API_BASE_URL,
        LOG_LEVEL: params.LOG_LEVEL || 'info',
      },
    });

    logger.info(JSON.stringify({
      msg: 'evaluate-sku completed',
      sku,
      eventId,
      correlationId,
      badges: activation.badges || [],
    }));

    return {
      statusCode: 200,
      body: { message: 'Event processed', sku, eventId, correlationId },
    };
  } catch (error) {
    logger.error(JSON.stringify({
      msg: 'evaluate-sku invocation failed',
      sku,
      eventId,
      correlationId,
      error: error?.message || String(error),
    }));
    // Return 500 so I/O Events retries this activation
    return {
      statusCode: 500,
      body: { error: 'evaluate-sku failed', sku, eventId, correlationId },
    };
  }
}

exports.main = main;
