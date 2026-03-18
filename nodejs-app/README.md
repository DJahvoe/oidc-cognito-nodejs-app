# Simple Cognito OIDC App

This app uses Express, server-side sessions, and `openid-client` with the authorization code flow.

## 1. Cognito setup

Create or use an existing Cognito User Pool, then configure:

- A User Pool app client
- A Cognito hosted UI domain or custom domain
- Allowed callback URL: `http://localhost:3000/callback`
- Allowed sign-out URL: `http://localhost:3000`
- OAuth grant type: `Authorization code grant`
- OAuth scopes: at least `openid`, `email`, `profile`

## 2. Required environment variables

Create `.env` from `.env.example` and fill in your Cognito values.

You can still set the same values in PowerShell if you prefer:

```powershell
$env:PORT="3000"
$env:BASE_URL="http://localhost:3000"
$env:SESSION_SECRET="replace-this"
$env:COGNITO_ISSUER="https://cognito-idp.ap-northeast-1.amazonaws.com/<user-pool-id>"
$env:COGNITO_CLIENT_ID="<app-client-id>"
$env:COGNITO_CLIENT_SECRET="<app-client-secret>"
$env:COGNITO_DOMAIN="<your-domain>.auth.ap-northeast-1.amazoncognito.com"
```

If your Cognito app client does not use a secret, leave `COGNITO_CLIENT_SECRET` unset.

## 3. Run the app

```powershell
npm start
```

Open `http://localhost:3000`, click `Login`, and complete the Cognito sign-in flow.

## What was missing in the original code

- No `app.listen(...)`, so the app never started serving requests
- The callback route resolved to `/`, which collided with the home page route
- The redirect URI used the site root instead of a dedicated callback path
- The login route could run before the OIDC client finished discovery
- Logout still had placeholder values
- Hardcoded secrets and IDs made the app brittle and unsafe
