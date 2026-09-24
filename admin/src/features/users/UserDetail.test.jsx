import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  errorMessage: (error) => error?.response?.data?.message || "Something went wrong",
}));

const { default: api } = await import("../../lib/api");
const { default: ToastProvider } = await import("../../components/ToastProvider");
const { default: UserDetail } = await import("./UserDetail");

const bloodBank = {
  _id: "o1",
  role: "organisation",
  organisationName: "City Blood Bank",
  phone: "+919876543210",
  address: "1 Main St",
  status: "active",
  verification: "pending",
  registrationNumber: "KA/BB/2041",
  createdAt: "2026-09-21T10:00:00Z",
};
const donor = {
  _id: "d1",
  role: "donar",
  name: "Asha",
  phone: "+919876500000",
  address: "Delhi",
  status: "active",
  verification: "approved",
  createdAt: "2026-09-21T10:00:00Z",
};

const open = async (user, props = {}) => {
  api.get.mockResolvedValue({ data: { user, stock: null, records: [] } });
  const onChanged = vi.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <UserDetail id={user._id} onClose={vi.fn()} onChanged={onChanged} {...props} />
      </ToastProvider>
    </MemoryRouter>
  );
  await screen.findByText(user.phone);
  return { onChanged };
};

const button = (name) => screen.queryByRole("button", { name });

beforeEach(() => vi.clearAllMocks());

describe("UserDetail approval", () => {
  it("shows a waiting blood bank's registration number and lets an admin decide", async () => {
    await open(bloodBank);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("KA/BB/2041")).toBeInTheDocument();
    expect(button("Approve")).toBeInTheDocument();
    expect(button("Reject")).toBeInTheDocument();
  });

  it("approves after confirming, then reloads the list", async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const { onChanged } = await open(bloodBank);

    fireEvent.click(button("Approve"));
    const dialog = screen.getByRole("dialog", { name: "Approve City Blood Bank?" });
    expect(within(dialog).getByText(/KA\/BB\/2041/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/users/o1/approve"));
    expect(await screen.findByText("Registration approved")).toBeInTheDocument();
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("shows why an approval failed and keeps the dialog open", async () => {
    api.post.mockRejectedValue({ response: { data: { message: "User not found" } } });
    await open(bloodBank);
    fireEvent.click(button("Approve"));
    const dialog = screen.getByRole("dialog", { name: "Approve City Blood Bank?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("User not found")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Approve City Blood Bank?" })).toBeInTheDocument();
  });

  it("will not reject without a reason, then sends it", async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    const { onChanged } = await open(bloodBank);

    fireEvent.click(button("Reject"));
    const dialog = screen.getByRole("dialog", { name: "Reject City Blood Bank" });
    const confirm = within(dialog).getByRole("button", { name: "Reject" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "  " } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Licence not found" } });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/users/o1/reject", { reason: "Licence not found" })
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("offers only Reject for an approved blood bank", async () => {
    await open({ ...bloodBank, verification: "approved", verifiedBy: "boss@example.com" });
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText(/by boss@example.com/)).toBeInTheDocument();
    expect(button("Approve")).not.toBeInTheDocument();
    expect(button("Reject")).toBeInTheDocument();
  });

  it("shows the reason for a rejection and offers only Approve", async () => {
    await open({ ...bloodBank, verification: "rejected", verificationReason: "Licence not found" });
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/Licence not found/)).toBeInTheDocument();
    expect(button("Approve")).toBeInTheDocument();
    expect(button("Reject")).not.toBeInTheDocument();
  });

  it("has no approval controls for a donor", async () => {
    await open(donor);
    expect(screen.queryByText("Approval")).not.toBeInTheDocument();
    expect(button("Approve")).not.toBeInTheDocument();
    expect(button("Reject")).not.toBeInTheDocument();
  });
});
