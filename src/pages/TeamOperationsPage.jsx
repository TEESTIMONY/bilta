import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import TeamPageHeader from '../components/TeamPageHeader'
import TeamNavbar from '../components/TeamNavbar'
import { useAuth } from '../context/authContext'
import {
  getDailySummary,
  getJobsForDate,
  getOrdersData,
  updateOrderQuickFields,
} from '../services/ordersService'
import {
  createPaymentRecord,
  createPhotocopySession,
  getPaymentRecordsData,
  getPhotocopySessionsData,
  getSystemSetting,
  updateSystemSetting,
} from '../services/operationsService'

const jobStatusOptions = [
  'pending',
  'in_progress',
  'ready_for_pickup',
  'awaiting_delivery',
  'completed',
  'cancelled',
]

const defaultPhotocopyForm = {
  openingReading: '',
  closingReading: '',
  actualCashCollected: '',
}

const defaultPaymentForm = {
  mode: 'walk_in',
  amount: '',
  jobId: '',
  serviceLabel: '',
  note: '',
  agreedTotal: '',
  discountReason: '',
}

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
  if (!value) return 'No timestamp'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'No timestamp'
  return parsed.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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

function TeamOperationsPage() {
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const [summaryDate, setSummaryDate] = useState(getTodayDateValue())
  const [dailySummary, setDailySummary] = useState(null)
  const [payments, setPayments] = useState([])
  const [sessions, setSessions] = useState([])
  const [jobs, setJobs] = useState([])
  const [dayJobs, setDayJobs] = useState([])
  const [savingJobId, setSavingJobId] = useState(null)
  const [setting, setSetting] = useState(null)
  const [priceInput, setPriceInput] = useState('')
  const [photocopyForm, setPhotocopyForm] = useState(defaultPhotocopyForm)
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm)
  const [loading, setLoading] = useState(true)
  const [submittingPhotocopy, setSubmittingPhotocopy] = useState(false)
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [tab, setTab] = useState('jobs')
  const [jobFilter, setJobFilter] = useState('all')
  const [openJobId, setOpenJobId] = useState(null)

  const loadOperationsData = useCallback(async (targetDate = summaryDate) => {
    setLoading(true)
    try {
      const [summaryData, paymentData, sessionData, settingData, orderData, dayJobData] = await Promise.all([
        getDailySummary(targetDate),
        getPaymentRecordsData(targetDate),
        getPhotocopySessionsData(targetDate),
        getSystemSetting(),
        getOrdersData(),
        getJobsForDate(targetDate),
      ])

      setDailySummary(summaryData.summary)
      setPayments(paymentData.payments)
      setSessions(sessionData.sessions)
      setSetting(settingData.setting)
      setJobs(orderData.orders)
      setDayJobs(dayJobData.orders)
      setPriceInput(settingData.setting ? String(settingData.setting.photocopyPricePerCopy || '') : '')
    } catch (error) {
      setStatusMessage(`Failed to load daily records: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [summaryDate])

  useEffect(() => {
    loadOperationsData(summaryDate)
  }, [loadOperationsData, summaryDate])

  const photocopyPreview = useMemo(() => {
    const opening = Number(photocopyForm.openingReading || 0)
    const closing = Number(photocopyForm.closingReading || 0)
    const totalCopies = Math.max(0, closing - opening)
    const pricePerCopy = Number(setting?.photocopyPricePerCopy || 0)
    const expectedRevenue = totalCopies * pricePerCopy
    const actualCash = Number(photocopyForm.actualCashCollected || 0)
    const revenueGap = actualCash - expectedRevenue

    return { totalCopies, expectedRevenue, revenueGap }
  }, [photocopyForm.actualCashCollected, photocopyForm.closingReading, photocopyForm.openingReading, setting?.photocopyPricePerCopy])

  const selectedDatePayments = useMemo(() => {
    return payments.filter((item) => getWATDateKey(item.createdAt) === summaryDate)
  }, [payments, summaryDate])

  const selectedDateSessions = useMemo(() => {
    return sessions.filter((item) => getWATDateKey(item.createdAt) === summaryDate)
  }, [sessions, summaryDate])

  const paymentSummary = useMemo(() => {
    const total = selectedDatePayments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const walkIn = selectedDatePayments.filter((item) => item.source === 'walk_in').length
    const linkedJobs = selectedDatePayments.filter((item) => item.source === 'job').length
    return { total, walkIn, linkedJobs }
  }, [selectedDatePayments])

  const selectedDateCompletedJobs = useMemo(() => {
    return jobs
      .filter(
        (item) =>
          item.status === 'completed' &&
          getWATDateKey(item.updated_at || item.created_at) === summaryDate,
      )
      .sort((left, right) => {
        const leftTime = new Date(left.updated_at || left.created_at || 0).getTime()
        const rightTime = new Date(right.updated_at || right.created_at || 0).getTime()
        return rightTime - leftTime
      })
  }, [jobs, summaryDate])

  async function handleJobStatusChange(jobId, status) {
    setSavingJobId(jobId)
    try {
      await updateOrderQuickFields(jobId, { status })
      await loadOperationsData(summaryDate)
      setStatusMessage(`Job #${jobId} updated.`)
    } catch (error) {
      setStatusMessage(`Could not update job #${jobId}: ${error.message}`)
    } finally {
      setSavingJobId(null)
    }
  }

  // Everything taken in on this day: job and walk-in payments plus photocopy cash.
  const moneyCollected = useMemo(() => {
    const payments = paymentSummary.total
    const photocopies = selectedDateSessions.reduce((sum, session) => sum + Number(session.actualCashCollected || 0), 0)
    return { payments, photocopies, total: payments + photocopies }
  }, [paymentSummary.total, selectedDateSessions])

  // Jobs added on this day, plus jobs from earlier days that were finished on it.
  const recordJobs = useMemo(() => {
    const byId = new Map()
    for (const job of [...dayJobs, ...selectedDateCompletedJobs]) byId.set(job.id, job)
    const rank = (job) => {
      if (job.status === 'cancelled') return 3
      if (job.status !== 'completed') return 0
      return Number(job.balanceDue || 0) > 0 ? 1 : 2
    }
    return [...byId.values()].sort(
      (a, b) => rank(a) - rank(b) || new Date(b.created_at || 0) - new Date(a.created_at || 0),
    )
  }, [dayJobs, selectedDateCompletedJobs])

  const recordCounts = useMemo(() => {
    const live = recordJobs.filter((job) => job.status !== 'cancelled')
    return {
      all: recordJobs.length,
      done: recordJobs.filter((job) => job.status === 'completed').length,
      open: live.filter((job) => job.status !== 'completed').length,
      owes: live.filter((job) => Number(job.balanceDue || 0) > 0).length,
      owed: live.reduce((sum, job) => sum + Number(job.balanceDue || 0), 0),
    }
  }, [recordJobs])

  const filteredRecordJobs = useMemo(() => {
    if (jobFilter === 'done') return recordJobs.filter((job) => job.status === 'completed')
    if (jobFilter === 'open') return recordJobs.filter((job) => job.status !== 'completed' && job.status !== 'cancelled')
    if (jobFilter === 'owes') {
      return recordJobs.filter((job) => job.status !== 'cancelled' && Number(job.balanceDue || 0) > 0)
    }
    return recordJobs
  }, [jobFilter, recordJobs])

  function startPaymentForJob(job) {
    setPaymentForm({ ...defaultPaymentForm, mode: 'job', jobId: String(job.id) })
    setTab('payments')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const payableJobs = useMemo(() => {
    return jobs.filter((item) => item.status !== 'cancelled' && item.paymentStatus !== 'paid')
  }, [jobs])

  async function handleSavePrice() {
    if (!setting?.id) {
      setStatusMessage('System setting record is not available yet.')
      return
    }

    if (!priceInput || Number(priceInput) <= 0) {
      setStatusMessage('Photocopy price must be greater than zero.')
      return
    }

    setSavingPrice(true)
    try {
      const updated = await updateSystemSetting(setting.id, {
        photocopy_price_per_copy: String(Number(priceInput || 0)),
      })
      setSetting(updated)
      setPriceInput(String(updated.photocopyPricePerCopy || ''))
      setStatusMessage('Photocopy price updated successfully.')
    } catch (error) {
      setStatusMessage(`Could not save price: ${error.message}`)
    } finally {
      setSavingPrice(false)
    }
  }

  async function handleSubmitPhotocopy(e) {
    e.preventDefault()

    if (!setting?.photocopyPricePerCopy) {
      setStatusMessage('Set the photocopy price before logging a session.')
      return
    }

    if (Number(photocopyForm.closingReading || 0) < Number(photocopyForm.openingReading || 0)) {
      setStatusMessage('Closing reading cannot be less than opening reading.')
      return
    }

    setSubmittingPhotocopy(true)
    try {
      await createPhotocopySession({
        opening_reading: Number(photocopyForm.openingReading || 0),
        closing_reading: Number(photocopyForm.closingReading || 0),
        price_per_copy: String(Number(setting.photocopyPricePerCopy || 0)),
        actual_cash_collected: String(Number(photocopyForm.actualCashCollected || 0)),
      })

      setPhotocopyForm(defaultPhotocopyForm)
      await loadOperationsData(summaryDate)
      setStatusMessage('Photocopy session logged successfully.')
    } catch (error) {
      setStatusMessage(`Could not log photocopy session: ${error.message}`)
    } finally {
      setSubmittingPhotocopy(false)
    }
  }

  const selectedPaymentJob = useMemo(
    () => (paymentForm.mode === 'job' ? jobs.find((job) => String(job.id) === String(paymentForm.jobId)) : null),
    [jobs, paymentForm.jobId, paymentForm.mode],
  )

  const discountPreview = useMemo(() => {
    if (!selectedPaymentJob) return null
    const total = Number(selectedPaymentJob.totalAmount || 0)
    const alreadyPaid = Number(selectedPaymentJob.amountPaid || 0)
    const hasAgreed = paymentForm.agreedTotal !== ''
    const agreed = hasAgreed ? Number(paymentForm.agreedTotal) : Number(selectedPaymentJob.amountDue || total)
    return {
      total,
      alreadyPaid,
      hasAgreed,
      agreed,
      discount: Math.max(0, total - agreed),
      leftToPay: Math.max(0, agreed - alreadyPaid),
      invalid: hasAgreed && (Number.isNaN(agreed) || agreed < alreadyPaid || agreed > total),
    }
  }, [paymentForm.agreedTotal, selectedPaymentJob])

  async function handleSubmitPayment(e) {
    e.preventDefault()

    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setStatusMessage('Payment amount must be greater than zero.')
      return
    }

    if (paymentForm.mode === 'job' && !paymentForm.jobId) {
      setStatusMessage('Choose a job before recording a linked payment.')
      return
    }

    if (paymentForm.mode === 'walk_in' && !paymentForm.serviceLabel.trim()) {
      setStatusMessage('Enter the walk-in service label before saving.')
      return
    }

    if (discountPreview?.hasAgreed && discountPreview.invalid) {
      setStatusMessage(
        `The agreed price must be between ${formatCurrency(discountPreview.alreadyPaid)} (already paid) and ${formatCurrency(discountPreview.total)} (job total).`,
      )
      return
    }

    setSubmittingPayment(true)
    try {
      await createPaymentRecord({
        amount: String(Number(paymentForm.amount || 0)),
        source: paymentForm.mode,
        job: paymentForm.mode === 'job' ? Number(paymentForm.jobId) : null,
        service_label: paymentForm.mode === 'walk_in' ? paymentForm.serviceLabel.trim() : '',
        note: paymentForm.note.trim(),
        ...(paymentForm.mode === 'job' && paymentForm.agreedTotal !== ''
          ? {
              agreed_total: String(Number(paymentForm.agreedTotal)),
              discount_reason: paymentForm.discountReason.trim(),
            }
          : {}),
      })

      setPaymentForm(defaultPaymentForm)
      await loadOperationsData(summaryDate)
      setStatusMessage('Payment recorded successfully.')
    } catch (error) {
      setStatusMessage(`Could not record payment: ${error.message}`)
    } finally {
      setSubmittingPayment(false)
    }
  }

  return (
    <>
      <TeamNavbar />
      <main className="min-h-screen bg-[#F4F8FC] pb-12">
        <TeamPageHeader
          title="Records"
          subtitle={
            isOwner
              ? 'Pick a day to see its jobs, payments and photocopies.'
              : 'Pick a day to see your jobs, payments and photocopies. You only see your own work.'
          }
        >
            <label className="block text-sm font-semibold text-slate-700">
              Day
              <input
                type="date"
                value={summaryDate}
                onChange={(e) => setSummaryDate(e.target.value)}
                className="mt-1 block min-h-[44px] w-full border border-slate-300 bg-white px-3 text-[15px] outline-none transition focus:border-navy sm:w-auto"
              />
            </label>
        </TeamPageHeader>

        <section className="container-shell py-6">
          {statusMessage ? (
            <div className="mb-5 border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-slate-700 shadow-sm">
              {statusMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryStat
              label="Total collected"
              value={formatCurrency(moneyCollected.total)}
              note={`Payments ${formatCurrency(moneyCollected.payments)} + photocopies ${formatCurrency(moneyCollected.photocopies)}`}
              strong
            />
            <SummaryStat label="Jobs added" value={dayJobs.length} />
            <SummaryStat label="Owed on these jobs" value={formatCurrency(recordCounts.owed)} alert={recordCounts.owed > 0} />
          </div>
          {(dailySummary?.anomalies?.photocopy_discrepancies ?? 0) > 0 ? (
            <p className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {dailySummary.anomalies.photocopy_discrepancies} photocopy session
              {dailySummary.anomalies.photocopy_discrepancies === 1 ? '' : 's'} on this day had cash that didn&apos;t match the copies.
            </p>
          ) : null}

          <div role="tablist" aria-label="Records" className="mt-5 grid grid-cols-3 gap-2">
            {[
              { value: 'jobs', label: 'Jobs', count: recordCounts.all },
              { value: 'payments', label: 'Payments', count: selectedDatePayments.length },
              { value: 'photocopies', label: 'Photocopies', count: selectedDateSessions.length },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={tab === option.value}
                onClick={() => setTab(option.value)}
                className={`min-h-[48px] border px-2 text-sm font-bold transition sm:text-base ${
                  tab === option.value
                    ? 'border-navy bg-navy text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-navy hover:text-navy'
                }`}
              >
                {option.label} <span className="font-semibold opacity-80">{option.count}</span>
              </button>
            ))}
          </div>

          {tab === 'jobs' ? (
            <section className="mt-4 border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'All', count: recordCounts.all },
                  { value: 'done', label: 'Done', count: recordCounts.done },
                  { value: 'open', label: 'Still open', count: recordCounts.open },
                  { value: 'owes', label: 'Owes money', count: recordCounts.owes },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setJobFilter(option.value)}
                    className={`min-h-[44px] border px-3 text-sm font-semibold transition ${
                      jobFilter === option.value
                        ? 'border-navy bg-navy text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-navy hover:text-navy'
                    }`}
                  >
                    {option.label} <span className="ml-1 opacity-80">{option.count}</span>
                  </button>
                ))}
              </div>

              <div className="mt-3 divide-y divide-slate-200">
                {filteredRecordJobs.length ? (
                  filteredRecordJobs.map((job) => {
                    const balance = Number(job.balanceDue || 0)
                    const isOpenRow = openJobId === job.id
                    return (
                      <article key={job.id}>
                        <button
                          type="button"
                          onClick={() => setOpenJobId((current) => (current === job.id ? null : job.id))}
                          aria-expanded={isOpenRow}
                          className="flex min-h-[56px] w-full items-center gap-3 py-3 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900">
                              <span className="text-slate-500">#{job.id}</span> {job.customerName || 'Walk-in'}
                            </p>
                            <p className="truncate text-sm text-slate-600">
                              {job.description || titleCase(job.jobType)} · {titleCase(job.status)}
                            </p>
                            {isOwner ? (
                              <span
                                className={`mt-1 inline-block border px-2 py-0.5 text-xs font-semibold ${
                                  job.createdByName
                                    ? 'border-navy/30 bg-navy/5 text-navy'
                                    : 'border-violet-300 bg-violet-50 text-violet-800'
                                }`}
                              >
                                {job.createdByName ? `Added by ${job.createdByName}` : 'Website order'}
                              </span>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-extrabold text-slate-900">{formatCurrency(job.amountDue)}</p>
                            <p className={`text-sm font-semibold ${jobMoneyTone(job)}`}>{jobMoneyLabel(job)}</p>
                          </div>
                          <ChevronDown
                            size={18}
                            className={`shrink-0 text-slate-500 transition ${isOpenRow ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isOpenRow ? (
                          <div className="mb-3 space-y-3 border border-slate-200 bg-slate-50 p-3 text-sm">
                            {job.items?.length ? (
                              <ul className="space-y-1">
                                {job.items.map((line, index) => (
                                  <li key={line.id || index} className="flex justify-between gap-3">
                                    <span>
                                      {line.quantity} × {line.description}
                                    </span>
                                    <span className="font-semibold">{formatCurrency(line.amount)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-slate-700">{job.description || 'No job description added.'}</p>
                            )}

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700 sm:grid-cols-4">
                              <span>
                                Total <span className="font-semibold">{formatCurrency(job.totalAmount)}</span>
                              </span>
                              {job.discountAmount > 0 ? (
                                <span className="text-emerald-700">
                                  Discount <span className="font-semibold">{formatCurrency(job.discountAmount)}</span>
                                </span>
                              ) : null}
                              <span>
                                Paid <span className="font-semibold">{formatCurrency(job.amountPaid)}</span>
                              </span>
                              <span>
                                Balance <span className="font-semibold">{formatCurrency(balance)}</span>
                              </span>
                            </div>
                            {job.discountReason ? <p className="text-emerald-700">Discount reason: {job.discountReason}</p> : null}
                            <p className="text-slate-500">
                              Added {formatDateTime(job.created_at)}
                              {job.createdByName ? ` by ${job.createdByName}` : ''}
                              {job.fulfilment ? ` · ${titleCase(job.fulfilment)}` : ''}
                            </p>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <select
                                value={job.status}
                                disabled={savingJobId === job.id}
                                onChange={(e) => handleJobStatusChange(job.id, e.target.value)}
                                aria-label={`Status for job #${job.id}`}
                                className="min-h-[44px] w-full border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition focus:border-navy disabled:opacity-60 sm:w-auto"
                              >
                                {jobStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {titleCase(status)}
                                  </option>
                                ))}
                              </select>
                              {balance > 0 && job.status !== 'cancelled' ? (
                                <button
                                  type="button"
                                  onClick={() => startPaymentForJob(job)}
                                  className="btn-primary min-h-[44px] w-full sm:w-auto"
                                >
                                  Take payment
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => navigate(`/team/orders?focusJobId=${encodeURIComponent(job.id)}`)}
                                className="min-h-[44px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy"
                              >
                                Open full details
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500">
                    {loading ? 'Loading jobs...' : 'No jobs here for this day.'}
                  </p>
                )}
              </div>
            </section>
          ) : null}

          {tab === 'payments' ? (
            <div className="mt-4 grid gap-6 xl:grid-cols-2 xl:items-start">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Payments
                    </p>
                  <h2 className="mt-1 text-2xl font-extrabold text-navy">Add Payment</h2>
                </div>

                <form onSubmit={handleSubmitPayment} className="mt-6 space-y-4">
                  <div className="grid gap-2 sm:flex sm:flex-wrap">
                    {[
                      { value: 'walk_in', label: 'Walk-in Service' },
                      { value: 'job', label: 'Linked to Job' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPaymentForm((current) => ({ ...current, mode: option.value, jobId: '', serviceLabel: '' }))}
                        className={`w-full border px-3 py-2 text-sm font-semibold transition sm:w-auto sm:py-1.5 ${
                          paymentForm.mode === option.value
                            ? 'border-navy bg-navy text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-navy hover:text-navy'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Amount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((current) => ({ ...current, amount: e.target.value }))}
                        className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                        placeholder="0.00"
                      />
                    </label>

                    {paymentForm.mode === 'job' ? (
                      <label className="block text-sm font-semibold text-slate-700">
                        Link to job with balance
                        <select
                          value={paymentForm.jobId}
                          onChange={(e) =>
                            setPaymentForm((current) => ({
                              ...current,
                              jobId: e.target.value,
                              agreedTotal: '',
                              discountReason: '',
                            }))
                          }
                          className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                        >
                          <option value="">Select job</option>
                          {payableJobs.map((job) => (
                            <option key={job.id} value={job.id}>
                              #{job.id} - {job.customerName || 'Walk-in'} - {titleCase(job.jobType)} - {formatCurrency(job.balanceDue)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="block text-sm font-semibold text-slate-700">
                        Service label
                        <input
                          value={paymentForm.serviceLabel}
                          onChange={(e) => setPaymentForm((current) => ({ ...current, serviceLabel: e.target.value }))}
                          className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                          placeholder="Photocopy, printing, binding..."
                        />
                      </label>
                    )}
                  </div>

                  {selectedPaymentJob && discountPreview ? (
                    <div className="border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                        <p>
                          Job total: <span className="font-bold text-slate-900">{formatCurrency(discountPreview.total)}</span>
                        </p>
                        <p>
                          Already paid:{' '}
                          <span className="font-bold text-slate-900">{formatCurrency(discountPreview.alreadyPaid)}</span>
                        </p>
                        <p>
                          Balance: <span className="font-bold text-slate-900">{formatCurrency(selectedPaymentJob.balanceDue)}</span>
                        </p>
                      </div>
                      {selectedPaymentJob.discountAmount > 0 ? (
                        <p className="mt-2 text-sm text-slate-600">
                          Current discount:{' '}
                          <span className="font-bold text-slate-900">{formatCurrency(selectedPaymentJob.discountAmount)}</span>
                          {selectedPaymentJob.discountReason ? ` (${selectedPaymentJob.discountReason})` : ''}
                        </p>
                      ) : null}

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="block text-sm font-semibold text-slate-700">
                          Agreed price (after discount) <span className="font-normal text-slate-500">(optional)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={paymentForm.agreedTotal}
                            onChange={(e) => setPaymentForm((current) => ({ ...current, agreedTotal: e.target.value }))}
                            className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                            placeholder={`Agreed total, e.g. less than ${formatCurrency(discountPreview.total)}`}
                          />
                        </label>
                        <label className="block text-sm font-semibold text-slate-700">
                          Discount reason
                          <input
                            value={paymentForm.discountReason}
                            onChange={(e) => setPaymentForm((current) => ({ ...current, discountReason: e.target.value }))}
                            disabled={!discountPreview.hasAgreed}
                            className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy disabled:bg-slate-100"
                            placeholder="e.g. Bulk order, loyal customer"
                          />
                        </label>
                      </div>

                      {discountPreview.hasAgreed ? (
                        discountPreview.invalid ? (
                          <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            The agreed price must be between {formatCurrency(discountPreview.alreadyPaid)} (already paid) and{' '}
                            {formatCurrency(discountPreview.total)} (job total).
                          </p>
                        ) : (
                          <div className="mt-3 flex flex-col gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                              Discount <span className="font-bold">{formatCurrency(discountPreview.discount)}</span>. Customer pays{' '}
                              <span className="font-bold">{formatCurrency(discountPreview.leftToPay)}</span> to close this job.
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPaymentForm((current) => ({ ...current, amount: String(discountPreview.leftToPay) }))
                              }
                              className="border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:border-emerald-500"
                            >
                              Use {formatCurrency(discountPreview.leftToPay)} as amount
                            </button>
                          </div>
                        )
                      ) : null}
                    </div>
                  ) : null}

                  <label className="block text-sm font-semibold text-slate-700">
                    Note
                    <textarea
                      value={paymentForm.note}
                      onChange={(e) => setPaymentForm((current) => ({ ...current, note: e.target.value }))}
                      className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      rows={3}
                      placeholder="Optional note about the payment"
                    />
                  </label>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingPayment}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {submittingPayment ? 'Saving Payment...' : 'Record Payment'}
                    </button>
                  </div>
                </form>
              </div>
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Payment History
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Payments for {summaryDate}</h2>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      Total: {formatCurrency(paymentSummary.total)}
                      <span className="ml-1 text-sm font-normal text-slate-600">
                        ({selectedDatePayments.length} payment{selectedDatePayments.length === 1 ? '' : 's'})
                      </span>
                    </p>
                  </div>
                  {loading ? <span className="text-sm text-slate-500">Loading...</span> : null}
                </div>

                <div className="mt-5 space-y-3">
                  {selectedDatePayments.length ? (
                    selectedDatePayments.map((payment) => (
                      <article key={payment.id} className="border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">
                              {payment.source === 'job'
                                ? `Job Payment${payment.jobId ? ` #${payment.jobId}` : ''}`
                                : payment.serviceLabel || 'Walk-in Service'}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {payment.recordedByName || 'Unknown staff'} • {formatDateTime(payment.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-extrabold text-navy">{formatCurrency(payment.amount)}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {titleCase(payment.source)}
                            </p>
                          </div>
                        </div>
                        {payment.note ? (
                          <p className="mt-3 text-sm leading-6 text-slate-600">{payment.note}</p>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      No payment records for this date yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'photocopies' ? (
            <div className="mt-4 grid gap-6 xl:grid-cols-2 xl:items-start">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Photocopy
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Record Copies</h2>
                  </div>
                  <div className="border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                    Price per copy: {formatCurrency(setting?.photocopyPricePerCopy ?? 0)}
                  </div>
                </div>

                {isOwner ? (
                  <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block text-sm font-semibold text-slate-700">
                      Admin price per copy
                      <input
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                        placeholder="50"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSavePrice}
                      disabled={savingPrice}
                      className="w-full border border-navy px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {savingPrice ? 'Saving...' : 'Save Price'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Only the owner/admin can change the photocopy price. Staff can still use the saved
                    rate for session logging.
                  </div>
                )}

                <form onSubmit={handleSubmitPhotocopy} className="mt-6 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="block text-sm font-semibold text-slate-700">
                      Opening reading
                      <input
                        type="number"
                        min="0"
                        value={photocopyForm.openingReading}
                        onChange={(e) => setPhotocopyForm((current) => ({ ...current, openingReading: e.target.value }))}
                        className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Closing reading
                      <input
                        type="number"
                        min="0"
                        value={photocopyForm.closingReading}
                        onChange={(e) => setPhotocopyForm((current) => ({ ...current, closingReading: e.target.value }))}
                        className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Actual cash collected
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={photocopyForm.actualCashCollected}
                        onChange={(e) => setPhotocopyForm((current) => ({ ...current, actualCashCollected: e.target.value }))}
                        className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <ValueCard label="Total Copies" value={photocopyPreview.totalCopies} />
                    <ValueCard label="Expected Revenue" value={formatCurrency(photocopyPreview.expectedRevenue)} />
                    <ValueCard
                      label="Gap"
                      value={formatCurrency(photocopyPreview.revenueGap)}
                      tone={photocopyPreview.revenueGap === 0 ? 'normal' : 'alert'}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingPhotocopy}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {submittingPhotocopy ? 'Logging Session...' : 'Log Photocopy Session'}
                    </button>
                  </div>
                </form>
              </div>
                  <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Photocopy History
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Sessions for {summaryDate}</h2>
                  </div>
                  <span className="border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
                    {selectedDateSessions.length} session{selectedDateSessions.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {selectedDateSessions.length ? (
                    selectedDateSessions.map((session) => (
                      <article
                        key={session.id}
                        className={`border p-4 shadow-sm ${
                          session.hasDiscrepancy ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Logged {formatDateTime(session.createdAt)}
                            </p>
                            <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                              {session.staffName || 'Staff session'}
                            </h3>
                          </div>
                          <span
                            className={`border px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] ${
                              session.hasDiscrepancy
                                ? 'border-red-300 bg-red-100 text-red-700'
                                : 'border-emerald-300 bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {session.hasDiscrepancy ? 'Flagged' : 'Balanced'}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <ValueCard label="Opening" value={session.openingReading} compact />
                          <ValueCard label="Closing" value={session.closingReading} compact />
                          <ValueCard label="Total Copies" value={session.totalCopies} compact />
                          <ValueCard label="Expected" value={formatCurrency(session.expectedRevenue)} compact />
                          <ValueCard label="Actual Cash" value={formatCurrency(session.actualCashCollected)} compact />
                          <ValueCard
                            label="Gap"
                            value={formatCurrency(session.revenueGap)}
                            tone={session.hasDiscrepancy ? 'alert' : 'normal'}
                            compact
                          />
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 lg:col-span-2">
                      No photocopy sessions recorded for this date yet.
                    </div>
                  )}
                </div>
                  </div>
            </div>
          ) : null}
        </section>
      </main>
    </>
  )
}

function ValueCard({ label, value, tone = 'normal', compact = false }) {
  const toneClass =
    tone === 'alert'
      ? 'border-red-200 bg-red-50'
      : 'border-slate-200 bg-slate-50'

  return (
    <div className={`${toneClass} border px-4 ${compact ? 'py-3' : 'py-3'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-extrabold text-slate-900">{value}</p>
    </div>
  )
}

export default TeamOperationsPage

function jobMoneyLabel(job) {
  if (job.status === 'cancelled') return 'Cancelled'
  if (Number(job.totalAmount || 0) === 0) return 'Not priced yet'
  const balance = Number(job.balanceDue || 0)
  return balance > 0 ? `Owes ${formatCurrency(balance)}` : 'Paid'
}

function jobMoneyTone(job) {
  if (job.status === 'cancelled' || Number(job.totalAmount || 0) === 0) return 'text-slate-500'
  return Number(job.balanceDue || 0) > 0 ? 'text-red-700' : 'text-emerald-700'
}

function SummaryStat({ label, value, note = '', alert = false, strong = false }) {
  const tone = alert
    ? 'border-red-200 bg-red-50'
    : strong
      ? 'col-span-2 border-navy/30 bg-navy/5 sm:col-span-1'
      : 'border-slate-200 bg-white'
  return (
    <div className={`border px-4 py-3 ${tone}`}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${alert ? 'text-red-700' : strong ? 'text-navy' : 'text-slate-900'}`}>{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-600">{note}</p> : null}
    </div>
  )
}
