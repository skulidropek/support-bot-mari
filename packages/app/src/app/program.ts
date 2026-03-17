import { Effect } from "effect"
import { TelegramBot } from "../shell/telegram.js"

// CHANGE: start the Telegram bot instead of the CLI greeting
// WHY: the goal is to run a bot that forwards messages
// QUOTE(TZ): "Сделать простого бота в которого менеджер отправляет сообщение..."
// PURITY: SHELL
// EFFECT: Effect<void, Error, TelegramBot>
// INVARIANT: bot is running until stopped or crashed

export const program = Effect.gen(function*(_) {
  const bot = yield* _(TelegramBot)
  yield* _(Effect.logInfo("Starting Telegram bot..."))
  yield* _(bot.start)
})
