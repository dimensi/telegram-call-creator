import { HttpsProxyAgent } from 'https-proxy-agent';

export interface CallsShortCredentials {
  /**
   * Short numeric ID of a call
   */
  id: string;
  /**
   * Password that can be used to join a call by short numeric ID
   */
  password: string;
  /**
   * Link without a password
   */
  link_without_password: string;
  /**
   * Link with a password
   */
  link_with_password: string;
}


export interface CallsStartParams {
  chat_id?: number;
  only_auth_users?: 0 | 1;
  group_id?: number;
  name?: string;
  time?: number;
  duration?: number;
  recurrence_start_time?: number;
  recurrence_until_time?: number;
  recurrence_rule?:
    | "daily"
    | "monthly"
    | "never"
    | "not_set"
    | "same_week_day"
    | "weekdays"
    | "weekend"
    | "weekly"
    | "yearly";
  skip_notification?: 0 | 1;
  waiting_hall?: 0 | 1;
  mute_audio?: "mute" | "mute_permanent" | "not_set" | "unmute";
  mute_video?: "mute" | "mute_permanent" | "not_set" | "unmute";
  mute_screen_sharing?: "mute" | "mute_permanent" | "not_set" | "unmute";
  allowed_users?: string;
  only_admin_can_share_movie?: 0 | 1;
  feedback?: 0 | 1;
  broadcast_id?: string;
  only_admin_can_record?: 0 | 1;
  only_admin_can_start_asr?: 0 | 1;
  no_chat?: 0 | 1;
  no_history?: 0 | 1;
  only_chat_participants?: 0 | 1;
}

export interface CallsStartResponse {
  /**
   * Call id
   */
  call_id?: string;
  /**
   * Join link
   */
  join_link: string;
  /**
   * OK join link
   */
  ok_join_link: string;
  /**
   * video id for link
   */
  broadcast_video_id?: string;
  /**
   * video id for streaming
   */
  broadcast_ov_id?: string;
  short_credentials?: CallsShortCredentials;
}

interface RequestParam {
  key: string;
  value: string;
}

export interface ErrorDetails {
  error_code: number;
  error_subcode: number;
  error_msg: string;
  error_text: string;
  request_params: RequestParam[];
  view: string;
}

export interface ErrorResponse {
  error: ErrorDetails;
}

export interface APIResponse<T> {
  response: T;
  error?: ErrorDetails;
}

export interface DataResponse<T> {
  response: T;
}

export const isErrorResponse = (data: any): data is ErrorResponse => {
  return data.error !== undefined;
}

export const proxyAgent = new HttpsProxyAgent(`http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_ADDRESS}:${process.env.PROXY_PORT}`)

export interface User {
  user_id: string; // Идентификатор пользователя.
  first_name: string; // Имя пользователя.
  last_name: string; // Первая буква фамилии пользователя.
  phone: string; // Телефон пользователя.
  avatar: string; // Ссылка на фото профиля пользователя.
  email: string; // Адрес почты пользователя.
  sex: 0 | 1 | 2; // Пол. Возможные значения: 1 — женский, 2 — мужской, 0 — пол не указан.
  is_verified: boolean; // Признак того, что аккаунт пользователя подтвержден.
  birthday: string; // Дата рождения пользователя.
}

export interface UserResponse {
  user: User;
}