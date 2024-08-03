import { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import axios from "axios";
import { Telegraf } from "telegraf";
import { AuthResponse, UserAuthState } from "../UserState";
import logger from "../logger";
import { proxyAgent, UserResponse } from "../api";

const bot = new Telegraf(process.env.BOT_TOKEN as string);

export default async (req: VercelRequest, res: VercelResponse) => {
  const { query } = req;
  const state = String(query.state);
  const codeVerifier = await kv.getdel(`challenge:${state}`);

  if (!codeVerifier) {
    return res.redirect("https://vkcallsBot.t.me/");
  }

  console.log("codeVerifier: ", { codeVerifier });

  try {
    const { data } = await axios.post<Omit<AuthResponse, "device_id">>(
      "https://id.vk.com/oauth2/auth",
      {
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
        code: String(query.code),
        client_id: process.env.CLIENT_ID,
        device_id: String(query.device_id),
        redirect_uri: "https://telegram-calls.dimensi.dev/verify",
        state: state,
        ip: process.env.PROXY_ADDRESS,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
      }
    );

    logger.info(`"ouath2/auth response data: ${JSON.stringify(data)}"`);
    const userId = await kv.getdel(`user_state:${state}`);
    const userState = new UserAuthState(userId as string);
    await userState.save(
      Object.assign(data, { device_id: String(query.device_id) })
    );
    const userInfo = await axios.post<UserResponse>(
      "https://id.vk.com/oauth2/public_info",
      {
        client_id: process.env.CLIENT_ID,
        id_token: data.id_token,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
      }
    );

    logger.info(`"response data: ${JSON.stringify(userInfo.data)}"`);

    await bot.telegram.sendMessage(
      userId as string,
      `Вы авторизовались как ${userInfo.data.user.first_name} ${userInfo.data.user.last_name}

Для создания звонка напишите в любом диалоге и чате @vkcallsBot, пробел, название звонка.

Например, вот так:

@vkcallsBot Обсудим важные дела`
    );
    res.redirect("https://vkcallsBot.t.me/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
