import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("renders nothing when everything fits on one page", () => {
    const { container } = render(<Pagination page={1} pageSize={25} total={25} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows where you are and moves one page at a time", () => {
    const onPage = vi.fn();
    render(<Pagination page={2} pageSize={25} total={60} onPage={onPage} />);
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPage).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPage).toHaveBeenLastCalledWith(3);
  });

  it("disables the buttons at both ends", () => {
    const { rerender } = render(<Pagination page={1} pageSize={10} total={30} onPage={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    rerender(<Pagination page={3} pageSize={10} total={30} onPage={() => {}} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
