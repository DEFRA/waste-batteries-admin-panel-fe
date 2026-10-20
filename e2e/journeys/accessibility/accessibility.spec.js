import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/** Each page, and how to reach it. */
const pages = [
  { name: 'Home (signed out)', path: '/' },
  { name: 'About (signed out)', path: '/about' },
  { name: 'Not found', path: '/no-such-page' }
]

test.describe('Accessibility', { tag: '@a11y' }, () => {
  for (const { name, path, act, hasErrors } of pages) {
    const open = async (page) => {
      await page.goto(path)
      await act?.(page)
    }

    test(`${name} meets WCAG 2.2 AA`, async ({ page }) => {
      await open(page)

      const { violations } = await new AxeBuilder({ page })
        /**
         * Axe's tags are not cumulative, so AA means listing every level up to it.
         * best-practice adds axe's non-WCAG rules, such as landmarks.
         */
        .withTags([
          'wcag2a',
          'wcag2aa',
          'wcag21a',
          'wcag21aa',
          'wcag22a',
          'wcag22aa',
          'best-practice'
        ])
        .analyze()

      expect(
        violations.map(({ id, impact, help, nodes }) => ({
          id,
          impact,
          help,
          targets: nodes.map((node) => node.target.join(' '))
        }))
      ).toEqual([])
    })

    test(`${name} has a title that matches its heading`, async ({ page }) => {
      await open(page)

      // GOV.UK pattern: "<h1> | <service>", prefixed "Error: " when the page
      // shows a validation error, so screen readers announce it first
      const heading = (await page.locator('h1').innerText()).trim()
      const [titleStart] = (await page.title()).split(' | ')

      expect(titleStart).toBe(`${hasErrors ? 'Error: ' : ''}${heading}`)
    })
  }
})
