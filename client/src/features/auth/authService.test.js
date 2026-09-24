import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./authService";

describe("authErrorMessage", () => {
  it("translates Firebase codes into plain language", () => {
    expect(authErrorMessage({ code: "auth/invalid-verification-code" })).toMatch(/incorrect/);
    expect(authErrorMessage({ code: "auth/too-many-requests" })).toMatch(/wait a few minutes/);
    expect(authErrorMessage({ code: "app/verification-timeout" })).toMatch(/did not finish/);
  });

  it("prefers the message the API sent", () => {
    const error = { response: { data: { message: "This account has been suspended." } } };
    expect(authErrorMessage(error)).toBe("This account has been suspended.");
  });

  it("never shows raw Firebase text", () => {
    const error = new Error("Firebase: Error (auth/some-new-code).");
    error.code = "auth/some-new-code";
    expect(authErrorMessage(error)).toBe("Something went wrong. Please try again.");
  });
});
