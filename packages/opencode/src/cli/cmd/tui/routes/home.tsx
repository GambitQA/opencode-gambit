import { onMount } from "solid-js"
import { useSDK } from "../context/sdk"
import { Toast, useToast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData, useRoute } from "@tui/context/route"

export function Home() {
  const sdk = useSDK()
  const nav = useRoute()
  const route = useRouteData("home")
  const args = useArgs()
  const toast = useToast()

  onMount(() => {
    const initialPrompt = route.initialPrompt ?? (args.prompt ? { input: args.prompt, parts: [] } : undefined)
    sdk.client.session
      .create({})
      .then((result) => {
        nav.navigate({
          type: "session",
          sessionID: result.data!.id,
          initialPrompt,
          submit: !route.initialPrompt && !!args.prompt,
        })
      })
      .catch(() => toast.show({ message: "Failed to create session", variant: "error" }))
  })

  return (
    <>
      <box flexGrow={1} />
      <Toast />
    </>
  )
}
