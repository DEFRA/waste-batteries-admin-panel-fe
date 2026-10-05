# End-to-end tests

Playwright journeys, grouped by area under [journeys/](journeys). Everything
here today is [journeys/auth/](journeys/auth). The sign-in journeys sign in
against the local Entra ID stub, not real Entra; see
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
artefact.

## Adding an area

A new area needs a folder under `journeys/` and a matching tag on its
`describe`. Registrations would be `journeys/registration/` tagged
`@registration`, and `--grep @registration` would run just those. Anything
genuinely shared across areas belongs in [support/](support).

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
