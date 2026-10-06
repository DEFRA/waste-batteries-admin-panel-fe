# Entra authentication verification

This checklist applies to `eb-181-admin-setup`, using the existing Hapi OIDC plugin, Navikt Docker stub, token refresh and Entra SSO logout.

## Current status

Live CDP dev checks are **pending**. This workspace has no supplied live `ENTRA_CLIENT_ID`, `ENTRA_DISCOVERY_URI`, `APP_BASE_URL` or `CDP_JWT_ISSUER`, no local `.env`, and no connected CDP/Entra tooling. The local `cdp-app-config` checkout has no service configuration directory for `waste-batteries-admin-panel-fe`; confirm the current deployment/configuration in Portal rather than treating that checkout as live evidence.

No Entra registrations, CDP configuration, secrets or deployments were changed. Local tests do not establish real Entra federation, proxy routing or cross-site HTTPS callback behaviour.

Local verification completed on 5 October 2026:

| Check                    | Result                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`   | Passed                                                                                                                |
| `npm run lint`           | Passed                                                                                                                |
| `PORT=0 npm test`        | Passed: 116 tests in 23 files, including real-library log-capture tests for login, refresh and logout success/failure |
| `npm run build:frontend` | Passed; Vite reports a GOV.UK CSS media-query warning                                                                 |
| `npm run test:e2e`       | Passed: 13 browser tests against the existing Navikt Docker stub                                                      |

The ten log-capture cases also passed with CDP's ECS log format:

```bash
LOG_FORMAT=ecs AWS_EMF_ENVIRONMENT=Local TZ=UTC npx --no-install vitest run src/server/auth/auth-logging.test.js
```

The browser journeys cover successful login, protected-route/role denial, a valid return path with its query string, malformed return values containing a literal tab or dot segments that produce a protocol-relative path, an OAuth cancellation response and Entra end-session redirect with application-session invalidation. Cancellation is simulated with the browser's real state/correlation cookie because the stub has no cancellation button. The local app uses memory sessions and HTTP query callbacks; HTTPS `form_post`, live federation and multi-instance Redis remain pending below. The unit log-capture cases exercise both GET and POST callbacks, raw provider failures, ordinary request redaction and retained outcome/trace identifiers.

## Prerequisites for CDP dev

Confirm the actual service URL, Entra registration, role/group assignments and access to the service's CDP logs. Have an assigned account and an account without the required role available for testing.

Use the original branch's configuration names:

| Setting                    | Required value/check                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `ENTRA_CLIENT_ID`          | Client/application ID returned for the approved dev registration                               |
| `ENTRA_DISCOVERY_URI`      | `https://login.microsoftonline.com/<approved-tenant-id>/v2.0/.well-known/openid-configuration` |
| `APP_BASE_URL`             | Actual browser-facing HTTPS origin, matching the registration                                  |
| `ENTRA_REQUIRED_ROLE`      | Exact assigned role value; the original branch defaults to `Admin`                             |
| `ENTRA_FEDERATED_AUDIENCE` | Exact federated-credential audience, normally `api://AzureADTokenExchange`                     |
| `ENTRA_FEDERATED_MOCKING`  | `false`                                                                                        |
| `ENTRA_RESPONSE_MODE`      | `form_post`                                                                                    |
| `SESSION_COOKIE_SECURE`    | `true`                                                                                         |
| `SESSION_CACHE_ENGINE`     | `redis`, with the environment's correct Redis configuration                                    |
| `SESSION_COOKIE_PASSWORD`  | A real random secret from CDP Secrets, shared by the service's tasks                           |
| `ENTRA_SCOPES`             | Approved scopes for this branch, retaining `offline_access` for refresh                        |

Register both `<APP_BASE_URL>/auth/callback` and `<APP_BASE_URL>/` as Web redirect URIs; the latter is the post-logout destination used by this implementation. Confirm consent for the requested scopes and the enterprise application's group-to-role assignment.

