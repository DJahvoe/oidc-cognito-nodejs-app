# Cognito SSO Demo with App 1 and App 2

This project now contains two separate Express apps:

- `App 1` on `http://localhost:3000`
- `App 2` on `http://localhost:4000`

Both apps use:

- the same Cognito User Pool
- the same Cognito Hosted UI domain
- the same Cognito issuer

Each app should use its own Cognito App Client. That is the recommended setup for SSO across multiple applications.

## Project layout

- `app1/server.js`: starts App 1
- `app2/server.js`: starts App 2
- `app1/.env.example`: sample config for App 1
- `app2/.env.example`: sample config for App 2
- `config.js`: loads app-specific `.env` files and builds runtime config
- `auth-routes.js`: shared `/login`, `/callback`, and `/logout` routes
- `oidc-client.js`: shared OIDC discovery and logout URL logic
- `server-factory.js`: shared Express server setup
- `views/home.ejs`: shared UI used by both apps

## What App Client means in this demo

There are two different things involved:

- The **Cognito App Client** is configured in AWS Cognito
- The **Node app** is the Express server in this repository

The Cognito App Client in AWS defines:

- allowed callback URLs
- allowed sign-out URLs
- allowed OAuth flow
- allowed scopes
- whether a client secret is required

The Node app reads those settings from `.env` and uses them at runtime.

Example mapping:

- `COGNITO_CLIENT_ID` = Cognito App Client ID for that app
- `COGNITO_CLIENT_SECRET` = Cognito App Client secret for that app, if used
- `COGNITO_ISSUER` = User Pool issuer URL
- `COGNITO_DOMAIN` = Hosted UI domain

## Recommended Cognito setup

Use one User Pool and create two App Clients inside it:

- `App 1 Client`
- `App 2 Client`

Both App Clients should use the same:

- User Pool
- Hosted UI domain
- identity providers

But each App Client should have its own callback and sign-out URLs.

### App 1 Cognito settings

- Callback URL: `http://localhost:3000/callback`
- Sign-out URL: `http://localhost:3000`
- OAuth flow: `Authorization code grant`
- Scopes: `openid email profile`

### App 2 Cognito settings

- Callback URL: `http://localhost:4000/callback`
- Sign-out URL: `http://localhost:4000`
- OAuth flow: `Authorization code grant`
- Scopes: `openid email profile`

## Environment files

Create these files:

- `app1/.env`
- `app2/.env`

Start from the provided examples:

- `app1/.env.example`
- `app2/.env.example`

### Example for App 1

```env
PORT=3000
BASE_URL=http://localhost:3000
SESSION_SECRET=replace-with-a-long-random-string-for-app1
COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxxx
COGNITO_DOMAIN=your-domain.auth.ap-northeast-1.amazoncognito.com
COGNITO_CLIENT_ID=your-app1-client-id
COGNITO_CLIENT_SECRET=your-app1-client-secret
COGNITO_SCOPES=openid email profile
APP1_URL=http://localhost:3000
APP2_URL=http://localhost:4000
```

### Example for App 2

```env
PORT=4000
BASE_URL=http://localhost:4000
SESSION_SECRET=replace-with-a-long-random-string-for-app2
COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxxx
COGNITO_DOMAIN=your-domain.auth.ap-northeast-1.amazoncognito.com
COGNITO_CLIENT_ID=your-app2-client-id
COGNITO_CLIENT_SECRET=your-app2-client-secret
COGNITO_SCOPES=openid email profile
APP1_URL=http://localhost:3000
APP2_URL=http://localhost:4000
```

Important:

- `COGNITO_ISSUER` should be the same in both apps
- `COGNITO_DOMAIN` should be the same in both apps
- `COGNITO_CLIENT_ID` should be different for App 1 and App 2
- `COGNITO_CLIENT_SECRET` should match each app's own App Client

## How App 1 and App 2 interact with Cognito

The SSO flow is split into two phases.

### Phase 1: Authorization request

When you click `Login with Cognito` in App 1 or App 2, the app redirects the browser to Cognito Hosted UI.

That redirect includes values like:

- `client_id`
- `redirect_uri`
- `response_type=code`
- `scope`
- `state`
- `nonce`
- PKCE `code_challenge`

Cognito checks those values against the App Client configured in AWS.

If they match, Cognito accepts the request and signs the user in.

### Phase 2: Token exchange

After Cognito redirects back to `/callback`, the Node app sends the authorization code to Cognito's token endpoint.

That back-channel request includes:

- `client_id`
- `client_secret` if required
- `code`
- `redirect_uri`
- PKCE `code_verifier`

Cognito validates the request and returns tokens for that specific app.

## Why SSO works

Each Express app has its own local session.

That means:

- logging into App 1 creates a local session only in App 1
- App 2 is still locally logged out until it performs its own login flow

SSO works because Cognito Hosted UI has its own session cookie.

So after this sequence:

1. You log in on App 1
2. Cognito stores the hosted UI session
3. You open App 2
4. App 2 redirects to the same Cognito Hosted UI domain

Cognito sees the existing hosted UI session and can authenticate you again without asking for credentials.

That is the shared SSO layer.

## How to run the demo

Use two terminals.

### Terminal 1

```powershell
npm run start:app1
```

### Terminal 2

```powershell
npm run start:app2
```

Then open:

- App 1: `http://localhost:3000`
- App 2: `http://localhost:4000`

## How to test SSO

1. Open App 1
2. Click `Login with Cognito`
3. Complete login in Cognito Hosted UI
4. After App 1 shows you as authenticated, use the menu to open App 2
5. In App 2, click `Login with Cognito`
6. Cognito should reuse the same Hosted UI session and return you without asking for credentials again

If that happens, SSO is working.

## What the UI does

Both apps now show:

- a top menu with links to `App 1` and `App 2`
- a login or logout button
- the current app's callback URL
- the current app's App Client ID
- a panel explaining the SSO behavior
- the Cognito user claims after login

This makes it easier to verify that:

- both apps are using different App Clients
- both apps are using the same Cognito login session

## Important logout behavior

When you click `/logout` in one app:

1. the local Express session is destroyed
2. the browser is redirected to Cognito `/logout`
3. Cognito clears the Hosted UI session

Because Cognito clears the shared Hosted UI session, that affects SSO for both apps.

## Verification

Code changes were syntax-checked with:

```powershell
node --check app1/server.js
node --check app2/server.js
node --check config.js
node --check auth-routes.js
node --check oidc-client.js
node --check server-factory.js
```
