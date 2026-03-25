<template>
  <section class="view-card">
    <span class="eyebrow">Public Route</span>
    <h2>Anyone can open this page</h2>
    <p>
      This route stays public in the Nuxt app. It is useful for a landing page,
      documentation, or any pre-login explanation while the main menu and protected
      page still require Cognito authentication.
    </p>

    <div class="sub-grid">
      <article class="sub-card">
        <h3>Expected behavior</h3>
        <ul>
          <li>No redirect to Cognito</li>
          <li>No callback processing</li>
          <li>Works before login and after logout</li>
        </ul>
      </article>

      <article class="sub-card">
        <h3>Suggested test</h3>
        <p>
          Open this page first, then move to the main menu to see the Hosted UI redirect begin.
        </p>
      </article>
    </div>
  </section>
</template>
