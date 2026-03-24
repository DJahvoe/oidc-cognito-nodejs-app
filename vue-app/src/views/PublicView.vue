<template>
  <section class="view-card">
    <span class="eyebrow">Public Route</span>
    <h2>Anyone can open this page</h2>
    <p>
      This route does not require a Cognito session. It is useful for landing pages,
      docs, pricing, or pre-login explanations in a Vue SPA.
    </p>

    <div class="sub-grid">
      <article class="sub-card">
        <h3>Expected behavior</h3>
        <ul>
          <li>No redirect to Cognito</li>
          <li>No token processing</li>
          <li>Works before login and after logout</li>
        </ul>
      </article>

      <article class="sub-card">
        <h3>Suggested test</h3>
        <p>
          Open this page first, then move to the protected page to see the login redirect begin.
        </p>
      </article>
    </div>
  </section>
</template>
