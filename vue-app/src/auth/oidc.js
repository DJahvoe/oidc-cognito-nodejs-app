import { reactive } from 'vue'
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

const baseUrl = window.location.origin
const authority = import.meta.env.VITE_COGNITO_ISSUER
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
const cognitoDomain = normalizeDomain(import.meta.env.VITE_COGNITO_DOMAIN)
const scopes = import.meta.env.VITE_COGNITO_SCOPES || 'openid email profile'

if (!authority || !clientId || !cognitoDomain) {
  throw new Error('Missing Vite Cognito settings. Check vue-app/.env.')
}

export const appInfo = Object.freeze({
  appName: import.meta.env.VITE_APP_NAME || 'Vue Cognito OIDC Demo',
  baseUrl,
  redirectUri: `${baseUrl}/callback`,
  authority,
  clientId,
  cognitoDomain,
  scopes,
})

const userManager = new UserManager({
  authority: appInfo.authority,
  client_id: appInfo.clientId,
  redirect_uri: appInfo.redirectUri,
  response_type: 'code',
  scope: appInfo.scopes,
  loadUserInfo: false,
  automaticSilentRenew: false,
  monitorSession: false,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
})

export const authState = reactive({
  user: null,
  isReady: false,
  isLoading: false,
  error: null,
})

userManager.events.addUserLoaded((user) => {
  authState.user = user
})

userManager.events.addUserUnloaded(() => {
  authState.user = null
})

userManager.events.addSilentRenewError((error) => {
  authState.error = formatError(error)
})

export async function initializeAuth() {
  if (authState.isReady) {
    return authState.user
  }

  authState.isLoading = true
  authState.error = null

  try {
    authState.user = await userManager.getUser()
    authState.isReady = true
    return authState.user
  } catch (error) {
    authState.error = formatError(error)
    authState.isReady = true
    return null
  } finally {
    authState.isLoading = false
  }
}

export function isAuthenticated() {
  return Boolean(authState.user && !authState.user.expired)
}

export async function signin(returnTo = `${window.location.pathname}${window.location.search}`) {
  authState.error = null

  await userManager.signinRedirect({
    state: {
      returnTo,
    },
  })
}

export async function handleSigninCallback() {
  authState.isLoading = true
  authState.error = null

  try {
    const user = await userManager.signinCallback()
    authState.user = user
    authState.isReady = true
    return user.state?.returnTo || '/'
  } catch (error) {
    authState.error = formatError(error)
    throw error
  } finally {
    authState.isLoading = false
  }
}

export async function signout() {
  authState.error = null
  authState.user = null
  await userManager.removeUser()

  const logoutUrl = new URL(`https://${appInfo.cognitoDomain}/logout`)
  logoutUrl.searchParams.set('client_id', appInfo.clientId)
  logoutUrl.searchParams.set('logout_uri', appInfo.baseUrl)

  window.location.assign(logoutUrl.toString())
}

export function clearAuthError() {
  authState.error = null
}

export function getDisplayName() {
  if (!authState.user) {
    return 'Anonymous'
  }

  const profile = authState.user.profile || {}
  return profile.preferred_username || profile.email || profile.username || profile.sub || 'Authenticated user'
}

function normalizeDomain(value) {
  return String(value || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
