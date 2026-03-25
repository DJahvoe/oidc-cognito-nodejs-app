export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  if (to.path === '/callback' || to.path === '/public-page') {
    return
  }

  const { authenticated, initializeAuth, signin } = useOidcAuth()

  await initializeAuth()

  if (!authenticated.value) {
    await signin(to.fullPath)
    return abortNavigation()
  }
})
