import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./authService", () => ({
  refreshProfile: vi.fn(),
  logout: vi.fn(),
  authErrorMessage: (error) => error.message,
}));

const { refreshProfile, logout } = await import("./authService");
const { default: authReducer } = await import("./authSlice");
const { default: ApprovalPending } = await import("./ApprovalPending");

const pending = {
  _id: "org1",
  role: "organisation",
  organisationName: "City Blood Bank",
  phone: "+919876543210",
  registrationNumber: "KA/BB/2041",
  verification: "pending",
};

const renderScreen = (user) =>
  render(
    <Provider store={configureStore({ reducer: { auth: authReducer } })}>
      <ApprovalPending user={user} />
    </Provider>
  );

beforeEach(() => vi.clearAllMocks());

describe("ApprovalPending", () => {
  it("tells a new blood bank it is waiting and shows what it registered with", () => {
    renderScreen(pending);
    expect(screen.getByRole("heading", { level: 1, name: "Waiting for approval" })).toBeInTheDocument();
    expect(screen.getByText("Blood bank")).toBeInTheDocument();
    expect(screen.getByText("City Blood Bank")).toBeInTheDocument();
    expect(screen.getByText("KA/BB/2041")).toBeInTheDocument();
    expect(screen.getByText("+91 98765 43210")).toBeInTheDocument();
    expect(screen.queryByText(/Reason:/)).not.toBeInTheDocument();
  });

  it("says when a registration was not approved and gives the reason", () => {
    renderScreen({ ...pending, verification: "rejected", verificationReason: "Licence not found" });
    expect(screen.getByRole("heading", { level: 1, name: "Registration not approved" })).toBeInTheDocument();
    expect(screen.getByText("Reason: Licence not found")).toBeInTheDocument();
  });

  it("does not invent a reason when none was given", () => {
    renderScreen({ ...pending, verification: "rejected" });
    expect(screen.queryByText(/Reason:/)).not.toBeInTheDocument();
  });

  it("checks again and says when nothing has changed", async () => {
    refreshProfile.mockResolvedValue(pending);
    renderScreen(pending);
    expect(screen.queryByText("Nothing has changed yet.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(screen.getByRole("button", { name: "Checking" })).toBeDisabled();

    expect(await screen.findByText("Nothing has changed yet.")).toBeInTheDocument();
    expect(refreshProfile).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
  });

  it("shows why a check failed and offers a retry", async () => {
    refreshProfile.mockRejectedValueOnce(new Error("Could not reach the server."));
    renderScreen(pending);
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server.");
    expect(screen.queryByText("Nothing has changed yet.")).not.toBeInTheDocument();

    refreshProfile.mockResolvedValueOnce(pending);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("lets the person log out", () => {
    renderScreen(pending);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(logout).toHaveBeenCalled();
  });
});
