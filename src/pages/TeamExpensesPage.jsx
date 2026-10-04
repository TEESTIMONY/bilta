import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import StaffCountBreakdown from '../components/StaffCountBreakdown'
import TeamNavbar from '../components/TeamNavbar'
import TeamPageHeader from '../components/TeamPageHeader'
import { useAuth } from '../context/authContext'
import {
  EXPENSE_CATEGORIES,
  createExpense,
  deleteExpense,
  getCashCounts,
  getExpenses,
  getMoneyStatement,
  getPaymentRecordsData,
  getPhotocopySessionsData,
} from '../services/operationsService'

const inputClass =
  'mt-1 w-full min-h-[44px] border border-slate-300 bg-white px-3 text-[15px] outline-none transition focus:border-navy'

const emptyExpense = { category: 'fuel', description: '', amount: '', paidFromTakings: true }

function formatCurrency(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )
}

// Dates are handled as YYYY-MM-DD strings in the shop's day.
function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function toDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(key, days) {
  const date = toDate(key)
  date.setDate(date.getDate() + days)
  return toKey(date)
}

function weekRange(key) {
  const date = toDate(key)
  const fromMonday = (date.getDay() + 6) % 7
  const start = addDays(key, -fromMonday)
  return { start, end: addDays(start, 6) }
}

function monthRange(key) {
  const date = toDate(key)
  return {
    start: toKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: toKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  }
}

function dayLabel(key, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return toDate(key).toLocaleDateString('en-NG', options)
}

