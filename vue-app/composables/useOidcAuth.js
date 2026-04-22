import { computed } from 'vue'
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

let userManager
const POST_LOGOUT_RELOGIN_KEY = 'oidc-post-logout-relogin'

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
      redirectUri: baseUrl || '/',
      authority: runtimeConfig.public.cognitoIssuer,
      clientId: runtimeConfig.public.cognitoClientId,
      cognitoDomain: normalizeDomain(runtimeConfig.public.cognitoDomain),
      scopes: runtimeConfig.public.cognitoScopes || 'openid email profile',
    }

    console.log('[useOidcAuth] appInfo computed returning', result)
    return result
  })

  const authenticated = computed(() => Boolean(user.value && !user.value.expired))
  const logoutDebug = computed(() => {
    const result = {
      appBaseUrl: appInfo.value.baseUrl,
      clientId: appInfo.value.clientId,
      cognitoDomain: appInfo.value.cognitoDomain,
      logoutUrl: appInfo.value.baseUrl ? buildLogoutUrl(appInfo.value) : '',
      scopes: appInfo.value.scopes,
    }

    console.log('[useOidcAuth] logoutDebug computed returning', result)
    return result
  })
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
      baseUrl: appInfo.value.baseUrl,
    })
    if (!import.meta.client) {
      console.log('[useOidcAuth] signout returning early because import.meta.client is false')
      return
    }

    error.value = null
    user.value = null
    ready.value = true
    await getUserManager().removeUser()
    markPostLogoutRelogin(`${window.location.pathname}${window.location.search}`)
    const logoutUrl = buildLogoutUrl(appInfo.value)
    console.log('[useOidcAuth] signout exiting via redirect', { logoutUrl })
    window.location.assign(logoutUrl)
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
    logoutDebug,
    displayName,
    initializeAuth,
    signin,
    handleCallback,
    signout,
    clearError,
    consumePostLogoutRelogin,
  }
}

function normalizeDomain(value) {
  console.log('[useOidcAuth] normalizeDomain called', { value })
  const result = String(value || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  console.log('[useOidcAuth] normalizeDomain returning', { result })
  return result
}

function buildLogoutUrl(appInfo) {
  console.log('[useOidcAuth] buildLogoutUrl called', { appInfo })
  const logoutUrl = new URL(`https://${appInfo.cognitoDomain}/logout`)
  logoutUrl.searchParams.set('client_id', appInfo.clientId)
  logoutUrl.searchParams.set('logout_uri', appInfo.baseUrl)
  const result = logoutUrl.toString()
  console.log('[useOidcAuth] buildLogoutUrl returning', { result })
  return result
}

function markPostLogoutRelogin(returnTo) {
  console.log('[useOidcAuth] markPostLogoutRelogin called', { returnTo })
  if (!import.meta.client) {
    console.log('[useOidcAuth] markPostLogoutRelogin returning early because import.meta.client is false')
    return
  }

  window.sessionStorage.setItem(POST_LOGOUT_RELOGIN_KEY, returnTo)
  console.log('[useOidcAuth] markPostLogoutRelogin completed')
}

function consumePostLogoutRelogin() {
  console.log('[useOidcAuth] consumePostLogoutRelogin called')
  if (!import.meta.client) {
    console.log('[useOidcAuth] consumePostLogoutRelogin returning null because import.meta.client is false')
    return null
  }

  const returnTo = window.sessionStorage.getItem(POST_LOGOUT_RELOGIN_KEY)

  if (!returnTo) {
    console.log('[useOidcAuth] consumePostLogoutRelogin returning null because no flag exists')
    return null
  }

  window.sessionStorage.removeItem(POST_LOGOUT_RELOGIN_KEY)
  console.log('[useOidcAuth] consumePostLogoutRelogin returning', { returnTo })
  return returnTo
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
