const BADGE_ENDPOINT =
  'https://3967933-389wheatplanarian-capstone.adobeioruntime.net/api/v1/web/badge-management/get-badge-for-sku'

async function fetchBadges(sku) {
  try {
    const res = await fetch(`${BADGE_ENDPOINT}?sku=${encodeURIComponent(sku)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.badges || []
  } catch (_) {
    return []
  }
}

module.exports = {
  SimpleProductView: {
    badges: {
      selectionSet: '{ sku }',
      resolve: (root) => fetchBadges(root.sku)
    }
  },
  ComplexProductView: {
    badges: {
      selectionSet: '{ sku }',
      resolve: (root) => fetchBadges(root.sku)
    }
  }
}
