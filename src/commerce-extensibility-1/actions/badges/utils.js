const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const DEFAULT_SCOPES = 'openid AdobeID email profile adobeio_api adobeio.abdata.read adobeio.abdata.manage adobeio.abdata.write';

function resolveImsScopeParam (raw, defaultScopes) {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) return defaultScopes;
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean).join(' ');
  const s = String(raw).trim();
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean).join(' ');
    } catch { /* fall through */ }
  }
  return s.split(/[,\s]+/).filter(Boolean).join(' ');
}

async function getImsAccessToken (params) {
  const body = new URLSearchParams({
    client_id: params.IMS_OAUTH_S2S_CLIENT_ID,
    client_secret: params.IMS_OAUTH_S2S_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: resolveImsScopeParam(params.IMS_OAUTH_S2S_SCOPES, DEFAULT_SCOPES),
  });
  const res = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IMS token request failed: ${res.status} ${text}`);
  }
  return (await res.json()).access_token;
}

function commerceHeaders (accessToken, params) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'x-api-key': params.IMS_OAUTH_S2S_CLIENT_ID,
    'x-gw-ims-org-id': params.IMS_OAUTH_S2S_ORG_ID,
    'Content-Type': 'application/json',
  };
}

function matchesRule (rule, product) {
  switch (rule.conditionType) {
    case 'inventory_below': {
      const qty = product.extension_attributes?.stock_item?.qty;
      return qty != null && Number(qty) < Number(rule.threshold);
    }
    case 'created_within_days': {
      if (!product.created_at) return false;
      const cutoffMs = Date.now() - Number(rule.threshold) * 86400000;
      return new Date(product.created_at).getTime() >= cutoffMs;
    }
    case 'has_special_price': {
      if (product.special_price != null && product.special_price !== '') return true;
      const attr = (product.custom_attributes || []).find((a) => a.attribute_code === 'special_price');
      return attr != null && attr.value != null && attr.value !== '';
    }
    case 'price_below':
      return product.price != null && Number(product.price) < Number(rule.threshold);
    case 'price_above':
      return product.price != null && Number(product.price) > Number(rule.threshold);
    case 'price_between':
      return product.price != null &&
        Number(product.price) >= Number(rule.threshold) &&
        Number(product.price) <= Number(rule.thresholdMax);
    case 'manual':
      return false;
    default:
      return false;
  }
}

function evaluateRules (rules, product) {
  return rules
    .filter((r) => r.active && matchesRule(r, product))
    .map((r) => r.label);
}

module.exports = { getImsAccessToken, commerceHeaders, matchesRule, evaluateRules };
