<script setup>
const { appInfo, authenticated, displayName, user } = useOidcAuth()
const profilePreview = computed(() => JSON.stringify(user.value?.profile || null, null, 2))
</script>

<template>
  <section class="view-card">
    <span class="eyebrow">Main Menu</span>
    <h2>Nuxt app with Cognito Hosted UI</h2>
    <p>
      This page is the main menu after login. Anonymous access to <span class="mono">/</span>
      triggers the Nuxt route middleware, which redirects the browser to Cognito Hosted UI.
      After the user authenticates, Cognito returns to <span class="mono">/callback</span>
      and the app lands here.
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
          No Cognito user is currently stored in the Nuxt app.
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
