import request from "supertest";
import type { Express } from "express";

export interface CsrfInfo {
  token: string;
  cookie: string;
}

export async function getCsrfTokenAndCookie(app: Express): Promise<CsrfInfo> {
  const res = await request(app).get("/api/v1/csrf-token");
  const token = (res.body.csrfToken || res.body.token) as string;
  const setCookie = res.headers["set-cookie"];
  const cookieStr = Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
  const cookie = cookieStr.split(";")[0]!;
  return { token, cookie };
}
