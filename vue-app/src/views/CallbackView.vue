<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { handleSigninCallback } from '../auth/oidc'

const router = useRouter()
const status = ref('Completing Cognito sign-in...')
const details = ref('')

onMounted(async () => {
  try {
    const returnTo = await handleSigninCallback()
    status.value = 'Sign-in complete. Redirecting...'
    await router.replace(returnTo)
  } catch (error) {
    status.value = 'Callback handling failed.'
    details.value = error instanceof Error ? error.message : String(error)
  }
})
</script>

<template>
  <section class="view-card">
    <span class="eyebrow">Callback</span>
    <h2>{{ status }}</h2>
    <p>
      This route is only here to finish the Cognito authorization code flow and restore
      the original Vue route.
    </p>

    <div class="sub-grid">
      <article class="sub-card">
        <h3>What happens here</h3>
        <ul>
          <li>The SPA reads the authorization code from the browser URL</li>
          <li>`oidc-client-ts` validates state and PKCE data</li>
          <li>The user is written into browser storage</li>
          <li>The router replaces this URL with the original destination</li>
        </ul>
      </article>

      <article v-if="details" class="sub-card">
        <h3>Error details</h3>
        <pre>{{ details }}</pre>
      </article>
    </div>
  </section>
</template>
