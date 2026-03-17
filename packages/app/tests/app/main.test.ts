import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"

import { program } from "../../src/app/program.js"
import { TelegramBot } from "../../src/shell/telegram.js"

// Mock TelegramBot Layer
const MockTelegramBotLive = Layer.succeed(
  TelegramBot,
  TelegramBot.of({
    start: Effect.void
  })
)

describe("main program", () => {
  it.effect("starts the bot successfully", () =>
    Effect.gen(function*(_) {
      const result = yield* _(Effect.provide(program, MockTelegramBotLive))
      expect(result).toBeUndefined()
    }))
})
