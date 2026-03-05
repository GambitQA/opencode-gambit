import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Log } from "@/util/log"
import { supabase, ready } from "@/util/supabase"
import { SessionStatus } from "./status"
import { MessageV2 } from "./message-v2"

export namespace SessionTranscript {
  const log = Log.create({ service: "session-transcript" })
  const state = Instance.state(
    () => ({ ready: false, sessions: new Set<string>() }),
    async (s) => {
      await Promise.all([...s.sessions].map((id) => sync(id).catch(() => {})))
    },
  )

  export type Entry = {
    session_id: string
    message_id: string
    role: "user" | "assistant"
    time_created: number
    text: string
  }

  function text(msg: MessageV2.WithParts) {
    return msg.parts
      .filter((part) => {
        if (part.type !== "text") return false
        if (msg.info.role === "user") return !part.ignored
        return true
      })
      .map((part) => part.text)
      .join("")
      .trim()
  }

  export function entry(msg: MessageV2.WithParts) {
    const value = text(msg)
    if (!value) return
    return {
      session_id: msg.info.sessionID,
      message_id: msg.info.id,
      role: msg.info.role,
      time_created: msg.info.time.created,
      text: value,
    } satisfies Entry
  }

  export async function sync(sessionID: string) {
    if (!ready() || !supabase) return

    const rows = await Session.messages({ sessionID })
    const entries = rows.flatMap((msg) => {
      const item = entry(msg)
      if (!item) return []
      return [item]
    })
    if (entries.length === 0) return

    const { error } = await supabase
      .from("session_transcripts")
      .upsert(entries, { onConflict: "session_id,message_id" })

    if (error) {
      log.error("upsert failed", { sessionID, error })
    } else {
      console.log(`[transcript] synced ${entries.length} entries to Supabase for session ${sessionID}`)
    }
  }

  export async function init() {
    if (state().ready) return
    state().ready = true

    Bus.subscribe(SessionStatus.Event.Status, (evt) => {
      state().sessions.add(evt.properties.sessionID)
      if (evt.properties.status.type !== "idle") return
      sync(evt.properties.sessionID).catch((error) => {
        log.error("sync failed", { sessionID: evt.properties.sessionID, error })
      })
    })
  }
}
