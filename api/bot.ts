import { VercelRequest, VercelResponse } from "@vercel/node";
import { Telegraf } from "telegraf";
import { AuthApi } from "../AuthApi";
import { APIResponse, CallsStartResponse, isErrorResponse } from "../api";
import logger from "../logger";

const bot = new Telegraf(process.env.BOT_TOKEN as string);

bot.command("start", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const authApi = new AuthApi(chatId);

  logger.info(`Received /auth command with parameter from user ${chatId}`);

  try {
    await ctx.telegram.sendMessage(
      chatId,
      `Для авторизации, пожалуйста, перейдите по следующей ссылке: ${await authApi.generateAuthUrl()}`
    );
  } catch (err) {
    logger.error(err);
    await ctx.telegram.sendMessage(chatId, `Произошла ошибка, ${err.message}`);
  }
});

bot.command("create", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const authApi = new AuthApi(chatId);
  const [authToken, userId] = await Promise.all([
    authApi.getAuthToken(),
    authApi.getVKUserId(),
  ]);

  logger.info(`User ${chatId} state: ${authToken}, ${userId}`);
  if (!authToken || !userId) {
    await bot.telegram.sendMessage(
      chatId,
      "Пожалуйста, авторизуйтесь для продолжения.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Авторизоваться", callback_data: "auth" }],
          ],
        },
      }
    );
    logger.info(`Inline query answered for user ${chatId}`);

    return;
  }

  try {
    const name = ctx.message.text.split(" ").slice(1) || "Новый звонок"; // Название звонка, можете заменить на желаемое
    const axios = authApi.getAxios();
    const response = await axios.get<APIResponse<CallsStartResponse>>(
      "calls.start",
      {
        params: {
          user_id: userId,
          v: "5.131",
          access_token: authToken,
          name,
        },
      }
    );

    logger.info(`response data: ${JSON.stringify(response.data)}`);
    if (isErrorResponse(response.data)) {
      logger.error(JSON.stringify(response.data.error));
      await bot.telegram.sendMessage(
        chatId,
        `Произошла ошибка: ${response.data.error.error_msg}`
      );
      return;
    }

    const joinLink = response.data.response.join_link;

    await bot.telegram.sendMessage(chatId, `Звонок "${name}":\n${joinLink}`, {
      reply_markup: {
        inline_keyboard: [[{ text: "Присоединиться к звонку", url: joinLink }]],
      },
    });
  } catch (error) {
    logger.error(error);
    await bot.telegram.sendMessage(
      chatId,
      `Произошла ошибка: ${error.message}`
    );
  }
});

bot.on("inline_query", async (ctx) => {
  const id = ctx.from.id;
  logger.info(`Inline query received from user ${ctx.from.id}`);
  const authApi = new AuthApi(id);
  const [authToken, userId] = await Promise.all([
    authApi.getAuthToken(),
    authApi.getVKUserId(),
  ]);

  logger.info(`User ${id} state: ${authToken}, ${userId}`);
  if (!authToken || !userId) {
    await bot.telegram.answerInlineQuery(ctx.inlineQuery.id, [], {
      cache_time: 0,
      button: { text: "Авторизоваться", start_parameter: "auth" },
    });
    logger.info(`Inline query answered for user ${id}`);

    return;
  }

  try {
    const name = ctx.inlineQuery.query || "Новый звонок"; // Название звонка, можете заменить на желаемое
    const axios = authApi.getAxios();
    const response = await axios.get<APIResponse<CallsStartResponse>>(
      "calls.start",
      {
        params: {
          user_id: userId,
          v: "5.131",
          access_token: authToken,
          name,
        },
      }
    );

    logger.info(`response data: ${JSON.stringify(response.data)}`);
    if (isErrorResponse(response.data)) {
      logger.error(JSON.stringify(response.data.error));
      await bot.telegram.answerInlineQuery(
        ctx.inlineQuery.id,
        [
          {
            type: "article",
            id: "1",
            title: "Произошла ошибка",
            input_message_content: {
              message_text: `Произошла ошибка: ${response.data.error.error_msg}`,
            },
          },
        ],
        { cache_time: 0 }
      );
      return;
    }

    const joinLink = response.data.response.join_link;

    await bot.telegram.answerInlineQuery(
      ctx.inlineQuery.id,
      [
        {
          type: "article",
          id: response.data.response.call_id ?? "1",
          title: `Создать звонок`,
          description: `"${name}"`,
          input_message_content: {
            message_text: `Звонок "${name}":\n${joinLink}`,
          },
          thumbnail_url: `https://sun9-57.userapi.com/s/v1/if2/a3VZfnU-3YGPHZLjqvf0DoF9ECzlBASilkK3Mo12ynYkuABfAdMys_nyNgteortiCbsR5QHoXjDuNZS-PlgRLZZw.jpg?quality=96&crop=0,0,400,400&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360&ava=1&u=PPlxrtoRCn_XFl4WD0keqTS5DF7JaD3i9GhD2Jo_lvs&cs=100x100`,
          thumbnail_width: 100,
          thumbnail_height: 100,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Присоединиться к звонку", url: joinLink }],
            ],
          },
        },
      ],
      { cache_time: 0 }
    );
  } catch (error) {
    logger.error(error);
    await bot.telegram.answerInlineQuery(ctx.inlineQuery.id, []);
  }
});

logger.info("Telegram bot started");
export default async (req: VercelRequest, res: VercelResponse) => {
  const webhook = await bot.createWebhook({
    domain: `telegram-calls.dimensi.dev`,
    path: "/api/bot",
  });
  webhook(req, res);
};
