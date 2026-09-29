# End-to-end tests

Playwright journeys, grouped by area under [journeys/](journeys). Everything
here today is [journeys/auth/](journeys/auth). There is no identity provider
wired in yet, so these only cover signed-out behaviour; sign-in journeys come
back with Entra ID.

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

Playwright starts the app itself (see [support/app-instances.js](support/app-instances.js)),
so `npm run dev` does not need to be running.

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

One route exists only for these tests: `/e2e/protected`, which takes the
server-wide auth default. The application's own pages are all deliberately
public today, so without it nothing would exercise route protection. It is
registered in [support/test-server.js](support/test-server.js) behind
`E2E_PROTECTED_ROUTES` and is never registered by `src/index.js`.

The app's stdout is captured to `e2e/.logs/app-<port>.log`.

## Coverage of the manual checklist

| Phase                      | Spec                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| 0 Environment up           | [environment.spec.js](journeys/auth/environment.spec.js)           |
| 1 Signed-out state         | [signed-out.spec.js](journeys/auth/signed-out.spec.js)             |
| 4 Route protection default | [route-protection.spec.js](journeys/auth/route-protection.spec.js) |

The browser-side "must never see" invariants (a JWT in a cookie, anything
auth-related in web storage) are in [support/invariants.js](support/invariants.js).
