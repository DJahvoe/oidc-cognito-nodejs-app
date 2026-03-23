# Custom Login App

This app is a companion demo to the Hosted UI samples in `app1` and `app2`.

The key difference is:

- `app1` and `app2` redirect the browser to Cognito Hosted UI
- `custom-login-app` renders its own login form and calls Cognito directly

## What this demo uses

This app authenticates with the Cognito User Pool API by calling:

- `InitiateAuth`
- `GetUser`
- `GlobalSignOut`

That means the server receives the username and password from the local login form and sends them to Cognito itself.

## Important tradeoff

Because this app does not use Cognito Hosted UI, it does **not** get the Hosted UI browser session cookie.

So:

- you get full control over the login page design
- you lose browser-based Hosted UI SSO across apps unless you build your own shared session approach

## Cognito requirements

The Cognito App Client used by this app must allow direct username/password authentication.

For this demo, configure:

- auth flow: `USER_PASSWORD_AUTH`
- callback URL: not required for login because the app does not use Hosted UI
- Hosted UI domain: not required for login

If your Cognito App Client has a secret, put it in `.env`.
If it does not, leave `COGNITO_CLIENT_SECRET` empty or unset.

## Environment file

Create:

- `custom-login-app/.env`

Start from:

- `custom-login-app/.env.example`

Example:

```env
PORT=5000
BASE_URL=http://localhost:5000
SESSION_SECRET=replace-with-a-long-random-string-for-custom-login
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
COGNITO_CLIENT_ID=your-custom-login-client-id
COGNITO_CLIENT_SECRET=your-custom-login-client-secret
COGNITO_AUTH_FLOW=USER_PASSWORD_AUTH
```

## Routes

- `/`: home page
- `/login`: local custom login form
- `/public-page`: page accessible without authentication
- `/protected-page`: page accessible only after authentication
- `/logout`: destroys the local session and attempts Cognito `GlobalSignOut`

## How the protected route works

If an unauthenticated user opens `/protected-page`:

1. the app stores the original URL in `req.session.returnTo`
2. the app redirects to `/login`
3. the user submits the custom login form
4. the app calls Cognito `InitiateAuth`
5. the app fetches the user profile with `GetUser`
6. the app restores the original URL and redirects back to `/protected-page`

## How to run

From `nodejs-app`:

```powershell
npm run start:custom-login
```

Then open:

```text
http://localhost:5000
```

## Current limitations

This demo intentionally stays simple.

It does not yet implement:

- MFA challenges
- `NEW_PASSWORD_REQUIRED`
- password reset flows
- token signature verification

For a production app, those would need to be handled properly.
