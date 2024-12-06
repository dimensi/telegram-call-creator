import { VercelRequest, VercelResponse } from "@vercel/node";
import { AuthApi } from "../AuthApi";
import logger from "../logger";
import { kv } from "@vercel/kv";

export default async (req: VercelRequest, res: VercelResponse) => {
  const { id, deep_link } = req.query;
  const authApi = new AuthApi(id as string);

  logger.info(`Received /auth command with parameter from user ${id}`);

  await kv.set(`raycast_deeplink:${id}`, deep_link);
  try {
    return res.json({
      url: await authApi.generateAuthUrl("raycast"),
    });
  } catch (err) {
    logger.error(err);
    return res.json({
      error: err.message,
    });
  }
};
