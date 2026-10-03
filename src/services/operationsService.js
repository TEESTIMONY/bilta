import { DJANGO_API_BASE, USE_DJANGO_API, fetchAllPages, fetchJson } from './api'

function normalizePayment(item) {
  return {
    ...item,
    amount: Number(item?.amount || 0),
    jobId: item?.job || null,
    source: item?.source || 'job',
    recordedByName: item?.recorded_by_name || '',
    serviceLabel: item?.service_label || '',
    note: item?.note || '',
    createdAt: item?.created_at || '',
  }
}

function normalizePhotocopySession(item) {
  return {
    ...item,
    openingReading: Number(item?.opening_reading || 0),
    closingReading: Number(item?.closing_reading || 0),
    totalCopies: Number(item?.total_copies || 0),
    pricePerCopy: Number(item?.price_per_copy || 0),
    expectedRevenue: Number(item?.expected_revenue || 0),
    actualCashCollected: Number(item?.actual_cash_collected || 0),
    revenueGap: Number(item?.revenue_gap || 0),
    hasDiscrepancy: Boolean(item?.has_discrepancy),
    staffName: item?.staff_name || '',
    createdAt: item?.created_at || '',
  }
}

function normalizeSystemSetting(item) {
  return {
    ...item,
    photocopyPricePerCopy: Number(item?.photocopy_price_per_copy || 0),
    jobCategories: Array.isArray(item?.job_categories) ? item.job_categories : [],
  }
}

function normalizeAuditLog(item) {
  return {
    ...item,
    modelName: item?.model_name || '',
    objectId: item?.object_id || '',
    performedByName: item?.performed_by_name || '',
    performedByDisplay: item?.performed_by_display || item?.performed_by_name || 'Someone',
    reason: item?.reason || '',
    metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    createdAt: item?.created_at || '',
  }
}

// Pass a YYYY-MM-DD date to fetch just that day's records instead of the whole history.
function dayQuery(date) {
  return date ? `?date=${encodeURIComponent(date)}` : ''
}

export async function getPaymentRecordsData(date) {
  if (!USE_DJANGO_API) return { payments: [], source: 'disabled' }
  const payments = await fetchAllPages(`${DJANGO_API_BASE}/payments/${dayQuery(date)}`)
  return { payments: payments.map(normalizePayment), source: 'django' }
}

export async function createPaymentRecord(payload) {
  const created = await fetchJson(`${DJANGO_API_BASE}/payments/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normalizePayment(created)
}

export async function getPhotocopySessionsData(date) {
  if (!USE_DJANGO_API) return { sessions: [], source: 'disabled' }
  const sessions = await fetchAllPages(`${DJANGO_API_BASE}/photocopy-sessions/${dayQuery(date)}`)
  return { sessions: sessions.map(normalizePhotocopySession), source: 'django' }
}

export async function createPhotocopySession(payload) {
  const created = await fetchJson(`${DJANGO_API_BASE}/photocopy-sessions/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normalizePhotocopySession(created)
}

export async function getSystemSetting() {
  if (!USE_DJANGO_API) return { setting: null, source: 'disabled' }

  const settings = await fetchAllPages(`${DJANGO_API_BASE}/settings/`)
  const normalized = settings.map(normalizeSystemSetting)

  if (normalized.length) {
    return { setting: normalized[0], source: 'django' }
  }

  const created = await fetchJson(`${DJANGO_API_BASE}/settings/`, {
    method: 'POST',
    body: JSON.stringify({
      business_name: 'Bilta Print Shop',
      business_address: '',
      photocopy_price_per_copy: '50.00',
      job_categories: [],
    }),
  })

  return { setting: normalizeSystemSetting(created), source: 'django' }
}

export async function updateSystemSetting(settingId, payload) {
  const updated = await fetchJson(`${DJANGO_API_BASE}/settings/${settingId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return normalizeSystemSetting(updated)
}

export async function getAuditLogsData(date) {
  if (!USE_DJANGO_API) return { auditLogs: [], source: 'disabled' }
  const auditLogs = await fetchAllPages(`${DJANGO_API_BASE}/audit-logs/${dayQuery(date)}`)
  return { auditLogs: auditLogs.map(normalizeAuditLog), source: 'django' }
}

function normalizeCashCount(item) {
  return {
    ...item,
    staffId: item?.staff ?? null,
    staffName: item?.staff_name || '',
    cashAmount: Number(item?.cash_amount || 0),
    transferAmount: Number(item?.transfer_amount || 0),
    countedTotal: Number(item?.counted_total || 0),
    recordedTotal: Number(item?.recorded_total || 0),
    difference: Number(item?.difference || 0),
    note: item?.note || '',
    updatedAt: item?.updated_at || '',
  }
}

// End-of-day counts for a day (staff get their own; the owner gets everyone's).
export async function getCashCounts(date) {
  if (!USE_DJANGO_API) return { counts: [], source: 'disabled' }
  const counts = await fetchAllPages(`${DJANGO_API_BASE}/cash-counts/${dayQuery(date)}`)
  return { counts: counts.map(normalizeCashCount), source: 'django' }
}

// Saves (or updates) the signed-in person's count for today.
export async function saveCashCount({ cashAmount, transferAmount, note }) {
  const saved = await fetchJson(`${DJANGO_API_BASE}/cash-counts/`, {
    method: 'POST',
    body: JSON.stringify({
      cash_amount: String(Number(cashAmount || 0)),
      transfer_amount: String(Number(transferAmount || 0)),
      note: note || '',
    }),
  })
  return normalizeCashCount(saved)
}
