# Nuxt Cognito OIDC Demo

This folder contains a Nuxt app that signs in with Amazon Cognito using:

- authorization code flow
- PKCE
- browser redirects

The app runs with `ssr: false`, so the authentication flow behaves like a client-side SPA while still using Nuxt pages and route middleware.

It is intentionally a public browser app, so it does **not** use a client secret.

## What it includes

- `Nuxt`
- `oidc-client-ts`
- global route middleware
- Cognito login redirect
- Cognito callback handling
- public route
- protected route
- manual Cognito logout

## Environment file

Create:

- `vue-app/.env`

Start from:

- `vue-app/.env.example`

Example:

```env
NUXT_PORT=5173
NUXT_PUBLIC_APP_NAME=Nuxt Cognito OIDC Demo
NUXT_PUBLIC_COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxxx
NUXT_PUBLIC_COGNITO_CLIENT_ID=your-public-spa-client-id
NUXT_PUBLIC_COGNITO_DOMAIN=your-domain.auth.ap-northeast-1.amazoncognito.com
NUXT_PUBLIC_COGNITO_SCOPES=openid email profile
NUXT_PUBLIC_LOGOUT_URL=http://localhost:5000/logout
```

Important:

- do **not** put `COGNITO_CLIENT_SECRET` in a browser app
- create a Cognito app client without a secret
- enable authorization code grant
- `NUXT_PORT` controls the Nuxt dev server port
- if you change `NUXT_PORT`, update the Cognito callback URL to match it exactly
- `NUXT_PUBLIC_LOGOUT_URL` defaults to the shared custom-login app logout route on `http://localhost:5000/logout`
- the config also accepts the older `VITE_*` variables as a fallback while you transition

## Cognito app-client settings

For local development, if `NUXT_PORT=5173`, use:

- callback URL: `http://localhost:5173/callback`
- shared logout route for the Vue app: `http://localhost:5000/logout`
- OAuth flow: `Authorization code grant`
- scopes: `openid email profile`

Use the same user pool and Hosted UI domain as your other Cognito apps if you want Cognito Hosted UI SSO across them. The Vue app now clears its local OIDC state and then redirects to the custom-login app's logout route, which performs the Cognito Hosted UI logout on `localhost:5000`.

## How it works

1. User opens the Nuxt app
2. If the user opens `/` or `/protected-page` without a session, the global route middleware triggers `signinRedirect()`
3. Cognito Hosted UI authenticates the user
4. Cognito sends the browser back to `/callback`
5. The callback page processes the authorization code and stores the user in browser storage
6. The app redirects to the original route, with `/` acting as the main menu after login
7. `public-page` remains available without authentication

## Logout

This sample clears the SPA's local OIDC state and then redirects to `NUXT_PUBLIC_LOGOUT_URL`, which defaults to `http://localhost:5000/logout`. That shared route is responsible for redirecting the browser to Cognito `/logout`.

## Run it

From `vue-app`:

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:<NUXT_PORT>
```

## Routes

- `/`: main menu after login; redirects anonymous users to Cognito Hosted UI
- `/public-page`: route that anyone can open
- `/protected-page`: route that requires authentication
- `/callback`: Cognito redirect callback

## Files

- `app.vue`: top-level app shell
- `nuxt.config.ts`: Nuxt runtime and port configuration
- `composables/useOidcAuth.js`: Cognito OIDC client logic
- `middleware/auth.global.js`: global auth redirect behavior
- `pages/`: Nuxt routes

## AWS references

- [Using PKCE in authorization code grants](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html)
- [Authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)
- [Login endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/login-endpoint.html)
- [Logout endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html)
