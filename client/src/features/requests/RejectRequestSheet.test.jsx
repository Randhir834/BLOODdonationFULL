import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("./requestsApi", () => ({ rejectRequest: vi.fn() }));

const { notify } = await import("../../lib/notify");
const { rejectRequest } = await import("./requestsApi");
const { default: RejectRequestSheet } = await import("./RejectRequestSheet");

const request = { _id: "r1", bloodGroup: "A+", quantity: 450 };

beforeEach(() => vi.clearAllMocks());

describe("RejectRequestSheet", () => {
  it("will not submit without a reason", () => {
    render(<RejectRequestSheet request={request} onClose={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject request" }));
    expect(screen.getByText("Enter a reason.")).toBeInTheDocument();
    expect(rejectRequest).not.toHaveBeenCalled();
  });

  it("rejects with the reason, trimmed, and reports success", async () => {
    rejectRequest.mockResolvedValue({});
    const onDone = vi.fn();
    render(<RejectRequestSheet request={request} onClose={vi.fn()} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  No stock right now  " } });
    fireEvent.click(screen.getByRole("button", { name: "Reject request" }));

    await waitFor(() => expect(rejectRequest).toHaveBeenCalledWith("r1", "No stock right now"));
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Request rejected"));
    expect(onDone).toHaveBeenCalled();
  });

  it("shows why rejecting failed and lets the person try again", async () => {
    rejectRequest.mockRejectedValue({ response: { data: { message: "This request is already fulfilled" } } });
    render(<RejectRequestSheet request={request} onClose={vi.fn()} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "No stock" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already fulfilled");
    expect(screen.getByRole("button", { name: "Reject request" })).toBeEnabled();
  });
});
