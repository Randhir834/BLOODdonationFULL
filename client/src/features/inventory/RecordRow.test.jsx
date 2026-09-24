import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecordRow from "./RecordRow";

const base = {
  _id: "r1",
  inventoryType: "in",
  bloodGroup: "A+",
  quantity: 450,
  createdAt: "2026-09-20T10:00:00Z",
};

describe("RecordRow", () => {
  it("shows the amount and who it was with, with no unit note for an ordinary record", () => {
    render(
      <ul>
        <RecordRow record={base} title="Asha" />
      </ul>
    );
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Asha").closest("li")).toHaveTextContent("450");
    expect(screen.queryByText(/Expires|Discarded/)).not.toBeInTheDocument();
  });

  it("shows when an available unit expires", () => {
    render(
      <ul>
        <RecordRow
          record={{ ...base, status: "available", expiresAt: "2026-11-03T00:00:00Z" }}
          title="Asha"
        />
      </ul>
    );
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
  });

  it("shows a discarded unit as discarded, not its expiry", () => {
    render(
      <ul>
        <RecordRow
          record={{ ...base, status: "discarded", expiresAt: "2026-11-03T00:00:00Z" }}
          title="Asha"
        />
      </ul>
    );
    expect(screen.getByText(/Discarded/)).toBeInTheDocument();
    expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
  });

  it("offers to discard only an available 'in' unit, and only when asked to", () => {
    const onDiscard = vi.fn();
    const { rerender } = render(
      <ul>
        <RecordRow record={{ ...base, status: "available" }} title="Asha" onDiscard={onDiscard} />
      </ul>
    );
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();

    rerender(
      <ul>
        <RecordRow record={{ ...base, status: "available" }} title="Asha" />
      </ul>
    );
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();

    rerender(
      <ul>
        <RecordRow record={{ ...base, status: "issued" }} title="Asha" onDiscard={onDiscard} />
      </ul>
    );
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();

    rerender(
      <ul>
        <RecordRow
          record={{ ...base, inventoryType: "out", status: undefined }}
          title="General Hospital"
          onDiscard={onDiscard}
        />
      </ul>
    );
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });
});
