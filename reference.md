# AWS Cognito References

Relevant Amazon Cognito documentation for local OIDC login, callback URLs, default redirect URLs, and logout behavior.

## Managed login and redirect URLs

- Authorization endpoint:
  https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
  Notes:
  `redirect_uri` is required for the authorization endpoint.
  Callback URLs must be absolute URIs.
  `http://localhost` is allowed for testing.

- App client settings:
  https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-idp-settings.html
  Notes:
  Allowed callback URLs define where Cognito can send the browser after sign-in.
  Default redirect URL must be one of the allowed callback URLs.
  Allowed sign-out URLs define where Cognito can send the browser after logout.

## Logout behavior

- Logout endpoint:
  https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
  Notes:
  `/logout` is a Cognito-managed browser redirect endpoint.
  `logout_uri` must match one of the app client's allowed sign-out URLs.
  `redirect_uri` in a logout request is for sign-in again after logout, not the same as `logout_uri`.
  If both `logout_uri` and `redirect_uri` are present, Cognito uses `logout_uri`.

## API reference

- UpdateUserPoolClient API:
  https://docs.aws.amazon.com/en_us/cognito-user-identity-pools/latest/APIReference/API_UpdateUserPoolClient.html
  Notes:
  `CallbackURLs`, `DefaultRedirectURI`, and `LogoutURLs` are the fields that control these settings.
