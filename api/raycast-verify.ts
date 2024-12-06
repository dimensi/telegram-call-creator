import { VercelRequest, VercelResponse } from "@vercel/node";
import logger from "../logger";
import { AuthApi } from "../AuthApi";

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
