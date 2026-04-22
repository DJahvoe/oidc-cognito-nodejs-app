# Building Cognito Login in Nuxt/Vue and Extending It with Identity Pool Credentials

This repository already contains the core pieces for a clean Cognito login flow in Nuxt:

- Nuxt 4 with `ssr: false`
- `oidc-client-ts` for Authorization Code Flow with PKCE
- route middleware for protected pages
- a browser-only callback page
- manual Cognito Hosted UI logout

For this article, I would focus only on `vue-app`. That is the part that best explains how to build a Vue frontend against Amazon Cognito without mixing in server-side session code.

## What the Vue app already does

The current Nuxt app is a browser-based OIDC client. It sends the user to Cognito Hosted UI, receives the authorization code on `/callback`, lets `oidc-client-ts` process the code exchange, and stores the authenticated user in browser storage.

These files are the center of the implementation:

- `nuxt.config.ts`
- `composables/useOidcAuth.js`
- `middleware/auth.global.js`
- `pages/callback.client.vue`
- `pages/public-page.vue`
- `pages/protected-page.vue`
- `app.vue`

The best part of this structure is that each responsibility is isolated:

- Nuxt runtime config owns Cognito settings.
- The composable owns OIDC login state and redirects.
- Middleware decides which routes require authentication.
- The callback page only finishes the sign-in flow.

## Why this Nuxt setup works well

The app is intentionally configured as a client-rendered SPA:

```ts
export default defineNuxtConfig({
  ssr: false,
  runtimeConfig: {
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Nuxt Cognito OIDC Demo',
      cognitoIssuer: process.env.NUXT_PUBLIC_COGNITO_ISSUER || '',
      cognitoClientId: process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID || '',
      cognitoDomain: normalizeDomain(process.env.NUXT_PUBLIC_COGNITO_DOMAIN || ''),
      cognitoScopes: process.env.NUXT_PUBLIC_COGNITO_SCOPES || 'openid email profile',
    },
  },
})
```

That choice is correct for this repository because `oidc-client-ts` depends on browser APIs like `window` and `localStorage`. A client-only Nuxt app avoids SSR complexity in the auth flow and makes the redirect lifecycle much easier to reason about.

## The sign-in flow in this repository

The flow in `vue-app` is simple and good enough for a blog because readers can follow it page by page:

1. The user opens `/` or `/protected-page`.
2. Global route middleware checks whether a valid OIDC user already exists locally.
3. If not, the app calls `signinRedirect()` and sends the browser to Cognito Hosted UI.
4. Cognito authenticates the user and redirects back to `/callback`.
5. `pages/callback.client.vue` calls `handleCallback()`.
6. `oidc-client-ts` validates state and PKCE data, then stores the user in browser storage.
7. The app navigates back to the original route.

That flow is implemented cleanly in three places.

### 1. OIDC client creation in the composable

```js
userManager = new UserManager({
  authority: currentInfo.authority,
  client_id: currentInfo.clientId,
  redirect_uri: currentInfo.redirectUri,
  response_type: 'code',
  scope: currentInfo.scopes,
  loadUserInfo: false,
  automaticSilentRenew: false,
  monitorSession: false,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
})
```

This is the core configuration that turns the app into a browser OIDC client.

Important details worth calling out in the blog:

- `response_type: 'code'` means Authorization Code Flow
- there is no client secret because this is a browser app
- user state is stored in `localStorage`
- Cognito is used as the OIDC authority

### 2. Route protection in one middleware file

```js
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  if (to.path === '/callback' || to.path === '/public-page') {
    return
  }

  const { authenticated, initializeAuth, signin } = useOidcAuth()

  await initializeAuth()

  if (!authenticated.value) {
    await signin(to.fullPath)
    return abortNavigation()
  }
})
```

This is a strong Vue pattern because protected-route behavior stays centralized. The app does not need to repeat auth checks in every page component.

### 3. Callback handling on a client-only page

```vue
<script setup>
const { handleCallback } = useOidcAuth()

onMounted(async () => {
  const returnTo = await handleCallback()
  await navigateTo(returnTo, { replace: true })
})
</script>
```

