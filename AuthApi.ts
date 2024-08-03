// authApi.ts
import { UserAuthState, AuthResponse } from "./UserState";
import pkceChallenge from "./pkceChallenge";
import logger from "./logger";
import axios, { AxiosInstance, AxiosStatic } from "axios";
import { isErrorResponse, proxyAgent, User, UserResponse } from "./api";
import { generate } from "@iamnnort/smart-id";
import { kv } from "@vercel/kv";

axios.defaults.httpAgent = proxyAgent;
axios.defaults.httpsAgent = proxyAgent;

export class AuthApi {
  private userAuthState: UserAuthState;
  public userId: string | number;

  constructor(userId: string | number) {
    this.userId = userId;
    this.userAuthState = new UserAuthState(userId);
  }

  async generateAuthUrl(): Promise<string> {
    const authId = generate();
    await kv.set(`telegram_id:${authId}`, this.userAuthState);
    return `https://telegram-calls.dimensi.dev/auth?user_state=${authId}`;
  }

  static async retriveAuthState(authId: string): Promise<AuthApi | null> {
    const telegramUserId = (await kv.get(`telegram_id:${authId}`)) as string;
    if (!telegramUserId) {
      return null;
    }
    return new AuthApi(telegramUserId);
  }

  async initiateAuth(authId: string): Promise<string> {
    const challenge = await pkceChallenge();
    await kv.set(`challenge:${authId}`, challenge.code_verifier);

    const redirectUrl = new URL("https://id.vk.com/authorize");
    const query = redirectUrl.searchParams;
    query.append("response_type", "code");
    query.append("client_id", process.env.CLIENT_ID as string);
    query.append("redirect_uri", "https://telegram-calls.dimensi.dev/verify");
    query.append("scope", "email phone");
    query.append("state", authId);
    query.append("code_challenge", challenge.code_challenge);
    query.append("code_challenge_method", "s256");
    query.append("ip", process.env.PROXY_ADDRESS as string);

    return redirectUrl.toString();
  }

  async verifyAuth(
    authId: string,
    code: string,
    deviceId: string
  ): Promise<AuthResponse> {
    const codeVerifier = await kv.getdel(`challenge:${authId}`);

    if (!codeVerifier) {
      throw new Error("Invalid state or code verifier not found");
    }

    logger.info(`codeVerifier: ${codeVerifier}`);

    const { data } = await axios.post<Omit<AuthResponse, "device_id">>(
      "https://id.vk.com/oauth2/auth",
      {
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
        code,
        client_id: process.env.CLIENT_ID,
        device_id: deviceId,
        redirect_uri: "https://telegram-calls.dimensi.dev/verify",
        state: authId,
        ip: process.env.PROXY_ADDRESS,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const authResponse = { ...data, device_id: deviceId };
    this.userAuthState.save(authResponse);
    await kv.del(`telegram_id:${authId}`);

    return authResponse;
  }

  async refreshToken(): Promise<AuthResponse> {
    const allState = await this.userAuthState.getAll();
    if (!allState) {
      throw new Error("User state not found");
    }

    const { data } = await axios.post<AuthResponse>(
      "https://id.vk.com/oauth2/auth",
      {
        grant_type: "refresh_token",
        refresh_token: allState.refresh_token,
        client_id: process.env.CLIENT_ID,
        device_id: allState.device_id,
        state: allState.state,
        ip: process.env.PROXY_ADDRESS,
        redirect_uri: "https://telegram-calls.dimensi.dev/verify",
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    logger.info(`Update auth token ${JSON.stringify(data)}`);

    if (isErrorResponse(data)) {
      throw new Error(data.error.error_msg);
    }
    const newState = { ...allState, ...data };
    await this.userAuthState.save(newState);
    return newState;
  }

  async getUserInfo(): Promise<User> {
    const idToken = await this.userAuthState.get("id_token");
    if (!idToken) {
      throw new Error("id_token not found");
    }

    const response = await axios.post<UserResponse>(
      "https://id.vk.com/oauth2/public_info",
      {
        client_id: process.env.CLIENT_ID,
        id_token: idToken,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.user;
  }

  getAxios(): AxiosInstance {
    const customAxios = axios.create({
      baseURL: "https://api.vk.com/method",
    });

    customAxios.interceptors.response.use(async (response) => {
      if (
        isErrorResponse(response.data) &&
        response.data.error.error_msg.includes("access_token has expired.")
      ) {
        logger.error(
          `Catch error in interceptors: ${JSON.stringify(response.data)}`
        );
        const allState = await this.userAuthState.getAll();
        logger.info(`allState in interceptors: ${JSON.stringify(allState)}`);

        if (!allState) {
          return response;
        }

        const newState = await this.refreshToken();

        return axios({
          ...response.config,
          params: {
            ...response.config.params,
            access_token: newState.access_token,
          },
        });
      }

      return response;
    });

    return customAxios;
  }

  async getAuthToken(): Promise<string | null> {
    return this.userAuthState.get("access_token");
  }

  async getVKUserId(): Promise<number | null> {
    const vkid = this.userAuthState.get("user_id");
    return vkid ? Number(vkid) : null;
  }
}
