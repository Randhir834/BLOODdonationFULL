import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  default: { get: vi.fn(), delete: vi.fn() },
  errorMessage: (error) => error?.response?.data?.message || "Something went wrong",
}));

const { default: api } = await import("../../lib/api");
const { default: ToastProvider } = await import("../../components/ToastProvider");
const { default: InventoryPage } = await import("./InventoryPage");

const page = { total: 1, page: 1, pageSize: 25, truncated: false };
const unit = (overrides = {}) => ({
  _id: "r1",
  inventoryType: "in",
  bloodGroup: "A+",
  quantity: 450,
  phone: "+919876543210",
  createdAt: "2026-09-20T10:00:00Z",
  organisation: { _id: "o1", organisationName: "City Blood Bank" },
  donar: { _id: "d1", name: "Asha" },
  status: "available",
  expiresAt: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

const show = (path = "/inventory") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <InventoryPage />
      </ToastProvider>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

describe("InventoryPage unit status", () => {
  it("shows a unit's status and expiry date, and '-' for an issue", async () => {
    api.get.mockResolvedValue({
      data: { records: [unit(), unit({ _id: "r2", inventoryType: "out", status: undefined })], ...page },
    });
    show();
    await screen.findAllByText("City Blood Bank");

    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(within(rows[0]).getByText("Available")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Nov 1, 2026")).toBeInTheDocument();
    expect(within(rows[1]).getAllByText("-")).toHaveLength(2); // unit column and expiry column
  });

  it("shows a unit as expired once its date has passed, even though it is still 'available'", async () => {
    api.get.mockResolvedValue({
      data: { records: [unit({ expiresAt: "2020-01-01T00:00:00.000Z" })], ...page },
    });
    show();
    expect(await screen.findByText("Expired")).toBeInTheDocument();
  });

  it("shows nothing for a pre-unit legacy record", async () => {
    // a real migrated record: tagged "legacy", but never given an expiry date
    api.get.mockResolvedValue({
      data: { records: [unit({ status: "legacy", expiresAt: undefined })], ...page },
    });
    show();
    const row = (await screen.findByText("City Blood Bank")).closest("tr");
    expect(within(row).queryByText(/Available|Issued|Discarded|Expired/)).not.toBeInTheDocument();
    expect(within(row).getAllByText("-")).toHaveLength(2);
  });

  it("filters by unit status and sends it to the API", async () => {
    api.get.mockResolvedValue({ data: { records: [], ...page, total: 0 } });
    show();
    fireEvent.change(await screen.findByLabelText("Unit status"), { target: { value: "discarded" } });
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith(
        "/inventory",
        expect.objectContaining({ params: expect.objectContaining({ status: "discarded" }) })
      )
    );
  });

  it("sorts by soonest to expire and sends it to the API, defaulting to newest", async () => {
    api.get.mockResolvedValue({ data: { records: [], ...page, total: 0 } });
    show();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        "/inventory",
        expect.objectContaining({ params: expect.objectContaining({ sort: "newest" }) })
      )
    );
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "expiry" } });
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith(
        "/inventory",
        expect.objectContaining({ params: expect.objectContaining({ sort: "expiry" }) })
      )
    );
  });
});
