import "dotenv/config"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"

import { TelegramBotLive } from "../shell/telegram.js"
import { program } from "./program.js"

// CHANGE: provide TelegramBotLive layer
// WHY: program requires TelegramBot service
// QUOTE(TZ): "Сделать простого бота"
// PURITY: SHELL
// EFFECT: Effect<void, Error, never>
// INVARIANT: bot starts with required dependencies

const MainLive = Layer.mergeAll(NodeContext.layer, TelegramBotLive)

const main = Effect.provide(program, MainLive)

NodeRuntime.runMain(main)
