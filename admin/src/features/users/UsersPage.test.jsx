import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  default: { get: vi.fn() },
  errorMessage: (error) => error?.response?.data?.message || "Something went wrong",
}));

const { default: api } = await import("../../lib/api");
const { default: ToastProvider } = await import("../../components/ToastProvider");
const { default: UsersPage } = await import("./UsersPage");

const users = [
  {
    _id: "o1",
    role: "organisation",
    organisationName: "City Blood Bank",
    phone: "+911000000001",
    address: "1 Main St",
    status: "active",
    verification: "pending",
    createdAt: "2026-09-21T10:00:00Z",
  },
  {
    _id: "d1",
    role: "donar",
    name: "Asha",
    phone: "+919876500000",
    address: "Delhi",
    status: "active",
    verification: "approved",
    createdAt: "2026-09-20T10:00:00Z",
  },
];

const show = (path = "/users") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <UsersPage />
      </ToastProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { users, total: 2, page: 1, pageSize: 25, truncated: false } });
});

describe("UsersPage approval", () => {
  it("shows whether each hospital or blood bank has been approved", async () => {
    show();
    const bloodBank = (await screen.findByText("City Blood Bank")).closest("tr");
    expect(within(bloodBank).getByText("Pending")).toBeInTheDocument();
    // a donor never needs approval
    const donor = screen.getByText("Asha").closest("tr");
    expect(within(donor).getByText("Not needed")).toBeInTheDocument();
  });

  it("opens already filtered to accounts waiting for approval, as the dashboard link does", async () => {
    show("/users?verification=pending");
    await screen.findByText("City Blood Bank");
    expect(screen.getByLabelText("Approval")).toHaveValue("pending");
    expect(api.get).toHaveBeenCalledWith("/users", {
      params: expect.objectContaining({ verification: "pending" }),
    });
  });

  it("filters by approval", async () => {
    show();
    await screen.findByText("City Blood Bank");
    fireEvent.change(screen.getByLabelText("Approval"), { target: { value: "rejected" } });
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith("/users", {
        params: expect.objectContaining({ verification: "rejected" }),
      })
    );
  });
});
