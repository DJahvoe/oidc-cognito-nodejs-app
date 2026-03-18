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
$env:COGNITO_SCOPES="openid email profile"
$env:COGNITO_DOMAIN="<your-domain>.auth.ap-northeast-1.amazoncognito.com"
```

If your Cognito app client does not use a secret, leave `COGNITO_CLIENT_SECRET` unset.
If your Cognito app client allows `phone` instead of `profile`, set `COGNITO_SCOPES="openid email phone"`.

## 3. Run the app

```powershell
npm start
```

Open `http://localhost:3000`, click `Login`, and complete the Cognito sign-in flow.

## 4. How the code works

### Startup

When `app.js` starts, it:

- Loads values from `.env` in `config.js`
- Builds `BASE_URL`, for example `http://localhost:3000`
- Builds `redirectUri` as `BASE_URL/callback`
- Creates an Express session for storing login state
- Uses `Issuer.discover(COGNITO_ISSUER)` in `oidc-client.js` to read Cognito's OIDC metadata
- Creates an OpenID Connect client with your app client ID and optional secret

The `COGNITO_ISSUER` is the User Pool issuer URL, for example:

```text
https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxx
```

The `COGNITO_DOMAIN` is the Hosted UI domain, for example:

```text
your-domain.auth.ap-northeast-1.amazoncognito.com
```

### Session

This app keeps auth state in the server session.

Before login completes, the session stores temporary values:

- `state`
- `nonce`
- `codeVerifier`

After login completes, the session stores:

- `userInfo`
- `tokenSet`

That means the browser does not need to manage tokens directly for this sample app.

### Login flow

1. The user opens `/`
2. The app checks whether `req.session.userInfo` exists
3. If not logged in, the page shows a `Login` link
4. When the user opens `/login`, the app generates:
   - `state`
   - `nonce`
   - `codeVerifier`
5. The app creates a PKCE `codeChallenge` from the `codeVerifier`
6. The app stores those values in the session
7. The app redirects the browser to Cognito Hosted UI

These values are important:

- `state` protects against CSRF and callback tampering
- `nonce` protects against token replay and token substitution
- `codeVerifier` and `codeChallenge` are PKCE values used to protect the authorization code exchange

### Callback flow

After the user signs in on Cognito, Cognito redirects the browser back to:

```text
http://localhost:3000/callback
```

The app then:

1. Reads the `code` and `state` query parameters from the request
2. Calls `client.callback(...)`
3. Sends the authorization code to Cognito's token endpoint
4. Verifies the response using the stored `state`, `nonce`, and `codeVerifier`
5. Receives a `tokenSet`
6. Calls `client.userinfo(access_token)` to fetch the user's claims
7. Stores the result in `req.session.userInfo`
8. Redirects the user back to `/`

Once `req.session.userInfo` exists, the home page treats the user as authenticated.

### Logout flow

When the user opens `/logout`, the app:

1. Destroys the local Express session
2. Redirects the browser to Cognito's `/logout` endpoint
3. Passes:
   - `client_id`
   - `logout_uri`
4. Cognito clears the Hosted UI session and redirects the browser back to your app

### Route summary

- `/` shows either the login screen or the authenticated user info
- `/login` starts the OIDC authorization code flow
- `/callback` finishes the OIDC flow after Cognito redirects back
- `/logout` clears the local session and logs out from Cognito Hosted UI

## 5. File layout

- `app.js`: app startup, sessions, home route, and shared error handling
- `config.js`: `.env` loading and app configuration
- `oidc-client.js`: Cognito client creation and logout URL generation
- `auth-routes.js`: `/login`, `/callback`, and `/logout`
