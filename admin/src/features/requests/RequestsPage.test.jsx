import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  default: { get: vi.fn() },
  errorMessage: (error) => error?.response?.data?.message || "Something went wrong",
}));

const { default: api } = await import("../../lib/api");
const { default: RequestsPage } = await import("./RequestsPage");

const page = { total: 1, page: 1, pageSize: 25, truncated: false };
const bloodRequest = (overrides = {}) => ({
  _id: "r1",
  requester: { _id: "h1", hospitalName: "General Hospital" },
  requesterRole: "hospital",
  requesterPhone: "+919876543210",
  organisation: { _id: "o1", organisationName: "City Blood Bank" },
  patientName: "Jane Doe",
  bloodGroup: "A+",
  component: "whole_blood",
  quantity: 450,
  priority: "normal",
  location: "City Hospital, Ward 4",
  status: "pending",
  createdAt: "2026-09-20T10:00:00Z",
  ...overrides,
});

const show = (path = "/requests") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RequestsPage />
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

describe("RequestsPage", () => {
  it("shows every request with its requester, patient and target blood bank", async () => {
    api.get.mockResolvedValue({ data: { requests: [bloodRequest()], ...page } });
    show();

    const row = (await screen.findByText("General Hospital")).closest("tr");
    expect(within(row).getByText("Jane Doe")).toBeInTheDocument();
    expect(within(row).getByText("City Blood Bank")).toBeInTheDocument();
    expect(within(row).getByText("City Hospital, Ward 4")).toBeInTheDocument();
    expect(within(row).getByText("Hospital")).toBeInTheDocument(); // the requester's role badge
    expect(within(row).getByText("Waiting")).toBeInTheDocument();
  });

  it("shows a still-pending request past its needed-by date as expired", async () => {
    api.get.mockResolvedValue({
      data: { requests: [bloodRequest({ requiredAt: "2020-01-01T00:00:00.000Z" })], ...page },
    });
    show();
    expect(await screen.findByText("Expired")).toBeInTheDocument();
  });

  it("filters by requester type and sends it to the API", async () => {
    api.get.mockResolvedValue({ data: { requests: [], ...page, total: 0 } });
    show();
    fireEvent.change(await screen.findByLabelText("Requester type"), { target: { value: "donar" } });
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith(
        "/requests",
        expect.objectContaining({ params: expect.objectContaining({ role: "donar" }) })
      )
    );
  });

  it("filters by status and sends it to the API", async () => {
    api.get.mockResolvedValue({ data: { requests: [], ...page, total: 0 } });
    show();
    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "fulfilled" } });
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith(
        "/requests",
        expect.objectContaining({ params: expect.objectContaining({ status: "fulfilled" }) })
      )
    );
  });

  it("shows an empty state when nothing matches", async () => {
    api.get.mockResolvedValue({ data: { requests: [], ...page, total: 0 } });
    show();
    expect(await screen.findByText("No blood requests match these filters.")).toBeInTheDocument();
  });

  it("shows a retry when the list fails to load", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "Access denied" } } });
    show();
    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows a role badge naming a donor or blood bank requester too", async () => {
    api.get.mockResolvedValue({
      data: {
        requests: [
          bloodRequest({ _id: "r2", requesterRole: "donar", requester: { _id: "d1", name: "Asha" } }),
        ],
        ...page,
      },
    });
    show();
    const row = (await screen.findByText("Asha")).closest("tr");
    expect(within(row).getByText("Donor")).toBeInTheDocument();
  });
});
