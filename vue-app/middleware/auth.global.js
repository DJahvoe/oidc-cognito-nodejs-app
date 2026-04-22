export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  if (to.path === '/public-page') {
    return
  }

  const {
    authenticated,
    initializeAuth,
    signin,
    handleCallback,
    consumePostLogoutRelogin,
  } = useOidcAuth()

  if (isOidcCallbackRequest(to)) {
    try {
      const returnTo = await handleCallback()

      if (returnTo !== to.fullPath) {
        return navigateTo(returnTo, { replace: true })
      }
    } catch {
      return
    }

    return
  }

  const postLogoutReturnTo = consumePostLogoutRelogin()

  if (postLogoutReturnTo) {
    await signin(postLogoutReturnTo)
    return abortNavigation()
  }

  await initializeAuth()

  if (!authenticated.value) {
    await signin(to.fullPath)
    return abortNavigation()
  }
})

function isOidcCallbackRequest(to) {
  return Boolean(
    typeof to.query.code === 'string' ||
    typeof to.query.error === 'string',
  )
}
