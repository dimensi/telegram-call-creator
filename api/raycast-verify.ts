import { VercelRequest, VercelResponse } from "@vercel/node";
import logger from "../logger";
import { AuthApi } from "../AuthApi";
import { kv } from "@vercel/kv";

export default async (req: VercelRequest, res: VercelResponse) => {
  const { query } = req;
  const authId = String(query.state);
  const authApi = await AuthApi.retriveAuthState(authId, "raycast");
  if (!authApi) {
    return res.status(200).send("invalid user_state");
  }

  try {
    const deepLink = await kv.getdel(`raycast_deeplink:${authId}`);

    const updatedUrl = new URL(deepLink as string);
    updatedUrl.searchParams.append(
      "context",
      JSON.stringify({
        code: String(query.code),
        device_id: String(query.device_id),
      })
    );

    if (!deepLink) {
      return res.status(200).send("invalid user_state");
    }

    return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
          </head>
          <body>
            <p>Redirecting...</p>
            <script>
              window.location.href = "${updatedUrl.toString()}";
            </script>
          </body>
        </html>
    `);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error.message);
      res.status(500).send(`Error: ${error.message}`);
    } else {
      res.send("Internal Server Error");
    }
  }
};
