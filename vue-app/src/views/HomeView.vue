<script setup>
import { computed } from 'vue'
import { appInfo, authState, getDisplayName, isAuthenticated } from '../auth/oidc'

const authenticated = computed(() => isAuthenticated())
const profilePreview = computed(() => JSON.stringify(authState.user?.profile || null, null, 2))
const displayName = computed(() => getDisplayName())
</script>

<template>
  <section class="view-card">
    <span class="eyebrow">Home</span>
    <h2>Simple Vue SPA with Cognito OIDC</h2>
    <p>
      This app is a browser-side OIDC sample. The protected route triggers a Cognito redirect,
      the callback route finishes the login, and the user profile stays in browser storage.
    </p>

    <div class="sub-grid">
      <article class="sub-card">
        <h3>What to configure in Cognito</h3>
        <ul>
          <li>Allowed callback URL: <span class="mono">{{ appInfo.redirectUri }}</span></li>
          <li>Allowed sign-out URL: <span class="mono">{{ appInfo.baseUrl }}</span></li>
          <li>OAuth flow: Authorization code grant</li>
          <li>Scopes: <span class="mono">{{ appInfo.scopes }}</span></li>
        </ul>
      </article>

      <article class="sub-card">
        <h3>Session summary</h3>
        <p v-if="authenticated">
          Signed in as <strong>{{ displayName }}</strong>.
        </p>
        <p v-else>
          No Cognito user is currently stored in the SPA.
        </p>
      </article>
    </div>

    <div class="sub-grid">
      <article class="sub-card">
        <h3>OIDC configuration</h3>
        <ul>
          <li>Authority: <span class="mono">{{ appInfo.authority }}</span></li>
          <li>Client ID: <span class="mono">{{ appInfo.clientId }}</span></li>
          <li>Domain: <span class="mono">{{ appInfo.cognitoDomain }}</span></li>
        </ul>
      </article>

      <article class="sub-card">
        <h3>Profile snapshot</h3>
        <pre>{{ profilePreview }}</pre>
      </article>
    </div>
  </section>
</template>
