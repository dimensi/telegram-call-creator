import { VercelRequest, VercelResponse } from "@vercel/node";
import { AuthApi } from "../AuthApi";
import logger from "../logger";

export default async (req: VercelRequest, res: VercelResponse) => {
  const { id } = req.query;
  const authApi = new AuthApi(id as string);

  logger.info(`Received /auth command with parameter from user ${id}`);

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
