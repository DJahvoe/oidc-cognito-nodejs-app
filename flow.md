# Vue App Auth Flow

This document explains the complete authentication flow for `vue-app` as the code works today.

Relevant files:

- [vue-app/composables/useOidcAuth.js](C:/Users/satri/Desktop/SAV/code/oidc-cognito-app-test/vue-app/composables/useOidcAuth.js)
- [vue-app/middleware/auth.global.js](C:/Users/satri/Desktop/SAV/code/oidc-cognito-app-test/vue-app/middleware/auth.global.js)
- [vue-app/app.vue](C:/Users/satri/Desktop/SAV/code/oidc-cognito-app-test/vue-app/app.vue)

## 1. App starts on the Vue root URL

The Vue app runs on one root URL, for example:

```text
http://localhost:5000
```

The app also uses that same root URL for:

- Cognito callback URL
- Cognito default redirect URL
- Cognito allowed sign-out URL

In `useOidcAuth`, the runtime `redirectUri` is set to `window.location.origin`, not `/callback`.

## 2. User opens a protected route

When the user opens `/` or `/protected-page`, the global route middleware runs first.

File:

- [vue-app/middleware/auth.global.js](C:/Users/satri/Desktop/SAV/code/oidc-cognito-app-test/vue-app/middleware/auth.global.js)

What it does:

1. skips server-side execution
2. allows `/public-page` without authentication
3. checks whether the current URL looks like a Cognito callback
4. checks whether the app is returning from a logout
5. otherwise initializes local auth state
6. if the user is still anonymous, starts login

## 3. Vue checks existing local browser auth state

The middleware calls `initializeAuth()`.

File:

- [vue-app/composables/useOidcAuth.js](C:/Users/satri/Desktop/SAV/code/oidc-cognito-app-test/vue-app/composables/useOidcAuth.js)

`initializeAuth()`:

1. gets or creates a shared `UserManager`
2. reads the stored OIDC user from browser `localStorage`
3. writes that user into Nuxt state
4. marks auth as ready

If a valid local OIDC user already exists, the route continues normally and the user stays in the app.

## 4. If there is no local user, Vue starts Cognito login

If `authenticated` is false after initialization, the middleware calls `signin(to.fullPath)`.

`signin()`:

1. clears any previous local auth error
2. calls `getUserManager().signinRedirect(...)`
3. stores `returnTo` inside the OIDC state object
4. sends the browser away from Vue to Cognito Hosted UI

At this point the browser leaves the Vue app entirely.

## 5. Cognito Hosted UI authenticates the user

On the Cognito side:

1. the browser lands on the Hosted UI authorization flow
2. the user signs in, or Cognito reuses an existing Hosted UI session
3. Cognito redirects the browser back to the configured callback URL

For this app, that callback URL is the Vue root, for example:

```text
http://localhost:5000
```

The callback now includes query parameters like:

```text
?code=...&state=...
```

## 6. Vue receives the callback on `/`

When the browser comes back to `/` with `code` or `error` in the query string, the middleware treats that request as an OIDC callback.

It calls `handleCallback()`.

`handleCallback()`:

1. calls `getUserManager().signinCallback()`
2. lets `oidc-client-ts` validate state and PKCE data
3. exchanges the authorization code for tokens
4. stores the authenticated user in browser storage
5. writes the user into Nuxt state
6. reads the original `returnTo` value from callback state
7. returns that route to the middleware

If the user originally asked for `/protected-page`, the middleware navigates back there.

If there is no custom `returnTo`, the app stays on `/`.

## 7. App is now authenticated locally

After callback handling:

- `authenticated` becomes true
- `displayName` is derived from the user profile
- the top-level UI in [vue-app/app.vue](C:/Users/satri/Desktop/SAV/code/oidc-cognito-app-test/vue-app/app.vue) shows the authenticated state
- protected routes are now allowed

At this point there are two kinds of session state:

- local Vue browser state managed by `oidc-client-ts`
- Cognito Hosted UI browser session on the Cognito domain

The local state lets Vue know the user is signed in right now.
The Cognito Hosted UI session lets future logins reuse the Cognito browser session.

## 8. User clicks Sign Out

When the user clicks the sign-out button, Vue calls `signout()`.

`signout()` does four important things:

1. clears local error state
2. clears the current Vue user state
3. removes the locally stored OIDC user with `removeUser()`
4. stores a temporary `sessionStorage` flag named `oidc-post-logout-relogin`

That flag exists so the app knows it should immediately start a fresh login after logout finishes.

## 9. Vue redirects the browser to Cognito `/logout`

Still inside `signout()`, Vue builds a logout URL like this:

```text
https://<cognito-domain>/logout?client_id=<client-id>&logout_uri=http://localhost:5000
```

The `logout_uri` is the Vue app root URL.

Vue then calls:

```text
window.location.assign(logoutUrl)
```

So the browser leaves the app again and goes to Cognito.

## 10. Cognito clears its Hosted UI session

At the Cognito domain:

1. Cognito receives `/logout`
2. Cognito checks that `client_id` is valid
3. Cognito checks that `logout_uri` exactly matches one of the app client's allowed sign-out URLs
4. Cognito clears the managed login session
5. Cognito redirects the browser back to `http://localhost:5000`

If `client_id` or `logout_uri` do not match the app client configuration exactly, Cognito shows:

```text
Invalid request
Please check your input and try again.
```

## 11. Vue sees the post-logout return to `/`

When the browser returns to the app root after logout, the middleware runs again.

Before it does normal auth initialization, it calls `consumePostLogoutRelogin()`.

That function:

1. checks `sessionStorage` for the `oidc-post-logout-relogin` flag
2. reads the saved route the user came from
3. removes the flag so it only runs once
4. returns the saved route

## 12. Vue immediately starts a fresh login again

If the post-logout flag exists, the middleware calls:

```text
signin(postLogoutReturnTo)
```

That starts a brand-new `signinRedirect()` flow.

This is the key point:

- Vue does not try to continue the old OIDC transaction
- Vue creates a completely fresh PKCE and state setup
- the browser goes back to Cognito Hosted UI login again

That is why the app can reliably do:

1. logout
2. return to the app
3. immediately show Cognito login again

without breaking `oidc-client-ts`

## 13. User logs in again

After the browser returns to Cognito Hosted UI again:

1. the user signs in
2. Cognito redirects back to `http://localhost:5000?code=...&state=...`
3. Vue middleware detects callback params
4. `handleCallback()` processes the new login
5. Vue navigates back to the saved route

This completes the full cycle:

1. login
2. callback to app
3. authenticated app usage
4. logout
5. Cognito session cleared
6. return to app
7. start login again
8. callback to app again

## Short summary

The current Vue app uses one root URL for everything:

- login callback target
- post-login landing
- post-logout return

The middleware decides which phase the app is in by checking:

- callback query parameters like `code` and `state`
- the post-logout re-login flag in `sessionStorage`
- the locally stored OIDC user in `localStorage`

That is what lets the app share one URL while still supporting:

- normal login
- callback handling
- logout
- immediate login-again flow
