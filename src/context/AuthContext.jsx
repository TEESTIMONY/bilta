import { useEffect, useMemo, useState } from 'react'
import {
  acceptStaffInvitation,
  clearCmsSession,
  getCmsCurrentUser,
  getStoredCmsToken,
  loginCmsUser,
  logoutCmsUser,
} from '../services/authService'
import { USE_DJANGO_API } from '../services/api'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    async function hydrateUser() {
      if (!USE_DJANGO_API || !getStoredCmsToken()) {
        if (isActive) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      try {
        const currentUser = await getCmsCurrentUser()
        if (isActive) {
          setUser(currentUser)
        }
      } catch {
        clearCmsSession()
        if (isActive) {
          setUser(null)
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    hydrateUser()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    function handleExpiredSession() {
      clearCmsSession()
      setUser(null)
      setLoading(false)
    }

    window.addEventListener('bilta-auth-expired', handleExpiredSession)
    return () => window.removeEventListener('bilta-auth-expired', handleExpiredSession)
  }, [])

  async function login(credentials) {
    const payload = await loginCmsUser(credentials)
    setUser(payload?.user || null)
    return payload?.user || null
  }

  async function acceptInvitation(invitationPayload) {
    const payload = await acceptStaffInvitation(invitationPayload)
    setUser(payload?.user || null)
    return payload?.user || null
  }

  async function logout() {
    await logoutCmsUser()
    setUser(null)
  }

  // Re-read the signed-in user, e.g. after their name is changed in Settings.
  async function refreshUser() {
    const currentUser = await getCmsCurrentUser()
    setUser(currentUser)
    return currentUser
  }

  const value = useMemo(() => {
    const isOwner = Boolean(user?.is_superuser || user?.role === 'owner')
    return {
      user,
      loading,
      login,
      acceptInvitation,
      logout,
      refreshUser,
      isAuthenticated: Boolean(user),
      isOwner,
      isStaff: Boolean(user),
    }
  }, [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
