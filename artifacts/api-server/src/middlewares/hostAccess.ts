import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";

export const HOST_ACCESS_COOKIE = "host_access";

function getCookieSecret(): string {
  return process.env.SESSION_SECRET?.trim() || "dev-session-secret";
}

function getAllowedHostCodes(): string[] {
  const combined = [
    process.env.HOST_ACCESS_CODES,
    process.env.HOST_ACCESS_CODE,
    process.env.SESSION_SECRET,
  ]
    .filter(Boolean)
    .join(",");

  return combined
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function verifyHostAccessCode(accessKey: string): boolean {
  const normalized = accessKey.trim();
  if (!normalized) return false;

  return getAllowedHostCodes().includes(normalized);
}

export function hasHostAccess(req: Pick<Request, "signedCookies">): boolean {
  return req.signedCookies?.[HOST_ACCESS_COOKIE] === "allowed";
}

export function hasHostAccessFromCookieHeader(cookieHeader?: string): boolean {
  if (!cookieHeader) return false;

  const rawCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${HOST_ACCESS_COOKIE}=`));

  if (!rawCookie) return false;

  const cookieValue = decodeURIComponent(rawCookie.slice(HOST_ACCESS_COOKIE.length + 1));
  return cookieParser.signedCookie(cookieValue, getCookieSecret()) === "allowed";
}

export function setHostAccessCookie(res: Response): void {
  const isSecure = process.env.NODE_ENV === "production";

  res.cookie(HOST_ACCESS_COOKIE, "allowed", {
    httpOnly: true,
    signed: true,
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
    path: "/",
    maxAge: 1000 * 60 * 60 * 12,
  });
}

export function clearHostAccessCookie(res: Response): void {
  const isSecure = process.env.NODE_ENV === "production";

  res.clearCookie(HOST_ACCESS_COOKIE, {
    httpOnly: true,
    signed: true,
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
    path: "/",
  });
}

export function requireHostAccess(req: Request, res: Response, next: NextFunction): void {
  if (hasHostAccess(req)) {
    next();
    return;
  }

  res.status(401).json({ error: "Host access required" });
}
