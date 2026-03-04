import { test, expect } from "../fixtures"
import { closeDialog, openSettings } from "../actions"

test("models settings can hide and restore a model", async ({ page, gotoSession }) => {
  await gotoSession()

  const settings = await openSettings(page)

  await settings.getByRole("tab", { name: "Models" }).click()

  const toggle = settings.locator('[data-component="switch"]').first()
  const input = toggle.locator('[data-slot="switch-input"]')

  await expect(toggle).toBeVisible()
  await expect(input).toHaveAttribute("aria-checked", "true")

  await toggle.locator('[data-slot="switch-control"]').click()
  await expect(input).toHaveAttribute("aria-checked", "false")

  await toggle.locator('[data-slot="switch-control"]').click()
  await expect(input).toHaveAttribute("aria-checked", "true")

  await closeDialog(page, settings)
})
