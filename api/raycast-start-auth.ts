import { VercelRequest, VercelResponse } from "@vercel/node";
import { AuthApi } from "../AuthApi";
import logger from "../logger";
import { kv } from "@vercel/kv";

export default async (req: VercelRequest, res: VercelResponse) => {
  const { id, deep_link } = req.query;
  const authApi = new AuthApi(id as string);

  logger.info(`Received /auth command with parameter from user ${id}`);

  try {
    return res.json({
      id: await authApi.generateStartAuthId(deep_link as string),
    });
  } catch (err) {
    logger.error(err);
    return res.json({
      error: err.message,
    });
  }
};
