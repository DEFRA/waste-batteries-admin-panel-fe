import { execSync } from 'node:child_process'

export default function globalSetup() {
  // The test servers run with NODE_ENV=test, which serves the built assets in
  // .public rather than Vite's dev middleware — so build them, or every page
  // renders unstyled
  execSync('npm run build:frontend', { stdio: 'inherit' })
}
