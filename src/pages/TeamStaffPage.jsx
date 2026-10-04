import { useCallback, useEffect, useMemo, useState } from 'react'
import TeamNavbar from '../components/TeamNavbar'
import TeamPageHeader from '../components/TeamPageHeader'
import { useAuth } from '../context/authContext'
import { getStaffProfiles, updateStaffProfile, getStaffDailyRecords, saveStaffDailyRecord } from '../services/staffService'

const inputClass = 'mt-1 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-navy'
const currency = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
const emptyReview = { resumed_at: '', left_at: '', rating: '', notes: '', bonus_recommended: false }

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function watInput(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T')
}

function watTime(value) {
  return value ? new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not recorded'
}

function dateLabel(value) {
  return new Date(`${value}T12:00:00+01:00`).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' })
}

function duration(minutes) {
  return minutes == null ? '-' : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function apiError(error) {
  const payload = error.payload
  if (payload && typeof payload === 'object') {
    return Object.entries(payload).map(([field, messages]) => `${field.replaceAll('_', ' ')}: ${Array.isArray(messages) ? messages.join(' ') : messages}`).join(' | ')
  }
  return error.message
}

function TeamStaffPage() {
  const { isOwner, user, refreshUser } = useAuth()
  const today = todayKey()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [profiles, setProfiles] = useState([])
  const [records, setRecords] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [day, setDay] = useState(today)
  const [profileDraft, setProfileDraft] = useState({})
  const [reviewDraft, setReviewDraft] = useState(emptyReview)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [bonusOnly, setBonusOnly] = useState(false)
  const [search, setSearch] = useState('')
  const start = `${month}-01`
  const end = useMemo(() => {
    const [year, number] = month.split('-').map(Number)
    return `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}`
  }, [month])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [people, days] = await Promise.all([getStaffProfiles(), getStaffDailyRecords(start, end)])
      setProfiles(people)
      setRecords(days)
      setSelectedId((current) => people.some((profile) => profile.id === current) ? current : people[0]?.id || null)
    } catch (error) {
      setMessage(`Could not load staff profiles: ${apiError(error)}`)
    } finally {
      setLoading(false)
    }
  }, [start, end])

  useEffect(() => { load() }, [load])

  const profile = profiles.find((person) => person.id === selectedId)
  const staffRecords = useMemo(() => records.filter((record) => record.staff === profile?.staff), [records, profile?.staff])
  const dailyRecord = staffRecords.find((record) => record.date === day)

  useEffect(() => {
    setProfileDraft(profile ? { first_name: profile.first_name, last_name: profile.last_name, job_title: profile.job_title, monthly_salary: profile.monthly_salary, expected_start: profile.expected_start?.slice(0, 5) || '' } : {})
  }, [profile])

  useEffect(() => {
    setReviewDraft(dailyRecord ? { resumed_at: watInput(dailyRecord.resumed_at), left_at: watInput(dailyRecord.left_at), rating: dailyRecord.rating ?? '', notes: dailyRecord.notes || '', bonus_recommended: Boolean(dailyRecord.bonus_recommended) } : emptyReview)
  }, [dailyRecord, selectedId, day])

  const visibleProfiles = profiles.filter((person) => {
    const matches = `${person.display_name} ${person.username} ${person.job_title}`.toLowerCase().includes(search.toLowerCase())
    return matches && (!bonusOnly || records.some((record) => record.staff === person.staff && record.bonus_recommended))
  })
  const rated = staffRecords.filter((record) => record.rating != null)
  const average = rated.length ? (rated.reduce((sum, record) => sum + record.rating, 0) / rated.length).toFixed(1) : '-'

  function changeMonth(value) {
    if (!value) return
    setMonth(value)
    setDay(value === today.slice(0, 7) ? today : `${value}-01`)
    setMessage('')
  }

  function selectDay(value) {
    if (!value) return
    setDay(value)
    if (value.slice(0, 7) !== month) setMonth(value.slice(0, 7))
  }

  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateStaffProfile(profile.id, { ...profileDraft, expected_start: profileDraft.expected_start || null })
      await load()
      if (profile.staff === user.id) await refreshUser()
      setMessage('Staff profile saved. Salary and expected resumption time are set by admin.')
    } catch (error) { setMessage(`Could not save profile: ${apiError(error)}`) }
    finally { setSaving(false) }
  }

  async function saveDay(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await saveStaffDailyRecord(dailyRecord?.id, {
        staff: profile.staff, date: day,
        resumed_at: reviewDraft.resumed_at ? new Date(`${reviewDraft.resumed_at}+01:00`).toISOString() : null,
        left_at: reviewDraft.left_at ? new Date(`${reviewDraft.left_at}+01:00`).toISOString() : null,
        rating: reviewDraft.rating === '' ? null : Number(reviewDraft.rating),
        notes: reviewDraft.notes.trim(), bonus_recommended: reviewDraft.bonus_recommended,
      })
      await load()
      setMessage('Attendance and daily review saved. Ratings and notes are visible to admin only.')
    } catch (error) { setMessage(`Could not save daily record: ${apiError(error)}`) }
    finally { setSaving(false) }
  }

  function field(key) {
    return (event) => setProfileDraft((current) => ({ ...current, [key]: event.target.value }))
  }

  return (
    <div className="min-h-screen bg-[#F4F8FC] text-slate-900">
      <TeamNavbar />
      <TeamPageHeader title={isOwner ? 'Staff profiles' : 'My profile'} subtitle={isOwner ? 'Manage salaries, attendance, and daily performance. All times are West Africa Time.' : 'Your role, monthly salary, expected resumption time, and recorded attendance.'}>
        <label className="text-sm font-semibold">Month<input type="month" value={month} max={today.slice(0, 7)} onChange={(e) => changeMonth(e.target.value)} className={inputClass} /></label>
      </TeamPageHeader>
      <main className="container-shell space-y-5 py-6">
        {message ? <p role="status" className="border border-slate-300 bg-white p-3 text-sm">{message}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Loading staff records...</p> : null}
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex-1 text-sm font-semibold">Find staff<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or job role" className={inputClass} /></label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={bonusOnly} onChange={(e) => setBonusOnly(e.target.checked)} />Bonus recommendations this month</label>
          </div>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-2">
            {visibleProfiles.map((person) => {
              const bonus = isOwner && records.some((record) => record.staff === person.staff && record.bonus_recommended)
              return <button key={person.id} onClick={() => { setSelectedId(person.id); setMessage('') }} className={`w-full border p-4 text-left ${selectedId === person.id ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white'}`}>
                <p className="font-bold">{person.display_name || person.username}</p>
                <p className="mt-1 text-sm opacity-80">{person.job_title || (person.access_role === 'owner' ? 'Owner/Admin' : 'Staff')}</p>
                {!person.active ? <p className="mt-1 text-xs">Inactive account</p> : null}
                {bonus ? <span className="mt-2 inline-block bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Consider for bonus</span> : null}
              </button>
            })}
            {!loading && !visibleProfiles.length ? <p className="text-sm text-slate-500">No staff match this selection.</p> : null}
          </aside>
          {profile ? <div className="min-w-0 space-y-5">
            <section className="border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-extrabold text-navy">{profile.display_name || profile.username}</h2><span className="border border-slate-200 px-2 py-1 text-xs font-semibold">{profile.access_role === 'owner' ? 'Owner/Admin' : 'Staff'}</span></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div><p className="text-sm text-slate-500">Job role</p><p className="font-bold">{profile.job_title || 'Not set'}</p></div>
                <div><p className="text-sm text-slate-500">Fixed monthly salary</p><p className="font-bold">{currency.format(Number(profile.monthly_salary))}</p></div>
                <div><p className="text-sm text-slate-500">Expected resumption</p><p className="font-bold">{profile.expected_start?.slice(0, 5) || 'Not set'} {profile.expected_start ? 'WAT' : ''}</p></div>
              </div>
              {isOwner ? <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer font-semibold text-navy">Edit staff profile</summary><form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">First name<input required value={profileDraft.first_name || ''} onChange={field('first_name')} className={inputClass} /></label>
                <label className="text-sm font-semibold">Last name<input value={profileDraft.last_name || ''} onChange={field('last_name')} className={inputClass} /></label>
                <label className="text-sm font-semibold">Job role<input maxLength={120} value={profileDraft.job_title || ''} onChange={field('job_title')} placeholder="e.g. Printer, Designer, Cashier" className={inputClass} /></label>
                <label className="text-sm font-semibold">Fixed monthly salary (NGN)<input type="number" required min="0" step="0.01" value={profileDraft.monthly_salary ?? ''} onChange={field('monthly_salary')} className={inputClass} /></label>
                <label className="text-sm font-semibold">Expected resumption time (WAT)<input type="time" value={profileDraft.expected_start || ''} onChange={field('expected_start')} className={inputClass} /></label>
                <div className="flex items-end"><button disabled={saving || loading} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save profile'}</button></div>
              </form></details> : null}
            </section>
            {isOwner ? <section id="staff-daily-review" className="border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold text-navy">Daily attendance and review</h2><p className="mt-1 text-sm text-slate-500">Admin records times. Ratings, notes, and bonus recommendations are private.</p></div><label className="text-sm font-semibold">Day<input type="date" value={day} max={today} onChange={(e) => selectDay(e.target.value)} className={inputClass} /></label></div>
              <form onSubmit={saveDay} className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold">Time resumed (WAT)<input type="datetime-local" value={reviewDraft.resumed_at} onChange={(e) => setReviewDraft((current) => ({ ...current, resumed_at: e.target.value }))} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Arrival date must match the selected day.</span></label>
                  <label className="text-sm font-semibold">Time leaving (WAT)<input type="datetime-local" value={reviewDraft.left_at} onChange={(e) => setReviewDraft((current) => ({ ...current, left_at: e.target.value }))} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Use the next date for a shift that ends after midnight.</span></label>
                </div>
                <fieldset><legend className="text-sm font-semibold">Daily rating: {reviewDraft.rating === '' ? 'Not rated' : `${reviewDraft.rating} / 10`}</legend><div className="mt-2 flex flex-wrap gap-2">{Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => <button key={rating} type="button" aria-label={`Rate ${rating} out of 10`} aria-pressed={Number(reviewDraft.rating) === rating} onClick={() => setReviewDraft((current) => ({ ...current, rating }))} className={`h-10 w-10 border font-bold ${Number(reviewDraft.rating) === rating ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{rating}</button>)}<button type="button" onClick={() => setReviewDraft((current) => ({ ...current, rating: '' }))} className="px-2 text-sm text-slate-600 underline">Clear rating</button></div><p className="mt-2 text-xs text-slate-500">1 = poor performance. 10 = excellent performance.</p></fieldset>
                <label className="block text-sm font-semibold">Notes for the day<textarea rows={4} value={reviewDraft.notes} onChange={(e) => setReviewDraft((current) => ({ ...current, notes: e.target.value }))} placeholder="Record good work, incidents, concerns, or the reason for a bonus recommendation." className={inputClass} /></label>
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={reviewDraft.bonus_recommended} onChange={(e) => setReviewDraft((current) => ({ ...current, bonus_recommended: e.target.checked }))} />Consider this staff member for a bonus</label>
                <button disabled={saving || loading} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : dailyRecord ? 'Update daily record' : 'Save daily record'}</button>
                {dailyRecord ? <p className="text-xs text-slate-500">Recorded by {dailyRecord.recorded_by_name || 'Admin'}{dailyRecord.updated_by_name ? ` | Last saved by ${dailyRecord.updated_by_name}` : ''}</p> : null}
              </form>
            </section> : null}
            <section className="border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-extrabold text-navy">{isOwner ? 'Monthly attendance and performance' : 'My attendance'}</h2>
              <div className="mt-3 flex flex-wrap gap-4 text-sm"><span>Attendance recorded: <strong>{staffRecords.filter((record) => record.resumed_at).length} days</strong></span><span>Late arrivals: <strong>{staffRecords.filter((record) => record.late_minutes > 0).length}</strong></span>{isOwner ? <><span>Average rating: <strong>{average}{rated.length ? ' / 10' : ''}</strong> ({rated.length} rated days)</span><span>Bonus recommendations: <strong>{staffRecords.filter((record) => record.bonus_recommended).length}</strong></span></> : null}</div>
              <div className="mt-4 space-y-3">{staffRecords.map((record) => <article key={record.id} className="border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{dateLabel(record.date)}</h3>{isOwner ? <button type="button" onClick={() => { setDay(record.date); document.getElementById('staff-daily-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} className="text-sm font-semibold text-navy underline">Edit daily record</button> : null}</div>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><p>Resumed: <strong>{watTime(record.resumed_at)}</strong></p><p>Left: <strong>{watTime(record.left_at)}</strong></p><p>Time worked: <strong>{duration(record.worked_minutes)}</strong></p><p className={record.late_minutes > 0 ? 'text-amber-800' : ''}>Arrival: <strong>{record.late_minutes == null ? 'No comparison available' : record.late_minutes > 0 ? `${record.late_minutes} minutes late` : 'On time'}</strong>{record.expected_start ? ` (expected ${record.expected_start.slice(0, 5)} WAT)` : ''}</p></div>
                {isOwner ? <div className="mt-3 border-t border-slate-100 pt-3"><p className="font-semibold">Rating: {record.rating == null ? 'Not rated' : `${record.rating} / 10`}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{record.notes || 'No notes added.'}</p>{record.bonus_recommended ? <span className="mt-2 inline-block bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Consider for bonus</span> : null}</div> : null}
              </article>)}{!staffRecords.length ? <p className="text-sm text-slate-500">No daily records for this month.</p> : null}</div>
            </section>
          </div> : !loading ? <p className="text-sm text-slate-500">No staff profile is available.</p> : null}
        </div>
      </main>
    </div>
  )
}

export default TeamStaffPage
