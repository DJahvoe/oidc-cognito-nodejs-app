<script setup>
const status = ref('Completing Cognito sign-in...')
const details = ref('')
const { handleCallback } = useOidcAuth()

onMounted(async () => {
  try {
    const returnTo = await handleCallback()
    status.value = 'Sign-in complete. Redirecting...'
    await navigateTo(returnTo, { replace: true })
  } catch (currentError) {
    status.value = 'Callback handling failed.'
    details.value = currentError instanceof Error ? currentError.message : String(currentError)
  }
})
</script>

<template>
  <section class="view-card">
    <span class="eyebrow">Callback</span>
    <h2>{{ status }}</h2>
    <p>
      This page only exists to finish the Cognito authorization code flow and return
      the user to the Nuxt route they originally asked for.
    </p>

    <div class="sub-grid">
      <article class="sub-card">
        <h3>What happens here</h3>
        <ul>
          <li>The app reads the authorization code from the browser URL</li>
          <li>`oidc-client-ts` validates state and PKCE data</li>
          <li>The user is written into browser storage</li>
          <li>The app replaces this URL with the original destination</li>
        </ul>
      </article>

      <article v-if="details" class="sub-card">
        <h3>Error details</h3>
        <pre>{{ details }}</pre>
      </article>
    </div>
  </section>
</template>
