# Entra ID: remaining work

Background: [README](README.md#app-registration),
[docs/entra-id-verification.md](docs/entra-id-verification.md).

The code is done. What's left is Entra admin, CDP config and verifying on dev.

## 1. Admin role in `defradev`

The ID token now carries `roles: ["admin"]`. The group is
`AG-WASTE-BATTERIES-ADMIN`.

- [x] Confirm the App Registration (client ID `4fe546c9-6e83-4503-8c5a-3ac7477afd88`) has an app role: its value is `admin`, now the app's default
- [x] Request a `defradev` security group via ServiceNow
- [x] Assign that group to the role under Enterprise applications → Users and groups (not "Default Access")
- [ ] Add the team as direct members (nested groups don't pass on app roles): Anthony.Barlow, Arihan.Sinha, Ashley.Connolly, Kieran.Ohanlon, Philip.Morris (`@defradev.onmicrosoft.com`)
- [x] Check locally: `node --env-file=.env scratch/whoami-server.js`, sign out of Entra and open <http://localhost:3000/whoami> in a private window. `idTokenClaims.roles` should hold the role.
- [x] Check access: `npm run dev`, then sign in at <http://localhost:3000/auth-test>; it shows your name and roles

## 2. CDP dev and test

`cdp-app-config` branch `eb-181-epr-entra-id` sets `ENTRA_CLIENT_ID`,
`ENTRA_DISCOVERY_URI` and `APP_BASE_URL` for dev and test. Proxy settings are
already in `defaults.env`. `form_post`, secure cookies and Redis sessions are
the defaults under `NODE_ENV=production`, which the Dockerfile sets.

- [ ] Raise and merge the `cdp-app-config` PR
- [ ] CDP Portal secrets, dev and test: `ENTRA_CLIENT_SECRET`, and `SESSION_COOKIE_PASSWORD` (random, 32+ characters). Without the cookie password the app falls back to a public default, so don't skip it.
- [ ] Confirm Redis is enabled for the service in CDP Portal
- [ ] Confirm the proxy ACL allows `login.microsoftonline.com`
- [ ] Set a reminder to renew the client secret before it expires, or nobody can sign in

## 3. Verify on dev

- [x] Run `npm run test:e2e` (needs Docker)
- [ ] Commit and push this branch (`/auth-test` and nav link, `admin` role default, e2e tests on `/auth-test`, re-enabled auth route unit tests, docs)
- [ ] Deploy to dev and run the acceptance checks in the [verification doc](docs/entra-id-verification.md#acceptance-checks)
- [ ] Sign-out returns to the app (confirms the `/` redirect URI)
- [ ] Open `/auth-test` with an account in the group (shows your name and roles) and with one outside it ("You do not have access")

## 4. Prod

- [ ] Request an App Registration, app role and group in the `defra` tenant (`AG-WASTE-BATTERIES-ADMIN` may be usable there). Current credentials are `defradev` (dev and test) only.
- [ ] Add the prod values to `cdp-app-config` and CDP Portal secrets

## Optional

- Make the app refuse to start in production without `SESSION_COOKIE_PASSWORD`, like `ENTRA_CLIENT_SECRET`
- The App Registration's front-channel Logout URL does nothing useful (Entra calls it in an iframe without the `SameSite=Lax` cookie). Harmless; leave it.
- Delete `scratch/whoami-server.js` once roles work
