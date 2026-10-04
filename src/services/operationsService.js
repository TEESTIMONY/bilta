import { DJANGO_API_BASE, USE_DJANGO_API, fetchAllPages, fetchJson } from './api'

function normalizePayment(item) {
  return {
    ...item,
    amount: Number(item?.amount || 0),
    jobId: item?.job || null,
    source: item?.source || 'job',
    recordedByName: item?.recorded_by_name || '',
    recordedById: item?.recorded_by ?? null,
    customerName: item?.customer_name || '',
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
    staffId: item?.staff ?? null,
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
    recordedByName: item?.recorded_by_name || '',
    cashAmount: Number(item?.cash_amount || 0),
    transferAmount: Number(item?.transfer_amount || 0),
    countedTotal: Number(item?.counted_total || 0),
    recordedTotal: Number(item?.recorded_total || 0),
    expectedTotal: Number(item?.expected_total ?? item?.recorded_total ?? 0),
    difference: Number(item?.difference || 0),
    note: item?.note || '',
    updatedAt: item?.updated_at || '',
  }
}

// End-of-day counts are visible only to the owner/admin.
export async function getCashCounts(date) {
  if (!USE_DJANGO_API) return { counts: [], source: 'disabled' }
  const counts = await fetchAllPages(`${DJANGO_API_BASE}/cash-counts/${dayQuery(date)}`)
  return { counts: counts.map(normalizeCashCount), source: 'django' }
}

// Admin saves or updates today's combined shop count.
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

export const EXPENSE_CATEGORIES = [
  { value: 'fuel', label: 'Fuel / diesel' },
  { value: 'materials', label: 'Materials' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'transport', label: 'Transport' },
  { value: 'rent_bills', label: 'Rent & bills' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'food', label: 'Food' },
  { value: 'other', label: 'Other' },
]

function normalizeExpense(item) {
  return {
    ...item,
    amount: Number(item?.amount || 0),
    paidFromTakings: item?.paid_from_takings !== false,
    categoryLabel: item?.category_label || item?.category || '',
    recordedByName: item?.recorded_by_name || '',
    recordedById: item?.recorded_by ?? null,
    createdAt: item?.created_at || '',
  }
}

// Staff get their own expenses; the owner gets everyone's.
export async function getExpenses(date) {
  if (!USE_DJANGO_API) return { expenses: [], source: 'disabled' }
  const expenses = await fetchAllPages(`${DJANGO_API_BASE}/expenses/${dayQuery(date)}`)
  return { expenses: expenses.map(normalizeExpense), source: 'django' }
}

export async function createExpense({ date, category, description, amount, paidFromTakings = true }) {
  const created = await fetchJson(`${DJANGO_API_BASE}/expenses/`, {
    method: 'POST',
    body: JSON.stringify({
      ...(date ? { date } : {}),
      category,
      description,
      amount: String(Number(amount)),
      paid_from_takings: Boolean(paidFromTakings),
    }),
  })
  return normalizeExpense(created)
}

export async function deleteExpense(expenseId) {
  await fetchJson(`${DJANGO_API_BASE}/expenses/${expenseId}/`, { method: 'DELETE' })
}

// Owner only: recorded collections from all staff/admin and expenses; counts are separate.
export async function getMoneyStatement(start, end) {
  const data = await fetchJson(
    `${DJANGO_API_BASE}/reports/statement/?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  )
  const num = (value) => Number(value || 0)
  return {
    days: (data?.days || []).map((day) => ({
      date: day.date,
      cash: num(day.cash),
      transfer: num(day.transfer),
      countEntered: Boolean(day.count_entered),
      received: num(day.received),
      expenses: num(day.expenses),
      remaining: num(day.remaining),
    })),
    totals: {
      cash: num(data?.totals?.cash),
      transfer: num(data?.totals?.transfer),
      received: num(data?.totals?.received),
      expenses: num(data?.totals?.expenses),
      remaining: num(data?.totals?.remaining),
    },
    byCategory: (data?.expenses_by_category || []).map((row) => ({ ...row, total: num(row.total) })),
  }
}
