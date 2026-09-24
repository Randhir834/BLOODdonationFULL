import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("./inventoryApi", () => ({ discardUnit: vi.fn() }));

const { notify } = await import("../../lib/notify");
const { discardUnit } = await import("./inventoryApi");
const { default: DiscardUnitSheet } = await import("./DiscardUnitSheet");

const record = { _id: "r1", bloodGroup: "A+", quantity: 450 };

beforeEach(() => vi.clearAllMocks());

describe("DiscardUnitSheet", () => {
  it("will not submit without a reason", () => {
    const onDone = vi.fn();
    render(<DiscardUnitSheet record={record} onClose={vi.fn()} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard unit" }));

    expect(screen.getByText("Choose a reason.")).toBeInTheDocument();
    expect(discardUnit).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("discards with the chosen reason and note, and reports success", async () => {
    discardUnit.mockResolvedValue({});
    const onDone = vi.fn();
    render(<DiscardUnitSheet record={record} onClose={vi.fn()} onDone={onDone} />);

    fireEvent.click(screen.getByRole("radio", { name: "Damaged" }));
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: "Bag was leaking" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard unit" }));

    await waitFor(() =>
      expect(discardUnit).toHaveBeenCalledWith("r1", { reason: "damaged", note: "Bag was leaking" })
    );
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith("Unit discarded", expect.stringContaining("A+, 450 ML"))
    );
    expect(onDone).toHaveBeenCalled();
  });

  it("shows the server's reason when it is refused, and lets the person try again", async () => {
    discardUnit.mockRejectedValue({
      response: {
        data: { message: "Part of this unit has already been issued, it can not be discarded whole" },
      },
    });
    render(<DiscardUnitSheet record={record} onClose={vi.fn()} onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Past its expiry date" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard unit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already been issued");
    expect(screen.getByRole("button", { name: "Discard unit" })).toBeEnabled();
  });

  it("closes without discarding", () => {
    const onClose = vi.fn();
    render(<DiscardUnitSheet record={record} onClose={onClose} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    expect(discardUnit).not.toHaveBeenCalled();
  });
});
