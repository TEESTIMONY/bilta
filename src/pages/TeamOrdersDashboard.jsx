import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Plus, Search, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import JobOrderForm from '../components/JobOrderForm'
import TeamPageHeader from '../components/TeamPageHeader'
import TeamNavbar from '../components/TeamNavbar'
import { useAuth } from '../context/authContext'
import { getCustomersData } from '../services/customersService'
import { getSystemSetting } from '../services/operationsService'
import { createPaymentRecord } from '../services/operationsService'
import {
  getDailySummary,
  getJob,
  getJobsQueueData,
  updateOrderQuickFields,
} from '../services/ordersService'

const orderStatusOptions = [
  'pending',
  'in_progress',
  'ready_for_pickup',
  'awaiting_delivery',
  'completed',
  'cancelled',
]

const queueViewOptions = [
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'payment_issues', label: 'Owes money' },
  { value: 'completed', label: 'Done' },
  { value: 'all', label: 'All' },
]

function getTodayDateValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return 'No deadline'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'No deadline'
  return parsed.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function toDateTimeLocalValue(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatFileSize(value) {
  const size = Number(value || 0)
  if (!size) return '0 KB'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function titleCase(value) {
  if (value === 'walk_in') return 'Walk-in'
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getWATDateKey(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

function isCompletedJob(order) {
  return order?.status === 'completed'
}

function isActiveDeskJob(order) {
  return order?.status !== 'completed' && order?.status !== 'cancelled'
}

function hasOutstandingPayment(order) {
  return Number(order?.balanceDue || 0) > 0 || order?.paymentStatus !== 'paid'
}

function isCompletedWithPaymentIssue(order) {
  return isCompletedJob(order) && hasOutstandingPayment(order)
}

function getActiveJobSortPriority(order) {
  if (order?.isOverdue) return 0
  if (order?.status === 'in_progress') return 1
  if (order?.status === 'awaiting_delivery') return 2
  if (order?.status === 'ready_for_pickup') return 3
  if (order?.status === 'pending') return 4
  return 5
}

function getTimestamp(value, fallback) {
  const parsed = new Date(value || fallback || 0)
  const timestamp = parsed.getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function compareDeskOrders(left, right) {
  const leftPriority = isActiveDeskJob(left) ? 0 : isCompletedWithPaymentIssue(left) ? 1 : 2
  const rightPriority = isActiveDeskJob(right) ? 0 : isCompletedWithPaymentIssue(right) ? 1 : 2

  if (leftPriority !== rightPriority) return leftPriority - rightPriority

  if (leftPriority === 0) {
    const leftStatusPriority = getActiveJobSortPriority(left)
    const rightStatusPriority = getActiveJobSortPriority(right)
    if (leftStatusPriority !== rightStatusPriority) return leftStatusPriority - rightStatusPriority

    const leftDeadline = left.deadline ? getTimestamp(left.deadline) : Number.MAX_SAFE_INTEGER
    const rightDeadline = right.deadline ? getTimestamp(right.deadline) : Number.MAX_SAFE_INTEGER
    if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline
  }

  return getTimestamp(right.updated_at, right.created_at) - getTimestamp(left.updated_at, left.created_at)
}

function TeamOrdersDashboard() {
  const { isOwner } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [dailySummary, setDailySummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingOrderId, setSavingOrderId] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [summaryDate, setSummaryDate] = useState(getTodayDateValue())
  const [queueEdits, setQueueEdits] = useState({})
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [queueSearch, setQueueSearch] = useState('')
  const [queueView, setQueueView] = useState('needs_attention')
  const [visibleQueueCount, setVisibleQueueCount] = useState(6)
  // Jobs from earlier days opened through a ?focusJobId= link (Records / Reports);
  // the queue itself only holds today's jobs.
  const [linkedJobIds, setLinkedJobIds] = useState([])
  const [showNewJob, setShowNewJob] = useState(false)
  const [jobCategories, setJobCategories] = useState([])
  const [collectDrafts, setCollectDrafts] = useState({})
  const [collectingOrderId, setCollectingOrderId] = useState(null)
  const [missingJobIds, setMissingJobIds] = useState([])
  const deferredQueueSearch = useDeferredValue(queueSearch)

  const loadDashboard = useCallback(async (date = summaryDate) => {
    setLoading(true)
    try {
      const [queueData, customerData, summaryData, linkedJobResults] = await Promise.all([
        getJobsQueueData(),
        getCustomersData(),
        getDailySummary(date),
        Promise.allSettled(linkedJobIds.map((jobId) => getJob(jobId))),
      ])

      const seenIds = new Set(queueData.orders.map((order) => order.id))
      const linkedJobs = []
      for (const result of linkedJobResults) {
        if (result.status !== 'fulfilled' || seenIds.has(result.value.id)) continue
        seenIds.add(result.value.id)
        linkedJobs.push(result.value)
      }
      setMissingJobIds(linkedJobIds.filter((_, index) => linkedJobResults[index].status === 'rejected'))

      setOrders([...queueData.orders, ...linkedJobs])
      setCustomers(customerData.customers)
      setDailySummary(summaryData.summary)
    } catch (error) {
      setStatusMessage(`Failed to load desk dashboard: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [linkedJobIds, summaryDate])

  useEffect(() => {
    loadDashboard(summaryDate)
  }, [loadDashboard, summaryDate])

  useEffect(() => {
    // Job types for contract/project jobs come from Settings when the owner has set them.
    getSystemSetting()
      .then(({ setting }) => setJobCategories(setting?.jobCategories || []))
      .catch(() => setJobCategories([]))
  }, [])

  // The queue only holds today's jobs, so reload once the day rolls over if the desk is left open.
  useEffect(() => {
    let currentDay = getWATDateKey(new Date())
    const timer = window.setInterval(() => {
      const today = getWATDateKey(new Date())
      if (today === currentDay) return
      currentDay = today
      setLinkedJobIds([])
      setSummaryDate(getTodayDateValue())
      loadDashboard(getTodayDateValue())
    }, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [loadDashboard, summaryDate])

  useEffect(() => {
    setQueueEdits(
      Object.fromEntries(
        orders.map((order) => [
          order.id,
          {
            quantity: String(Math.max(1, Number(order.quantity || 1))),
            unitPrice: String(Number(order.unitPrice || 0)),
            amountPaid: String(Number(order.amountPaid || 0)),
            deadline: toDateTimeLocalValue(order.deadline),
          },
        ]),
      ),
    )
  }, [orders])

  useEffect(() => {
    setExpandedOrderId((current) => {
      if (current && orders.some((order) => order.id === current)) return current
      return null
    })
  }, [orders])

  useEffect(() => {
    const focusJobIdParam = searchParams.get('focusJobId')
    if (!focusJobIdParam) return

    const targetId = Number(focusJobIdParam)
    if (!Number.isFinite(targetId)) return

    const targetExists = orders.some((order) => order.id === targetId)
    if (!targetExists) {
      if (missingJobIds.includes(targetId)) {
        setStatusMessage(`Job #${targetId} could not be found.`)
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('focusJobId')
        setSearchParams(nextParams, { replace: true })
      } else if (!linkedJobIds.includes(targetId)) {
        // Not one of today's jobs: load it alongside the queue.
        setLinkedJobIds((current) => (current.includes(targetId) ? current : [...current, targetId]))
      }
      return
    }

    setQueueView('all')
    setQueueSearch('')
    setExpandedOrderId(targetId)

    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.getElementById('desk-job-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('focusJobId')
    setSearchParams(nextParams, { replace: true })
  }, [linkedJobIds, missingJobIds, orders, searchParams, setSearchParams])

  useEffect(() => {
    setVisibleQueueCount(6)
  }, [deferredQueueSearch, queueView])

  const activeOrders = useMemo(() => orders.filter((order) => isActiveDeskJob(order)), [orders])

  const completedOrders = useMemo(() => orders.filter((order) => isCompletedJob(order)), [orders])

  const completedJobsWithPaymentIssues = useMemo(
    () => orders.filter((order) => isCompletedWithPaymentIssue(order)),
    [orders],
  )

  const filteredQueueOrders = useMemo(() => {
    const query = deferredQueueSearch.trim().toLowerCase()

    const matchesFilter = (order) => {
      if (queueView === 'all') return true
      if (queueView === 'needs_attention') {
        return (isActiveDeskJob(order) && (order.isOverdue || order.status === 'pending')) || isCompletedWithPaymentIssue(order)
      }
      if (queueView === 'in_progress') {
        return order.status === 'in_progress' || order.status === 'awaiting_delivery'
      }
      if (queueView === 'ready') return order.status === 'ready_for_pickup'
      if (queueView === 'payment_issues') return isCompletedWithPaymentIssue(order)
      if (queueView === 'completed') return isCompletedJob(order)
      return true
    }

    const matchesQuery = (order) => {
      if (!query) return true
      const haystack = [
        order.customerName,
        order.customerPhone,
        order.customerEmail,
        order.description,
        order.projectScopeNote,
        order.specialInstructions,
        order.jobType,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    }

    return orders
      .filter((order) => matchesFilter(order) && matchesQuery(order))
      .sort(compareDeskOrders)
  }, [deferredQueueSearch, orders, queueView])

  const visibleQueueOrders = useMemo(
    () => filteredQueueOrders.slice(0, visibleQueueCount),
    [filteredQueueOrders, visibleQueueCount],
  )

  const queueCounts = useMemo(
    () => ({
      needsAttention: orders.filter(
        (order) =>
          (isActiveDeskJob(order) && (order.isOverdue || order.status === 'pending')) ||
          isCompletedWithPaymentIssue(order),
      ).length,
      inProgress: activeOrders.filter(
        (order) => order.status === 'in_progress' || order.status === 'awaiting_delivery',
      ).length,
      ready: activeOrders.filter((order) => order.status === 'ready_for_pickup').length,
      paymentIssues: completedJobsWithPaymentIssues.length,
      completed: completedOrders.length,
      all: orders.length,
    }),
    [activeOrders, completedJobsWithPaymentIssues.length, completedOrders.length, orders],
  )

  const todaySummary = useMemo(() => {
    const today = getWATDateKey(new Date())
    const todays = orders.filter((order) => getWATDateKey(order.created_at) === today)
    return {
      jobs: todays.length,
      toDo: todays.filter((order) => isActiveDeskJob(order)).length,
      owed: todays
        .filter((order) => order.status !== 'cancelled')
        .reduce((sum, order) => sum + Number(order.balanceDue || 0), 0),
    }
  }, [orders])

  async function handleJobCreated(message) {
    setShowNewJob(false)
    await refreshAfterJobChange(message)
  }

  async function refreshAfterJobChange(message) {
    await loadDashboard(summaryDate)
    setStatusMessage(message)
  }

  async function handleStatusChange(orderId, value) {
    try {
      await updateOrderQuickFields(orderId, { status: value })
      await refreshAfterJobChange('Job status updated successfully.')
    } catch (error) {
      setStatusMessage(`Could not update status: ${error.message}`)
    }
  }

  function updateQueueEdit(orderId, key, value) {
    setQueueEdits((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        [key]: value,
      },
    }))
  }

  async function handleSaveQueueDetails(order) {
    const draft = queueEdits[order.id]
    if (!draft) return

    const nextQuantity = Math.max(1, Number(draft.quantity || 1))
    const nextUnitPrice = Number(draft.unitPrice || 0)
    const nextAmountPaid = Number(draft.amountPaid || 0)

    if (Number.isNaN(nextQuantity) || nextQuantity <= 0) {
      setStatusMessage('Quantity must be at least 1.')
      return
    }

    if (Number.isNaN(nextUnitPrice) || nextUnitPrice < 0) {
      setStatusMessage('Unit price cannot be negative.')
      return
    }

    if (Number.isNaN(nextAmountPaid) || nextAmountPaid < 0) {
      setStatusMessage('Amount paid cannot be negative.')
      return
    }

    setSavingOrderId(order.id)
    try {
      const payload = {
        deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
      }

      if (isOwner) {
        if (!order.items?.length) {
          payload.quantity = nextQuantity
          payload.unit_price = String(nextUnitPrice)
        }
        payload.amount_paid = String(nextAmountPaid)
      }

      await updateOrderQuickFields(order.id, payload)
      await refreshAfterJobChange('Queue job details updated successfully.')
    } catch (error) {
      setStatusMessage(`Could not update job details: ${error.message}`)
    } finally {
      setSavingOrderId(null)
    }
  }

  function updateCollectDraft(orderId, key, value) {
    setCollectDrafts((current) => ({
      ...current,
      [orderId]: { amount: '', agreedTotal: '', discountReason: '', ...current[orderId], [key]: value },
    }))
  }

  function getCollectPreview(order) {
    const draft = collectDrafts[order.id] || {}
    const total = Number(order.totalAmount || 0)
    const alreadyPaid = Number(order.amountPaid || 0)
    const hasAgreed = draft.agreedTotal !== undefined && draft.agreedTotal !== ''
    const agreed = hasAgreed ? Number(draft.agreedTotal) : Number(order.amountDue || total)
    return {
      total,
      alreadyPaid,
      hasAgreed,
      discount: Math.max(0, total - agreed),
      leftToPay: Math.max(0, agreed - alreadyPaid),
      invalid: hasAgreed && (Number.isNaN(agreed) || agreed < alreadyPaid || agreed > total),
    }
  }

  async function handleCollectPayment(order) {
    const draft = collectDrafts[order.id] || {}
    const amount = Number(draft.amount || 0)
    const preview = getCollectPreview(order)

    if (!amount || amount <= 0) {
      setStatusMessage('Enter the amount received before recording the payment.')
      return
    }
    if (preview.invalid) {
      setStatusMessage(
        `The discounted price must be between ${formatCurrency(preview.alreadyPaid)} (already paid) and ${formatCurrency(preview.total)} (job total).`,
      )
      return
    }

    setCollectingOrderId(order.id)
    try {
      await createPaymentRecord({
        job: order.id,
        source: 'job',
        amount: String(amount),
        note: 'Collected at the front desk.',
        ...(preview.hasAgreed
          ? { agreed_total: String(Number(draft.agreedTotal)), discount_reason: String(draft.discountReason || '').trim() }
          : {}),
      })
      setCollectDrafts((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
      await refreshAfterJobChange(`Payment of ${formatCurrency(amount)} recorded for job #${order.id}.`)
    } catch (error) {
      setStatusMessage(`Could not record payment: ${error.message}`)
    } finally {
      setCollectingOrderId(null)
    }
  }

  function toggleOrderExpanded(orderId) {
    setExpandedOrderId((current) => (current === orderId ? null : orderId))
  }

  return (
    <>
      <TeamNavbar />
      <main className="min-h-screen bg-[#F4F8FC] pb-12">
        <TeamPageHeader
          title="Today"
          subtitle={new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        >
          <button
            type="button"
            onClick={() => setShowNewJob((current) => !current)}
            aria-expanded={showNewJob}
            className="btn-primary inline-flex min-h-[48px] w-full items-center justify-center gap-2 sm:w-auto"
          >
            {showNewJob ? <X size={18} /> : <Plus size={18} />}
            {showNewJob ? 'Close new job' : 'New job'}
          </button>
        </TeamPageHeader>

        <section className="container-shell py-6">
          {statusMessage ? (
            <div className="mb-5 border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-slate-700 shadow-sm">
              {statusMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Jobs today" value={todaySummary.jobs} />
            <SummaryStat label="Still to do" value={todaySummary.toDo} />
            <SummaryStat label="Owed on today's jobs" value={formatCurrency(todaySummary.owed)} alert={todaySummary.owed > 0} />
            <SummaryStat label="Paid in today" value={formatCurrency(dailySummary?.total_revenue ?? 0)} />
          </div>

          {showNewJob ? (
            <section id="new-job" className="mt-5 border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-extrabold text-navy">New job</h2>
              <p className="mt-1 text-sm text-slate-600">Fill it in like the paper job order form.</p>
              <div className="mt-5">
                <JobOrderForm
                  customers={customers}
                  jobTypes={jobCategories}
                  onCreated={handleJobCreated}
                  onError={setStatusMessage}
                />
              </div>
            </section>
          ) : null}

          <section id="desk-job-list" className="mt-5 border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-navy">Jobs</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Older jobs are in{' '}
                  <Link to="/team/records" className="font-semibold text-navy underline underline-offset-2">
                    Records
                  </Link>
                  .
                </p>
              </div>
              {loading ? <span className="text-sm text-slate-500">Loading...</span> : null}
            </div>

            <label className="mt-4 flex min-h-[44px] items-center gap-2 border border-slate-300 bg-white px-3">
              <Search size={16} className="text-slate-500" />
              <input
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="w-full bg-transparent py-2 text-[15px] outline-none placeholder:text-slate-500"
                placeholder="Search name, phone or job"
                aria-label="Search jobs"
              />
            </label>

            <div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {queueViewOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setQueueView(option.value)}
                      className={`min-h-[44px] border px-3 text-sm font-semibold transition ${
                        queueView === option.value
                          ? 'border-navy bg-navy text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-navy hover:text-navy'
                      }`}
                    >
                      {option.label}
                      <span className="ml-2 text-xs opacity-80">
                        {option.value === 'needs_attention'
                          ? queueCounts.needsAttention
                          : option.value === 'in_progress'
                            ? queueCounts.inProgress
                            : option.value === 'ready'
                              ? queueCounts.ready
                              : option.value === 'payment_issues'
                                ? queueCounts.paymentIssues
                                : option.value === 'completed'
                                  ? queueCounts.completed
                                  : queueCounts.all}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-5 space-y-4">
                  {visibleQueueOrders.length ? (
                    visibleQueueOrders.map((order) => {
                  const queueDraft = queueEdits[order.id] || {
                    quantity: String(Math.max(1, Number(order.quantity || 1))),
                    unitPrice: String(Number(order.unitPrice || 0)),
                    amountPaid: String(Number(order.amountPaid || 0)),
                    deadline: toDateTimeLocalValue(order.deadline),
                  }
                  const draftTotal = order.items?.length
                    ? Number(order.totalAmount || 0)
                    : Math.max(1, Number(queueDraft.quantity || 1)) * Number(queueDraft.unitPrice || 0)
                  const draftBalance = Math.max(
                    0,
                    draftTotal - Number(order.discountAmount || 0) - Number(queueDraft.amountPaid || 0),
                  )
                  const isExpanded = expandedOrderId === order.id
                  const hasPaymentIssue = isCompletedWithPaymentIssue(order)
                  const isCompleted = isCompletedJob(order)
                  const createdDay = getWATDateKey(order.created_at)
                  const isFromEarlierDay = Boolean(createdDay) && createdDay !== getWATDateKey(new Date())

                    return (
                      <article
                        key={order.id}
                        className={`border p-4 shadow-sm ${
                          order.isOverdue
                            ? 'border-red-300 bg-red-50/50'
                            : hasPaymentIssue
                              ? 'border-amber-300 bg-amber-50/70'
                              : isCompleted
                                ? 'border-emerald-200 bg-emerald-50/60'
                                : 'border-slate-200 bg-white'
                        }`}
                      >
                      <button
                        type="button"
                        onClick={() => toggleOrderExpanded(order.id)}
                        className="flex w-full flex-col gap-4 text-left sm:flex-row sm:items-start sm:justify-between"
                        aria-expanded={isExpanded}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="text-slate-500">Job #{order.id}</span>
                            <span className="border border-slate-300 bg-white px-2 py-0.5 text-slate-700">
                              {titleCase(order.status)}
                            </span>
                            {order.isOverdue ? (
                              <span className="border border-red-300 bg-red-100 px-2 py-0.5 text-red-700">Overdue</span>
                            ) : null}
                            {isFromEarlierDay ? (
                              <span className="border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-600">
                                From {createdDay}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-2 text-lg font-extrabold text-slate-900">
                            {order.customerName || 'Walk-in'}
                          </h3>
                          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
                            {order.jobType && order.jobType !== 'walk_in' ? `${titleCase(order.jobType)} · ` : ''}
                            {order.description || 'No description added.'}
                          </p>
                          {order.deadline || order.discountAmount > 0 ? (
                            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                              {order.deadline ? <span>Due {formatDateTime(order.deadline)}</span> : null}
                              {order.discountAmount > 0 ? (
                                <span className="text-emerald-700" title={order.discountReason || undefined}>
                                  Discount {formatCurrency(order.discountAmount)}
                                </span>
                              ) : null}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
                          <div>
                            <p className="text-base font-extrabold text-slate-900">{formatCurrency(order.amountDue)}</p>
                            {Number(order.totalAmount || 0) === 0 ? (
                              <p className="text-sm font-semibold text-slate-500">Not priced yet</p>
                            ) : Number(order.balanceDue || 0) > 0 ? (
                              <p className={`text-sm font-semibold ${hasPaymentIssue ? 'text-red-700' : 'text-amber-700'}`}>
                                Owes {formatCurrency(order.balanceDue)}
                              </p>
                            ) : (
                              <p className="text-sm font-semibold text-emerald-700">Paid</p>
                            )}
                          </div>
                          <span className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-navy sm:mt-1 sm:min-h-0">
                            {isExpanded ? 'Hide details' : 'Details'}
                            <ChevronDown size={18} className={`shrink-0 transition ${isExpanded ? 'rotate-180' : ''}`} />
                          </span>
                        </div>
                      </button>

                    {isExpanded ? (
                      <>
                    {order.items?.length ? (
                      <div className="mt-4 border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                            <tr>
                              <th className="px-3 py-2">#</th>
                              <th className="px-3 py-2">Item</th>
                              <th className="px-3 py-2 text-right">Qty</th>
                              <th className="hidden px-3 py-2 text-right sm:table-cell">Rate</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((line, index) => (
                              <tr key={line.id || index} className="border-t border-slate-100">
                                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                                <td className="px-3 py-2 font-semibold text-slate-800">{line.description}</td>
                                <td className="px-3 py-2 text-right">{line.quantity}</td>
                                <td className="hidden px-3 py-2 text-right sm:table-cell">{formatCurrency(line.rate)}</td>
                                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(line.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-slate-200 text-sm">
                            <tr>
                              <td colSpan={5} className="px-3 py-2">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Total</span>
                                  <span className="font-bold">{formatCurrency(order.totalAmount)}</span>
                                </div>
                                {order.discountAmount > 0 ? (
                                  <div className="flex justify-between text-emerald-700">
                                    <span>Discount{order.discountReason ? ` (${order.discountReason})` : ''}</span>
                                    <span className="font-bold">-{formatCurrency(order.discountAmount)}</span>
                                  </div>
                                ) : null}
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Paid</span>
                                  <span className="font-bold">{formatCurrency(order.amountPaid)}</span>
                                </div>
                                <div className="flex justify-between text-base">
                                  <span className="font-semibold text-slate-800">Balance</span>
                                  <span className="font-extrabold text-navy">{formatCurrency(order.balanceDue)}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{titleCase(order.fulfilment)}</p>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <MiniValueCard label="Quantity" value={order.quantity || 1} />
                        <MiniValueCard label="Unit Price" value={formatCurrency(order.unitPrice || 0)} />
                        <MiniValueCard label="Total" value={formatCurrency(order.totalAmount)} />
                        <MiniValueCard label="Balance" value={formatCurrency(order.balanceDue)} />
                      </div>
                    )}

                    {order.customerPhone || order.customerEmail ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {order.customerPhone ? (
                          <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Phone
                            </span>
                            <span className="mt-1 block font-semibold text-slate-800">{order.customerPhone}</span>
                          </div>
                        ) : null}
                        {order.customerEmail ? (
                          <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Email
                            </span>
                            <span className="mt-1 block break-all font-semibold text-slate-800">{order.customerEmail}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Deadline
                        </span>
                        <span className="mt-1 block font-semibold text-slate-800">
                          {formatDateTime(order.deadline)}
                        </span>
                      </div>

                      <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Balance Due
                        </span>
                        <span className="mt-1 block font-semibold text-slate-800">
                          {formatCurrency(order.balanceDue)}
                        </span>
                      </div>
                    </div>

                    {order.specialInstructions ? (
                      <div className="mt-4 border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Submission Details
                        </span>
                        <p className="mt-2 whitespace-pre-line leading-6">{order.specialInstructions}</p>
                      </div>
                    ) : null}

                    {order.projectScopeNote ? (
                      <div className="mt-4 border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Request Notes
                        </span>
                        <p className="mt-2 whitespace-pre-line leading-6">{order.projectScopeNote}</p>
                      </div>
                    ) : null}

                    {Number(order.balanceDue || 0) > 0 && order.status !== 'cancelled' ? (
                      (() => {
                        const collectDraft = collectDrafts[order.id] || {}
                        const collectPreview = getCollectPreview(order)
                        return (
                          <div className="mt-4 border border-navy/20 bg-white px-4 py-4">
                            <p className="text-sm font-bold text-navy">Take payment</p>
                            <h4 className="mt-1 text-base font-extrabold text-slate-900">
                              Balance {formatCurrency(order.balanceDue)}
                              {order.discountAmount > 0 ? (
                                <span className="ml-2 text-sm font-semibold text-emerald-700">
                                  (after {formatCurrency(order.discountAmount)} discount)
                                </span>
                              ) : null}
                            </h4>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <label className="text-sm font-semibold text-slate-700">
                                Amount received
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={collectDraft.amount || ''}
                                  onChange={(e) => updateCollectDraft(order.id, 'amount', e.target.value)}
                                  className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                                  placeholder="0.00"
                                />
                              </label>
                              <label className="text-sm font-semibold text-slate-700">
                                Discounted price (optional)
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={collectDraft.agreedTotal || ''}
                                  onChange={(e) => updateCollectDraft(order.id, 'agreedTotal', e.target.value)}
                                  className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                                  placeholder={`Agreed total, full price ${formatCurrency(collectPreview.total)}`}
                                />
                              </label>
                              <label className="text-sm font-semibold text-slate-700">
                                Discount reason
                                <input
                                  value={collectDraft.discountReason || ''}
                                  onChange={(e) => updateCollectDraft(order.id, 'discountReason', e.target.value)}
                                  disabled={!collectPreview.hasAgreed}
                                  className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy disabled:cursor-not-allowed disabled:bg-slate-100"
                                  placeholder="e.g. Bulk order, loyal customer"
                                />
                              </label>
                            </div>

                            {collectPreview.hasAgreed ? (
                              collectPreview.invalid ? (
                                <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                  The discounted price must be between {formatCurrency(collectPreview.alreadyPaid)} (already
                                  paid) and {formatCurrency(collectPreview.total)} (job total).
                                </p>
                              ) : (
                                <p className="mt-3 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                  Discount <span className="font-bold">{formatCurrency(collectPreview.discount)}</span>. Customer
                                  pays <span className="font-bold">{formatCurrency(collectPreview.leftToPay)}</span> to close this
                                  job.
                                </p>
                              )
                            ) : null}

                            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                              <button
                                type="button"
                                onClick={() => updateCollectDraft(order.id, 'amount', String(collectPreview.leftToPay))}
                                disabled={collectPreview.invalid}
                                className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy disabled:opacity-50"
                              >
                                Use full balance {formatCurrency(collectPreview.leftToPay)}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCollectPayment(order)}
                                disabled={collectingOrderId === order.id}
                                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                              >
                                {collectingOrderId === order.id ? 'Recording...' : 'Record Payment'}
                              </button>
                            </div>
                          </div>
                        )
                      })()
                    ) : null}

                    {isOwner ? (
                      <div className="mt-4 border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Owner only
                            </p>
                            <h4 className="mt-1 text-base font-extrabold text-slate-900">
                              Change prices, amount paid or deadline
                            </h4>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {order.items?.length ? null : (
                          <>
                              <label className="text-sm font-semibold text-slate-700">
                                Quantity
                                <input
                                  type="number"
                                  min="1"
                                  value={queueDraft.quantity}
                                  onChange={(e) => updateQueueEdit(order.id, 'quantity', e.target.value)}
                                  className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy disabled:cursor-not-allowed disabled:bg-slate-100"
                                />
                              </label>

                              <label className="text-sm font-semibold text-slate-700">
                                Unit price
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={queueDraft.unitPrice}
                                  onChange={(e) => updateQueueEdit(order.id, 'unitPrice', e.target.value)}
                                  className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy disabled:cursor-not-allowed disabled:bg-slate-100"
                                />
                              </label>
                          </>
                        )}

                          <label className="text-sm font-semibold text-slate-700">
                            Amount paid (correction)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={queueDraft.amountPaid}
                              onChange={(e) => updateQueueEdit(order.id, 'amountPaid', e.target.value)}
                              className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy disabled:cursor-not-allowed disabled:bg-slate-100"
                            />
                          </label>

                          <label className="text-sm font-semibold text-slate-700">
                            Deadline
                            <input
                              type="datetime-local"
                              value={queueDraft.deadline}
                              onChange={(e) => updateQueueEdit(order.id, 'deadline', e.target.value)}
                              className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                            />
                          </label>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <MiniValueCard label="Edited Total" value={formatCurrency(draftTotal)} />
                          <MiniValueCard label="Edited Balance" value={formatCurrency(draftBalance)} />
                        </div>

                        <div className="mt-4 flex flex-col items-stretch gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-slate-600">
                            Project details stay visible here while you adjust quantity, payment, and due date.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSaveQueueDetails(order)}
                            disabled={savingOrderId === order.id}
                            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          >
                            {savingOrderId === order.id ? 'Saving...' : 'Save Queue Details'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <label className="flex-1 text-sm font-semibold text-slate-700">
                            Deadline
                            <input
                              type="datetime-local"
                              value={queueDraft.deadline}
                              onChange={(e) => updateQueueEdit(order.id, 'deadline', e.target.value)}
                              className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleSaveQueueDetails(order)}
                            disabled={savingOrderId === order.id}
                            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          >
                            {savingOrderId === order.id ? 'Saving...' : 'Save Deadline'}
                          </button>
                        </div>
                      </div>
                    )}

                    {order.attachments?.length ? (
                      <div className="mt-4 border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Uploaded Assets
                        </span>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {order.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-navy transition hover:border-navy hover:bg-navy hover:text-white"
                            >
                              {attachment.originalName} ({formatFileSize(attachment.sizeBytes)})
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {hasPaymentIssue ? (
                      <div className="mt-4 border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                        Done, but the customer still owes {formatCurrency(order.balanceDue)}. Take payment above.
                      </div>
                    ) : null}

                    {order.isOverdue ? (
                      <div className="mt-4 border border-red-300 bg-red-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-red-700">
                        Overdue job
                      </div>
                    ) : null}

                    {isCompleted && !hasPaymentIssue ? (
                      <div className="mt-4 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                        Completed job details remain available here for future review.
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-col items-stretch gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-semibold text-slate-600">
                        Status: <span className="text-slate-900">{titleCase(order.status)}</span>
                      </div>
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className="w-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-navy sm:w-auto"
                      >
                        {orderStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {titleCase(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                      </>
                    ) : null}
                      </article>
                    )
                  })
                ) : (
                  <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    {orders.length
                      ? 'No jobs today match your current search or filter.'
                      : 'No jobs yet today. Earlier jobs are in Records.'}
                  </div>
                )}
                </div>

                {filteredQueueOrders.length > visibleQueueCount ? (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleQueueCount((current) => current + 6)}
                      className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy"
                    >
                      Show 6 More Jobs
                    </button>
                  </div>
                ) : null}
              </div>
          </section>
        </section>
      </main>
    </>
  )
}

function MiniValueCard({ label, value, compact = false }) {
  return (
    <div
      className={`min-w-0 border border-slate-200 bg-slate-50 ${
        compact ? 'px-3 py-3' : 'px-4 py-3'
      }`}
    >
      <p
        className={`font-semibold uppercase text-slate-500 ${
          compact ? 'text-xs leading-4 tracking-[0.08em]' : 'text-xs tracking-[0.14em]'
        }`}
      >
        {label}
      </p>
      <p className={`mt-2 font-extrabold text-slate-900 ${compact ? 'text-lg' : 'text-xl'}`}>{value}</p>
    </div>
  )
}

function AlertRow({ label, value, danger }) {
  return (
    <div
      className={`flex flex-col gap-2 border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
        danger
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      <span className="font-semibold">{label}</span>
      <span className="text-base font-extrabold">{value}</span>
    </div>
  )
}

export default TeamOrdersDashboard

function SummaryStat({ label, value, alert = false }) {
  return (
    <div className={`border px-4 py-3 ${alert ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
