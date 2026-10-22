# Entra ID: remaining work

Background: [README](README.md#app-registration),
[docs/entra-id-verification.md](docs/entra-id-verification.md).

## 1. App Registration

- [ ] **The group name doesn't match.** The request says both `AG-WASTE-BATTERIES-ADMIN` and `WASTE-BATTERIES-ADMIN-DEV`. Confirm which exists.
- [ ] **Assign that group to the `Admin` role on the Enterprise Application**, not just create it. Otherwise users sign in with no `roles` claim and get the "You do not have access" page.
- [x] **Get the secret Value from Philip Morris**, securely, never Slack or email.
- [ ] **Logout URL (optional): won't do anything useful.** Entra calls it in a hidden iframe, where the `SameSite=Lax` session cookie isn't sent, so there's no session to clear. Harmless; leave it or ask for it to be removed.

## 2. Credentials

| Credential | Env var                                                                                                | Where                        |
| ---------- | ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| App ID     | `ENTRA_CLIENT_ID`                                                                                      | `cdp-app-config`             |
| Tenant ID  | `ENTRA_DISCOVERY_URI` = `https://login.microsoftonline.com/<id>/v2.0/.well-known/openid-configuration` | `cdp-app-config`             |
| Value      | `ENTRA_CLIENT_SECRET`                                                                                  | CDP Portal secret, never git |

Secret ID isn't used; the app reads the Value.

- [ ] Set a reminder to renew the secret before it expires, or nobody can sign in.

## 3. Local (optional)

Put the three env vars above in a git-ignored `.env`. Leave `APP_BASE_URL` at
its default.

- [x] App reaches Entra with the dev credentials
- [ ] **Get a defradev account, or guest access to defradev for your current account.** Entra rejects accounts from other tenants ("Selected user account does not exist in tenant 'O365_DEFRADEV'"). Ask whoever raised the App Registration ServiceNow request, or Defra's identity/Entra team. If you already have a defradev account, sign in with it in a private window so the account picker doesn't reuse your normal account.
- [ ] Sign in locally with that account. It must be in the group assigned to `Admin`, or you'll land on the "You do not have access" page.

## 4. CDP dev and test

`cdp-app-config`, per environment:

- [ ] `ENTRA_CLIENT_ID`, `ENTRA_DISCOVERY_URI`
- [ ] `APP_BASE_URL`: `https://waste-batteries-admin-panel-fe.<dev|test>.cdp-int.defra.cloud`
- [ ] `ENTRA_RESPONSE_MODE=form_post`, `SESSION_COOKIE_SECURE=true`, `SESSION_CACHE_ENGINE=redis`
- [ ] `NODE_USE_ENV_PROXY=1`, `HTTPS_PROXY`, `NO_PROXY` (values in the verification doc)

CDP Portal secrets:

- [ ] `ENTRA_CLIENT_SECRET`
- [ ] `SESSION_COOKIE_PASSWORD`: random, 32+ characters

- [ ] Confirm the proxy ACL allows `login.microsoftonline.com`

## 5. Verify

- [ ] Deploy to dev and run the acceptance checks in the verification doc

## 6. Prod

- [ ] Request an App Registration in the `defra` tenant. These credentials are `defradev` (dev and test) only.