function TeamExpensesPage() {
  const { isOwner } = useAuth()
  // ?date=YYYY-MM-DD&staff=<id> opens a day with one person's count already expanded (from Reports).
  const [searchParams] = useSearchParams()
  const linkedDay = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') || '') ? searchParams.get('date') : null
  const linkedStaff = searchParams.get('staff') ? Number(searchParams.get('staff')) : null
  const [view, setView] = useState('day')
  const [selectedDay, setSelectedDay] = useState(linkedDay || todayKey())
  const [expenses, setExpenses] = useState([])
  const [counts, setCounts] = useState([])
  const [dayPayments, setDayPayments] = useState([])
  const [daySessions, setDaySessions] = useState([])
  const [statement, setStatement] = useState(null)
  const [form, setForm] = useState(emptyExpense)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const range = useMemo(() => {
    if (view === 'week') return weekRange(selectedDay)
    if (view === 'month') return monthRange(selectedDay)
    return { start: selectedDay, end: selectedDay }
  }, [selectedDay, view])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (view === 'day') {
        const [expenseData, countData, statementData, paymentData, sessionData] = await Promise.all([
          getExpenses(selectedDay),
          isOwner ? getCashCounts(selectedDay) : Promise.resolve({ counts: [] }),
          isOwner ? getMoneyStatement(selectedDay, selectedDay) : Promise.resolve(null),
          isOwner ? getPaymentRecordsData(selectedDay) : Promise.resolve({ payments: [] }),
          isOwner ? getPhotocopySessionsData(selectedDay) : Promise.resolve({ sessions: [] }),
        ])
        setExpenses(expenseData.expenses)
        setCounts(countData.counts)
        setStatement(statementData)
        setDayPayments(paymentData.payments)
        setDaySessions(sessionData.sessions)
      } else {
        setStatement(await getMoneyStatement(range.start, range.end))
      }
    } catch (error) {
      setMessage(`Could not load: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [isOwner, range.end, range.start, selectedDay, view])

  useEffect(() => {
    load()
  }, [load])

  const isToday = selectedDay === todayKey()
  const canAdd = isOwner ? selectedDay <= todayKey() : isToday

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.description.trim()) {
      setMessage('Say what the money was spent on.')
      return
    }
    if (!(Number(form.amount) > 0)) {
      setMessage('Enter an amount above ₦0.')
      return
    }
    setSaving(true)
    try {
      await createExpense({
        date: isOwner ? selectedDay : undefined,
        category: form.category,
        description: form.description.trim(),
        amount: form.amount,
        paidFromTakings: form.paidFromTakings,
      })
      setForm(emptyExpense)
      setMessage(`Expense of ${formatCurrency(form.amount)} saved.`)
      await load()
    } catch (error) {
      setMessage(`Could not save the expense: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Delete "${expense.description}" (${formatCurrency(expense.amount)})?`)) return
    try {
      await deleteExpense(expense.id)
      setMessage('Expense deleted.')
      await load()
    } catch (error) {
      setMessage(`Could not delete: ${error.message}`)
    }
  }

  function shift(direction) {
    if (view === 'week') setSelectedDay(addDays(weekRange(selectedDay).start, 7 * direction))
    else if (view === 'month') {
      const date = toDate(selectedDay)
      setSelectedDay(toKey(new Date(date.getFullYear(), date.getMonth() + direction, 1)))
    } else setSelectedDay(addDays(selectedDay, direction))
  }

  const periodLabel =
    view === 'week'
      ? `${dayLabel(range.start, { day: 'numeric', month: 'short' })} – ${dayLabel(range.end, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : view === 'month'
        ? toDate(range.start).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
        : dayLabel(selectedDay, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const totals = statement?.totals
  const activeDays = (statement?.days || []).filter((day) => day.received || day.expenses)

  const expenseForm = canAdd ? (
    <form onSubmit={handleAdd} className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-extrabold text-navy">Add an expense{isOwner && !isToday ? ` for ${dayLabel(selectedDay)}` : ''}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr_9rem]">
        <label className="block text-sm font-semibold text-slate-700">
          Category
          <select
            value={form.category}
            onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}
            className={inputClass}
          >
            {EXPENSE_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          What was it for?
          <input
            value={form.description}
            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
            className={inputClass}
            placeholder="e.g. Diesel for generator"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Amount (₦)
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))}
            className={inputClass}
            placeholder="0"
          />
        </label>
      </div>
      <label className="mt-3 flex min-h-[44px] items-center gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.paidFromTakings}
          onChange={(e) => setForm((current) => ({ ...current, paidFromTakings: e.target.checked }))}
          className="h-5 w-5"
        />
        <span>
          <span className="font-semibold">Paid from today&apos;s takings</span> (the money collected today). Untick if it was paid
          another way, e.g. from the bank.
        </span>
      </label>
      <button type="submit" disabled={saving} className="btn-primary mt-3 min-h-[44px] w-full disabled:opacity-60 sm:w-auto">
        {saving ? 'Saving...' : 'Save expense'}
      </button>
    </form>
  ) : null

  const expenseList = (
    <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold text-navy">{isOwner ? 'Expenses' : 'Your expenses'}</h2>
        <p className="font-bold text-slate-900">{formatCurrency(expenses.reduce((sum, item) => sum + item.amount, 0))}</p>
      </div>
      {expenses.length ? (
        <ul className="mt-2 divide-y divide-slate-200">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{expense.description}</p>
                <p className="text-sm text-slate-600">
                  {expense.categoryLabel}
                  {isOwner && expense.recordedByName ? ` · ${expense.recordedByName}` : ''}
                  {expense.paidFromTakings ? ' · from takings' : ' · paid another way'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-bold text-slate-900">{formatCurrency(expense.amount)}</span>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(expense)}
                    className="flex h-11 w-11 items-center justify-center border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-600"
                    aria-label={`Delete ${expense.description}`}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{loading ? 'Loading...' : 'No expenses for this day.'}</p>
      )}
    </section>
  )

  return (
    <>
      <TeamNavbar />
      <main className="min-h-screen bg-[#F4F8FC] pb-12">
        <TeamPageHeader
          title="Expenses"
          subtitle={
            isOwner
              ? "Money in, money out, and what's left, by day, week or month."
              : 'Record what you spend today. You only see your own expenses.'
          }
        />

        <section className="container-shell py-6">
          {message ? (
            <div className="mb-4 border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-slate-700">{message}</div>
          ) : null}

          {isOwner ? (
            <div role="tablist" aria-label="Period" className="grid grid-cols-3 gap-2">
              {[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={view === option.value}
                  onClick={() => setView(option.value)}
                  className={`min-h-[48px] border text-base font-bold transition ${
                    view === option.value ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-navy'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {isOwner ? (
            <div className="mt-3 flex items-center justify-between gap-2 border border-slate-200 bg-white px-2 py-2">
              <button
                type="button"
                onClick={() => shift(-1)}
                className="flex h-11 w-11 items-center justify-center text-navy"
                aria-label={`Previous ${view}`}
              >
                <ChevronLeft size={22} />
              </button>
              <p className="text-center font-bold text-slate-900">{periodLabel}</p>
              <button
                type="button"
                onClick={() => shift(1)}
                disabled={range.end >= todayKey()}
                className="flex h-11 w-11 items-center justify-center text-navy disabled:opacity-30"
                aria-label={`Next ${view}`}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          ) : null}

          {isOwner && totals ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <MoneyStat label="Received" value={totals.received} />
              <MoneyStat label="Expenses" value={totals.expenses} />
              <MoneyStat label="Remaining" value={totals.remaining} tone={totals.remaining < 0 ? 'bad' : 'good'} />
            </div>
          ) : null}
          {isOwner && totals ? (
            <p className="mt-2 text-sm text-slate-600">
              Received = staff counts (cash {formatCurrency(totals.cash)} + transfers {formatCurrency(totals.transfer)})
              {totals.spentFromTakings ? ` + ${formatCurrency(totals.spentFromTakings)} already spent from takings` : ''}.
            </p>
          ) : null}

          {view === 'day' && !isOwner ? (
            // Staff: the form and their own list side by side on wide screens.
            <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
              {expenseForm || (
                <p className="border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  You can only add expenses for today.
                </p>
              )}
              {expenseList}
            </div>
          ) : view === 'day' ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="space-y-4">
                {expenseForm}
                {expenseList}
              </div>
              {isOwner ? (
                <StaffCountBreakdown
                  key={selectedDay}
                  counts={counts}
                  payments={dayPayments}
                  sessions={daySessions}
                  expenses={expenses}
                  loading={loading}
                  initialOpenId={selectedDay === linkedDay ? linkedStaff : null}
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
              <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-lg font-extrabold text-navy">Day by day</h2>
                {activeDays.length ? (
                  <ul className="mt-2 divide-y divide-slate-200">
                    {activeDays.map((day) => (
                      <li key={day.date}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDay(day.date)
                            setView('day')
                          }}
                          className="grid min-h-[56px] w-full grid-cols-[1fr_auto] items-center gap-x-3 py-2 text-left"
                        >
                          <span className="font-semibold text-slate-900">{dayLabel(day.date)}</span>
                          <span className={`text-right font-extrabold ${day.remaining < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                            {formatCurrency(day.remaining)}
                          </span>
                          <span className="col-span-2 text-sm text-slate-600">
                            In {formatCurrency(day.received)} · Out {formatCurrency(day.expenses)}
                            {day.peopleCounted ? '' : ' · no staff counts'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{loading ? 'Loading...' : 'Nothing recorded in this period.'}</p>
                )}
              </section>

              <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-lg font-extrabold text-navy">Where the money went</h2>
                {statement?.byCategory?.length ? (
                  <ul className="mt-2 divide-y divide-slate-200">
                    {statement.byCategory.map((row) => (
                      <li key={row.category} className="flex justify-between gap-3 py-2">
                        <span className="text-slate-800">{row.label}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(row.total)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No expenses in this period.</p>
                )}
              </section>
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function MoneyStat({ label, value, tone = 'normal' }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className="border border-slate-200 bg-white px-3 py-3 sm:px-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-base font-extrabold sm:text-xl ${color}`}>{formatCurrency(value)}</p>
    </div>
  )
}

export default TeamExpensesPage
