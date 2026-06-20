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
  ProgressCircle,
  Well,
  TableView,
  TableHeader,
  TableBody,
  Column,
  Row,
  Cell,
  DialogContainer,
  Dialog,
  Content,
  Divider,
  ButtonGroup,
  AlertDialog,
  Form,
  TextField,
  Picker,
  Item,
  Switch,
} from '@adobe/react-spectrum';

// Update namespace to match your deployed I/O Runtime workspace
const RUNTIME_BASE = 'https://3967933-389wheatplanarian-capstone.adobeioruntime.net/api/v1/web/badge-management';
const URLS = {
  getRules:    `${RUNTIME_BASE}/get-badge-rules`,
  saveRule:    `${RUNTIME_BASE}/save-badge-rule`,
  deleteRule:  `${RUNTIME_BASE}/delete-badge-rule`,
  evaluateAll: `${RUNTIME_BASE}/evaluate-all`,
};

const CONDITION_OPTIONS = [
  { id: 'inventory_below',    label: 'Inventory Below Threshold' },
  { id: 'created_within_days', label: 'Created Within N Days' },
  { id: 'has_special_price',  label: 'Has Special Price' },
  { id: 'price_below',        label: 'Price Below' },
  { id: 'price_above',        label: 'Price Above' },
  { id: 'price_between',      label: 'Price Between (range)' },
  { id: 'manual',             label: 'Manual Only' },
];

const THRESHOLD_LABELS = {
  inventory_below:    'Threshold (qty)',
  created_within_days: 'Days',
  price_below:        'Max Price ($)',
  price_above:        'Min Price ($)',
  price_between:      'Min Price ($)',
};

const EMPTY_FORM = { label: '', conditionType: 'inventory_below', threshold: '', thresholdMax: '', priority: '0', active: true };

function PageShell ({ embedded, children }) {
  if (embedded) return children;
  return (
    <Provider theme={defaultTheme} colorScheme="light">
      {children}
    </Provider>
  );
}

async function getImsToken (ims) {
  if (!ims?.token) {
    throw new Error('IMS token unavailable. Reload the page from the Commerce Admin Apps menu.');
  }
  return ims.token;
}

