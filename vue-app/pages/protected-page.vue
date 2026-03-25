<script setup>
const { displayName, user } = useOidcAuth()
const profilePreview = computed(() => JSON.stringify(user.value?.profile || null, null, 2))
</script>

<template>
  <section class="view-card">
    <span class="eyebrow">Protected Route</span>
    <h2>This page requires authentication</h2>
    <p>
      If you reached this page, the global route middleware already verified that a valid
      Cognito user exists locally. Without that user, the middleware redirects the browser
      to Cognito before this page renders.
    </p>

    <div class="sub-grid">
      <article class="sub-card">
        <h3>Authenticated user</h3>
        <p><strong>{{ displayName }}</strong></p>
        <p>The profile below is coming from the stored OIDC user object.</p>
      </article>

      <article class="sub-card">
        <h3>Protected flow</h3>
        <ul>
          <li>Nuxt route middleware checks local user state</li>
          <li>If missing, `signinRedirect()` starts the OIDC flow</li>
          <li>Cognito sends the browser to <span class="mono">/callback</span></li>
          <li>The callback page restores the original route after processing</li>
        </ul>
      </article>
    </div>

    <div class="sub-grid">
      <article class="sub-card">
        <h3>Profile claims</h3>
        <pre>{{ profilePreview }}</pre>
      </article>
    </div>
  </section>
</template>
