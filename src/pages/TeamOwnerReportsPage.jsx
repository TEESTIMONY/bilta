import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import TeamNavbar from '../components/TeamNavbar'
import { getDailySummary, getOrdersData } from '../services/ordersService'
import {
  getAuditLogsData,
  getPaymentRecordsData,
  getPhotocopySessionsData,
} from '../services/operationsService'

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

function TeamOwnerReportsPage() {
  const navigate = useNavigate()
  const [reportDate, setReportDate] = useState(getTodayDateValue())
  const [dailySummary, setDailySummary] = useState(null)
  const [jobs, setJobs] = useState([])
  const [payments, setPayments] = useState([])
  const [sessions, setSessions] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [staffFilter, setStaffFilter] = useState('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')

  const loadOwnerData = useCallback(async (targetDate = reportDate) => {
    setLoading(true)
    try {
      const [summaryData, ordersData, paymentData, sessionData, auditData] = await Promise.all([
        getDailySummary(targetDate),
        getOrdersData(),
        getPaymentRecordsData(),
        getPhotocopySessionsData(),
        getAuditLogsData(),
      ])

      setDailySummary(summaryData.summary)
      setJobs(ordersData.orders)
      setPayments(paymentData.payments)
      setSessions(sessionData.sessions)
      setAuditLogs(auditData.auditLogs)
    } catch (error) {
      setStatusMessage(`Failed to load owner reports: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [reportDate])

  useEffect(() => {
    loadOwnerData(reportDate)
  }, [loadOwnerData, reportDate])

  const selectedDateJobs = useMemo(() => {
    return jobs.filter((job) => getWATDateKey(job.created_at) === reportDate)
  }, [jobs, reportDate])

  const selectedDateCompletedJobs = useMemo(() => {
    return jobs.filter(
      (job) =>
        job.status === 'completed' &&
        getWATDateKey(job.updated_at || job.created_at) === reportDate,
    )
  }, [jobs, reportDate])

  const selectedDatePayments = useMemo(() => {
    return payments.filter((payment) => getWATDateKey(payment.createdAt) === reportDate)
  }, [payments, reportDate])

  const selectedDateSessions = useMemo(() => {
    return sessions.filter((session) => getWATDateKey(session.createdAt) === reportDate)
  }, [sessions, reportDate])

  const selectedDateAuditLogs = useMemo(() => {
    return auditLogs.filter((entry) => getWATDateKey(entry.createdAt) === reportDate)
  }, [auditLogs, reportDate])

  const staffOptions = useMemo(() => {
    const names = new Set()

    selectedDatePayments.forEach((payment) => {
      if (payment.recordedByName) names.add(payment.recordedByName)
    })
    selectedDateSessions.forEach((session) => {
      if (session.staffName) names.add(session.staffName)
    })
    selectedDateAuditLogs.forEach((entry) => {
      if (entry.performedByName) names.add(entry.performedByName)
    })

    return Array.from(names).sort((left, right) => left.localeCompare(right))
  }, [selectedDateAuditLogs, selectedDatePayments, selectedDateSessions])

  const completedUnpaidJobs = useMemo(() => {
    return selectedDateCompletedJobs.filter((job) => job.paymentStatus !== 'paid')
  }, [selectedDateCompletedJobs])

  function handleViewUnpaidCompletedJobs() {
    if (!completedUnpaidJobs.length) return
    const targetJobId = completedUnpaidJobs[0]?.id
    if (!targetJobId) return
    navigate(`/team/orders?focusJobId=${encodeURIComponent(targetJobId)}`)
  }

  const overdueActiveJobs = useMemo(() => {
    return jobs.filter((job) => job.status !== 'completed' && job.status !== 'cancelled' && job.isOverdue)
  }, [jobs])

  const filteredAuditLogs = useMemo(() => {
    const query = auditSearch.trim().toLowerCase()

    return selectedDateAuditLogs.filter((entry) => {
      if (staffFilter !== 'all' && entry.performedByName !== staffFilter) {
        return false
      }

      if (!query) return true

      const haystack = [
        entry.action,
        entry.modelName,
        entry.performedByName,
        entry.reason,
        entry.objectId,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [auditSearch, selectedDateAuditLogs, staffFilter])

  const flaggedAuditLogs = useMemo(() => {
    return filteredAuditLogs.filter(
      (entry) => entry.modelName === 'PaymentRecord' || entry.reason || entry.action === 'delete',
    )
  }, [filteredAuditLogs])

  const discrepancyOverview = useMemo(() => {
    const photocopyGapTotal = selectedDateSessions.reduce(
      (sum, session) => sum + Math.abs(Number(session.revenueGap || 0)),
      0,
    )
    const discrepancySessions = selectedDateSessions.filter((session) => session.hasDiscrepancy).length
    const paymentEdits = selectedDateAuditLogs.filter(
      (entry) => entry.modelName === 'PaymentRecord' && entry.action === 'update',
    ).length

    return {
      photocopyGapTotal,
      discrepancySessions,
      paymentEdits,
    }
  }, [selectedDateAuditLogs, selectedDateSessions])

  const staffSummary = useMemo(() => {
    const summaryMap = new Map()

    function getBucket(name) {
      const key = name || 'Unknown staff'
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          name: key,
          paymentsCount: 0,
          paymentsTotal: 0,
          sessionCount: 0,
          discrepancyCount: 0,
          auditCount: 0,
          flaggedEdits: 0,
        })
      }
      return summaryMap.get(key)
    }

    selectedDatePayments.forEach((payment) => {
      const bucket = getBucket(payment.recordedByName)
      bucket.paymentsCount += 1
      bucket.paymentsTotal += Number(payment.amount || 0)
    })

    selectedDateSessions.forEach((session) => {
      const bucket = getBucket(session.staffName)
      bucket.sessionCount += 1
      if (session.hasDiscrepancy) {
        bucket.discrepancyCount += 1
      }
    })

    selectedDateAuditLogs.forEach((entry) => {
      const bucket = getBucket(entry.performedByName)
      bucket.auditCount += 1
      if (entry.modelName === 'PaymentRecord' && entry.action === 'update') {
        bucket.flaggedEdits += 1
      }
    })

    const values = Array.from(summaryMap.values())
    values.sort((left, right) => {
      const scoreRight =
        right.paymentsTotal + right.auditCount * 50 + right.sessionCount * 25 + right.flaggedEdits * 10
      const scoreLeft =
        left.paymentsTotal + left.auditCount * 50 + left.sessionCount * 25 + left.flaggedEdits * 10
      return scoreRight - scoreLeft
    })
    return values
  }, [selectedDateAuditLogs, selectedDatePayments, selectedDateSessions])

  return (
    <>
      <TeamNavbar />
      <main className="bg-[#F4F8FC]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#102848] via-[#17365d] to-[#214672] py-10 text-white">
          <div className="pointer-events-none absolute -left-8 top-6 h-28 w-28 bg-yellow/20 blur-3xl" />
          <div className="pointer-events-none absolute right-8 top-10 h-24 w-24 bg-white/10 blur-3xl" />
          <div className="container-shell relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow">
              Owner Report
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
                  Check shop money, staff work, and problem areas in one place.
                </h1>
                <p className="mt-4 text-sm leading-6 text-slate-100 sm:text-base">
                  Check daily totals, staff activity, changes, and photocopy gaps from one screen.
                </p>
              </div>

              <label className="block w-full text-sm font-semibold text-slate-100 sm:w-auto">
                Date
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="mt-2 w-full border border-white/25 bg-white/10 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-200 focus:border-yellow sm:w-auto"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="container-shell py-8 md:py-10">
          {statusMessage ? (
            <div className="mb-6 border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-slate-700 shadow-sm">
              {statusMessage}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Money Made" value={formatCurrency(dailySummary?.total_revenue ?? 0)} />
            <StatCard
              label="Balance Left"
              value={formatCurrency(dailySummary?.outstanding_balances ?? 0)}
              tone={Number(dailySummary?.outstanding_balances ?? 0) > 0 ? 'alert' : 'normal'}
            />
            <StatCard
              label="Done Not Paid"
              value={completedUnpaidJobs.length}
              tone={completedUnpaidJobs.length > 0 ? 'alert' : 'normal'}
            />
            <StatCard
              label="Photocopy Gap"
              value={formatCurrency(discrepancyOverview.photocopyGapTotal)}
              tone={discrepancyOverview.photocopyGapTotal > 0 ? 'alert' : 'accent'}
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Quick Check
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Needs Attention</h2>
                  </div>
                  {loading ? <span className="text-sm text-slate-500">Loading...</span> : null}
                </div>

                <div className="mt-5 grid gap-3">
                  <AlertRow
                    label="Completed jobs with missing full payment"
                    value={completedUnpaidJobs.length}
                    danger={completedUnpaidJobs.length > 0}
                    actionLabel={completedUnpaidJobs.length > 0 ? 'View jobs' : ''}
                    onAction={completedUnpaidJobs.length > 0 ? handleViewUnpaidCompletedJobs : null}
                  />
                  <AlertRow
                    label="Photocopy sessions with discrepancies"
                    value={discrepancyOverview.discrepancySessions}
                    danger={discrepancyOverview.discrepancySessions > 0}
                  />
                  <AlertRow
                    label="Payment edits recorded in audit log"
                    value={discrepancyOverview.paymentEdits}
                    danger={discrepancyOverview.paymentEdits > 0}
                  />
                  <AlertRow
                    label="Active overdue jobs in queue"
                    value={overdueActiveJobs.length}
                    danger={overdueActiveJobs.length > 0}
                  />
                </div>
              </div>

              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Staff Work
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Staff Summary</h2>
                  </div>
                  <span className="border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
                    {staffSummary.length} active
                  </span>
                </div>

                <div className="mt-5 grid gap-4">
                  {staffSummary.length ? (
                    staffSummary.map((person) => (
                      <article key={person.name} className="border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">{person.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Audit actions {person.auditCount} | Payment edits {person.flaggedEdits}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-extrabold text-navy">
                              {formatCurrency(person.paymentsTotal)}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Payments logged
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <MiniValueCard label="Payments" value={person.paymentsCount} />
                          <MiniValueCard label="Sessions" value={person.sessionCount} />
                          <MiniValueCard
                            label="Discrepancies"
                            value={person.discrepancyCount}
                            tone={person.discrepancyCount > 0 ? 'alert' : 'normal'}
                          />
                          <MiniValueCard
                            label="Flagged Edits"
                            value={person.flaggedEdits}
                            tone={person.flaggedEdits > 0 ? 'alert' : 'normal'}
                          />
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      No staff activity has been logged for this date yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Problem Changes
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold text-navy">Changes and Issues</h2>
                </div>

                <div className="mt-5 space-y-3">
                  {flaggedAuditLogs.length ? (
                    flaggedAuditLogs.slice(0, 8).map((entry) => (
                      <article key={entry.id} className="border border-red-200 bg-red-50/70 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700">
                              {titleCase(entry.action)} {titleCase(entry.modelName)}
                            </p>
                            <h3 className="mt-1 text-base font-extrabold text-slate-900">
                              {entry.performedByName || 'Unknown staff'}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Record #{entry.objectId || 'N/A'} | {formatDateTime(entry.createdAt)}
                            </p>
                          </div>
                          <span className="border border-red-300 bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-red-700">
                            Review
                          </span>
                        </div>
                        {entry.reason ? (
                          <p className="mt-3 text-sm leading-6 text-slate-700">Reason: {entry.reason}</p>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            This action touches cash or a record that usually needs owner review.
                          </p>
                        )}
                      </article>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      No high-risk edits or anomalies for this date.
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Activity Log
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Search Log</h2>
                  </div>

                  <div className="grid w-full gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Staff
                      <select
                        value={staffFilter}
                        onChange={(e) => setStaffFilter(e.target.value)}
                        className="mt-2 w-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-navy"
                      >
                        <option value="all">All staff</option>
                        {staffOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Search
                      <input
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        className="mt-2 w-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-navy"
                        placeholder="PaymentRecord, update, username..."
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {filteredAuditLogs.length ? (
                    filteredAuditLogs.map((entry) => (
                      <article key={entry.id} className="border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {titleCase(entry.modelName)} | {titleCase(entry.action)}
                            </p>
                            <h3 className="mt-1 text-base font-extrabold text-slate-900">
                              {entry.performedByName || 'Unknown staff'}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Record #{entry.objectId || 'N/A'} | {formatDateTime(entry.createdAt)}
                            </p>
                          </div>
                          <span className="border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                            {titleCase(entry.action)}
                          </span>
                        </div>

                        {entry.reason ? (
                          <p className="mt-3 text-sm leading-6 text-slate-700">Reason: {entry.reason}</p>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      No audit records match this filter yet.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function StatCard({ label, value, tone = 'normal' }) {
  const toneClass =
    tone === 'alert'
      ? 'border-red-200 bg-red-50'
      : tone === 'accent'
        ? 'border-yellow/40 bg-yellow/20'
        : 'border-slate-200 bg-white'

  return (
    <div className={`${toneClass} border px-4 py-4 shadow-sm`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  )
}

function MiniValueCard({ label, value, tone = 'normal' }) {
  const toneClass = tone === 'alert' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'

  return (
    <div className={`${toneClass} border px-3 py-3`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-slate-900">{value}</p>
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

export default TeamOwnerReportsPage