This page exists for one reason only: finish the OIDC redirect flow and restore the user to the route they originally requested.

## How to build this in Vue with Nuxt

If I were turning this repository into a tutorial, I would explain the implementation in these steps.

### Step 1: Create the Nuxt app and install OIDC support

```powershell
npx nuxi@latest init vue-app
cd vue-app
npm install
npm install oidc-client-ts
```

### Step 2: Add public runtime config for Cognito

Use `.env` values so the app can switch environments without changing source code.

```env
NUXT_PORT=5173
NUXT_PUBLIC_APP_NAME=Nuxt Cognito OIDC Demo
NUXT_PUBLIC_COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xxxxxxxxx
NUXT_PUBLIC_COGNITO_CLIENT_ID=your-public-spa-client-id
NUXT_PUBLIC_COGNITO_DOMAIN=your-domain.auth.ap-northeast-1.amazoncognito.com
NUXT_PUBLIC_COGNITO_SCOPES=openid email profile
```

For a browser SPA, the Cognito app client should:

- use Authorization Code Grant
- use PKCE
- not require a client secret
- allow `http://localhost:5173/callback` as a callback URL
- allow `http://localhost:5173` as a sign-out URL

### Step 3: Wrap Cognito logic in a composable

This repository uses `useOidcAuth.js`, which is the right shape for a Vue app because everything auth-related stays behind a small interface:

- `initializeAuth()`
- `signin()`
- `handleCallback()`
- `signout()`
- `authenticated`
- `user`
- `displayName`

That is easier to maintain than spreading `UserManager` logic across multiple pages.

### Step 4: Protect routes with middleware

Instead of making every page decide whether it is protected, this app uses `middleware/auth.global.js`. That makes the login behavior structural and predictable.

### Step 5: Keep the callback route browser-only

The file name `callback.client.vue` is important. The callback depends on browser state generated before the redirect, so it should run only on the client.

### Step 6: Implement logout against Cognito, not just local state

The repository clears the local user and then redirects to Cognito's `/logout` endpoint:

```js
const logoutUrl = new URL(`https://${appInfo.value.cognitoDomain}/logout`)
logoutUrl.searchParams.set('client_id', appInfo.value.clientId)
logoutUrl.searchParams.set('logout_uri', appInfo.value.baseUrl)

window.location.assign(logoutUrl.toString())
```

That is important. If you only remove the local user object, the Hosted UI session may still exist and the next login can appear to "skip" authentication.

## Extending the app to generate AWS credentials from an Identity Pool

The current repository stops at user authentication with a Cognito User Pool. That is enough for login, route protection, and showing profile claims.

If you also want the Nuxt app to call AWS services directly from the browser, the next step is to connect the signed-in user to a Cognito Identity Pool and exchange the user pool token for temporary AWS credentials.

This is a different responsibility from user login:

- User Pool: who the user is
- Identity Pool: what temporary AWS credentials the app can obtain for that user

The credentials you get from an Identity Pool are temporary AWS credentials:

- `accessKeyId`
- `secretAccessKey`
- `sessionToken`
- expiration time

## How to set up the Identity Pool

In AWS, create an Identity Pool and connect it to the same Cognito User Pool that your Nuxt app already uses.

At a high level, the setup is:

1. Create a Cognito Identity Pool.
2. Enable authenticated access.
3. Add your Cognito User Pool as an authentication provider.
4. Select the User Pool ID and the App Client ID used by the Nuxt app.
5. Attach an IAM role for authenticated users.
6. Grant that IAM role only the AWS permissions the frontend actually needs.

For example, if the app only needs to upload to one S3 bucket, the authenticated IAM role should only have that bucket permission, not broad access to the entire account.

## The extra environment values you need

To extend this Nuxt app, add these public values:

```env
NUXT_PUBLIC_AWS_REGION=ap-northeast-1
NUXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=ap-northeast-1:11111111-2222-3333-4444-555555555555
```

Why these values matter:

- `NUXT_PUBLIC_AWS_REGION` is the region for the identity pool
- `NUXT_PUBLIC_COGNITO_USER_POOL_ID` identifies the user pool provider name
- `NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` tells AWS where to mint temporary credentials

You also need to expose them in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      awsRegion: process.env.NUXT_PUBLIC_AWS_REGION || '',
      cognitoUserPoolId: process.env.NUXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      cognitoIdentityPoolId: process.env.NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || '',
    },
  },
})
```

