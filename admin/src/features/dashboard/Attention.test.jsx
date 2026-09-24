import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Attention from "./Attention";

const show = (items) =>
  render(
    <MemoryRouter>
      <Attention items={items} />
    </MemoryRouter>
  );

describe("Attention", () => {
  it("links accounts waiting for approval to the filtered user list", () => {
    show([
      {
        severity: "warning",
        title: "3 accounts waiting for approval",
        detail: "Blood banks and hospitals can not use the app until an admin approves them.",
        link: { to: "/users?verification=pending", label: "Review" },
      },
    ]);
    expect(screen.getByText("3 accounts waiting for approval")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/users?verification=pending"
    );
  });

  it("shows no link when an item has none", () => {
    show([{ severity: "critical", title: "1 blood group out of stock", detail: "O-" }]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says so when nothing needs attention", () => {
    show([]);
    expect(screen.getByText("Nothing needs attention right now.")).toBeInTheDocument();
  });
});
