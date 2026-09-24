import { describe, expect, it } from "vitest";
import reducer, { setSession } from "./authSlice";

describe("authSlice", () => {
  it("starts loading, until Firebase says who is signed in", () => {
    expect(reducer(undefined, { type: "@@init" })).toEqual({ loading: true, signedIn: false, user: null });
  });

  it("stores a signed-in user", () => {
    const user = { _id: "u1", role: "donar" };
    expect(reducer(undefined, setSession({ signedIn: true, user }))).toEqual({
      loading: false,
      signedIn: true,
      user,
    });
  });

  it("keeps a verified phone without a profile apart from a signed-out visitor", () => {
    const verified = reducer(undefined, setSession({ signedIn: true, user: null }));
    const visitor = reducer(undefined, setSession({ signedIn: false, user: null }));
    expect(verified).toMatchObject({ signedIn: true, user: null });
    expect(visitor).toMatchObject({ signedIn: false, user: null });
  });
});
