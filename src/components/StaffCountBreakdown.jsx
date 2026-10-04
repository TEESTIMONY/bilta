import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

function formatCurrency(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )
}

function formatTime(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
}

function paymentLabel(payment) {
  if (payment.jobId) return `Job #${payment.jobId}${payment.customerName ? ` (${payment.customerName})` : ''}`
  return payment.serviceLabel || 'Walk-in service'
}

// For the owner: each person's day itemised, i.e. what they counted against every payment,
// photocopy session and takings expense behind the CMS figure.
function StaffCountBreakdown({ counts, payments, sessions, expenses, loading, initialOpenId = null }) {
  const [openId, setOpenId] = useState(initialOpenId)

  const people = useMemo(() => {
    const map = new Map()
    const personFor = (id, name) => {
      const key = id ?? `name:${name}`
      if (!map.has(key)) {
        map.set(key, { key, id, name: name || 'Unknown', count: null, payments: [], sessions: [], spent: [] })
      }
      const person = map.get(key)
      if (!person.name || person.name === 'Unknown') person.name = name || person.name
      return person
    }
    for (const count of counts) personFor(count.staffId, count.staffName).count = count
    for (const payment of payments) personFor(payment.recordedById, payment.recordedByName).payments.push(payment)
    for (const session of sessions) personFor(session.staffId, session.staffName).sessions.push(session)
    for (const expense of expenses) {
      if (expense.paidFromTakings) personFor(expense.paidById, expense.paidByName).spent.push(expense)
    }

    return [...map.values()]
      .map((person) => {
        const paymentTotal = person.payments.reduce((sum, item) => sum + item.amount, 0)
        const copyTotal = person.sessions.reduce((sum, item) => sum + item.actualCashCollected, 0)
        const spentTotal = person.spent.reduce((sum, item) => sum + item.amount, 0)
        const recorded = paymentTotal + copyTotal
        const expected = recorded - spentTotal
        const counted = person.count ? person.count.countedTotal : null
        const difference = counted === null ? null : counted - expected
        return { ...person, paymentTotal, copyTotal, spentTotal, recorded, expected, counted, difference }
      })
      .filter((person) => person.count || person.recorded || person.spentTotal)
      .sort((a, b) => {
        // Problems first: short, then not counted, then over, then matching.
        const rank = (p) => (p.difference === null ? 1 : p.difference < -0.005 ? 0 : p.difference > 0.005 ? 2 : 3)
        return rank(a) - rank(b) || a.name.localeCompare(b.name)
      })
  }, [counts, expenses, payments, sessions])

  return (
    <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-extrabold text-navy">Staff counts</h2>
      <p className="mt-1 text-sm text-slate-600">Tap a person to see everything behind their count.</p>

      {people.length ? (
        <ul className="mt-2 divide-y divide-slate-200">
          {people.map((person) => {
            const isOpen = openId === person.key || (openId !== null && openId === person.id)
            const status =
              person.difference === null
                ? { text: 'Not counted', className: 'text-slate-600' }
                : Math.abs(person.difference) < 0.005
                  ? { text: '✓ Matches', className: 'text-emerald-700' }
                  : person.difference < 0
                    ? { text: `${formatCurrency(-person.difference)} short`, className: 'text-red-700' }
                    : { text: `${formatCurrency(person.difference)} over`, className: 'text-amber-700' }
            return (
              <li key={person.key} id={`staff-count-${person.id ?? person.key}`}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : person.key)}
                  aria-expanded={isOpen}
                  className="flex min-h-[56px] w-full items-center gap-3 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{person.name}</p>
                    <p className="text-sm text-slate-600">
                      {person.counted === null ? 'No count' : `Counted ${formatCurrency(person.counted)}`} · Expected{' '}
                      {formatCurrency(person.expected)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${status.className}`}>{status.text}</span>
                  <ChevronDown size={18} className={`shrink-0 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen ? (
                  <div className="mb-3 space-y-4 border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div>
                      <p className="font-bold text-slate-900">What they counted</p>
                      {person.count ? (
                        <>
                          <p className="mt-1 text-slate-700">
                            Cash {formatCurrency(person.count.cashAmount)} + transfers {formatCurrency(person.count.transferAmount)} ={' '}
                            <span className="font-bold">{formatCurrency(person.counted)}</span>
                            <span className="text-slate-500"> · at {formatTime(person.count.updatedAt)}</span>
                          </p>
                          {person.count.note ? <p className="mt-1 text-slate-600">Their note: {person.count.note}</p> : null}
                        </>
                      ) : (
                        <p className="mt-1 text-slate-600">They haven&apos;t done an end-of-day count.</p>
                      )}
                    </div>

                    <div>
                      <p className="font-bold text-slate-900">
                        Payments they recorded ({person.payments.length}) · {formatCurrency(person.paymentTotal)}
                      </p>
                      {person.payments.length ? (
                        <ul className="mt-1 divide-y divide-slate-200 border border-slate-200 bg-white">
                          {person.payments.map((payment) => (
                            <li key={payment.id} className="flex justify-between gap-3 px-3 py-2">
                              <span className="min-w-0">
                                <span className="text-slate-500">{formatTime(payment.createdAt)}</span> · {paymentLabel(payment)}
                                {payment.note ? <span className="block text-xs text-slate-500">{payment.note}</span> : null}
                              </span>
                              <span className="shrink-0 font-semibold">{formatCurrency(payment.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-slate-600">None.</p>
                      )}
                    </div>

                    {person.sessions.length ? (
                      <div>
                        <p className="font-bold text-slate-900">
                          Photocopy sessions ({person.sessions.length}) · {formatCurrency(person.copyTotal)}
                        </p>
                        <ul className="mt-1 divide-y divide-slate-200 border border-slate-200 bg-white">
                          {person.sessions.map((session) => (
                            <li key={session.id} className="flex justify-between gap-3 px-3 py-2">
                              <span>
                                <span className="text-slate-500">{formatTime(session.createdAt)}</span> · {session.totalCopies} copies
                                (expected {formatCurrency(session.expectedRevenue)})
                              </span>
                              <span className="shrink-0 font-semibold">{formatCurrency(session.actualCashCollected)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {person.spent.length ? (
                      <div>
                        <p className="font-bold text-slate-900">
                          Spent from takings ({person.spent.length}) · −{formatCurrency(person.spentTotal)}
                        </p>
                        <ul className="mt-1 divide-y divide-slate-200 border border-slate-200 bg-white">
                          {person.spent.map((expense) => (
                            <li key={expense.id} className="flex justify-between gap-3 px-3 py-2">
                              <span>
                                {expense.description} <span className="text-slate-500">· {expense.categoryLabel}</span>
                              </span>
                              <span className="shrink-0 font-semibold">−{formatCurrency(expense.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="border-t border-slate-300 pt-3 text-slate-800">
                      <p>
                        Recorded {formatCurrency(person.recorded)}
                        {person.spentTotal ? ` − spent ${formatCurrency(person.spentTotal)}` : ''} ={' '}
                        <span className="font-bold">expected {formatCurrency(person.expected)}</span>
                      </p>
                      <p className={`mt-1 font-bold ${status.className}`}>
                        {person.counted === null
                          ? 'Not counted yet.'
                          : `Counted ${formatCurrency(person.counted)}: ${
                              Math.abs(person.difference) < 0.005 ? 'matches.' : status.text + '.'
                            }`}
                      </p>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          {loading ? 'Loading...' : 'Nobody took money or did a count on this day.'}
        </p>
      )}
    </section>
  )
}

export default StaffCountBreakdown
