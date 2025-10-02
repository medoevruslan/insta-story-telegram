import { Telegraf, Context } from "telegraf";
import { Update } from "telegraf/types";
import { PublishInstagramStoryUseCase } from "../../application/usecases/publish-instagram-story.usecase";
import { Logger } from "../../application/ports/logger";
import { extractInstagramUrl, inferMediaType } from "./instagram-link-parser";

export const createTelegramBot = (
  token: string,
  useCase: PublishInstagramStoryUseCase,
  logger: Logger
): Telegraf<Context<Update>> => {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    await ctx.reply(
      "Send me an Instagram reel or story URL and I will mirror it to Telegram stories."
    );
  });

  bot.on("message", async (ctx) => {
    const rawMessage = ctx.message as { text?: string; caption?: string };
    const text = rawMessage.text ?? rawMessage.caption;
    const url = extractInstagramUrl(text);

    if (!url) {
      logger.debug("No Instagram URL found in message");
      return ctx.reply("Please send a valid Instagram reel or story URL.");
    }

    const type = inferMediaType(url);

    try {
      await useCase.execute({
        url,
        type,
        captionOverride: text ?? undefined,
      });

      await ctx.reply(
        "✅ Your Instagram media is being published to Telegram stories."
      );
    } catch (error) {
      logger.error("Failed to process Instagram media", { error });
      await ctx.reply(
        "❌ Failed to process this Instagram link. Please try again later."
      );
    }
  });

  return bot;
};
