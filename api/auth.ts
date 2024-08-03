import { VercelRequest, VercelResponse } from "@vercel/node";
import { URL } from "url";
import pkceChallenge from "../pkceChallenge";
import { kv } from "@vercel/kv";

export default async (req: VercelRequest, res: VercelResponse) => {
  const { user_state } = req.query;

  if (!user_state) {
    res.status(400).send("empty user_state");
    return;
  }

  const savedState = await kv.get(`user_state:${user_state}`);
  if (!savedState) {
    res.status(400).send("invalid user_state");
    return;
  }

  const userState = String(user_state);

  try {
    const challenge = await pkceChallenge();
    await kv.set(`challenge:${userState}`, challenge.code_verifier);

    const redirectUrl = new URL("https://id.vk.com/authorize");
    const query = redirectUrl.searchParams;
    query.append("response_type", "code");
    query.append("client_id", process.env.CLIENT_ID as string);
    query.append("redirect_uri", "https://telegram-calls.dimensi.dev/verify");
    query.append("scope", "email phone");
    query.append("state", userState);
    query.append("code_challenge", challenge.code_challenge);
    query.append("code_challenge_method", "s256");
    query.append("ip", process.env.PROXY_ADDRESS as string);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
