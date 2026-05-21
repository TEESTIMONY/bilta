import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import TeamNavbar from '../components/TeamNavbar'
import { useAuth } from '../context/authContext'
import { getDailySummary, getOrdersData } from '../services/ordersService'
import {
  createPaymentRecord,
  createPhotocopySession,
  getPaymentRecordsData,
  getPhotocopySessionsData,
  getSystemSetting,
  updateSystemSetting,
} from '../services/operationsService'

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
  const [setting, setSetting] = useState(null)
  const [priceInput, setPriceInput] = useState('')
  const [photocopyForm, setPhotocopyForm] = useState(defaultPhotocopyForm)
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm)
  const [loading, setLoading] = useState(true)
  const [submittingPhotocopy, setSubmittingPhotocopy] = useState(false)
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const loadOperationsData = useCallback(async (targetDate = summaryDate) => {
    setLoading(true)
    try {
      const [summaryData, paymentData, sessionData, settingData, orderData] = await Promise.all([
        getDailySummary(targetDate),
        getPaymentRecordsData(),
        getPhotocopySessionsData(),
        getSystemSetting(),
        getOrdersData(),
      ])

      setDailySummary(summaryData.summary)
      setPayments(paymentData.payments)
      setSessions(sessionData.sessions)
      setSetting(settingData.setting)
      setJobs(orderData.orders)
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

  const completedUnpaidJobs = useMemo(() => {
    return selectedDateCompletedJobs.filter((job) => job.paymentStatus !== 'paid')
  }, [selectedDateCompletedJobs])

  function goToDeskUnpaidCompletedJob() {
    if (!completedUnpaidJobs.length) return
    const targetJobId = completedUnpaidJobs[0]?.id
    if (!targetJobId) return
    navigate(`/team/orders?focusJobId=${encodeURIComponent(targetJobId)}`)
  }

  const completedJobsSummary = useMemo(() => {
    return selectedDateCompletedJobs.reduce(
      (summary, job) => ({
        count: summary.count + 1,
        totalValue: summary.totalValue + Number(job.totalAmount || 0),
        amountReceived: summary.amountReceived + Number(job.amountPaid || 0),
        outstanding: summary.outstanding + Number(job.balanceDue || 0),
      }),
      {
        count: 0,
        totalValue: 0,
        amountReceived: 0,
        outstanding: 0,
      },
    )
  }, [selectedDateCompletedJobs])

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

    setSubmittingPayment(true)
    try {
      await createPaymentRecord({
        amount: String(Number(paymentForm.amount || 0)),
        source: paymentForm.mode,
        job: paymentForm.mode === 'job' ? Number(paymentForm.jobId) : null,
        service_label: paymentForm.mode === 'walk_in' ? paymentForm.serviceLabel.trim() : '',
        note: paymentForm.note.trim(),
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
      <main className="bg-[#F4F8FC]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#102848] via-[#17365d] to-[#214672] py-10 text-white">
          <div className="pointer-events-none absolute -left-8 top-6 h-28 w-28 bg-yellow/20 blur-3xl" />
          <div className="pointer-events-none absolute right-8 top-10 h-24 w-24 bg-white/10 blur-3xl" />
          <div className="container-shell relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow">
              Daily Records
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              Record photocopy work, payments, and daily totals.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-100 sm:text-base">
              Enter photocopy readings, add payments, and check the day&apos;s summary in one place.
            </p>
          </div>
        </section>

        <section className="container-shell py-8 md:py-10">
          {statusMessage ? (
            <div className="mb-6 border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-slate-700 shadow-sm">
              {statusMessage}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="space-y-6">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Today
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Day Summary</h2>
                  </div>
                  <input
                    type="date"
                    value={summaryDate}
                    onChange={(e) => setSummaryDate(e.target.value)}
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-navy sm:w-auto"
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ValueCard label="Jobs Created" value={dailySummary?.jobs_created ?? 0} />
                  <ValueCard label="Jobs Completed" value={dailySummary?.jobs_completed ?? 0} />
                  <ValueCard label="Payments Received" value={dailySummary?.payments_received ?? 0} />
                  <ValueCard label="Photocopy Sessions" value={dailySummary?.photocopy_sessions ?? 0} />
                  <ValueCard label="Total Revenue" value={formatCurrency(dailySummary?.total_revenue ?? 0)} />
                  <ValueCard label="Photocopy Revenue" value={formatCurrency(dailySummary?.photocopy_revenue ?? 0)} />
                </div>

                <div className="mt-5 grid gap-3">
                  <AlertRow
                    label="Completed jobs without full payment"
                    value={dailySummary?.anomalies?.completed_unpaid_jobs ?? 0}
                    danger={(dailySummary?.anomalies?.completed_unpaid_jobs ?? 0) > 0}
                    actionLabel={(dailySummary?.anomalies?.completed_unpaid_jobs ?? 0) > 0 ? 'View jobs' : ''}
                    onAction={(dailySummary?.anomalies?.completed_unpaid_jobs ?? 0) > 0 ? goToDeskUnpaidCompletedJob : null}
                  />
                  <AlertRow
                    label="Photocopy discrepancies"
                    value={dailySummary?.anomalies?.photocopy_discrepancies ?? 0}
                    danger={(dailySummary?.anomalies?.photocopy_discrepancies ?? 0) > 0}
                  />
                  <AlertRow
                    label="Outstanding balances"
                    value={formatCurrency(dailySummary?.outstanding_balances ?? 0)}
                    danger={Number(dailySummary?.outstanding_balances ?? 0) > 0}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Completed Jobs
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Jobs Done Today</h2>
                  </div>
                  <div className="border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                    {summaryDate}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ValueCard label="Jobs Done" value={completedJobsSummary.count} />
                  <ValueCard
                    label="Completed Job Value"
                    value={formatCurrency(completedJobsSummary.totalValue)}
                  />
                  <ValueCard
                    label="Amount Collected"
                    value={formatCurrency(completedJobsSummary.amountReceived)}
                  />
                  <ValueCard
                    label="Outstanding Balance"
                    value={formatCurrency(completedJobsSummary.outstanding)}
                    tone={completedJobsSummary.outstanding > 0 ? 'alert' : 'normal'}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {completedUnpaidJobs.length ? (
                    <div id="completed-unpaid-jobs" className="border border-amber-300 bg-amber-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                        Needs Payment Follow-up
                      </p>
                      <p className="mt-1 text-sm text-amber-900">
                        {completedUnpaidJobs.length} completed job{completedUnpaidJobs.length === 1 ? '' : 's'} still have outstanding payment.
                      </p>
                    </div>
                  ) : null}

                  {selectedDateCompletedJobs.length ? (
                    selectedDateCompletedJobs.map((job) => (
                      <article key={job.id} className="border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">
                              Job #{job.id} - {job.customerName || 'Walk-in'}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {titleCase(job.jobType)} - Completed {formatDateTime(job.updated_at || job.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-extrabold text-navy">
                              {formatCurrency(job.totalAmount)}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {titleCase(job.paymentStatus)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {job.description || 'No job description added.'}
                        </p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                            Paid: <span className="font-bold text-slate-900">{formatCurrency(job.amountPaid)}</span>
                          </div>
                          <div className="border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                            Balance:{' '}
                            <span className="font-bold text-slate-900">{formatCurrency(job.balanceDue)}</span>
                          </div>
                          <div className="border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                            Qty: <span className="font-bold text-slate-900">{job.quantity || 1}</span>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      No completed jobs recorded for this date yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                          onChange={(e) => setPaymentForm((current) => ({ ...current, jobId: e.target.value }))}
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

                  <div className="grid gap-3 sm:grid-cols-3">
                    <ValueCard label="Payments Today" value={selectedDatePayments.length} />
                    <ValueCard label="Walk-in Entries" value={paymentSummary.walkIn} />
                    <ValueCard label="Logged Total" value={formatCurrency(paymentSummary.total)} />
                  </div>

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
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Payment History
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Payments for {summaryDate}</h2>
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
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
            </section>
          </div>

          <section className="mt-8 border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Logged {formatDateTime(session.createdAt)}
                        </p>
                        <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                          {session.staffName || 'Staff session'}
                        </h3>
                      </div>
                      <span
                        className={`border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
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
          </section>
        </section>
      </main>
      <Footer />
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-extrabold text-slate-900">{value}</p>
    </div>
  )
}

function AlertRow({ label, value, danger, actionLabel = '', onAction = null }) {
  return (
    <div
      className={`flex flex-col gap-2 border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
        danger
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-base font-extrabold">{value}</span>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="border border-current px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] transition hover:bg-white/50"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default TeamOperationsPage
