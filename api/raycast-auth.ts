import { VercelRequest, VercelResponse } from "@vercel/node";
import { AuthApi } from "../AuthApi";

export default async (req: VercelRequest, res: VercelResponse) => {
  const { user_state } = req.query;

  if (!user_state) {
    res.status(400).send("empty user_state");
    return;
  }

  const authId = String(user_state);
  const authApi = await AuthApi.retriveAuthState(authId, "raycast");
  if (!authApi) {
    res.status(400).send("invalid user_state");
    return;
  }

  try {
    const authUrl = await authApi.initiateAuth(authId, "raycast");
    res.redirect(authUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
