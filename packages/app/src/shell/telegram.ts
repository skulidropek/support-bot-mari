import { Config, Context, Effect, Layer } from "effect"
import type { Context as GrammyContext } from "grammy"
import { Bot } from "grammy"
import sqlite3 from "sqlite3"

// CHANGE: Add TelegramBot service layer to manage the bot lifecycle and dependencies
// WHY: Integrate grammy with Effect functional core imperative shell (FCIS) pattern
// QUOTE(TZ): "Сделать простого бота... бот эти данные просто дублирует в канал"
// PURITY: SHELL
// EFFECT: Effect<TelegramBot, never, Config>
// INVARIANT: Bot instance is initialized with the configured token

export interface TelegramBot {
  readonly start: Effect.Effect<void, Error>
}

export const TelegramBot = Context.GenericTag<TelegramBot>("TelegramBot")

interface MessageData {
  readonly managerChatId: number
  readonly managerMessageId: number
}

const db = new sqlite3.Database("bot-state.db")

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    groupMessageId INTEGER PRIMARY KEY,
    managerChatId INTEGER NOT NULL,
    managerMessageId INTEGER NOT NULL
  )`)
})

interface DBRow {
  readonly managerChatId: number
  readonly managerMessageId: number
}

const getMessageData = (groupMessageId: number) =>
  Effect.async<MessageData | null, Error>((resume) => {
    db.get(
      "SELECT managerChatId, managerMessageId FROM messages WHERE groupMessageId = ?",
      [groupMessageId],
      (err, row: DBRow | undefined) => {
        if (err) {
          resume(Effect.fail(err))
        } else if (row) {
          resume(Effect.succeed({ managerChatId: row.managerChatId, managerMessageId: row.managerMessageId }))
        } else {
          resume(Effect.succeed(null))
        }
      }
    )
  })

const saveMessageData = (groupMessageId: number, data: MessageData) =>
  Effect.async<null, Error>((resume) => {
    db.run(
      "INSERT OR REPLACE INTO messages (groupMessageId, managerChatId, managerMessageId) VALUES (?, ?, ?)",
      [groupMessageId, data.managerChatId, data.managerMessageId],
      (err) => {
        if (err) {
          resume(Effect.fail(err))
        } else {
          resume(Effect.succeed(null))
        }
      }
    )
  })

const handleIncomingMessage = (ctx: GrammyContext, groupId: number) =>
  Effect.gen(function*(_) {
    if (!ctx.chat || !ctx.msg) {
      return
    }

    if (ctx.chat.type === "private") {
      yield* _(Effect.logInfo(`Private message from ${ctx.chat.id}`))
      const copied = yield* _(
        Effect.tryPromise(() => ctx.copyMessage(groupId))
      )
      yield* _(Effect.logInfo(`Copied to group ${groupId}, message_id: ${copied.message_id}`))
      yield* _(saveMessageData(copied.message_id, {
        managerChatId: ctx.chat.id,
        managerMessageId: ctx.msg.message_id
      }))
    } else if (
      ctx.chat.id === groupId &&
      ctx.msg.reply_to_message
    ) {
      yield* _(Effect.logInfo(`Group reply, reply_to_message.message_id: ${ctx.msg.reply_to_message.message_id}`))
      const data = yield* _(getMessageData(ctx.msg.reply_to_message.message_id))

      if (data === null) {
        yield* _(
          Effect.logWarning(`No managerChatId found in map for message ${ctx.msg.reply_to_message.message_id}`)
        )
      } else {
        yield* _(
          Effect.logInfo(`Found managerChatId: ${data.managerChatId}, managerMessageId: ${data.managerMessageId}`)
        )
        yield* _(Effect.tryPromise(() =>
          ctx.copyMessage(data.managerChatId, {
            reply_parameters: { message_id: data.managerMessageId }
          })
        ))
        yield* _(Effect.logInfo(`Copied reply back to manager ${data.managerChatId}`))
      }
    }
  })

const makeBot = Effect.gen(function*(_) {
  const token = yield* _(Config.string("TELEGRAM_BOT_TOKEN"))
  const groupId = yield* _(Config.integer("GROUP_CHAT_ID"))

  const bot = new Bot(token)

  bot.on("message", (ctx) => {
    const handledProcess = Effect.catchAllCause(
      handleIncomingMessage(ctx, groupId),
      (cause) => Effect.logError("Error processing message", cause)
    )

    void Effect.runPromise(handledProcess)
  })

  return TelegramBot.of({
    start: Effect.tryPromise({
      try: () => bot.start(),
      catch: (e) => new Error(String(e))
    })
  })
})

export const TelegramBotLive = Layer.effect(TelegramBot, makeBot)
