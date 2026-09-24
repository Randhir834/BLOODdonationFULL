import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

describe("parseEnv", () => {
  it("applies development defaults", () => {
    const env = parseEnv({});
    expect(env).toMatchObject({
      NODE_ENV: "development",
      PORT: 8080,
      ADMIN_TIMEZONE: "UTC",
      LOW_STOCK_ML: 1000,
      INACTIVE_DAYS: 30,
      ALLOW_PHONE_LOGIN: false,
      isProduction: false,
    });
    expect(env.CLIENT_ORIGINS).toEqual(["http://localhost:3100"]);
  });

  it("splits comma separated origins and coerces numbers", () => {
    const env = parseEnv({ CLIENT_ORIGIN: "https://a.test, https://b.test", PORT: "9000", TRUST_PROXY: "1" });
    expect(env.CLIENT_ORIGINS).toEqual(["https://a.test", "https://b.test"]);
    expect(env.PORT).toBe(9000);
    expect(env.TRUST_PROXY).toBe(1);
  });

  it("treats empty values as unset", () => {
    expect(parseEnv({ PORT: "", TRUST_PROXY: "" }).PORT).toBe(8080);
  });

  it("reports every invalid value", () => {
    expect(() => parseEnv({ PORT: "abc", ADMIN_TIMEZONE: "Mars/Base" })).toThrow(/PORT[\s\S]*ADMIN_TIMEZONE/);
  });

  it("refuses the OTP-less phone login in production", () => {
    const production = {
      NODE_ENV: "production",
      CLIENT_ORIGIN: "https://a.test",
      ADMIN_ORIGIN: "https://b.test",
    };
    expect(() => parseEnv({ ...production, ALLOW_PHONE_LOGIN: "true" })).toThrow(/ALLOW_PHONE_LOGIN/);
    expect(parseEnv({ ...production, ALLOW_PHONE_LOGIN: "false" }).isProduction).toBe(true);
  });

  it("requires explicit origins in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/CLIENT_ORIGIN, ADMIN_ORIGIN/);
  });
});
