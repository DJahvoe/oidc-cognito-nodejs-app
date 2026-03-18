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

## 4. How the code works

### App Client vs this Node app

There are two different "clients" involved in this project:

- The **Cognito App Client** is the application record you create inside your Cognito User Pool in AWS
- The **Node app** is your Express server in this repository

The Cognito App Client in AWS defines:

- which callback URLs are allowed
- which logout URLs are allowed
- which OAuth flow is allowed
- which scopes are allowed
- whether a client secret is required

This Node app uses those Cognito App Client settings through these environment variables:

- `COGNITO_CLIENT_ID` maps to the Cognito App Client ID
- `COGNITO_CLIENT_SECRET` maps to the Cognito App Client secret, if that app client has one
- `COGNITO_ISSUER` tells the Node app which User Pool to talk to
- `COGNITO_DOMAIN` tells the Node app which Hosted UI domain to use for logout

So the AWS side stores the registration and rules, while the Node app reads those values and follows those rules at runtime.

### Startup

When `app.js` starts, it:

- Loads values from `.env`
- Builds `BASE_URL`, for example `http://localhost:3000`
- Builds `redirectUri` as `BASE_URL/callback`
- Creates an Express session for storing login state
- Uses `Issuer.discover(COGNITO_ISSUER)` to read Cognito's OIDC metadata
- Creates an OpenID Connect client with your app client ID and optional secret

The `COGNITO_ISSUER` is the User Pool issuer URL, for example:

```text
https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxx
```

The `COGNITO_DOMAIN` is the Hosted UI domain, for example:

```text
your-domain.auth.ap-northeast-1.amazoncognito.com
```

### How the Node app and Cognito App Client interact

At startup, the Node app creates an OpenID Connect client using your Cognito App Client ID and optional secret.

That means:

- Cognito already knows your app because you registered an App Client in AWS
- Your Node app proves which App Client it is by sending `client_id`
- If your App Client uses a secret, your Node app also sends `client_secret` when exchanging the authorization code for tokens

The interaction is split into two main phases.

#### Phase 1: Authorization request

When the user clicks `Login`, the Node app redirects the browser to Cognito Hosted UI.

In that redirect, the Node app sends values such as:

- `client_id`
- `redirect_uri`
- `response_type=code`
- `scope`
- `state`
- `nonce`
- PKCE `code_challenge`

Cognito checks those values against the App Client configuration in AWS.

Examples:

- If `redirect_uri` is not listed in the App Client callback URLs, Cognito rejects the request
- If the App Client does not allow authorization code flow, Cognito rejects the request
- If the requested scopes are not allowed, Cognito rejects the request

If everything matches, Cognito authenticates the user and redirects the browser back to your Node app with an authorization code.

#### Phase 2: Token exchange

After Cognito redirects back to `/callback`, the Node app sends the authorization code to Cognito's token endpoint.

In that back-channel request, the Node app sends:

- `client_id`
- `client_secret` if required
- `code`
- `redirect_uri`
- PKCE `code_verifier`

Cognito validates:

- the code was issued for this App Client
- the callback URL matches the App Client configuration
- the client secret is correct, if used
- the PKCE verifier matches the earlier challenge

If validation succeeds, Cognito returns tokens.

The Node app then:

- verifies the OIDC response using `state` and `nonce`
- stores the token response in the session
- optionally calls the `userinfo` endpoint using the `access_token`

So the important boundary is:

- the browser handles the front-channel redirect between your app and Cognito Hosted UI
- the Node app handles the secure server-to-server token exchange with Cognito

#### Why the App Client settings matter

If the AWS App Client settings do not match what this Node app sends, the flow fails.

Common examples:

- callback URL mismatch
- sign-out URL mismatch
- wrong App Client ID
- secret configured in Cognito but missing in `.env`
- authorization code flow not enabled
- required scope not enabled

This is why the AWS Cognito configuration and the values in `.env` must describe the same App Client.

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
