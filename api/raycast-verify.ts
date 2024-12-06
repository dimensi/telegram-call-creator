import { VercelRequest, VercelResponse } from "@vercel/node";
import logger from "../logger";
import { AuthApi } from "../AuthApi";
import { kv } from "@vercel/kv";

export default async (req: VercelRequest, res: VercelResponse) => {
  const { query } = req;
  const authId = String(query.state);
  const authApi = await AuthApi.retriveAuthState(authId);
  if (!authApi) {
    return res.redirect("https://vkcallsBot.t.me/");
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

    const deepLink = await kv.getdel(`raycast_deeplink:${authId}`);

    const updatedUrl = new URL(deepLink as string);
    updatedUrl.searchParams.set("access_token", authResponse.access_token);
    updatedUrl.searchParams.set("refresh_token", authResponse.refresh_token);
    updatedUrl.searchParams.set(
      "expires_in",
      authResponse.expires_in.toString()
    );
    updatedUrl.searchParams.set("user_id", authResponse.user_id.toString());

    if (deepLink) {
      return res.status(200).send(`
    <script>
      window.location.href = "${updatedUrl.toString()}";
    </script>
    `);
    }

    return res.json({
      user,
      credentials: {
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
        expires_in: authResponse.expires_in,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error.message);
      res.status(500).send(`Error: ${error.message}`);
    } else {
      res.send("Internal Server Error");
    }
  }
};
