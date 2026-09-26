import { describe, expect, it, vi } from "vitest";
import {
  broadcastToOrganisation,
  organisationClientCount,
  subscribeOrganisation,
} from "../src/services/orgRealtimeBus.js";

const client = () => ({ write: vi.fn() });

describe("the hospital and blood bank live feed", () => {
  it("only tells an account about its own changes", () => {
    const mine = client();
    const theirs = client();
    subscribeOrganisation("bank1", mine);
    subscribeOrganisation("bank2", theirs);

    broadcastToOrganisation("bank1", "stock");

    expect(mine.write).toHaveBeenCalledTimes(1);
    expect(mine.write.mock.calls[0][0]).toMatch(/^data: \{"resource":"stock","at":".+"\}\n\n$/);
    expect(theirs.write).not.toHaveBeenCalled();
  });

  it("reaches every open tab of the account", () => {
    const a = client();
    const b = client();
    subscribeOrganisation("bank3", a);
    subscribeOrganisation("bank3", b);
    broadcastToOrganisation("bank3", "requests");
    expect(a.write).toHaveBeenCalledTimes(1);
    expect(b.write).toHaveBeenCalledTimes(1);
  });

  it("stops writing to a tab that closed, and forgets an account with none open", () => {
    const before = organisationClientCount();
    const tab = client();
    const stop = subscribeOrganisation("bank4", tab);
    expect(organisationClientCount()).toBe(before + 1);
    stop();
    expect(organisationClientCount()).toBe(before);
    broadcastToOrganisation("bank4", "stock");
    expect(tab.write).not.toHaveBeenCalled();
  });

  it("drops a tab whose connection fails instead of failing the broadcast", () => {
    const broken = {
      write: vi.fn(() => {
        throw new Error("socket closed");
      }),
    };
    const healthy = client();
    subscribeOrganisation("bank5", broken);
    subscribeOrganisation("bank5", healthy);
    expect(() => broadcastToOrganisation("bank5", "stock")).not.toThrow();
    expect(healthy.write).toHaveBeenCalledTimes(1);
    broadcastToOrganisation("bank5", "stock");
    expect(broken.write).toHaveBeenCalledTimes(1);
  });

  it("says nothing when nobody is listening", () => {
    expect(() => broadcastToOrganisation("nobody", "stock")).not.toThrow();
  });
});
