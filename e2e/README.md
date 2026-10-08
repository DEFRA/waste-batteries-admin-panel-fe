# End-to-end tests

Playwright journeys, grouped by area under [journeys/](journeys). Everything
here today is [journeys/auth/](journeys/auth), and [journeys/zap/](journeys/zap),
a post-suite assertion against OWASP ZAP when the proxy is on. The sign-in
journeys sign in against the local Entra ID stub, not real Entra; see
[Signing in locally and in CI](../README.md#signing-in-locally-and-in-ci) for
why, and for what that does and does not test.

## Running them

```bash
npm run test:e2e
```

Other entry points:

```bash
npm run test:e2e:ui                         # Playwright's watch mode
npm run test:e2e -- --grep @auth            # one area
npm run test:e2e -- signed-out              # one spec
npm run test:e2e:report                     # last HTML report
```

Docker must be running. Playwright starts the app itself (see
[support/app-instances.js](support/app-instances.js)), so `npm run dev` does not
need to be running. It also starts the Entra stub with
`docker compose up entra-stub`, unless it is already up; the first run pulls
the image, and the stub is left running afterwards
(`docker compose stop entra-stub` to stop it).

Every pull request runs the whole suite in the `e2e` job of
[check-pull-request.yml](../.github/workflows/check-pull-request.yml). The HTML
report and the app logs from a run are uploaded as the `playwright-report`
artefact. The same job proxies Chromium through ZAP and uploads
`zap-test-report` — see [OWASP ZAP](#owasp-zap).

## Adding an area

A new area needs a folder under `journeys/` and a matching tag on its
`describe`. Registrations would be `journeys/registration/` tagged
`@registration`, and `--grep @registration` would run just those. Anything
genuinely shared across areas belongs in [support/](support). The ZAP gate is
the exception — it is a project that depends on the journeys, not another
product area.

## How it is put together

Two routes exist only for these tests, because the application's own pages
are all deliberately public today:

- `/e2e/protected` takes the server-wide auth default, so it exercises route
  protection, the default required role (`Admin`) and returning to the page
  after sign-in.
- `/e2e/admin-only` requires the `Admin` scope, so it proves Entra app roles
  reach hapi's scope check.

They are registered in [support/test-server.js](support/test-server.js) behind
`E2E_PROTECTED_ROUTES` and are never registered by `src/index.js`.

The users the journeys sign in as, and the helper that fills in the stub's
sign-in page, are in [support/entra-stub.js](support/entra-stub.js). A user's
claims are the ones Entra puts in the ID token, so a new role to test is a new
entry in `users` with that role in `roles`.

The app's stdout is captured to `e2e/.logs/app-<port>.log`.

## Coverage of the manual checklist

| Phase                      | Spec                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| 0 Environment up           | [environment.spec.js](journeys/auth/environment.spec.js)           |
| 1 Signed-out state         | [signed-out.spec.js](journeys/auth/signed-out.spec.js)             |
| 4 Route protection default | [route-protection.spec.js](journeys/auth/route-protection.spec.js) |

Signing in, signing out and app roles, written for Entra ID, are in
[sign-in.spec.js](journeys/auth/sign-in.spec.js).

The browser-side "must never see" invariants (a JWT in a cookie, anything
auth-related in web storage) are in [support/invariants.js](support/invariants.js).

## OWASP ZAP

Every pull request proxies Playwright Chromium through a ZAP daemon and then
runs [journeys/zap/alerts.spec.js](journeys/zap/alerts.spec.js) (`@zap`). That
spec waits until ZAP's passive scan queue is empty, writes HTML and JSON
reports to `zap-reports/`, and fails if any **High** alert was raised against
this app (ports 3000 and 3100). Medium and Low stay in the report. The Entra
ID stub on port 3210 is also proxied, but its findings are excluded from the
High gate.

Without the ZAP env vars, `npm run test:e2e` is unchanged — the zap project is
not registered, so the spec is ignored.

### Running locally

Start the same named services CI uses, then start ZAP. Do not
`up -d --wait` the whole compose file — that also waits on mongodb, and
`--wait` on ZAP hangs because the image healthcheck probes `localhost`
(remapped to the host by `extra_hosts`).

```bash
docker compose -f compose.yml -f compose-github.override-zap.yml \
  up -d --wait floci redis entra-stub frontend
docker compose -f compose.yml -f compose-github.override-zap.yml up -d zap
```

Wait until the daemon answers on the **host** URL, not `http://zap:8080` —
that hostname only resolves inside the Compose network:

```bash
curl -fsS http://127.0.0.1:8080/OTHER/core/other/rootcert/ -o /tmp/zap-root-ca.pem
export NODE_EXTRA_CA_CERTS=/tmp/zap-root-ca.pem
export ZAP_PROXY_URL=http://127.0.0.1:8080
export ZAP_PROXY_API_URL=http://127.0.0.1:8080
npm run test:e2e
docker compose -f compose.yml -f compose-github.override-zap.yml down
```

On PowerShell:

```powershell
curl.exe -fsS http://127.0.0.1:8080/OTHER/core/other/rootcert/ -o "$env:TEMP\zap-root-ca.pem"
$env:NODE_EXTRA_CA_CERTS = "$env:TEMP\zap-root-ca.pem"
$env:ZAP_PROXY_URL = 'http://127.0.0.1:8080'
$env:ZAP_PROXY_API_URL = 'http://127.0.0.1:8080'
npm run test:e2e
docker compose -f compose.yml -f compose-github.override-zap.yml down
```

Run the **full** suite, not `--grep @zap` on its own. The zap project depends on
the journeys so there is traffic to inspect; grep would filter those journeys
out and the scan would be empty.

Always bring the overlay stack down afterwards, including when the suite fails.

### Chromium and localhost

Chrome skips the proxy for loopback addresses unless it is launched with
`--proxy-bypass-list=<-loopback>`. [playwright.config.js](../playwright.config.js)
adds that flag whenever `ZAP_PROXY_URL` is set. Every origin this suite hits is
localhost, so without it the report would be empty and `@zap` would pass for
the wrong reason. The spec treats "ZAP saw no app origin" as a failure.

### Reading the reports

After a run, open `zap-reports/zap-report.html` (or the JSON next to it). CI
uploads that directory as the `zap-test-report` artefact and comments the
download link on the pull request.

`zap-reports/` is gitignored. Compose bind-mounts it into the daemon as
`/home/zap/reports`.
