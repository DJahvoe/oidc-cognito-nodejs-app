# Custom Login App with Cognito SSO

This app is the SSO-safe version of a custom login experience.

It keeps a branded local `/login` page in your app, but it does **not** submit the password directly to Cognito from your own form. Instead, your page starts the normal Cognito authorization-code flow and redirects the browser to Cognito Hosted UI for the actual sign-in step.

That means:

- you keep your own login entry page
- Cognito still owns the credential page
- Cognito still sets the browser session cookie
- SSO stays compatible with `app1` and `app2`

## Why this shape is necessary

AWS documentation separates Cognito authentication into:

- **user pool API authentication**
- **OAuth / managed login authentication**

The managed login endpoints are browser-based endpoints. AWS documents that your app must invoke those managed login pages in the user's browser. That browser interaction is what enables the Cognito managed login session and SSO behavior.

Relevant AWS docs:

- [How authentication works with Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-how-to-authenticate.html)
- [User pool endpoints and managed login reference](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-userpools-server-contract-reference.html)
- [The managed login sign-in endpoint: /login](https://docs.aws.amazon.com/cognito/latest/developerguide/login-endpoint.html)
- [The managed login sign-out endpoint: /logout](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html)
- [The authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)

What those docs mean for this app:

- if you post username and password directly to Cognito with the User Pools API, you control the whole form, but you do **not** get the same Hosted UI browser session
- if you want the same SSO as `app1` and `app2`, the browser must still go through Cognito managed login

## What this app does

This app uses:

- a local branded `/login` page in your app
- Cognito `/oauth2/authorize` through `openid-client`
- Cognito `/login` behind the authorize flow for the actual credential entry
- Cognito `/logout` for shared logout

The local login page can collect a username hint and pass it into the authorization request as `login_hint`, but the actual password step remains on Cognito.

## Flow

1. User opens `/login` in your app
2. Your app renders your own branded page
3. User optionally enters username or email
4. Your app redirects the browser to Cognito authorization
5. Cognito either:
   - reuses the existing Hosted UI session and immediately redirects back, or
   - shows the Cognito sign-in page
6. Cognito redirects back to `/callback`
7. Your app exchanges the code, fetches user info, stores the local session, and redirects to the original page

## Why SSO still works

Because the actual sign-in still happens on Cognito Hosted UI, Cognito can keep using the same browser-based session cookie as `app1` and `app2`.

That is the key difference from a fully custom password form.

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
COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxxx
COGNITO_DOMAIN=your-domain.auth.ap-northeast-1.amazoncognito.com
COGNITO_CLIENT_ID=your-custom-login-client-id
COGNITO_CLIENT_SECRET=your-custom-login-client-secret
COGNITO_SCOPES=openid email profile
```

Use the same:

- `COGNITO_ISSUER`
- `COGNITO_DOMAIN`

as `app1` and `app2` if you want the same Cognito SSO session.

## Cognito requirements

Configure the Cognito App Client for this app with:

- callback URL: `http://localhost:5000/callback`
- sign-out URL: `http://localhost:5000`
- OAuth flow: `Authorization code grant`
- scopes: `openid email profile`

This app should use its **own** App Client, but under the same User Pool and Hosted UI domain as the other apps.

## Routes

- `/`: home page
- `/login`: custom branded login entry page
- `/login/direct`: skip the hint page and go straight to Cognito authorize
- `/callback`: Cognito callback
- `/public-page`: page accessible without authentication
- `/protected-page`: page accessible only after authentication
- `/logout`: destroys the local session and redirects to Cognito managed logout

## How the protected route works

If an unauthenticated user opens `/protected-page`:

1. the app stores the original URL in `req.session.returnTo`
2. the app redirects to the local `/login` page
3. the user continues to Cognito
4. Cognito authenticates the user or reuses an existing Hosted UI session
5. Cognito redirects to `/callback`
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

## Practical tradeoff

This app is the closest you can get to:

- keeping your own login page
- preserving Cognito Hosted UI SSO

without building your own central SSO service.

What you still do **not** control in this model:

- the actual Cognito password screen
- Cognito MFA challenge screens
- Cognito password reset screens

If you need to control those too, you are back in the fully custom-auth world, and then you lose the Hosted UI SSO behavior unless you build your own shared session architecture.
