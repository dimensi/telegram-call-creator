import { kv } from "@vercel/kv";

export interface AuthResponse {
  refresh_token: string;
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  user_id: number;
  state: string;
  scope: string;
  device_id: string;
}

export class UserAuthState {
  userId: string;

  constructor(userId: string | number) {
    this.userId = String(userId);
  }

  save(data: AuthResponse) {
    return kv.hset(this.userId, data as unknown as Record<string, unknown>);
  }

  get<T extends keyof AuthResponse>(field: T): Promise<AuthResponse[T] | null> {
    return kv.hget(this.userId, field);
  }

  getAll(): Promise<AuthResponse | null> {
    return kv.hgetall(this.userId) as Promise<AuthResponse | null>;
  }

  clear() {
    return kv.hdel(this.userId);
  }
}
