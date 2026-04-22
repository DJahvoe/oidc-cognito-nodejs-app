import { computed } from 'vue'
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

let userManager

export function useOidcAuth() {
  console.log('[useOidcAuth] useOidcAuth called')
  const runtimeConfig = useRuntimeConfig()
  const user = useState('oidc-user', () => null)
  const ready = useState('oidc-ready', () => false)
  const loading = useState('oidc-loading', () => false)
  const error = useState('oidc-error', () => null)

  const appInfo = computed(() => {
    const baseUrl = import.meta.client ? window.location.origin : ''
    const result = {
      appName: runtimeConfig.public.appName || 'Nuxt Cognito OIDC Demo',
      baseUrl,
      redirectUri: baseUrl ? `${baseUrl}/callback` : '/callback',
      logoutUrl: normalizeUrl(runtimeConfig.public.logoutUrl || 'http://localhost:5000/logout'),
      authority: runtimeConfig.public.cognitoIssuer,
      clientId: runtimeConfig.public.cognitoClientId,
      cognitoDomain: normalizeDomain(runtimeConfig.public.cognitoDomain),
      scopes: runtimeConfig.public.cognitoScopes || 'openid email profile',
    }

    console.log('[useOidcAuth] appInfo computed returning', result)
    return result
  })

  const authenticated = computed(() => Boolean(user.value && !user.value.expired))
  const displayName = computed(() => {
    if (!user.value) {
      console.log('[useOidcAuth] displayName computed returning Anonymous')
      return 'Anonymous'
    }

    const profile = user.value.profile || {}
    const result = profile.preferred_username || profile.email || profile.username || profile.sub || 'Authenticated user'
    console.log('[useOidcAuth] displayName computed returning', result)
    return result
  })

  function getUserManager() {
    console.log('[useOidcAuth] getUserManager called')
    if (!import.meta.client) {
      throw new Error('OIDC operations are only available in the browser.')
    }

    if (userManager) {
      console.log('[useOidcAuth] getUserManager returning cached manager')
      return userManager
    }

    const currentInfo = appInfo.value

    if (!currentInfo.authority || !currentInfo.clientId || !currentInfo.cognitoDomain) {
      throw new Error('Missing Nuxt Cognito settings. Check vue-app/.env.')
    }

    userManager = new UserManager({
      authority: currentInfo.authority,
      client_id: currentInfo.clientId,
      redirect_uri: currentInfo.redirectUri,
      response_type: 'code',
      scope: currentInfo.scopes,
      loadUserInfo: false,
      automaticSilentRenew: false,
      monitorSession: false,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    })

    console.log('[useOidcAuth] getUserManager returning new manager')
    return userManager
  }

  async function initializeAuth() {
    console.log('[useOidcAuth] initializeAuth called', {
      ready: ready.value,
      importMetaClient: import.meta.client,
    })
    if (ready.value || !import.meta.client) {
      console.log('[useOidcAuth] initializeAuth returning early', { user: user.value })
      return user.value
    }

    loading.value = true
    error.value = null

    try {
      user.value = await getUserManager().getUser()
      console.log('[useOidcAuth] initializeAuth returning user', { user: user.value })
      return user.value
    } catch (currentError) {
      error.value = formatError(currentError)
      console.log('[useOidcAuth] initializeAuth returning null after error', {
        error: error.value,
      })
      return null
    } finally {
      ready.value = true
      loading.value = false
    }
  }

  async function signin(returnTo = `${window.location.pathname}${window.location.search}`) {
    console.log('[useOidcAuth] signin called', { returnTo })
    error.value = null

    console.log('[useOidcAuth] signin exiting via redirect', { returnTo })
    await getUserManager().signinRedirect({
      state: {
        returnTo,
      },
    })
  }

  async function handleCallback() {
    console.log('[useOidcAuth] handleCallback called')
    loading.value = true
    error.value = null

    try {
      const callbackUser = await getUserManager().signinCallback()
      user.value = callbackUser
      ready.value = true
      const result = typeof callbackUser.state?.returnTo === 'string' ? callbackUser.state.returnTo : '/'
      console.log('[useOidcAuth] handleCallback returning', { returnTo: result })
      return result
    } catch (currentError) {
      error.value = formatError(currentError)
      throw currentError
    } finally {
      loading.value = false
    }
  }

  async function signout() {
    console.log('[useOidcAuth] signout called', {
      importMetaClient: import.meta.client,
      logoutUrl: appInfo.value.logoutUrl,
    })
    if (!import.meta.client) {
      console.log('[useOidcAuth] signout returning early because import.meta.client is false')
      return
    }

    error.value = null
    user.value = null
    ready.value = true
    await getUserManager().removeUser()
    console.log('[useOidcAuth] signout exiting via redirect', { logoutUrl: appInfo.value.logoutUrl })
    window.location.assign(appInfo.value.logoutUrl)
  }

  function clearError() {
    console.log('[useOidcAuth] clearError called')
    error.value = null
    console.log('[useOidcAuth] clearError completed')
  }

  console.log('[useOidcAuth] useOidcAuth returning API')
  return {
    appInfo,
    user,
    ready,
    loading,
    error,
    authenticated,
    displayName,
    initializeAuth,
    signin,
    handleCallback,
    signout,
    clearError,
  }
}

function normalizeDomain(value) {
  console.log('[useOidcAuth] normalizeDomain called', { value })
  const result = String(value || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  console.log('[useOidcAuth] normalizeDomain returning', { result })
  return result
}

function normalizeUrl(value) {
  console.log('[useOidcAuth] normalizeUrl called', { value })
  const result = String(value || '').replace(/\/$/, '')
  console.log('[useOidcAuth] normalizeUrl returning', { result })
  return result
}

function formatError(value) {
  console.log('[useOidcAuth] formatError called', { value })
  if (value instanceof Error) {
    console.log('[useOidcAuth] formatError returning error message', { message: value.message })
    return value.message
  }

  const result = String(value)
  console.log('[useOidcAuth] formatError returning stringified value', { result })
  return result
}
