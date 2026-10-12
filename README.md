# waste-batteries-admin-panel-fe

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-batteries-admin-panel-fe&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-batteries-admin-panel-fe)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-batteries-admin-panel-fe&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-batteries-admin-panel-fe)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-batteries-admin-panel-fe&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-batteries-admin-panel-fe)

Core delivery platform Node.js Frontend Template

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Authentication](#authentication)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
  - [Security scanning (ZAP)](#security-scanning-zap)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

This service uses Node.js 26.10.0. The version is pinned in [`.nvmrc`](./.nvmrc), and `package.json` requires Node.js 26 or newer. GitHub Actions reads `.nvmrc`, so pull request and publish workflows use the same version. The Docker image uses the DEFRA parent image `defradigital/node:3.2.3-node26.10.0`.

Install Node.js with a version manager, then install the version in `.nvmrc`.

**Windows** ([nvm for Windows](https://github.com/coreybutler/nvm-windows)):

```powershell
nvm install 26.10.0
nvm use 26.10.0
node -v
```

`node -v` should print `v26.10.0`. In this repository the nvm shim also follows `.nvmrc`, so commands run from the repo use 26.10.0 once that version is installed.

**macOS and Linux** ([nvm](https://github.com/nvm-sh/nvm)):

```bash
cd waste-batteries-admin-panel-fe
nvm install
nvm use
node -v
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run everything in docker, you can use:

```bash
docker compose up -d
```

To run the application in `development` mode without docker:

```bash
npm run dev
```

### Authentication

- [How sign-in works](#how-sign-in-works)
- [Configuration](#configuration)
- [App Registration](#app-registration)
- [CDP dev verification](docs/entra-id-verification.md)
- [Signing in locally and in CI](#signing-in-locally-and-in-ci)
  - [Signing in locally](#signing-in-locally)
  - [Signing in as someone else](#signing-in-as-someone-else)
  - [In the end-to-end tests and CI](#in-the-end-to-end-tests-and-ci)
  - [What the stub does not test](#what-the-stub-does-not-test)
  - [Troubleshooting](#troubleshooting)

#### How sign-in works

Users sign in with Defra's Entra ID via
[@defra/hapi-auth-oidc](https://github.com/DEFRA/cdp-libraries/tree/main/packages/hapi-auth-oidc),
following the CDP guide
[Node.js integration](https://github.com/DEFRA/cdp-documentation/blob/main/how-to/federated-credentials/node-integration.md)
except for one thing: the service authenticates to Entra with the App
Registration's **client secret**, not a federated credential. Sessions are held
server-side, refreshed shortly before the access token expires, and capped at
`SESSION_COOKIE_TTL` from sign-in.

Routes: `/auth/sign-in`, `/auth/callback` (GET, and POST for `form_post`) and
`/auth/sign-out`. Sign-out drops the session, then sends the user to Entra's
`end_session_endpoint` (with `id_token_hint`) so their Entra session ends too,
and Entra returns them to `<APP_BASE_URL>/`. If Entra's discovery document
cannot be read, the user is still signed out of the service.

Entra app roles assigned to a user arrive in the ID token's `roles` claim and
become their hapi `scope`. Every route requires a signed-in user with the
`ENTRA_REQUIRED_ROLE` app role by default; a signed-in user without it sees
"You do not have access to this service" (403). Users get the role through
membership of the security group assigned to it on the App Registration's
enterprise application. Public routes opt out with `auth: false`, or with
`auth: { strategy: 'session', mode: 'try' }` to render signed in or out
(naming the strategy stops hapi merging in the default's role check). A route
can require a different role with `options: { auth: { access: { scope: ['<role>'] } } }`.

The code is in [src/server/plugins/auth.js](src/server/plugins/auth.js),
[src/server/auth/](src/server/auth) and
[src/server/routes/auth/](src/server/routes/auth).

#### Configuration

| Variable              | Purpose                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENTRA_CLIENT_ID`     | App Registration client (application) ID                                                                                                                 |
| `ENTRA_CLIENT_SECRET` | App Registration client secret. A CDP secret, never in `cdp-app-config`. Required in production; the app will not start without it                       |
| `ENTRA_DISCOVERY_URI` | `https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration`. Defaults to the [local Entra stub](#signing-in-locally-and-in-ci) |
| `APP_BASE_URL`        | Public base URL; the callback is `<APP_BASE_URL>/auth/callback`                                                                                          |
| `ENTRA_SCOPES`        | Defaults to `openid profile email offline_access user.read`. See [App Registration](#app-registration) before calling a backend                          |
| `ENTRA_REQUIRED_ROLE` | App role needed on every route that does not opt out. Defaults to `Admin`; must match the role value on the App Registration                             |
| `ENTRA_RESPONSE_MODE` | `form_post` in production (needs HTTPS), omitted locally                                                                                                 |

In CDP, set `ENTRA_CLIENT_ID`, `ENTRA_DISCOVERY_URI` and `APP_BASE_URL` per
environment in `cdp-app-config`, and `ENTRA_CLIENT_SECRET` and
`SESSION_COOKIE_PASSWORD` as secrets in the CDP Portal. Use
[the CDP dev verification checklist](docs/entra-id-verification.md) for
deployment settings and live acceptance checks.

#### App Registration

Each Entra tenant (`defradev` for dev and test, `defra` for prod) needs an App
Registration for this service, set up through ServiceNow. It needs:

- **A client secret** ("Certificate Secret required: Yes"). It expires, usually
  after 12 months: request a new one and update the CDP secret before then, or
  nobody can sign in.
- **Redirect URIs** (web platform): `<APP_BASE_URL>/auth/callback` and
  `<APP_BASE_URL>/`. Entra only accepts a sign-out `post_logout_redirect_uri`
  that is a registered redirect URI.
- **An app role** whose value matches `ENTRA_REQUIRED_ROLE`, allowed for
  groups, plus the `roles` claim in the token configuration.
- **A security group** (`AG-...`) assigned to that role on the enterprise
  application. Users are given access by adding them to the group.

Before the app calls a backend with the user's access token, the App
Registration also needs `requestedAccessTokenVersion: 2` and a custom scope
exposed under "Expose an API" (for example `api://<client-id>/<scope>`), and
`ENTRA_SCOPES` must request that scope in place of `user.read`. Otherwise the
access token is a Microsoft Graph token, which a backend cannot verify.

#### Signing in locally and in CI

Locally and in CI, the app signs in against a **local Entra ID stub** instead
of real Entra. The stub is
[navikt/mock-oauth2-server](https://github.com/navikt/mock-oauth2-server), the
`entra-stub` service in [compose.yml](compose.yml), on
<http://localhost:3210>. It is never deployed. It accepts any client secret and
issues tokens with whatever claims you give it, so it can issue exactly what
Entra issues (`oid`, `name`, `preferred_username`, `roles`, and refresh tokens).

Everything else is the code that runs on CDP: the same plugin, client
authentication, routes, session, refresh and role handling. The differences:

| On CDP                                              | Locally and in CI                                 |
| --------------------------------------------------- | ------------------------------------------------- |
| Entra ID (`login.microsoftonline.com`)              | The Entra stub (`localhost:3210`)                 |
| The real client secret                              | `local-client-secret`, the non-production default |
| `form_post`, `SameSite=None` sign-in cookies, HTTPS | `query`, `Lax`, plain HTTP                        |
| Real users and app role assignments                 | Whoever you type into the stub's sign-in page     |

To test against real Entra locally, set `ENTRA_DISCOVERY_URI`,
`ENTRA_CLIENT_ID` and `ENTRA_CLIENT_SECRET` for the `defradev` tenant in your
`.env` (git-ignored). `http://localhost:3000/auth/callback` must be a
registered redirect URI.

##### Signing in locally

With Docker running:

```bash
docker compose up -d entra-stub
npm run dev
```

Open <http://localhost:3000> and choose **Sign in**. You land on the stub's
sign-in page, with a red "Not real Entra ID" banner. Pick a preset or edit
the claims, then choose **Sign in** to come back to the app signed in.

`npm run dev` needs nothing else: the defaults for `ENTRA_DISCOVERY_URI`,
`ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` and `APP_BASE_URL` all point at the
stub. Sessions are held in memory outside production, so Redis is not needed.

The stub keeps running until you stop it with `docker compose stop entra-stub`.

The `frontend` service in `compose.yml` runs the production image to check it
starts; use `npm run dev` to sign in.

##### Signing in as someone else

The stub's sign-in page ([compose/entra-stub/login.html](compose/entra-stub/login.html))
has two fields:

- **Username** becomes the token's `sub`.
- **ID token claims (JSON)** are added to the ID and access tokens.

The session reads these claims, so keep them in Entra's shape:

| Claim                | Used for                                         |
| -------------------- | ------------------------------------------------ |
| `oid`                | The user's ID in the session                     |
| `name`               | The name in the header                           |
| `preferred_username` | The email address in the header                  |
| `roles`              | Entra app roles, which become the user's `scope` |

The **Admin** preset has `roles: ["Admin"]`, and the **no roles** preset has
none, for checking what a user without access sees. To add a preset, add it to
the `presets` object in `login.html`; the stub reads the file on each request,
so there is no need to restart it.

The stub's own settings are in
[compose/entra-stub/config.json](compose/entra-stub/config.json). Its tokens
last an hour, the stub default.

##### In the end-to-end tests and CI

The sign-in journeys in
[e2e/journeys/auth/sign-in.spec.js](e2e/journeys/auth/sign-in.spec.js) sign in
through the stub's page, as the users in
[e2e/support/entra-stub.js](e2e/support/entra-stub.js). They cover signing in
and out, returning to the page the user was heading for, and a user with and
without the Admin role.

- **Locally**, `npm run test:e2e` starts the stub with
  `docker compose up entra-stub` if it is not already running, so Docker must
  be running. The first run pulls the image. The stub is left running
  afterwards.
- **In CI**, the `e2e` job in
  [check-pull-request.yml](.github/workflows/check-pull-request.yml) starts it
  with the other compose services, and Playwright reuses it.

See [e2e/README.md](e2e/README.md) for the rest of the suite.

##### What the stub does not test

These only get tested on CDP (or locally against the `defradev` tenant), so
check them in dev and test after any auth change:

- Real Entra behaviour: the client secret, registered redirect URIs, consent,
  and which claims Entra really sends.
- `form_post` and `SameSite=None` cookies. Locally the app uses `query` over
  HTTP, as the docs recommend.
- The CDP proxy route to `login.microsoftonline.com`.

The stub does not check the client ID, client secret or redirect URI. So a
wrong `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` or `APP_BASE_URL` will work
locally and fail on CDP.

##### Troubleshooting

| Symptom                                                                         | Cause                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| "Something went wrong" on **Sign in**, and `TypeError: fetch failed` in the log | The stub is not running: `docker compose up -d entra-stub`                           |
| The app will not start: `ENTRA_CLIENT_SECRET must be set`                       | Running with `NODE_ENV=production` and no secret. Set it as a CDP secret, or locally |
| "We could not sign you in" on CDP, with `AADSTS7000215` in the log              | The client secret is wrong                                                           |
| "We could not sign you in" on CDP, with `AADSTS7000222` in the log              | The client secret has expired: request a new one and update the CDP secret           |
| The stub sends you back to the wrong port                                       | `APP_BASE_URL` does not match where the app is running                               |
| Signed in, but no name in the header, or a 403 you did not expect               | The claims are missing `name`, or `roles` does not include the role the route needs  |

To see what the stub received, run `docker compose logs entra-stub`.

The stub image is pinned in `compose.yml`. When updating it, run
`npm run test:e2e` to check sign-in still works.

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag waste-batteries-admin-panel-fe`

Build:

```bash
docker build --target development --no-cache --tag waste-batteries-admin-panel-fe:development .
```

Run:

```bash
docker run -p 3000:3000 waste-batteries-admin-panel-fe:development
```

### Production image

Build:

```bash
docker build --no-cache --tag waste-batteries-admin-panel-fe .
```

Run:

```bash
docker run -p 3000:3000 waste-batteries-admin-panel-fe
```

### Docker Compose

A local environment with:

- Floci (replacing Localstack) for AWS services (S3, SQS)
- Redis
- MongoDB
- A local Entra ID stub, for signing in when running with `npm run dev` (see
  [Signing in locally and in CI](#signing-in-locally-and-in-ci))
- This service, in production mode. It cannot sign in locally.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Code quality and coverage are analysed by
[SonarCloud](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-batteries-admin-panel-fe)
on every pull request and on every publish. The quality gate appears as a check
on the pull request; the badges at the top of this file track `main`.

What is analysed is set in [sonar-project.properties](./sonar-project.properties)
— `src/` is the production code, and the unit tests, the Playwright journeys and
[test-helpers/](./test-helpers) are all declared as test code. Coverage comes
from the `./coverage/lcov.info` that `npm test` writes, so the scan runs after
the tests in each workflow.

To run the same scan locally:

```bash
SONAR_TOKEN=your-token ./sonarCloudLocal.sh
```

The script runs `npm test`, uploads the analysis with `@sonar/scan`, then writes
unresolved issues to `sonar-issues.json` and, when `python3` is available, a
copy/paste friendly `sonar-issues.md`.

To match the SonarCloud pull request summary view, pass the pull request key:

```bash
SONAR_TOKEN=your-token SONAR_PULL_REQUEST=6 ./sonarCloudLocal.sh
```

### Security scanning (ZAP)

Every pull request runs a **passive** [OWASP ZAP](https://www.zaproxy.org/)
scan as part of the `e2e` job. Playwright Chromium is proxied through a ZAP
daemon started from
[compose-github.override-zap.yml](./compose-github.override-zap.yml), so the
journeys generate the traffic ZAP inspects. There is no separate scan job.

The pull request fails if ZAP reports any **High** alerts against this app
(the compose frontend on port 3000 and the Playwright instance on 3100). The
`@zap` spec waits until ZAP's passive scan queue is empty before it reads
those alerts. Medium and Low findings stay in the report; they do not fail
the check. Traffic to the Entra ID stub on port 3210 is proxied too, but stub
findings are excluded from the High gate.

The HTML and JSON reports are uploaded as the `zap-test-report` artefact and
linked from a comment on the pull request, alongside the Playwright report.

ZAP is CI/test-only — it does not change app runtime config. The
[Proxy](#proxy) section above is the **app outbound** `HTTP_PROXY` / undici
dispatcher, which is unrelated.

To run the same scan locally, see [e2e/README.md](e2e/README.md#owasp-zap).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
