<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import {
  appInfo,
  authState,
  clearAuthError,
  getDisplayName,
  initializeAuth,
  isAuthenticated,
  signin,
  signout,
} from './auth/oidc'

const navigation = [
  { to: '/', label: 'Home' },
  { to: '/public-page', label: 'Public Page' },
  { to: '/protected-page', label: 'Protected Page' },
]

const authenticated = computed(() => isAuthenticated())
const displayName = computed(() => getDisplayName())

onMounted(() => {
  initializeAuth()
})
</script>

<template>
  <div class="app-shell">
    <header class="hero-card">
      <div class="hero-copy">
        <span class="eyebrow">Vue + Cognito OIDC</span>
        <h1>{{ appInfo.appName }}</h1>
        <p>
          This SPA uses the authorization code flow with PKCE. Public pages render
          normally, protected pages redirect to Cognito, and the callback route
          restores the Vue app after sign-in.
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
      <RouterLink
        v-for="link in navigation"
        :key="link.to"
        :to="link.to"
        class="nav-pill"
      >
        {{ link.label }}
      </RouterLink>
    </nav>

    <section v-if="authState.error" class="message-card message-card--error">
      <div>
        <strong>Authentication error</strong>
        <p>{{ authState.error }}</p>
      </div>
      <button type="button" class="ghost-btn" @click="clearAuthError()">
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
        <span class="card-label">Authority</span>
        <strong>{{ appInfo.authority }}</strong>
        <p>This is the issuer used for OIDC discovery.</p>
      </article>
    </section>

    <main>
      <RouterView />
    </main>
  </div>
</template>
