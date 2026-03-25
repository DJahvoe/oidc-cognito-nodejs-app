import { computed } from 'vue'
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

let userManager

export function useOidcAuth() {
  const runtimeConfig = useRuntimeConfig()
  const user = useState('oidc-user', () => null)
  const ready = useState('oidc-ready', () => false)
  const loading = useState('oidc-loading', () => false)
  const error = useState('oidc-error', () => null)

  const appInfo = computed(() => {
    const baseUrl = import.meta.client ? window.location.origin : ''

    return {
      appName: runtimeConfig.public.appName || 'Nuxt Cognito OIDC Demo',
      baseUrl,
      redirectUri: baseUrl ? `${baseUrl}/callback` : '/callback',
      authority: runtimeConfig.public.cognitoIssuer,
      clientId: runtimeConfig.public.cognitoClientId,
      cognitoDomain: normalizeDomain(runtimeConfig.public.cognitoDomain),
      scopes: runtimeConfig.public.cognitoScopes || 'openid email profile',
    }
  })

  const authenticated = computed(() => Boolean(user.value && !user.value.expired))
  const displayName = computed(() => {
    if (!user.value) {
      return 'Anonymous'
    }

    const profile = user.value.profile || {}
    return profile.preferred_username || profile.email || profile.username || profile.sub || 'Authenticated user'
  })

  function getUserManager() {
    if (!import.meta.client) {
      throw new Error('OIDC operations are only available in the browser.')
    }

    if (userManager) {
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

    return userManager
  }

  async function initializeAuth() {
    if (ready.value || !import.meta.client) {
      return user.value
    }

    loading.value = true
    error.value = null

    try {
      user.value = await getUserManager().getUser()
      return user.value
    } catch (currentError) {
      error.value = formatError(currentError)
      return null
    } finally {
      ready.value = true
      loading.value = false
    }
  }

  async function signin(returnTo = `${window.location.pathname}${window.location.search}`) {
    error.value = null

    await getUserManager().signinRedirect({
      state: {
        returnTo,
      },
    })
  }

  async function handleCallback() {
    loading.value = true
    error.value = null

    try {
      const callbackUser = await getUserManager().signinCallback()
      user.value = callbackUser
      ready.value = true
      return typeof callbackUser.state?.returnTo === 'string' ? callbackUser.state.returnTo : '/'
    } catch (currentError) {
      error.value = formatError(currentError)
      throw currentError
    } finally {
      loading.value = false
    }
  }

  async function signout() {
    if (!import.meta.client) {
      return
    }

    error.value = null
    user.value = null
    ready.value = true
    await getUserManager().removeUser()

    const logoutUrl = new URL(`https://${appInfo.value.cognitoDomain}/logout`)
    logoutUrl.searchParams.set('client_id', appInfo.value.clientId)
    logoutUrl.searchParams.set('logout_uri', appInfo.value.baseUrl)

    window.location.assign(logoutUrl.toString())
  }

  function clearError() {
    error.value = null
  }

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
  return String(value || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function formatError(value) {
  if (value instanceof Error) {
    return value.message
  }

  return String(value)
}
