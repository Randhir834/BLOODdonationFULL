import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useQueryParams } from "./useQueryParams";

const setup = (url) =>
  renderHook(() => ({ query: useQueryParams(), location: useLocation() }), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });

describe("useQueryParams", () => {
  it("reads values, with an empty string for missing ones", () => {
    const { result } = setup("/users?role=hospital");
    expect(result.current.query.get("role")).toBe("hospital");
    expect(result.current.query.get("status")).toBe("");
  });

  it("sets and removes keys, and goes back to page 1 when a filter changes", () => {
    const { result } = setup("/users?page=3&role=donar");
    act(() => result.current.query.update({ status: "suspended", role: "" }));
    expect(result.current.location.search).toBe("?status=suspended");
  });

  it("keeps the page when told to, or when the patch sets it", () => {
    const { result } = setup("/users?page=3");
    act(() => result.current.query.update({ open: "u1" }, true));
    expect(result.current.location.search).toBe("?page=3&open=u1");
    act(() => result.current.query.update({ page: "4" }));
    expect(result.current.location.search).toBe("?page=4&open=u1");
  });

  it("clears every filter", () => {
    const { result } = setup("/inventory?type=in&bloodGroup=A%2B");
    act(() => result.current.query.reset());
    expect(result.current.location.search).toBe("");
  });
});
