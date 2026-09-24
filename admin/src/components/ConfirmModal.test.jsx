import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmModal from "./ConfirmModal";

const setup = (props = {}) => {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <ConfirmModal
      title="Delete?"
      message="This can not be undone."
      confirmLabel="Delete it"
      danger
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />
  );
  return { onConfirm, onClose };
};

describe("ConfirmModal", () => {
  it("confirms straight away when nothing has to be typed", async () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete it" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("keeps the button disabled until the word is typed, in any case", () => {
    setup({ confirmText: "delete" });
    const button = screen.getByRole("button", { name: "Delete it" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "del" } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " DELETE " } });
    expect(button).toBeEnabled();
  });

  it("can be cancelled", () => {
    const { onClose, onConfirm } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
