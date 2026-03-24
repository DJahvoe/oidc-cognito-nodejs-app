<script setup>
import { computed } from 'vue'
import { authState, getDisplayName } from '../auth/oidc'

const displayName = computed(() => getDisplayName())
const profilePreview = computed(() => JSON.stringify(authState.user?.profile || null, null, 2))
</script>

<template>
  <section class="view-card">
    <span class="eyebrow">Protected Route</span>
    <h2>This page requires authentication</h2>
    <p>
      If you reached this page, the router guard already verified that a valid Cognito user
      exists locally. Without that user, the guard redirects the browser to Cognito first.
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
          <li>Vue route guard checks local user state</li>
          <li>If missing, `signinRedirect()` starts the OIDC flow</li>
          <li>Cognito sends the browser to `/callback`</li>
          <li>The app restores the original route after callback processing</li>
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