async function apiFetch (url, method, body, token) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function BadgeRulesPage ({ embedded = false, ims }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);        // { type: 'positive'|'negative', msg }

  const [dialogMode, setDialogMode] = useState(null); // 'add' | 'edit'
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEvaluating, setIsEvaluating] = useState(false);

  // ── Flash notice ────────────────────────────────────────────────────────────
  const showNotice = (type, msg) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4000);
  };

  // ── Load rules ──────────────────────────────────────────────────────────────
  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getImsToken(ims);
      const data = await apiFetch(URLS.getRules, 'GET', null, token);
      setRules(data.rules || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ims]);

  useEffect(() => { loadRules(); }, [loadRules]);

  // ── Dialog helpers ──────────────────────────────────────────────────────────
  function openAdd () {
    setForm(EMPTY_FORM);
    setEditingRule(null);
    setDialogMode('add');
  }

  function openEdit (rule) {
    setForm({
      label:         rule.label,
      conditionType: rule.conditionType,
      threshold:     rule.threshold != null     ? String(rule.threshold)    : '',
      thresholdMax:  rule.thresholdMax != null  ? String(rule.thresholdMax) : '',
      priority:      rule.priority != null      ? String(rule.priority)     : '0',
      active:        rule.active !== false,
    });
    setEditingRule(rule);
    setDialogMode('edit');
  }

  function closeDialog () {
    setDialogMode(null);
    setEditingRule(null);
    setIsSaving(false);
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave () {
    if (!form.label.trim()) return;
    setIsSaving(true);
    try {
      const token = await getImsToken(ims);
      const payload = {
        label:         form.label.trim(),
        conditionType: form.conditionType,
        threshold:     form.threshold !== '' ? Number(form.threshold) : null,
        thresholdMax:  form.thresholdMax !== '' ? Number(form.thresholdMax) : null,
        priority:      Number(form.priority) || 0,
        active:        form.active,
      };
      if (editingRule) payload._id = editingRule._id;

      await apiFetch(URLS.saveRule, 'POST', payload, token);
      closeDialog();
      await loadRules();
      showNotice('positive', `Rule "${payload.label}" saved. Re-evaluation triggered.`);
    } catch (err) {
      showNotice('negative', `Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function confirmDelete () {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const token = await getImsToken(ims);
      await apiFetch(`${URLS.deleteRule}?id=${encodeURIComponent(deleteTarget._id)}`, 'DELETE', null, token);
      setDeleteTarget(null);
      await loadRules();
      showNotice('positive', `Rule "${deleteTarget.label}" deleted.`);
    } catch (err) {
      showNotice('negative', `Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Re-evaluate all ─────────────────────────────────────────────────────────
  async function handleEvaluateAll () {
    setIsEvaluating(true);
    try {
      const token = await getImsToken(ims);
      const result = await apiFetch(URLS.evaluateAll, 'POST', { trigger: 'manual_refresh' }, token);
      showNotice('positive', `Re-evaluation complete — ${result.processed} products, ${result.changed} badge changes.`);
    } catch (err) {
      showNotice('negative', `Re-evaluation failed: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageShell embedded={embedded}>
        <View padding={embedded ? 'size-0' : 'size-400'}>
          <Flex alignItems="center" gap="size-200">
            <ProgressCircle aria-label="Loading" isIndeterminate />
            <Text>Loading badge rules...</Text>
          </Flex>
        </View>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell embedded={embedded}>
        <View padding={embedded ? 'size-0' : 'size-400'}>
          {!embedded && <Heading level={1}>Badge Rules</Heading>}
          <Well><Text>Error: {error}</Text></Well>
        </View>
      </PageShell>
    );
  }

  const needsThreshold = form.conditionType in THRESHOLD_LABELS;
  const needsThresholdMax = form.conditionType === 'price_between';

  return (
    <PageShell embedded={embedded}>
      <View padding={embedded ? 'size-0' : 'size-400'}>

        {/* Header row */}
        <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
          {!embedded && <Heading level={1} margin="size-0">Badge Rules</Heading>}
          {embedded && <View />}
          <Flex gap="size-150">
            <Button
              variant="secondary"
              onPress={handleEvaluateAll}
              isDisabled={isEvaluating}
            >
              {isEvaluating ? <ProgressCircle aria-label="Evaluating" isIndeterminate size="S" /> : null}
              {isEvaluating ? ' Evaluating…' : 'Re-evaluate Badges'}
            </Button>
            <Button variant="cta" onPress={openAdd}>Add Rule</Button>
          </Flex>
        </Flex>

        {/* Notice banner */}
        {notice && (
          <Well
            marginBottom="size-200"
            UNSAFE_style={{ background: notice.type === 'positive' ? '#f0fdf4' : '#fff1f2' }}
          >
            <Text>{notice.msg}</Text>
          </Well>
        )}

        {/* Rules table */}
        {rules.length === 0 ? (
          <Well><Text>No badge rules yet. Click "Add Rule" to create one.</Text></Well>
        ) : (
          <TableView aria-label="Badge rules" selectionMode="none">
            <TableHeader>
              <Column key="label"         width="25%">Label</Column>
              <Column key="conditionType" width="25%">Condition</Column>
              <Column key="threshold"     width="12%">Threshold</Column>
              <Column key="priority"      width="10%">Priority</Column>
              <Column key="active"        width="10%">Active</Column>
              <Column key="actions"       width="18%">Actions</Column>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <Row key={rule._id}>
                  <Cell>{rule.label}</Cell>
                  <Cell>
                    {CONDITION_OPTIONS.find((o) => o.id === rule.conditionType)?.label || rule.conditionType}
                  </Cell>
                  <Cell>
                    {rule.conditionType === 'price_between' && rule.threshold != null && rule.thresholdMax != null
                      ? `$${rule.threshold} – $${rule.thresholdMax}`
                      : rule.threshold != null ? String(rule.threshold) : '—'}
                  </Cell>
                  <Cell>{rule.priority ?? 0}</Cell>
                  <Cell>{rule.active ? 'Yes' : 'No'}</Cell>
                  <Cell>
                    <Flex gap="size-100">
                      <ActionButton isQuiet onPress={() => openEdit(rule)}>Edit</ActionButton>
                      <ActionButton isQuiet onPress={() => setDeleteTarget(rule)}>Delete</ActionButton>
                    </Flex>
                  </Cell>
                </Row>
              ))}
            </TableBody>
          </TableView>
        )}

        {/* Add / Edit dialog */}
        <DialogContainer onDismiss={closeDialog}>
          {dialogMode && (
            <Dialog>
              <Heading>{dialogMode === 'add' ? 'Add Badge Rule' : 'Edit Badge Rule'}</Heading>
              <Divider />
              <Content>
                <Form>
                  <TextField
                    label="Label"
                    value={form.label}
                    onChange={(v) => setForm((f) => ({ ...f, label: v }))}
                    isRequired
                    autoFocus
                  />
                  <Picker
                    label="Condition Type"
                    selectedKey={form.conditionType}
                    onSelectionChange={(v) => setForm((f) => ({ ...f, conditionType: v, threshold: '', thresholdMax: '' }))}
                  >
                    {CONDITION_OPTIONS.map((o) => <Item key={o.id}>{o.label}</Item>)}
                  </Picker>
                  {needsThreshold && (
                    <TextField
                      label={THRESHOLD_LABELS[form.conditionType]}
                      value={form.threshold}
                      onChange={(v) => setForm((f) => ({ ...f, threshold: v }))}
                      inputMode="numeric"
                    />
                  )}
                  {needsThresholdMax && (
                    <TextField
                      label="Max Price ($)"
                      value={form.thresholdMax}
                      onChange={(v) => setForm((f) => ({ ...f, thresholdMax: v }))}
                      inputMode="numeric"
                    />
                  )}
                  <TextField
                    label="Priority (lower = higher priority)"
                    value={form.priority}
                    onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                    inputMode="numeric"
                  />
                  <Switch
                    isSelected={form.active}
                    onChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  >
                    Active
                  </Switch>
                </Form>
              </Content>
              <ButtonGroup>
                <Button variant="secondary" onPress={closeDialog} isDisabled={isSaving}>Cancel</Button>
                <Button
                  variant="cta"
                  onPress={handleSave}
                  isDisabled={isSaving || !form.label.trim()}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
              </ButtonGroup>
            </Dialog>
          )}
        </DialogContainer>

        {/* Delete confirmation */}
        <DialogContainer onDismiss={() => setDeleteTarget(null)}>
          {deleteTarget && (
            <AlertDialog
              title="Delete Rule"
              variant="destructive"
              primaryActionLabel={isDeleting ? 'Deleting…' : 'Delete'}
              cancelLabel="Cancel"
              onPrimaryAction={confirmDelete}
              onCancel={() => setDeleteTarget(null)}
            >
              Delete the rule <strong>"{deleteTarget.label}"</strong>? This cannot be undone.
            </AlertDialog>
          )}
        </DialogContainer>

      </View>
    </PageShell>
  );
}
