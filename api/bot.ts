import { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import { Telegraf } from "telegraf";
import { AuthResponse, UserAuthState } from "../UserState";
import {
  APIResponse,
  CallsStartResponse,
  isErrorResponse,
  proxyAgent,
} from "../api";
import logger from "../logger";
import { kv } from "@vercel/kv";
import { generate } from "@iamnnort/smart-id";

const bot = new Telegraf(process.env.BOT_TOKEN as string);
const customAxios = axios.create({
  httpsAgent: proxyAgent,
  httpAgent: proxyAgent,
});

customAxios.interceptors.response.use(async (response) => {
  const telegramId = response.config.params.context.id;
  const userState = new UserAuthState(telegramId);

  if (
    isErrorResponse(response.data) &&
    response.data.error.error_msg.includes("access_token has expired.") &&
    typeof telegramId === "number"
  ) {
    logger.error(
      `Catch error in interceptors: ${JSON.stringify(response.data)}`
    );
    const allState = await userState.getAll();
    logger.info(`allState in interceptors: ${JSON.stringify(allState)}`);
    if (allState) {
      const { data } = await axios.post<AuthResponse>(
        "https://id.vk.com/oauth2/auth",
        {
          grant_type: "refresh_token",
          refresh_token: allState.refresh_token,
          client_id: process.env.CLIENT_ID,
          device_id: allState.device_id,
          state: allState.state,
          ip: process.env.PROXY_ADDRESS,
          redirect_uri: "https://telegram-calls.dimensi.dev/verify",
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          httpAgent: proxyAgent,
          httpsAgent: proxyAgent,
        }
      );
      logger.info(`Update auth token ${JSON.stringify(data)}`);
      if (!isErrorResponse(data)) {
        await userState.save({ ...allState, ...data });
        return axios({
          ...response.config,
          params: {
            ...response.config.params,
            access_token: data.access_token,
          },
        });
      }
    }
  }
  return response;
});

bot.command("start", async (ctx) => {
  const chatId = ctx.message.chat.id;
  const authKey = generate();

  logger.info(`Отвечаю на auth: ${chatId}`);

  logger.info(`Received /auth command with parameter from user ${chatId}`);

  const authUrl = `https://telegram-calls.dimensi.dev/auth?user_state=${authKey}`;
  await kv.set(`user_state:${authKey}`, chatId);

  try {
    await ctx.telegram.sendMessage(
      chatId,
      `Для авторизации, пожалуйста, перейдите по следующей ссылке: ${authUrl}`
    );
  } catch (err) {
    logger.error(err);
    await ctx.telegram.sendMessage(chatId, `Произошла ошибка, ${err.message}`);
  }
});

bot.on("inline_query", async (ctx) => {
  const id = ctx.from.id;
  logger.info(`Inline query received from user ${ctx.from.id}`);

  const userAuthState = new UserAuthState(id);
  const [authToken, userId] = await Promise.all([
    userAuthState.get("access_token"),
    userAuthState.get("user_id"),
  ]);

  logger.info(`User ${id} state: ${authToken}, ${userId}`);
  if (!authToken) {
    await bot.telegram.answerInlineQuery(ctx.inlineQuery.id, [], {
      cache_time: 0,
      button: { text: "Авторизоваться", start_parameter: "auth" },
    });
    logger.info(`Inline query answered for user ${id}`);

    return;
  }

  try {
    const name = ctx.inlineQuery.query || "Новый звонок"; // Название звонка, можете заменить на желаемое
    const response = await customAxios.get<APIResponse<CallsStartResponse>>(
      "https://api.vk.com/method/calls.start",
      {
        params: {
          user_id: userId,
          v: "5.131",
          access_token: authToken,
          name,
          context: {
            id,
          },
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
