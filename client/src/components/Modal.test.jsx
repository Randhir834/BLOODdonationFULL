import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("closes on Escape and on a press outside the panel, not inside it", () => {
    const onClose = vi.fn();
    render(
      <Modal labelledBy="t" onClose={onClose}>
        <h2 id="t">Title</h2>
        <button type="button">Inside</button>
      </Modal>
    );

    fireEvent.mouseDown(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("is labelled by its title and takes focus", () => {
    render(
      <Modal labelledBy="t" onClose={() => {}}>
        <h2 id="t">Log out?</h2>
      </Modal>
    );
    const dialog = screen.getByRole("dialog", { name: "Log out?" });
    expect(dialog).toHaveFocus();
  });

  it("keeps Tab inside the panel", () => {
    render(
      <Modal onClose={() => {}}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>
    );
    screen.getByText("Last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByText("First")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByText("Last")).toHaveFocus();
  });

  it("locks page scroll while open and restores focus and scroll on close", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(<Modal onClose={() => {}}>content</Modal>);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("can render its panel as a form", () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <Modal as="form" onClose={() => {}} onSubmit={onSubmit}>
        <button type="submit">Save</button>
      </Modal>
    );
    fireEvent.click(screen.getByText("Save"));
    expect(onSubmit).toHaveBeenCalled();
  });
});
