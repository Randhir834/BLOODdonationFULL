import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./authService", () => ({
  registerProfile: vi.fn(),
  logout: vi.fn(),
  authErrorMessage: (error) => error.message,
}));

const { registerProfile } = await import("./authService");
const { default: authReducer } = await import("./authSlice");
const { default: ProfileStep } = await import("./ProfileStep");

const renderStep = () => {
  const store = configureStore({ reducer: { auth: authReducer } });
  render(
    <Provider store={store}>
      <ProfileStep />
    </Provider>
  );
  return store;
};

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const choose = (name) => fireEvent.click(screen.getByRole("radio", { name }));
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

beforeEach(() => vi.clearAllMocks());

describe("ProfileStep", () => {
  it("does not ask a donor for a registration number", async () => {
    registerProfile.mockResolvedValue({ _id: "u1", role: "donar" });
    const store = renderStep();
    expect(screen.queryByLabelText(/Registration/)).not.toBeInTheDocument();

    type("Full name", "Asha");
    type("Address", "1 Main St");
    type("City", "Bengaluru");
    submit();

    await waitFor(() =>
      expect(registerProfile).toHaveBeenCalledWith({
        role: "donar",
        name: "Asha",
        address: "1 Main St",
        city: "Bengaluru",
        website: "",
        registrationNumber: "",
      })
    );
    await waitFor(() => expect(store.getState().auth.user).toEqual({ _id: "u1", role: "donar" }));
  });

  it("asks a blood bank for a registration number and explains why", () => {
    renderStep();
    choose(/Blood bank/);
    expect(screen.getByLabelText("Registration or licence number")).toBeInTheDocument();
    expect(screen.getByText(/It's verified before you can start/)).toBeInTheDocument();
  });

  it.each([
    ["a blood bank", /Blood bank/, "Blood bank name"],
    ["a hospital", /Hospital/, "Hospital name"],
  ])("will not send the profile of %s without the number", (_who, role, nameLabel) => {
    renderStep();
    choose(role);
    type(nameLabel, "City");
    type("Address", "1 Main St");
    type("City", "Bengaluru");
    submit();

    expect(screen.getByText("Enter your registration or licence number.")).toBeInTheDocument();
    expect(screen.getByLabelText("Registration or licence number")).toHaveAttribute("aria-invalid", "true");
    expect(registerProfile).not.toHaveBeenCalled();
  });

  it("sends the number and website of a blood bank", async () => {
    registerProfile.mockResolvedValue({ _id: "u1", role: "organisation", verification: "pending" });
    renderStep();
    choose(/Blood bank/);
    type("Blood bank name", "City Blood Bank");
    type("Address", "1 Main St");
    type("City", "Bengaluru");
    type("Registration or licence number", "KA/BB/2041");
    type(/Website/, "https://city.example");
    submit();

    await waitFor(() =>
      expect(registerProfile).toHaveBeenCalledWith({
        role: "organisation",
        name: "City Blood Bank",
        address: "1 Main St",
        city: "Bengaluru",
        website: "https://city.example",
        registrationNumber: "KA/BB/2041",
      })
    );
  });

  it("drops the number if the person switches back to being a donor", async () => {
    registerProfile.mockResolvedValue({ _id: "u1", role: "donar" });
    renderStep();
    choose(/Hospital/);
    type("Registration or licence number", "H-77");
    choose(/Donor/);
    type("Full name", "Asha");
    type("Address", "1 Main St");
    type("City", "Bengaluru");
    submit();

    await waitFor(() =>
      expect(registerProfile).toHaveBeenCalledWith(
        expect.objectContaining({ role: "donar", registrationNumber: "", website: "" })
      )
    );
  });

  it("shows why the server refused the profile and lets the person try again", async () => {
    registerProfile.mockRejectedValue(new Error("Address is too long"));
    renderStep();
    type("Full name", "Asha");
    type("Address", "1 Main St");
    type("City", "Bengaluru");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Address is too long");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});
