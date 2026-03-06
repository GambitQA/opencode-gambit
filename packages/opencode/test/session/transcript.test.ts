import { afterAll, describe, expect, test } from "bun:test"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionStatus } from "../../src/session/status"
import { SessionTranscript } from "../../src/session/transcript"

const projectRoot = path.join(__dirname, "../..")

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasSupabase = !!(supabaseUrl && supabaseKey)
const db = hasSupabase ? createClient(supabaseUrl, supabaseKey) : undefined

async function run(input: { init?: () => Promise<unknown>; fn: () => Promise<void> | void }) {
  await Instance.provide({
    directory: projectRoot,
    init: input.init,
    fn: async () => {
      try {
        await input.fn()
      } finally {
        await Instance.dispose()
      }
    },
  })
}

function msg(messageID: string, sessionID: string, input: string, ignored = false) {
  return Session.updateMessage({
    id: messageID,
    sessionID,
    role: "user",
    time: { created: Date.now() },
    agent: "user",
    model: { providerID: "test", modelID: "test" },
    tools: {},
  }).then(() =>
    Session.updatePart({
      id: Identifier.ascending("part"),
      messageID,
      sessionID,
      type: "text",
      text: input,
      ignored,
    }),
  )
}

function reply(messageID: string, sessionID: string, parentID: string, text: string, tool = false) {
  return Session.updateMessage({
    id: messageID,
    sessionID,
    role: "assistant",
    time: { created: Date.now() },
    parentID,
    modelID: "test",
    providerID: "test",
    mode: "",
    agent: "test",
    path: { cwd: projectRoot, root: projectRoot },
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
  }).then(async () => {
    if (tool) {
      await Session.updatePart({
        id: Identifier.ascending("part"),
        messageID,
        sessionID,
        type: "tool",
        callID: "call-" + messageID,
        tool: "shell",
        state: {
          status: "completed",
          input: {},
          output: "done",
          title: "shell",
          metadata: {},
          time: {
            start: Date.now(),
            end: Date.now(),
          },
        },
      })
    }
    if (!text) return
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID,
      sessionID,
      type: "text",
      text,
    })
  })
}

async function queryRows(sessionID: string) {
  if (!db) return []
  const { data } = await db
    .from("session_transcripts")
    .select("session_id, message_id, role, time_created, text")
    .eq("session_id", sessionID)
    .order("time_created", { ascending: true })
  return data ?? []
}

const cleanupSessionIDs: string[] = []

afterAll(async () => {
  if (!db) return
  for (const id of cleanupSessionIDs) {
    await db.from("session_transcripts").delete().eq("session_id", id)
  }
})

function skipWithoutSupabase() {
  if (!hasSupabase) {
    console.log("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set, skipping")
    return true
  }
  return false
}

describe("session transcript", () => {
  test("syncs messages to supabase on idle", async () => {
    if (skipWithoutSupabase()) return
    await run({
      init: SessionTranscript.init,
      fn: async () => {
        const session = await Session.create({})
        cleanupSessionIDs.push(session.id)

        const userID = Identifier.ascending("message")
        const assistantID = Identifier.ascending("message")

        await msg(userID, session.id, "Question?")
        await reply(assistantID, session.id, userID, "Answer.")

        SessionStatus.set(session.id, { type: "idle" })
        await Bun.sleep(200)

        const rows = await queryRows(session.id)
        expect(rows).toEqual([
          {
            session_id: session.id,
            message_id: userID,
            role: "user",
            time_created: expect.any(Number),
            text: "Question?",
          },
          {
            session_id: session.id,
            message_id: assistantID,
            role: "assistant",
            time_created: expect.any(Number),
            text: "Answer.",
          },
        ])

        await Session.remove(session.id)
      },
    })
  })

  test("deduplicates on repeated sync via upsert", async () => {
    if (skipWithoutSupabase()) return
    await run({
      fn: async () => {
        const session = await Session.create({})
        cleanupSessionIDs.push(session.id)

        const userID = Identifier.ascending("message")
        const assistantID = Identifier.ascending("message")

        await msg(userID, session.id, "keep")
        await reply(assistantID, session.id, userID, "reply", true)

        await SessionTranscript.init()
        await SessionTranscript.sync(session.id)
        await SessionTranscript.sync(session.id)

        const rows = await queryRows(session.id)
        expect(rows).toHaveLength(2)
        expect(rows[0]!.message_id).toBe(userID)
        expect(rows[1]!.message_id).toBe(assistantID)

        await Session.remove(session.id)
      },
    })
  })

  test("filters non-text parts and ignored messages", async () => {
    if (skipWithoutSupabase()) return
    await run({
      fn: async () => {
        const session = await Session.create({})
        cleanupSessionIDs.push(session.id)

        const userID = Identifier.ascending("message")
        const silentID = Identifier.ascending("message")
        const assistantID = Identifier.ascending("message")

        await msg(userID, session.id, "keep")
        await msg(Identifier.ascending("message"), session.id, "drop", true)
        await reply(silentID, session.id, userID, "", true)
        await reply(assistantID, session.id, userID, "reply", true)

        await SessionTranscript.init()
        await SessionTranscript.sync(session.id)

        const rows = await queryRows(session.id)
        expect(rows).toHaveLength(2)
        expect(rows.map((r) => r.text)).toEqual(["keep", "reply"])

        await Session.remove(session.id)
      },
    })
  })

  test("keeps transcript rows after session deletion", async () => {
    if (skipWithoutSupabase()) return
    await run({
      fn: async () => {
        const session = await Session.create({})
        cleanupSessionIDs.push(session.id)

        const userID = Identifier.ascending("message")
        await msg(userID, session.id, "persist")

        await SessionTranscript.init()
        await SessionTranscript.sync(session.id)

        await Session.remove(session.id)

        const rows = await queryRows(session.id)
        expect(rows).toHaveLength(1)
        expect(rows[0]!.text).toBe("persist")
      },
    })
  })
})
