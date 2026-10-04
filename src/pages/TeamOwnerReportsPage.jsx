import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TeamPageHeader from '../components/TeamPageHeader'
import TeamNavbar from '../components/TeamNavbar'
import { getDailySummary, getOrdersData } from '../services/ordersService'
import {
  getAuditLogsData,
  getCashCounts,
  getPaymentRecordsData,
  getPhotocopySessionsData,
} from '../services/operationsService'
import { countResult } from '../utils/cashCount'

const ACTIVITY_PAGE_SIZE = 10

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

function formatTime(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
}

function formatDay(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
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

function jobLabel(id, customerName) {
  return customerName ? `job #${id} (${customerName})` : `job #${id}`
}

// One plain sentence for each activity entry, e.g. "recorded ₦5,000 for job #6 (UniqueZayt)".
function describeActivity(entry) {
  const m = entry.metadata || {}
  const id = entry.objectId
  const key = `${entry.modelName}:${entry.action}`

  switch (key) {
    case 'Job:create':
      return `added ${jobLabel(id, m.customer_name)}${m.total ? ` for ${formatCurrency(m.total)}` : ''}`
    case 'Job:update':
      if (m.status_to) {
        return `moved ${jobLabel(id, m.customer_name)} from ${titleCase(m.status_from)} to ${titleCase(m.status_to)}`
      }
      if (m.paid_to) {
        return `corrected the amount paid on ${jobLabel(id, m.customer_name)} from ${formatCurrency(m.paid_from)} to ${formatCurrency(m.paid_to)}`
      }
      return `edited ${jobLabel(id, m.customer_name)}`
    case 'Job:discount':
      return `gave ${formatCurrency(m.discount_amount)} off job #${m.job_id || id}`
    case 'PaymentRecord:create':
      if (!m.amount) return 'recorded a payment'
      return m.job_id
        ? `recorded ${formatCurrency(m.amount)} for ${jobLabel(m.job_id, m.customer_name)}`
        : `recorded ${formatCurrency(m.amount)} for ${m.service_label || 'a walk-in service'}`
    case 'PaymentRecord:update':
      return m.amount
        ? `changed a payment${m.job_id ? ` on job #${m.job_id}` : ''} from ${formatCurrency(m.amount_from)} to ${formatCurrency(m.amount)}`
        : 'changed a payment'
    case 'PaymentRecord:delete':
      return m.amount
        ? `deleted a ${formatCurrency(m.amount)} payment${m.job_id ? ` on job #${m.job_id}` : ''}`
        : 'deleted a payment'
    case 'Customer:create':
      return `added customer ${m.name || `#${id}`}`
    case 'Customer:update':
      return `updated customer ${m.name || `#${id}`}`
    case 'PhotocopySession:create':
      return m.copies !== undefined
        ? `logged ${m.copies} photocopies (${formatCurrency(m.collected)} collected)`
        : 'logged a photocopy session'
    case 'DailyCashCount:create':
    case 'DailyCashCount:update':
      return `${entry.action === 'update' ? 'recounted' : 'did the end-of-day count'}: cash ${formatCurrency(m.cash)} + transfers ${formatCurrency(
        m.transfer,
      )}${Number(m.difference) ? ` (${Number(m.difference) < 0 ? `${formatCurrency(-Number(m.difference))} short` : `${formatCurrency(m.difference)} over`})` : ' (matched)'}`
    case 'StaffAccount:update':
      return `updated ${m.username || 'a staff'} account`
    case 'StaffAccount:reset_password':
      return `reset the password for ${m.username || 'a staff account'}`
    case 'StaffInvitation:create':
      return `invited ${m.email || 'someone'} to join as ${titleCase(m.role || 'staff')}`
    default:
      return `${titleCase(entry.action).toLowerCase()} ${titleCase(entry.modelName).toLowerCase()} #${id}`
  }
}

function activityJobId(entry) {
  const m = entry.metadata || {}
  if (entry.modelName === 'Job') return Number(m.job_id || entry.objectId) || null
  if (entry.modelName === 'PaymentRecord') return Number(m.job_id) || null
  return null
}

function TeamOwnerReportsPage() {
  const navigate = useNavigate()
  const [reportDate, setReportDate] = useState(getTodayDateValue())
  const [dailySummary, setDailySummary] = useState(null)
  const [jobs, setJobs] = useState([])
  const [sessions, setSessions] = useState([])
  const [activity, setActivity] = useState([])
  const [cashCounts, setCashCounts] = useState([])
  const [payments, setPayments] = useState([])
  const [personFilter, setPersonFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(ACTIVITY_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')

  const loadReport = useCallback(async (targetDate) => {
    setLoading(true)
    setStatusMessage('')
    try {
      const [summaryData, ordersData, sessionData, auditData, countData, paymentData] = await Promise.all([
        getDailySummary(targetDate),
        getOrdersData(),
        getPhotocopySessionsData(targetDate),
        getAuditLogsData(targetDate),
        getCashCounts(targetDate),
        getPaymentRecordsData(targetDate),
      ])
      setDailySummary(summaryData.summary)
      setJobs(ordersData.orders)
      setSessions(sessionData.sessions)
      setActivity(auditData.auditLogs)
      setCashCounts(countData.counts)
      setPayments(paymentData.payments)
    } catch (error) {
      setStatusMessage(`Could not load the report: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReport(reportDate)
    setVisibleCount(ACTIVITY_PAGE_SIZE)
  }, [loadReport, reportDate])

  const openJob = (jobId) => navigate(`/team/orders?focusJobId=${encodeURIComponent(jobId)}`)

  const doneButOwing = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status === 'completed' &&
          Number(job.balanceDue || 0) > 0 &&
          getWATDateKey(job.updated_at || job.created_at) === reportDate,
      ),
    [jobs, reportDate],
  )

  const overdueJobs = useMemo(
    () => jobs.filter((job) => job.status !== 'completed' && job.status !== 'cancelled' && job.isOverdue),
    [jobs],
  )

  const photocopyShort = useMemo(
    () => sessions.reduce((sum, session) => sum + Math.max(0, -Number(session.revenueGap || 0)), 0),
    [sessions],
  )

  // Things the owner should look at, each with a way to act on it.
  const checks = useMemo(() => {
    const items = []
    for (const job of doneButOwing) {
      items.push({
        key: `owing-${job.id}`,
        text: `Job #${job.id} (${job.customerName || 'Walk-in'}) is done but still owes ${formatCurrency(job.balanceDue)}.`,
        jobId: job.id,
      })
    }
    for (const entry of activity) {
      const who = entry.performedByDisplay
      const isDiscount = entry.modelName === 'Job' && entry.action === 'discount'
      const isPaymentChange = entry.modelName === 'PaymentRecord' && (entry.action === 'update' || entry.action === 'delete')
      if (!isDiscount && !isPaymentChange) continue
      items.push({
        key: `activity-${entry.id}`,
        text: `${who} ${describeActivity(entry)}.`,
        detail: entry.reason ? `Reason: ${entry.reason}` : isDiscount ? 'No reason given.' : '',
        jobId: activityJobId(entry),
        time: formatTime(entry.createdAt),
      })
    }
    for (const count of cashCounts) {
      const result = countResult(count)
      if (result.tone === 'ok') continue
      items.push({
        key: `count-${count.id}`,
        text: `${count.staffName}'s end-of-day count is ${result.label}.`,
        detail: `Cash ${formatCurrency(count.cashAmount)} + transfers ${formatCurrency(count.transferAmount)} = ${formatCurrency(
          count.countedTotal,
        )}, but the CMS recorded ${formatCurrency(count.recordedTotal)}.${count.note ? ` Note: ${count.note}` : ''}`,
        time: formatTime(count.updatedAt),
        link: { label: 'See itemised count', to: `/team/expenses?date=${reportDate}&staff=${count.staffId}` },
      })
    }
    if (reportDate < getWATDateKey(new Date())) {
      const counted = new Set(cashCounts.map((count) => count.staffName))
      const tookMoney = new Set(
        [
          ...payments.filter((payment) => Number(payment.amount) > 0).map((payment) => payment.recordedByName),
          ...sessions.filter((session) => Number(session.actualCashCollected) > 0).map((session) => session.staffName),
        ].filter(Boolean),
      )
      for (const name of tookMoney) {
        if (counted.has(name)) continue
        items.push({ key: `nocount-${name}`, text: `${name} took money but didn't do an end-of-day count.` })
      }
    }
    for (const session of sessions) {
      const gap = Number(session.revenueGap || 0)
      if (!gap) continue
      items.push({
        key: `copies-${session.id}`,
        text: `${session.staffName || 'A staff member'}'s photocopy cash was ${formatCurrency(Math.abs(gap))} ${gap < 0 ? 'short' : 'over'}.`,
        detail: `${session.totalCopies} copies: expected ${formatCurrency(session.expectedRevenue)}, collected ${formatCurrency(session.actualCashCollected)}.`,
        time: formatTime(session.createdAt),
      })
    }
    for (const job of overdueJobs) {
      items.push({
        key: `overdue-${job.id}`,
        text: `Job #${job.id} (${job.customerName || 'Walk-in'}) is overdue${job.deadline ? `, it was due ${formatDay(job.deadline)}` : ''}.`,
        jobId: job.id,
      })
    }
    return items
  }, [activity, cashCounts, doneButOwing, overdueJobs, payments, reportDate, sessions])

  const people = useMemo(() => {
    const map = new Map()
    const personFor = (name) => {
      const key = name || 'Someone'
      if (!map.has(key)) {
        map.set(key, { name: key, jobs: 0, updates: 0, payments: 0, paymentTotal: 0, copies: 0, copyCash: 0, discounts: 0, other: 0 })
      }
      return map.get(key)
    }
    for (const entry of activity) {
      const key = `${entry.modelName}:${entry.action}`
      if (['PaymentRecord:create', 'PhotocopySession:create'].includes(key) || entry.modelName === 'DailyCashCount') continue
      const person = personFor(entry.performedByDisplay)
      if (key === 'Job:create') person.jobs += 1
      else if (key === 'Job:update') person.updates += 1
      else if (key === 'Job:discount') person.discounts += 1
      else person.other += 1
    }
    for (const payment of payments) {
      const person = personFor(payment.recordedByName)
      person.payments += 1
      person.paymentTotal += Number(payment.amount || 0)
    }
    for (const session of sessions) {
      const person = personFor(session.staffName)
      person.copies += 1
      person.copyCash += Number(session.actualCashCollected || 0)
    }
    for (const person of map.values()) person.takenTotal = person.paymentTotal + person.copyCash
    return [...map.values()].sort((a, b) => b.takenTotal - a.takenTotal || a.name.localeCompare(b.name))
  }, [activity, payments, sessions])

  const sentences = useMemo(
    () =>
      activity.map((entry) => ({
        id: entry.id,
        who: entry.performedByDisplay,
        text: describeActivity(entry),
        reason: entry.reason,
        time: formatTime(entry.createdAt),
        jobId: activityJobId(entry),
      })),
    [activity],
  )

  const filteredSentences = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sentences.filter(
      (row) =>
        (personFilter === 'all' || row.who === personFilter) &&
        (!query || `${row.who} ${row.text} ${row.reason || ''}`.toLowerCase().includes(query)),
    )
  }, [personFilter, search, sentences])

  return (
    <>
      <TeamNavbar />
      <main className="min-h-screen bg-[#F4F8FC] pb-12">
        <TeamPageHeader title="Reports" subtitle="Money, staff activity, and anything that needs checking.">
          <label className="block text-sm font-semibold text-slate-700">
            Day
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="mt-1 block min-h-[44px] w-full border border-slate-300 bg-white px-3 text-[15px] outline-none transition focus:border-navy sm:w-auto"
            />
          </label>
        </TeamPageHeader>

        <section className="container-shell py-6">
          {statusMessage ? (
            <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{statusMessage}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat
              label="Total collected"
              value={formatCurrency(Number(dailySummary?.total_revenue ?? 0) + Number(dailySummary?.photocopy_revenue ?? 0))}
              note={`Payments ${formatCurrency(dailySummary?.total_revenue ?? 0)} + photocopies ${formatCurrency(
                dailySummary?.photocopy_revenue ?? 0,
              )}`}
            />
            <SummaryStat
              label="Still owed on this day's jobs"
              value={formatCurrency(dailySummary?.outstanding_balances ?? 0)}
              alert={Number(dailySummary?.outstanding_balances ?? 0) > 0}
            />
            <SummaryStat label="Done but not fully paid" value={doneButOwing.length} alert={doneButOwing.length > 0} />
            <SummaryStat label="Photocopy cash short" value={formatCurrency(photocopyShort)} alert={photocopyShort > 0} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-extrabold text-navy">Needs checking</h2>
              {loading ? (
                <p className="mt-3 text-sm text-slate-500">Loading...</p>
              ) : checks.length ? (
                <ul className="mt-3 divide-y divide-slate-200">
                  {checks.map((item) => (
                    <li key={item.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-slate-900">{item.text}</p>
                        {item.detail || item.time ? (
                          <p className="mt-0.5 text-sm text-slate-600">
                            {[item.detail, item.time].filter(Boolean).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                      {item.jobId ? (
                        <button
                          type="button"
                          onClick={() => openJob(item.jobId)}
                          className="min-h-[44px] shrink-0 border border-slate-300 bg-white px-3 text-sm font-semibold text-navy transition hover:border-navy"
                        >
                          Open job #{item.jobId}
                        </button>
                      ) : item.link ? (
                        <button
                          type="button"
                          onClick={() => navigate(item.link.to)}
                          className="min-h-[44px] shrink-0 border border-slate-300 bg-white px-3 text-sm font-semibold text-navy transition hover:border-navy"
                        >
                          {item.link.label}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Nothing needs checking for this day.
                </p>
              )}
            </section>

            <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-extrabold text-navy">Staff</h2>
              {people.length ? (
                <ul className="mt-3 divide-y divide-slate-200">
                  {people.map((person) => (
                    <li key={person.name} className="py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-bold text-slate-900">{person.name}</p>
                        <p className="text-sm font-semibold text-slate-700">{formatCurrency(person.takenTotal)} taken</p>
                      </div>
                      {(() => {
                        const count = cashCounts.find((item) => item.staffName === person.name)
                        if (!count) {
                          return person.takenTotal > 0 ? (
                            <p className="mt-0.5 text-sm font-semibold text-slate-500">End-of-day count: not done</p>
                          ) : null
                        }
                        const result = countResult(count)
                        return (
                          <p
                            className={`mt-0.5 text-sm font-semibold ${
                              result.tone === 'ok' ? 'text-emerald-700' : result.tone === 'short' ? 'text-red-700' : 'text-amber-700'
                            }`}
                          >
                            End-of-day count: {result.tone === 'ok' ? '✓ matches' : result.label} (cash {formatCurrency(count.cashAmount)} +
                            transfers {formatCurrency(count.transferAmount)})
                          </p>
                        )
                      })()}
                      <p className="mt-0.5 text-sm text-slate-600">
                        {[
                          person.jobs ? `${person.jobs} job${person.jobs === 1 ? '' : 's'} added` : '',
                          person.updates ? `${person.updates} job${person.updates === 1 ? '' : 's'} updated` : '',
                          person.payments ? `${person.payments} payment${person.payments === 1 ? '' : 's'}` : '',
                          person.copies ? `${person.copies} photocopy session${person.copies === 1 ? '' : 's'}` : '',
                          person.discounts ? `${person.discounts} discount${person.discounts === 1 ? '' : 's'} given` : '',
                          person.other ? `${person.other} other change${person.other === 1 ? '' : 's'}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'No activity'}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{loading ? 'Loading...' : 'Nobody did anything in the CMS on this day.'}</p>
              )}
            </section>
          </div>

          <section className="mt-5 border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-extrabold text-navy">Everything that happened</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[14rem_1fr]">
              <label className="block text-sm font-semibold text-slate-700">
                Person
                <select
                  value={personFilter}
                  onChange={(e) => {
                    setPersonFilter(e.target.value)
                    setVisibleCount(ACTIVITY_PAGE_SIZE)
                  }}
                  className="mt-1 min-h-[44px] w-full border border-slate-300 bg-white px-3 text-[15px] outline-none transition focus:border-navy"
                >
                  <option value="all">Everyone</option>
                  {people.map((person) => (
                    <option key={person.name} value={person.name}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Search
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setVisibleCount(ACTIVITY_PAGE_SIZE)
                  }}
                  className="mt-1 min-h-[44px] w-full border border-slate-300 bg-white px-3 text-[15px] outline-none transition focus:border-navy"
                  placeholder="e.g. a customer name, job number or discount"
                />
              </label>
            </div>

            {filteredSentences.length ? (
              <ul className="mt-3 divide-y divide-slate-200">
                {filteredSentences.slice(0, visibleCount).map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[15px] text-slate-800">
                        <span className="font-semibold text-slate-900">{row.who}</span> {row.text}
                      </p>
                      {row.reason ? <p className="mt-0.5 text-sm text-slate-600">Reason: {row.reason}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm text-slate-500">{row.time}</span>
                      {row.jobId ? (
                        <button
                          type="button"
                          onClick={() => openJob(row.jobId)}
                          className="min-h-[36px] text-sm font-semibold text-navy underline underline-offset-2"
                        >
                          Open job
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">{loading ? 'Loading...' : 'Nothing matches.'}</p>
            )}

            {filteredSentences.length > visibleCount ? (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + ACTIVITY_PAGE_SIZE)}
                className="mt-3 min-h-[44px] w-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy"
              >
                Show more ({filteredSentences.length - visibleCount} left)
              </button>
            ) : null}
          </section>
        </section>
      </main>
    </>
  )
}

function SummaryStat({ label, value, note = '', alert = false }) {
  return (
    <div className={`border px-4 py-3 ${alert ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-600">{note}</p> : null}
    </div>
  )
}

export default TeamOwnerReportsPage
