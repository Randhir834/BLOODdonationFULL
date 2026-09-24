import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OtpInput from "./OtpInput";

describe("OtpInput", () => {
  it("passes on digits only, never more than the code length", () => {
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} length={6} />);
    fireEvent.change(screen.getByLabelText("6-digit verification code"), {
      target: { value: "12ab34 5678" },
    });
    expect(onChange).toHaveBeenCalledWith("123456");
  });

  it("shows one box per digit and marks them invalid together", () => {
    const { container } = render(<OtpInput value="12" onChange={() => {}} length={6} invalid />);
    const cells = container.querySelectorAll(".otp-cell");
    expect(cells).toHaveLength(6);
    expect([...cells].map((cell) => cell.textContent)).toEqual(["1", "2", "", "", "", ""]);
    expect(container.querySelectorAll(".otp-cell.invalid")).toHaveLength(6);
  });

  it("can be disabled while a code is being checked", () => {
    render(<OtpInput value="123456" onChange={() => {}} disabled />);
    expect(screen.getByLabelText("6-digit verification code")).toBeDisabled();
  });
});
