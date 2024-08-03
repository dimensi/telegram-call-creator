import { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import axios from "axios";
import { Telegraf } from "telegraf";
import { AuthResponse, UserAuthState } from "../UserState";
import logger from "../logger";
import { proxyAgent, UserResponse } from "../api";
import { AuthApi } from "../AuthApi";

const bot = new Telegraf(process.env.BOT_TOKEN as string);

export default async (req: VercelRequest, res: VercelResponse) => {
  const { query } = req;
  const authId = String(query.state);
  const authApi = await AuthApi.retriveAuthState(authId);
  if (!authApi) {
    return res.send("Invalid authId");
  }

  try {
    const authResponse = await authApi.verifyAuth(
      authId,
      String(query.code),
      String(query.device_id)
    );

    logger.info(`"ouath2/auth response data: ${JSON.stringify(authResponse)}"`);

    const user = await authApi.getUserInfo();

    logger.info(`"response data: ${JSON.stringify(user)}"`);

    await bot.telegram.sendMessage(
      authApi.userId,
      `Вы авторизовались как ${user.first_name} ${user.last_name}

Для создания звонка напишите в любом диалоге и чате @vkcallsBot, пробел, название звонка.

Например, вот так:

@vkcallsBot Обсудим важные дела`
    );

    res.redirect("https://vkcallsBot.t.me/");
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error.message);
      res.status(500).send(`Error: ${error.message}`);
    } else {
      res.send("Internal Server Error");
    }
  }
};
