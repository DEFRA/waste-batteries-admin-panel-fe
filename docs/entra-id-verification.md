# Entra authentication verification

Checks to run after deploying to a CDP environment (dev, test, then prod).
Local tests run against the Entra stub, so they can't prove the real client
secret, the proxy route to Entra, the HTTPS `form_post` callback or Redis
sessions across tasks. These checks do.

## Before you start

- The environment's config is set: see [Configuration](../README.md#configuration) and [App Registration](../README.md#app-registration) in the README. The proxy settings are in `cdp-app-config`'s `defaults.env`.
- You have two accounts: one in the group assigned to the app role, and one that isn't.
- You can see the service's logs in CDP.

## Acceptance checks

Record the deployed commit, environment, timestamp, request/trace IDs and outcomes. Keep codes, tokens, the client secret and cookie values out of the evidence.

| Check                        | Procedure and expected outcome                                                                                                                                                                                                                                                        | Status  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Sign-in and allowed user     | Sign in through the header using an assigned user. Verify a protected route such as `/auth-test` succeeds and `auth.login` reports `succeeded`. An HTTP health response alone is insufficient.                                                                                        | Pending |
| Missing role/unassigned user | Use a separate browser session/account. Confirm Entra assignment denial or the application's no-access page, with protected content unavailable. Public home/about pages deliberately remain public.                                                                                  | Pending |
| HTTPS callback               | Observe Entra's POST to the exact `/auth/callback`. The correlation cookie is `SameSite=None; Secure; HttpOnly`; after the existing HTML meta refresh, the Lax application cookie accompanies the protected-page request. POST callback CSRF exemption remains limited to that route. | Pending |
| Safe return                  | Start from a protected URL with a query string; verify it returns there. Test a return value containing a literal tab followed by another slash; the browser must return to `/`.                                                                                                      | Pending |
| Cancellation/failure         | Cancel/refuse the real Entra flow. Verify the friendly recovery page and retry link without access to protected content.                                                                                                                                                              | Pending |
| Refresh                      | Continue an assigned user's session near access-token expiry. Verify `auth.refresh` reports `succeeded` and the user retains access. Verify a failed refresh drops the session and emits a sanitized failure event.                                                                   | Pending |
| Absolute expiry              | In an agreed dev test window, use a short `SESSION_COOKIE_TTL` if needed. Verify refresh/activity cannot extend access past that limit, then restore the accepted configuration.                                                                                                      | Pending |
| Logout                       | Sign out. Verify the application cache entry/cookie are invalidated, the browser reaches Entra's end-session endpoint and returns home, and protected access requires a new login. Verify Entra account-selection/logout behaviour with the test accounts.                            | Pending |
| Multiple tasks/Redis         | Confirm requests from one signed-in browser are handled by more than one application task and remain authenticated through shared Redis. Confirm logout invalidation is respected by each task.                                                                                       | Pending |
| Logs                         | Check login, denial, refresh, logout and provider-failure requests at the intended logging level. Outcomes and request/trace identifiers must be present; codes, tokens, the client secret, cookies, authentication URLs and raw provider error details must be absent.               | Pending |

The application logs fixed sign-in, refresh and sign-out outcomes through the server logger. Auth-path filtering silences automatic request logs and the OIDC library's sign-in/callback logs; refresh supplies a quiet logger on ordinary routes. Request logs redact URLs, query parameters, referrers, authorization headers, cookies and response headers. Every page is served `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Trace IDs are included by the existing logger mixin when supplied by the platform.
