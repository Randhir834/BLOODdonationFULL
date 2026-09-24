import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("closes on Escape, on the close button and on a press outside the dialog", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit user" onClose={onClose}>
        <button type="button">Inside</button>
      </Modal>
    );

    fireEvent.mouseDown(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("lets Escape close only the dialog on top", () => {
    const closeUnder = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <Modal title="Under" onClose={closeUnder}>
          a
        </Modal>
        <Modal title="Top" onClose={closeTop}>
          b
        </Modal>
      </>
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeUnder).not.toHaveBeenCalled();
  });

  it("is named by its title and takes focus", () => {
    render(
      <Modal title="Add an admin" onClose={() => {}}>
        x
      </Modal>
    );
    expect(screen.getByRole("dialog", { name: "Add an admin" })).toHaveFocus();
  });
});
