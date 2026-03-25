<script setup>
const navigation = [
  { to: '/', label: 'Main Menu' },
  { to: '/public-page', label: 'Public Page' },
  { to: '/protected-page', label: 'Protected Page' },
]

const {
  appInfo,
  authenticated,
  displayName,
  error,
  clearError,
  initializeAuth,
  signin,
  signout,
} = useOidcAuth()

onMounted(() => {
  initializeAuth()
})
</script>

<template>
  <div class="app-shell">
    <header class="hero-card">
      <div class="hero-copy">
        <span class="eyebrow">Nuxt + Cognito OIDC</span>
        <h1>{{ appInfo.appName }}</h1>
        <p>
          Opening the main menu requires authentication. If the user is not logged in,
          the route middleware redirects the browser to Cognito Hosted UI, Cognito
          returns to <span class="mono">/callback</span>, and the app lands on the
          main menu after sign-in.
        </p>
      </div>

      <div class="hero-actions">
        <button
          v-if="!authenticated"
          class="primary-btn"
          type="button"
          @click="signin()"
        >
          Sign In
        </button>
        <button
          v-else
          class="primary-btn"
          type="button"
          @click="signout()"
        >
          Sign Out
        </button>
      </div>
    </header>

    <nav class="nav-row" aria-label="Primary">
      <NuxtLink
        v-for="link in navigation"
        :key="link.to"
        :to="link.to"
        class="nav-pill"
        active-class="router-link-partial"
        exact-active-class="router-link-active"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>

    <section v-if="error" class="message-card message-card--error">
      <div>
        <strong>Authentication error</strong>
        <p>{{ error }}</p>
      </div>
      <button type="button" class="ghost-btn" @click="clearError()">
        Dismiss
      </button>
    </section>

    <section class="status-grid">
      <article class="info-card">
        <span class="card-label">Session state</span>
        <strong>{{ authenticated ? 'Authenticated' : 'Anonymous' }}</strong>
        <p>{{ authenticated ? displayName : 'No Cognito user is stored locally.' }}</p>
      </article>

      <article class="info-card">
        <span class="card-label">Callback URL</span>
        <strong>{{ appInfo.redirectUri }}</strong>
        <p>Register this exact URL in the Cognito app client.</p>
      </article>

      <article class="info-card">
        <span class="card-label">Issuer</span>
        <strong>{{ appInfo.authority }}</strong>
        <p>This is the authority used for OIDC discovery.</p>
      </article>
    </section>

    <main>
      <NuxtPage />
    </main>
  </div>
</template>
