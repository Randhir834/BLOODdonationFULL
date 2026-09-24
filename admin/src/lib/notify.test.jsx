import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toaster from "../components/Toaster";
import { getToasts, notify } from "./notify";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => vi.runAllTimers());
  vi.useRealTimers();
});

describe("notify", () => {
  it("shows one short line with its status, and removes it by itself", () => {
    render(<Toaster />);
    act(() => notify.success("Profile updated"));
    expect(screen.getByText("Profile updated")).toBeInTheDocument();
    expect(screen.getByText("Profile updated").closest(".toast")).toHaveClass("toast-success");

    act(() => vi.advanceTimersByTime(3500 + 200));
    expect(screen.queryByText("Profile updated")).not.toBeInTheDocument();
  });

  it("keeps errors on screen a little longer than confirmations", () => {
    render(<Toaster />);
    act(() => {
      notify.success("Saved");
      notify.error("Could not save");
    });
    act(() => vi.advanceTimersByTime(3500 + 200));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByText("Could not save")).toBeInTheDocument();
  });

  it("shows the same message once, not once per call", () => {
    render(<Toaster />);
    act(() => {
      notify.success("Request sent");
      notify.success("Request sent");
      notify.success("Request sent");
    });
    expect(screen.getAllByText("Request sent")).toHaveLength(1);
  });

  it("never stacks more than two messages", () => {
    render(<Toaster />);
    act(() => {
      notify.info("One");
      notify.warning("Two");
      notify.success("Three");
    });
    expect(getToasts().map((toast) => toast.message)).toEqual(["Two", "Three"]);
  });

  it("ignores an empty message", () => {
    render(<Toaster />);
    act(() => notify.error(""));
    expect(getToasts()).toHaveLength(0);
  });
});
