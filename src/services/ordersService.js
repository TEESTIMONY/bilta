import { DJANGO_API_BASE, USE_DJANGO_API, fetchAllPages, fetchJson } from './api'

function normalizeOrder(item) {
  return {
    ...item,
    editHistory: Array.isArray(item?.edit_history) ? item.edit_history : [],
    jobType: item?.job_type || '',
    description: item?.description || '',
    customerName: item?.customer_name || '',
    customerPhone: item?.customer_phone || '',
    customerEmail: item?.customer_email || '',
    customerBusinessName: item?.customer_business_name || '',
    createdByName: item?.created_by_name || '',
    quantity: Math.max(1, Number(item?.quantity || 1)),
    unitPrice: Number(item?.unit_price || 0),
    specialInstructions: item?.special_instructions || '',
    projectScopeNote: item?.project_scope_note || '',
    attachments: Array.isArray(item?.attachments)
      ? item.attachments.map((attachment) => ({
          id: attachment.id,
          originalName: attachment.original_name || 'Attachment',
          contentType: attachment.content_type || '',
          sizeBytes: Number(attachment.size_bytes || 0),
          createdAt: attachment.created_at || '',
          downloadUrl: attachment.download_url || '',
        }))
      : [],
    paymentStatus: item?.payment_status || 'unpaid',
    totalAmount: Number(item?.total_amount ?? item?.total ?? 0),
    amountPaid: Number(item?.amount_paid || 0),
    discountAmount: Number(item?.discount_amount || 0),
    discountReason: item?.discount_reason || '',
    amountDue: Number(item?.amount_due ?? item?.total_amount ?? item?.total ?? 0),
    balanceDue: Number(item?.balance_due || 0),
    deadline: item?.deadline || null,
    fulfilment: item?.fulfilment || 'pickup',
    items: Array.isArray(item?.items)
      ? item.items.map((line) => ({
          id: line.id,
          description: line.description || '',
          quantity: Number(line.quantity || 1),
          rate: Number(line.rate || 0),
          amount: Number(line.amount || 0),
        }))
      : [],
    hasBeenMessaged: Boolean(item?.has_been_messaged),
    isOverdue: Boolean(item?.is_overdue),
  }
}

export async function getOrdersData() {
  if (!USE_DJANGO_API) {
    return { orders: [], source: 'disabled' }
  }

  const orders = await fetchAllPages(`${DJANGO_API_BASE}/jobs/`)
  return { orders: orders.map(normalizeOrder), source: 'django' }
}

export async function getJobsForDate(date) {
  if (!USE_DJANGO_API) {
    return { orders: [], source: 'disabled' }
  }

  const orders = await fetchAllPages(`${DJANGO_API_BASE}/jobs/?created_on=${encodeURIComponent(date)}`)
  return { orders: orders.map(normalizeOrder), source: 'django' }
}

export async function getJob(jobId) {
  const job = await fetchJson(`${DJANGO_API_BASE}/jobs/${jobId}/`)
  return normalizeOrder(job)
}

export async function getJobsQueueData() {
  if (!USE_DJANGO_API) {
    return { orders: [], source: 'disabled' }
  }

  const orders = await fetchJson(`${DJANGO_API_BASE}/jobs/queue/`)
  return {
    orders: (Array.isArray(orders) ? orders : []).map(normalizeOrder),
    source: 'django',
  }
}

export async function getDailySummary(date) {
  if (!USE_DJANGO_API) {
    return { source: 'disabled', summary: null }
  }

  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  const summary = await fetchJson(`${DJANGO_API_BASE}/reports/daily-summary/${query}`)
  return { summary, source: 'django' }
}

export async function updateOrderQuickFields(orderId, updates) {
  const updated = await fetchJson(`${DJANGO_API_BASE}/jobs/${orderId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates }),
  })

  return normalizeOrder(updated)
}

export async function createJob(payload) {
  const created = await fetchJson(`${DJANGO_API_BASE}/jobs/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return normalizeOrder(created)
}

// The one shared customer record for anonymous walk-in jobs (found or created by the server).
export async function ensureWalkInCustomer() {
  return fetchJson(`${DJANGO_API_BASE}/customers/walk-in/`, { method: 'POST', body: JSON.stringify({}) })
}
