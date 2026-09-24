import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  getUserByPhoneNumber: vi.fn(),
  createUser: vi.fn(),
  createCustomToken: vi.fn(),
};
vi.mock("../src/config/firebase.js", () => ({ getAdminAuth: () => auth }));

const { customTokenForPhone } = await import("../src/services/authService.js");
const { HttpError } = await import("../src/utils/HttpError.js");

const notFound = Object.assign(new Error("no user"), { code: "auth/user-not-found" });
const alreadyExists = Object.assign(new Error("already exists"), {
  code: "auth/phone-number-already-exists",
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.createCustomToken.mockResolvedValue("a-token");
});

describe("signing in by phone (development only)", () => {
  it("hands back a token for a number that already has an account, without creating one", async () => {
    auth.getUserByPhoneNumber.mockResolvedValue({ uid: "u1", disabled: false });
    const token = await customTokenForPhone("+919876543210");
    expect(token).toBe("a-token");
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(auth.createCustomToken).toHaveBeenCalledWith("u1");
  });

  it("creates the account the first time a new number signs in", async () => {
    auth.getUserByPhoneNumber.mockRejectedValue(notFound);
    auth.createUser.mockResolvedValue({ uid: "u2", disabled: false });
    const token = await customTokenForPhone("+919876543211");
    expect(token).toBe("a-token");
    expect(auth.createUser).toHaveBeenCalledWith({ phoneNumber: "+919876543211" });
    expect(auth.createCustomToken).toHaveBeenCalledWith("u2");
  });

  it("recovers when a second, near-simultaneous sign-in for the same new number already created it", async () => {
    // Both requests see "not found" and both try to create the account; only one create call can win.
    auth.getUserByPhoneNumber.mockRejectedValueOnce(notFound).mockResolvedValueOnce({
      uid: "u3",
      disabled: false,
    });
    auth.createUser.mockRejectedValue(alreadyExists);
    const token = await customTokenForPhone("+919876543212");
    expect(token).toBe("a-token");
    expect(auth.getUserByPhoneNumber).toHaveBeenCalledTimes(2);
    expect(auth.createCustomToken).toHaveBeenCalledWith("u3");
  });

  it("still fails for any other reason the account could not be created", async () => {
    auth.getUserByPhoneNumber.mockRejectedValue(notFound);
    auth.createUser.mockRejectedValue(new Error("network down"));
    await expect(customTokenForPhone("+919876543213")).rejects.toThrow("network down");
  });

  it("still fails for any other reason the lookup itself could not complete", async () => {
    auth.getUserByPhoneNumber.mockRejectedValue(new Error("service unavailable"));
    await expect(customTokenForPhone("+919876543214")).rejects.toThrow("service unavailable");
    expect(auth.createUser).not.toHaveBeenCalled();
  });

  it("refuses a suspended account", async () => {
    auth.getUserByPhoneNumber.mockResolvedValue({ uid: "u4", disabled: true });
    const error = await customTokenForPhone("+919876543215").catch((e) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(403);
    expect(auth.createCustomToken).not.toHaveBeenCalled();
  });
});
