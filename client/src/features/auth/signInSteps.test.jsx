import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("./authService", () => ({
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  authErrorMessage: (error) => error.message,
}));

const { notify } = await import("../../lib/notify");
const { sendOtp, verifyOtp } = await import("./authService");
const { default: PhoneStep } = await import("./PhoneStep");
const { default: CodeStep } = await import("./CodeStep");

const typeNumber = (value) => fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value } });

beforeEach(() => vi.clearAllMocks());

describe("PhoneStep", () => {
  it("asks for a complete number before doing anything", () => {
    const onSubmit = vi.fn();
    render(<PhoneStep onSubmit={onSubmit} sendsCode />);
    typeNumber("98765");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a 10-digit mobile number.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps only digits and passes the number in international format", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PhoneStep onSubmit={onSubmit} sendsCode />);
    typeNumber("98765 43210");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("+919876543210"));
  });

  it("shows why sending failed and lets the person try again", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Too many attempts."));
    render(<PhoneStep onSubmit={onSubmit} sendsCode />);
    typeNumber("9876543210");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts.");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("explains the SMS only when a code is sent", () => {
    const { rerender } = render(<PhoneStep onSubmit={vi.fn()} sendsCode />);
    expect(screen.getByText(/text you a verification code/)).toBeInTheDocument();
    rerender(<PhoneStep onSubmit={vi.fn()} sendsCode={false} />);
    expect(screen.getByText(/10-digit mobile number to continue/)).toBeInTheDocument();
  });
});

describe("CodeStep", () => {
  const code = () => screen.getByLabelText("6-digit verification code");

  it("checks the code as soon as the sixth digit is typed", async () => {
    verifyOtp.mockResolvedValue(undefined);
    render(<CodeStep phone="+919876543210" onChangeNumber={vi.fn()} />);
    fireEvent.change(code(), { target: { value: "12345" } });
    expect(verifyOtp).not.toHaveBeenCalled();

    fireEvent.change(code(), { target: { value: "123456" } });
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith("123456"));
  });

  it("shows a wrong code, clears the boxes and lets the person retype", async () => {
    verifyOtp.mockRejectedValue(new Error("That code is incorrect."));
    render(<CodeStep phone="+919876543210" onChangeNumber={vi.fn()} />);
    fireEvent.change(code(), { target: { value: "000000" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("That code is incorrect.");
    await waitFor(() => expect(code()).toHaveValue(""));
    expect(code()).toBeEnabled();
  });

  it("names the number the code went to and can go back to change it", () => {
    const onChangeNumber = vi.fn();
    render(<CodeStep phone="+919876543210" onChangeNumber={onChangeNumber} />);
    expect(screen.getByText("+91 98765 43210")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(onChangeNumber).toHaveBeenCalled();
  });

  it("only offers a new code after the wait, then sends one", async () => {
    vi.useFakeTimers();
    sendOtp.mockResolvedValue(undefined);
    render(<CodeStep phone="+919876543210" onChangeNumber={vi.fn()} />);
    expect(screen.getByText("Resend code in 0:30")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend code" })).not.toBeInTheDocument();

    for (let second = 0; second < 30; second++) await act(async () => vi.advanceTimersByTimeAsync(1000));
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await waitFor(() => expect(sendOtp).toHaveBeenCalledWith("+919876543210"));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Code sent"));
    expect(screen.getByText("Resend code in 0:30")).toBeInTheDocument();
  });
});
