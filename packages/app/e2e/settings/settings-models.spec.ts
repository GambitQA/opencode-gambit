import { test, expect } from "../fixtures"
import { closeDialog, openSettings } from "../actions"

test("models settings search filters the list", async ({ page, gotoSession }) => {
  await gotoSession()

  const settings = await openSettings(page)

  await settings.getByRole("tab", { name: "Models" }).click()

  const search = settings.getByPlaceholder("Search models")
  await expect(search).toBeVisible()

  await search.fill("big-pickle")
  await expect(settings.locator('[data-component="switch"]')).toHaveCount(1)

  await search.fill("missing-model-name")
  await expect(settings.getByText("No model results")).toBeVisible()

  await closeDialog(page, settings)
})
