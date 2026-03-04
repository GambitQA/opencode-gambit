import { test, expect } from "../fixtures"
import { openPalette } from "../actions"
import { promptSelector, sessionComposerDockSelector } from "../selectors"

test("model switching is hidden from the session UI", async ({ page, gotoSession }) => {
  await gotoSession()

  await expect(page.locator(sessionComposerDockSelector)).not.toContainText("big-pickle")

  await page.locator(promptSelector).click()
  await page.keyboard.type("/model")

  await expect(page.locator('[data-slash-id="model.choose"]')).toHaveCount(0)

  const palette = await openPalette(page)
  await palette.getByRole("textbox").first().fill("model")

  await expect(palette.locator('[data-slot="list-item"][data-key="model.choose"]')).toHaveCount(0)
})