Check the federated credential's issuer against the running `CDP_JWT_ISSUER`, its subject against the actual service IAM role ARN, and its audience against `ENTRA_FEDERATED_AUDIENCE`. The provider receives that configured audience as an array at the SDK boundary.

Configure the platform's native-fetch proxy settings before Node starts, following the current [CDP proxy guide](../../cdp-documentation/how-to/proxy.md). Its current service configuration is:

```dotenv
NODE_USE_ENV_PROXY=1
HTTPS_PROXY=http://localhost:3128
NO_PROXY=.cdp-int.defra.cloud,.s3.eu-west-2.amazonaws.com,sqs.eu-west-2.amazonaws.com,sns.eu-west-2.amazonaws.com,dynamodb.eu-west-2.amazonaws.com
```

Set these through CDP service configuration, retaining the platform-provided `HTTP_PROXY`; loading them after Node has started is too late. Confirm the service's proxy ACL permits the approved Entra endpoints. Verify that discovery, token and logout discovery requests reach Entra through the required route. Add explicit STS proxy configuration only if the running environment requires it; this patch does not assume that it does.

## Acceptance checks

Record the deployed commit, environment, timestamp, request/trace IDs and outcomes. Keep codes, tokens, assertions and cookie values out of the evidence.

| Check                        | Procedure and expected outcome                                                                                                                                                                                                                                                        | Status  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Federation and allowed user  | Sign in through the header using an assigned user. Verify a real protected route succeeds and `auth.login` reports `succeeded`. An HTTP health response alone is insufficient.                                                                                                        | Pending |
| Missing role/unassigned user | Use a separate browser session/account. Confirm Entra assignment denial or the application's no-access page, with protected content unavailable. Public home/about pages deliberately remain public.                                                                                  | Pending |
| HTTPS callback               | Observe Entra's POST to the exact `/auth/callback`. The correlation cookie is `SameSite=None; Secure; HttpOnly`; after the existing HTML meta refresh, the Lax application cookie accompanies the protected-page request. POST callback CSRF exemption remains limited to that route. | Pending |
| Safe return                  | Start from a protected URL with a query string; verify it returns there. Test a return value containing a literal tab followed by another slash; the browser must return to `/`.                                                                                                      | Pending |
| Cancellation/failure         | Cancel/refuse the real Entra flow. Verify the friendly recovery page and retry link without access to protected content.                                                                                                                                                              | Pending |
| Refresh                      | Continue an assigned user's session near access-token expiry. Verify `auth.refresh` reports `succeeded` and the user retains access. Verify a failed refresh drops the session and emits a sanitized failure event.                                                                   | Pending |
| Absolute expiry              | In an agreed dev test window, use a short `SESSION_COOKIE_TTL` if needed. Verify refresh/activity cannot extend access past that limit, then restore the accepted configuration.                                                                                                      | Pending |
| Logout                       | Sign out. Verify the application cache entry/cookie are invalidated, the browser reaches Entra's end-session endpoint and returns home, and protected access requires a new login. Verify Entra account-selection/logout behaviour with the test accounts.                            | Pending |
| Multiple tasks/Redis         | Confirm requests from one signed-in browser are handled by more than one application task and remain authenticated through shared Redis. Confirm logout invalidation is respected by each task.                                                                                       | Pending |
| Logs                         | Check login, denial, refresh, logout and provider-failure requests at the intended logging level. Outcomes and request/trace identifiers must be present; codes, tokens, client assertions, cookies, authentication URLs and raw provider error details must be absent.               | Pending |

The application logs fixed sign-in, refresh and sign-out outcomes through the server logger. Auth-path filtering silences automatic request logs and the OIDC library's sign-in/callback logs; refresh supplies a quiet logger on ordinary routes. Request logs redact URLs, query parameters, referrers, authorization headers, cookies and response headers. Every page is served `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Trace IDs are included by the existing logger mixin when supplied by the platform.
