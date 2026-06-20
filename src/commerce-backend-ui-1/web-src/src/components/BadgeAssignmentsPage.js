import React, { useEffect, useState, useCallback } from 'react';
import {
  Provider,
  defaultTheme,
  View,
  Heading,
  Text,
  Flex,
  Button,
  ActionButton,
  TextField,
  ProgressCircle,
  Well,
  Tabs,
  TabList,
  TabPanels,
  Item,
  Divider,
} from '@adobe/react-spectrum';

const RUNTIME_BASE = 'https://3967933-389wheatplanarian-capstone.adobeioruntime.net/api/v1/web/badge-management';
const URLS = {
  getBadgeProducts: `${RUNTIME_BASE}/get-badge-products`,
};

async function getImsToken (ims) {
  if (!ims?.token) {
    throw new Error('IMS token unavailable. Reload the page from the Commerce Admin Apps menu.');
  }
  return ims.token;
}

async function apiFetch (url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Group badge_assignments into { badgeLabel: [sku, sku, ...] }
function groupByBadge (assignments) {
  const map = {};
  for (const doc of assignments) {
    for (const badge of doc.badges || []) {
      if (!map[badge]) map[badge] = [];
      map[badge].push(doc._id);
    }
  }
  return map;
}

// ─── By Badge view ────────────────────────────────────────────────────────────

function BadgeGroup ({ label, skus }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View
      borderWidth="thin"
      borderColor="dark"
      borderRadius="medium"
      padding="size-200"
      marginBottom="size-150"
    >
      <Flex justifyContent="space-between" alignItems="center">
        <Flex gap="size-200" alignItems="center">
          <Text UNSAFE_style={{ fontWeight: 'bold', fontSize: '1rem' }}>{label}</Text>
          <Text UNSAFE_style={{ color: '#6b7280' }}>{skus.length} SKU{skus.length !== 1 ? 's' : ''}</Text>
        </Flex>
        <ActionButton isQuiet onPress={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide SKUs ▲' : 'Show SKUs ▼'}
        </ActionButton>
      </Flex>

      {expanded && (
        <>
          <Divider size="S" marginTop="size-150" marginBottom="size-150" />
          <Flex wrap gap="size-100">
            {skus.map((sku) => (
              <View
                key={sku}
                backgroundColor="gray-200"
                borderRadius="small"
                paddingX="size-150"
                paddingY="size-50"
              >
                <Text UNSAFE_style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{sku}</Text>
              </View>
            ))}
          </Flex>
        </>
      )}
    </View>
  );
}

function ByBadgeView ({ ims }) {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getImsToken(ims);
      const data = await apiFetch(URLS.getBadgeProducts, token);
      setGrouped(groupByBadge(data.assignments || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ims]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Flex alignItems="center" gap="size-200" marginTop="size-300">
        <ProgressCircle aria-label="Loading" isIndeterminate />
        <Text>Loading badge assignments...</Text>
      </Flex>
    );
  }

  if (error) {
    return <Well marginTop="size-300"><Text>Error: {error}</Text></Well>;
  }

  const badges = Object.keys(grouped).sort();

  if (badges.length === 0) {
    return (
      <Well marginTop="size-300">
        <Text>No badge assignments found. Run "Re-evaluate Badges" from the Badge Rules page to populate.</Text>
      </Well>
    );
  }

  return (
    <View marginTop="size-300">
      <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
        <Text UNSAFE_style={{ color: '#6b7280' }}>
          {badges.length} badge{badges.length !== 1 ? 's' : ''} across {
            new Set(Object.values(grouped).flat()).size
          } unique SKUs
        </Text>
        <ActionButton isQuiet onPress={load}>Refresh</ActionButton>
      </Flex>
      {badges.map((badge) => (
        <BadgeGroup key={badge} label={badge} skus={grouped[badge]} />
      ))}
    </View>
  );
}

// ─── By SKU view ──────────────────────────────────────────────────────────────

function BySkuView ({ ims }) {
  const [skuInput, setSkuInput] = useState('');
  const [result, setResult] = useState(null);   // { sku, badges, evaluatedAt, evaluatedBy }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function search () {
    const sku = skuInput.trim();
    if (!sku) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getImsToken(ims);
      const url = `${URLS.getBadgeProducts}?sku=${encodeURIComponent(sku)}`;
      const data = await apiFetch(url, token);
      const doc = (data.assignments || [])[0] || null;
      setResult(doc ? { sku: doc._id, badges: doc.badges || [], evaluatedAt: doc.evaluatedAt, evaluatedBy: doc.evaluatedBy } : { sku, badges: [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown (e) {
    if (e.key === 'Enter') search();
  }

  return (
    <View marginTop="size-300">
      <Flex gap="size-150" alignItems="end" marginBottom="size-300">
        <TextField
          label="Search by SKU"
          placeholder="e.g. SKU-001"
          value={skuInput}
          onChange={setSkuInput}
          onKeyDown={handleKeyDown}
          width="size-4600"
        />
        <Button variant="primary" onPress={search} isDisabled={loading || !skuInput.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </Flex>

      {error && <Well><Text>Error: {error}</Text></Well>}

      {result && (
        <View
          borderWidth="thin"
          borderColor="dark"
          borderRadius="medium"
          padding="size-300"
        >
          <Heading level={3} margin="size-0" marginBottom="size-100">
            {result.sku}
          </Heading>

          {result.badges.length === 0 ? (
            <Text UNSAFE_style={{ color: '#6b7280' }}>No badges assigned to this SKU.</Text>
          ) : (
            <>
              <Text UNSAFE_style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                Active badges:
              </Text>
              <Flex wrap gap="size-100" marginBottom="size-200">
                {result.badges.map((badge) => (
                  <View
                    key={badge}
                    backgroundColor="blue-400"
                    borderRadius="small"
                    paddingX="size-200"
                    paddingY="size-75"
                  >
                    <Text UNSAFE_style={{ color: '#fff', fontWeight: '600', fontSize: '0.875rem' }}>
                      {badge}
                    </Text>
                  </View>
                ))}
              </Flex>
            </>
          )}

          {result.evaluatedAt && (
            <Text UNSAFE_style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
              Last evaluated: {new Date(result.evaluatedAt).toLocaleString()}
              {result.evaluatedBy ? ` · ${result.evaluatedBy}` : ''}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function BadgeAssignmentsPage ({ embedded = false, ims }) {
  const content = (
    <View padding={embedded ? 'size-0' : 'size-400'}>
      {!embedded && <Heading level={1} marginBottom="size-300">Badge Assignments</Heading>}

      <Tabs aria-label="Badge assignment views">
        <TabList>
          <Item key="by-badge">By Badge</Item>
          <Item key="by-sku">By SKU</Item>
        </TabList>
        <TabPanels>
          <Item key="by-badge"><ByBadgeView ims={ims} /></Item>
          <Item key="by-sku"><BySkuView ims={ims} /></Item>
        </TabPanels>
      </Tabs>

    </View>
  );

  if (embedded) return content;

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      {content}
    </Provider>
  );
}
