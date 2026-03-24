# Vue Cognito OIDC Demo

This folder contains a simple Vue 3 SPA that signs in with Amazon Cognito using:

- authorization code flow
- PKCE
- browser redirects

It is intentionally a public browser app, so it does **not** use a client secret.

## What it includes

- `Vue 3`
- `Vue Router`
- `oidc-client-ts`
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
VITE_APP_NAME=Vue Cognito OIDC Demo
VITE_PORT=5173
VITE_COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=your-public-spa-client-id
VITE_COGNITO_DOMAIN=your-domain.auth.ap-northeast-1.amazoncognito.com
VITE_COGNITO_SCOPES=openid email profile
```

Important:

- do **not** put `COGNITO_CLIENT_SECRET` in a browser SPA
- create a Cognito app client without a secret
- enable authorization code grant
- `VITE_PORT` controls the Vite dev server port
- if you change `VITE_PORT`, update the Cognito callback and sign-out URLs to match it exactly

## Cognito app-client settings

For Vite local development, if `VITE_PORT=5173`, use:

- callback URL: `http://localhost:5173/callback`
- sign-out URL: `http://localhost:5173`
- OAuth flow: `Authorization code grant`
- scopes: `openid email profile`

Use the same user pool and Hosted UI domain as your other Cognito apps if you want Cognito Hosted UI SSO across them.

## How it works

1. User opens the Vue SPA
2. Public routes render immediately
3. Protected routes trigger `signinRedirect()`
4. Cognito authenticates the user
5. Cognito sends the browser back to `/callback`
6. The app processes the callback and stores the user in browser storage
7. The protected route renders

## Logout

This sample uses a manual redirect to Cognito `/logout` instead of library-driven RP logout because Cognito expects `logout_uri` on its managed logout endpoint.

## Run it

From `vue-app`:

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:<VITE_PORT>
```

## Routes

- `/`: home page
- `/public-page`: route that anyone can open
- `/protected-page`: route that requires authentication
- `/callback`: Cognito redirect callback

## AWS references

- [Using PKCE in authorization code grants](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html)
- [Authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)
- [Login endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/login-endpoint.html)
- [Logout endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html)