## Install the AWS SDK pieces

For a browser-based Nuxt app, add the modular AWS SDK packages you need:

```powershell
npm install @aws-sdk/credential-providers @aws-sdk/client-sts
```

If you want to call S3, DynamoDB, or another service directly, install that client too.

## Generate temporary AWS credentials in the composable

The most natural extension point is `useOidcAuth.js`, because it already knows about the current signed-in user and their tokens.

The key detail is the `logins` map. For a Cognito User Pool provider, the key must look like this:

```text
cognito-idp.<region>.amazonaws.com/<userPoolId>
```

Example extension:

```js
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers'

async function getAwsCredentials() {
  const runtimeConfig = useRuntimeConfig()
  const currentUser = await getUserManager().getUser()

  if (!currentUser?.id_token) {
    throw new Error('No Cognito ID token is available.')
  }

  const identityProvider =
    `cognito-idp.${runtimeConfig.public.awsRegion}.amazonaws.com/` +
    runtimeConfig.public.cognitoUserPoolId

  const credentialProvider = fromCognitoIdentityPool({
    clientConfig: {
      region: runtimeConfig.public.awsRegion,
    },
    identityPoolId: runtimeConfig.public.cognitoIdentityPoolId,
    logins: {
      [identityProvider]: currentUser.id_token,
    },
  })

  return credentialProvider()
}
```

That returns temporary AWS credentials for the authenticated user. In practice, the returned object includes fields like:

- `accessKeyId`
- `secretAccessKey`
- `sessionToken`
- `expiration`

## Using those credentials from the Vue app

Once the app can mint temporary credentials, you can build service clients with them. A simple verification step is to call STS and inspect the caller identity.

Example:

```js
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'

async function verifyAwsIdentity() {
  const runtimeConfig = useRuntimeConfig()
  const credentials = await getAwsCredentials()

  const sts = new STSClient({
    region: runtimeConfig.public.awsRegion,
    credentials,
  })

  return sts.send(new GetCallerIdentityCommand({}))
}
```

That is a useful blog example because it proves the browser is no longer just authenticated with Cognito, but can also assume the authenticated IAM role attached to the Identity Pool.

## One important nuance about tokens

For this flow, use the Cognito User Pool token in the `logins` map for the User Pool provider. In this Nuxt app, the easiest source is the OIDC user object returned by `oidc-client-ts`.

The repository already stores that user object locally, so you do not need another login flow to obtain AWS credentials. The Identity Pool step is an extension on top of the existing login state.

## A clean way to present this in the blog

The strongest structure for the article is:

1. Show how `vue-app` handles Cognito login with OIDC and PKCE.
2. Explain the role of `useOidcAuth.js`, route middleware, and `callback.client.vue`.
3. Show the exact environment settings required in Cognito for a SPA.
4. Add Identity Pools as the next layer when the app needs to access AWS services directly.
5. Show `fromCognitoIdentityPool` as the bridge from user identity to AWS credentials.

That keeps the article focused. It does not confuse login with authorization to AWS resources, but it shows how the two fit together in a real Vue application.

## Suggested conclusion

This Nuxt implementation is a good blog subject because it is small, readable, and architecturally correct:

- Cognito Hosted UI handles authentication
- `oidc-client-ts` handles the OIDC redirect flow
- Nuxt middleware protects routes
- the callback page completes sign-in safely in the browser
- an Identity Pool can extend the same login session into temporary AWS credentials

That is a practical path for a frontend application: first authenticate the user, then add AWS access only if the app actually needs it.

## References

- AWS SDK for JavaScript v3, Cognito browser credentials: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-browser-credentials-cognito.html
- Amazon Cognito, understanding user pool tokens: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html
- Amazon Cognito, getting started with identity pools: https://docs.aws.amazon.com/cognito/latest/developerguide/getting-started-with-identity-pools.html
