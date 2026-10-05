import { DJANGO_API_BASE, USE_DJANGO_API, fetchAllPages, fetchJson } from './api'

function normalizeCustomer(item) {
  return {
    ...item,
    ordersCount: Number(item?.orders_count || 0),
    isReturningCustomer: Boolean(item?.is_returning_customer),
  }
}

export async function getCustomersData() {
  if (!USE_DJANGO_API) return { customers: [], source: 'disabled' }
  const customers = await fetchAllPages(`${DJANGO_API_BASE}/customers/`)
  return { customers: customers.map(normalizeCustomer), source: 'django' }
}

export async function createCustomer(payload) {
  const created = await fetchJson(`${DJANGO_API_BASE}/customers/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normalizeCustomer(created)
}

export async function updateCustomer(id, payload) {
  const updated = await fetchJson(`${DJANGO_API_BASE}/customers/${id}/`, {
    method: 'PATCH', body: JSON.stringify(payload),
  })
  return normalizeCustomer(updated)
}
