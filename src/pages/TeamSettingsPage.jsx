import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Footer from '../components/Footer'
import TeamNavbar from '../components/TeamNavbar'
import { useAuth } from '../context/authContext'
import {
  createStaffInvitation,
  getStaffAccountsData,
  getStaffInvitationsData,
  resetStaffAccountPassword,
  updateStaffAccount,
} from '../services/authService'
import { getSystemSetting, updateSystemSetting } from '../services/operationsService'

const defaultCreateForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'staff',
}

function buildStaffInvitationUrl(token) {
  if (typeof window === 'undefined' || !token) return ''
  return `${window.location.origin}/team/accept-invite?token=${encodeURIComponent(token)}`
}

function formatDateTime(value) {
  if (!value) return 'Never'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Never'
  return parsed.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function TeamSettingsPage() {
  const { user } = useAuth()
  const [setting, setSetting] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [invitations, setInvitations] = useState([])
  const [settingsForm, setSettingsForm] = useState({
    businessName: '',
    businessAddress: '',
    photocopyPricePerCopy: '',
    jobCategories: '',
  })
  const [createForm, setCreateForm] = useState(defaultCreateForm)
  const [latestInvitation, setLatestInvitation] = useState(null)
  const [passwordDrafts, setPasswordDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [updatingAccountId, setUpdatingAccountId] = useState(null)
  const [resettingAccountId, setResettingAccountId] = useState(null)
  const [copiedInviteId, setCopiedInviteId] = useState(null)
  const [expandedAccounts, setExpandedAccounts] = useState({})
  const [expandedInvitations, setExpandedInvitations] = useState({})
  const [statusMessage, setStatusMessage] = useState('')

  const loadSettingsPage = useCallback(async () => {
    setLoading(true)
    try {
      const [settingData, accountsData, invitationsData] = await Promise.all([
        getSystemSetting(),
        getStaffAccountsData(),
        getStaffInvitationsData(),
      ])
      const currentSetting = settingData.setting
      setSetting(currentSetting)
      setAccounts(accountsData.accounts)
      setInvitations(invitationsData.invitations || [])
      setSettingsForm({
        businessName: currentSetting?.business_name || currentSetting?.businessName || '',
        businessAddress: currentSetting?.business_address || currentSetting?.businessAddress || '',
        photocopyPricePerCopy: String(currentSetting?.photocopyPricePerCopy || ''),
        jobCategories: Array.isArray(currentSetting?.jobCategories)
          ? currentSetting.jobCategories.join(', ')
          : '',
      })
    } catch (error) {
      setStatusMessage(`Failed to load admin settings: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettingsPage()
  }, [loadSettingsPage])

  const orderedAccounts = useMemo(() => {
    const cloned = [...accounts]
    cloned.sort((left, right) => {
      const leftName = (left.display_name || left.username || '').toLowerCase()
      const rightName = (right.display_name || right.username || '').toLowerCase()
      return leftName.localeCompare(rightName)
    })
    return cloned
  }, [accounts])

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === 'pending'),
    [invitations],
  )

  async function handleSaveSettings() {
    if (!setting?.id) {
      setStatusMessage('System setting record is not available yet.')
      return
    }

    setSavingSettings(true)
    try {
      const updated = await updateSystemSetting(setting.id, {
        business_name: settingsForm.businessName.trim(),
        business_address: settingsForm.businessAddress.trim(),
        photocopy_price_per_copy: String(Number(settingsForm.photocopyPricePerCopy || 0)),
        job_categories: settingsForm.jobCategories
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })

      setSetting(updated)
      setSettingsForm({
        businessName: updated.business_name || updated.businessName || '',
        businessAddress: updated.business_address || updated.businessAddress || '',
        photocopyPricePerCopy: String(updated.photocopyPricePerCopy || ''),
        jobCategories: Array.isArray(updated.jobCategories) ? updated.jobCategories.join(', ') : '',
      })
      setStatusMessage('Business settings saved successfully.')
    } catch (error) {
      setStatusMessage(`Could not save business settings: ${error.message}`)
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleCreateAccount(e) {
    e.preventDefault()
    setCreatingAccount(true)
    try {
      const invitation = await createStaffInvitation({
        first_name: createForm.firstName.trim(),
        last_name: createForm.lastName.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
      })
      setCreateForm(defaultCreateForm)
      setLatestInvitation(invitation)
      await loadSettingsPage()
      setStatusMessage('Staff invitation created successfully.')
    } catch (error) {
      setStatusMessage(`Could not create staff invitation: ${error.message}`)
    } finally {
      setCreatingAccount(false)
    }
  }

  async function handleToggleActive(account) {
    setUpdatingAccountId(account.id)
    try {
      await updateStaffAccount(account.id, { is_active: !account.is_active })
      await loadSettingsPage()
      setStatusMessage(`${account.username} has been ${account.is_active ? 'deactivated' : 'reactivated'}.`)
    } catch (error) {
      setStatusMessage(`Could not update account status: ${error.message}`)
    } finally {
      setUpdatingAccountId(null)
    }
  }

  async function handleRoleChange(account, role) {
    setUpdatingAccountId(account.id)
    try {
      await updateStaffAccount(account.id, { role })
      await loadSettingsPage()
      setStatusMessage(`${account.username} is now set as ${role}.`)
    } catch (error) {
      setStatusMessage(`Could not update account role: ${error.message}`)
    } finally {
      setUpdatingAccountId(null)
    }
  }

  async function handleResetPassword(account) {
    const nextPassword = passwordDrafts[account.id] || ''
    if (nextPassword.length < 8) {
      setStatusMessage('New password must be at least 8 characters long.')
      return
    }

    setResettingAccountId(account.id)
    try {
      await resetStaffAccountPassword(account.id, nextPassword)
      setPasswordDrafts((current) => ({ ...current, [account.id]: '' }))
      setStatusMessage(`Password reset for ${account.username}.`)
    } catch (error) {
      setStatusMessage(`Could not reset password: ${error.message}`)
    } finally {
      setResettingAccountId(null)
    }
  }

  async function handleCopyInviteLink(invitation) {
    const inviteLink = buildStaffInvitationUrl(invitation.token)
    if (!inviteLink || typeof window === 'undefined' || !window.navigator?.clipboard) {
      setStatusMessage('Clipboard is not available in this browser.')
      return
    }

    try {
      await window.navigator.clipboard.writeText(inviteLink)
      setCopiedInviteId(invitation.id)
      setStatusMessage(`Invite link copied for ${invitation.email}.`)
      window.setTimeout(() => setCopiedInviteId((current) => (current === invitation.id ? null : current)), 1600)
    } catch {
      setStatusMessage('Could not copy the invite link right now.')
    }
  }

  function toggleAccountPanel(accountId) {
    setExpandedAccounts((current) => ({
      ...current,
      [accountId]: !current[accountId],
    }))
  }

  function toggleInvitationPanel(invitationId) {
    setExpandedInvitations((current) => ({
      ...current,
      [invitationId]: !current[invitationId],
    }))
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
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              Manage staff and shop settings.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-100 sm:text-base">
              Use this page to add staff, reset passwords, and update shop details.
            </p>
          </div>
        </section>

        <section className="container-shell py-8 md:py-10">
          {statusMessage ? (
            <div className="mb-6 border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-slate-700 shadow-sm">
              {statusMessage}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <section className="space-y-6">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Shop Settings
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Shop Info</h2>
                  </div>
                  {loading ? <span className="text-sm text-slate-500">Loading...</span> : null}
                </div>

                <div className="mt-5 grid gap-4">
                  <label className="block text-sm font-semibold text-slate-700">
                    Business name
                    <input
                      value={settingsForm.businessName}
                      onChange={(e) => setSettingsForm((current) => ({ ...current, businessName: e.target.value }))}
                      className="mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-navy"
                    />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Business address
                    <textarea
                      value={settingsForm.businessAddress}
                      onChange={(e) =>
                        setSettingsForm((current) => ({ ...current, businessAddress: e.target.value }))
                      }
                      rows={3}
                      className="mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-navy"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Photocopy price per copy
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settingsForm.photocopyPricePerCopy}
                        onChange={(e) =>
                          setSettingsForm((current) => ({
                            ...current,
                            photocopyPricePerCopy: e.target.value,
                          }))
                        }
                        className="mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-navy"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Job categories
                      <input
                        value={settingsForm.jobCategories}
                        onChange={(e) =>
                          setSettingsForm((current) => ({ ...current, jobCategories: e.target.value }))
                        }
                        placeholder="printing, binding, lamination"
                        className="mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-navy"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {savingSettings ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    New Staff
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold text-navy">Invite Staff</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Add the staff member&apos;s details and role. They&apos;ll receive a setup link
                    you can share so they can choose their own username and password.
                  </p>
                </div>

                <form onSubmit={handleCreateAccount} className="mt-5 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      First name
                      <input
                        value={createForm.firstName}
                        onChange={(e) => setCreateForm((current) => ({ ...current, firstName: e.target.value }))}
                        className="mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-navy"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Last name
                      <input
                        value={createForm.lastName}
                        onChange={(e) => setCreateForm((current) => ({ ...current, lastName: e.target.value }))}
                        className="mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-navy"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Email
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm((current) => ({ ...current, email: e.target.value }))}
                        className="mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-navy"
                        required
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Role
                      <select
                        value={createForm.role}
                        onChange={(e) => setCreateForm((current) => ({ ...current, role: e.target.value }))}
                        className="mt-2 w-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-navy"
                      >
                        <option value="staff">Staff</option>
                        <option value="owner">Owner/Admin</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={creatingAccount}
                      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {creatingAccount ? 'Creating...' : 'Create Invitation'}
                    </button>
                  </div>
                </form>

                {latestInvitation ? (
                  <div className="mt-6 border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-bold text-emerald-800">Latest invite link</p>
                    <p className="mt-1 text-sm text-emerald-700">
                      Share this link with {latestInvitation.first_name || latestInvitation.email} so
                      they can finish setting up their account.
                    </p>
                    <div className="mt-3 flex flex-col gap-3 md:flex-row">
                      <input
                        readOnly
                        value={buildStaffInvitationUrl(latestInvitation.token)}
                        className="w-full border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(latestInvitation)}
                        className="w-full border border-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 md:w-auto"
                      >
                        {copiedInviteId === latestInvitation.id ? 'Copied' : 'Copy Link'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Waiting Invites
                      </p>
                      <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                        {pendingInvitations.length} awaiting setup
                      </h3>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {pendingInvitations.length ? (
                      pendingInvitations.map((invitation) => {
                        const isExpanded = Boolean(expandedInvitations[invitation.id])

                        return (
                          <article key={invitation.id} className="border border-slate-200 bg-slate-50 p-4">
                            <button
                              type="button"
                              onClick={() => toggleInvitationPanel(invitation.id)}
                              className="flex w-full items-start justify-between gap-3 text-left"
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-900">{invitation.display_name}</p>
                                <p className="mt-1 text-sm text-slate-600">
                                  {invitation.email} | {invitation.role === 'owner' ? 'Owner/Admin' : 'Staff'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Expires {formatDateTime(invitation.expires_at)}
                                </p>
                              </div>

                              <span
                                className={`mt-0.5 flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-slate-500 transition ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                                aria-hidden="true"
                              >
                                <ChevronDown size={18} />
                              </span>
                            </button>

                            {isExpanded ? (
                              <div className="mt-3 border-t border-slate-200 pt-3">
                                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyInviteLink(invitation)}
                                    className="w-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy sm:w-auto"
                                  >
                                    {copiedInviteId === invitation.id ? 'Copied' : 'Copy Link'}
                                  </button>
                                </div>

                                <input
                                  readOnly
                                  value={buildStaffInvitationUrl(invitation.token)}
                                  className="mt-3 w-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                                />
                              </div>
                            ) : null}
                          </article>
                        )
                      })
                    ) : (
                      <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        No pending invitations right now.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Staff
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold text-navy">Staff Accounts</h2>
                </div>
                <span className="border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
                  {orderedAccounts.length} accounts
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {orderedAccounts.length ? (
                  orderedAccounts.map((account) => {
                    const isSelf = user?.id === account.id
                    const roleValue = account.is_superuser ? 'owner' : 'staff'
                    const isExpanded = Boolean(expandedAccounts[account.id])

                    return (
                      <article key={account.id} className="border border-slate-200 bg-slate-50 px-4 py-4">
                        <button
                          type="button"
                          onClick={() => toggleAccountPanel(account.id)}
                          className="flex w-full items-start justify-between gap-3 text-left"
                        >
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">
                              {account.display_name || account.username}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              @{account.username} | Last login {formatDateTime(account.last_login)}
                            </p>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="flex flex-wrap justify-end gap-2">
                              <span
                                className={`border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                                  account.is_active
                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                    : 'border-slate-300 bg-slate-200 text-slate-600'
                                }`}
                              >
                                {account.is_active ? 'Active' : 'Inactive'}
                              </span>

                              {isSelf ? (
                                <span className="border border-yellow/40 bg-yellow/20 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-navy">
                                  Your account
                                </span>
                              ) : null}
                            </div>

                            <span
                              className={`mt-0.5 flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-slate-500 transition ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                              aria-hidden="true"
                            >
                              <ChevronDown size={18} />
                            </span>
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 xl:grid-cols-[180px_minmax(0,1fr)]">
                            <label className="block text-sm font-semibold text-slate-700">
                              Role
                              <select
                                value={roleValue}
                                onChange={(e) => handleRoleChange(account, e.target.value)}
                                disabled={updatingAccountId === account.id}
                                className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="staff">Staff</option>
                                <option value="owner">Owner/Admin</option>
                              </select>
                            </label>

                            <label className="block text-sm font-semibold text-slate-700">
                              Reset password
                              <input
                                type="password"
                                value={passwordDrafts[account.id] || ''}
                                onChange={(e) =>
                                  setPasswordDrafts((current) => ({
                                    ...current,
                                    [account.id]: e.target.value,
                                  }))
                                }
                                className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                                placeholder="Enter a new password"
                              />
                              <span className="mt-2 block text-xs font-normal text-slate-500">
                                Use at least 8 characters.
                              </span>
                            </label>

                            <div className="xl:col-span-2">
                              <div className="flex flex-col items-stretch gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center">
                                <button
                                  type="button"
                                  onClick={() => handleResetPassword(account)}
                                  disabled={resettingAccountId === account.id}
                                  className="w-full border border-navy px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                >
                                  {resettingAccountId === account.id ? 'Resetting...' : 'Reset Password'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(account)}
                                  disabled={updatingAccountId === account.id || isSelf}
                                  className="w-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                >
                                  {account.is_active ? 'Deactivate' : 'Reactivate'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })
                ) : (
                  <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    No staff accounts found yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default TeamSettingsPage
