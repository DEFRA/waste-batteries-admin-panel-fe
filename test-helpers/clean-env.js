// Unit tests rely on config defaults. Drop auth values a developer's shell may
// export (e.g. a zsh plugin that loads .env), so results don't depend on it.
for (const key of Object.keys(process.env)) {
  if (/^(ENTRA_|SESSION_COOKIE_)|^APP_BASE_URL$/.test(key)) {
    delete process.env[key]
  }
}
