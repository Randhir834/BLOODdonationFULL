import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { current: {} };
vi.mock("../features/auth/authContext", () => ({ useAuth: () => auth.current }));
vi.mock("../lib/api", () => ({
  default: { get: vi.fn(async () => ({ data: {} })), post: vi.fn() },
  errorMessage: (e) => e?.message,
  SIGNED_OUT_KEY: "x",
}));
vi.mock("../hooks/useApi", () => ({ useApi: () => ({ data: null, loading: true, error: null, reload: () => {} }) }));
vi.mock("../hooks/useRealtime", () => ({ useRealtime: () => {} }));
vi.mock("../features/dashboard/DashboardPage", () => ({ default: () => <h1>Dashboard page</h1> }));

const { default: App } = await import("./App");

const approved = {
  _id: "b1",
  role: "organisation",
  organisationName: "City Blood Bank",
  verification: "approved",
  status: "active",
  city: "Bengaluru",
  phone: "+911000000001",
};
const show = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

beforeEach(() => {
  auth.current = { loading: false, signedIn: true, user: approved, reload: () => {}, logout: () => {} };
});

describe("which screen an account sees", () => {
  it("shows a loading state until it is known who is signed in", () => {
    auth.current = { loading: true };
    show();
    expect(screen.getByRole("status")).toHaveTextContent(/Loading/);
  });

  it("shows sign in to someone signed out", () => {
    auth.current = { loading: false, signedIn: false, user: null };
    show();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("offers registration at /register", () => {
    auth.current = { loading: false, signedIn: false, user: null };
    show("/register");
    expect(screen.getByRole("heading", { name: "Register your organisation" })).toBeInTheDocument();
  });

  it("asks a verified number that has no organisation yet for its details, with nothing filled in", () => {
    auth.current = { loading: false, signedIn: true, user: null, register: vi.fn(), logout: () => {} };
    show();
    expect(screen.getByRole("heading", { name: "Tell us about your organisation" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Registration/)).not.toBeInTheDocument();
  });

  it("tells an organisation waiting for approval so, with no way into the rest", () => {
    auth.current = { ...auth.current, user: { ...approved, verification: "pending", registrationNumber: "BB-1" } };
    show();
    expect(screen.getByRole("heading", { name: "Waiting for approval" })).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows a refused organisation the reason and a way to ask again", () => {
    auth.current = {
      ...auth.current,
      user: { ...approved, verification: "rejected", verificationReason: "Licence unreadable" },
    };
    show();
    expect(screen.getByRole("heading", { name: "Your registration was not approved" })).toBeInTheDocument();
    expect(screen.getByText("Licence unreadable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send for review again" })).toBeInTheDocument();
  });

  it("tells a suspended organisation, even one that was approved", () => {
    auth.current = { ...auth.current, user: { ...approved, status: "suspended", statusReason: "Misuse" } };
    show();
    expect(screen.getByRole("heading", { name: "This account is suspended" })).toBeInTheDocument();
    expect(screen.getByText("Misuse")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Correct details" })).not.toBeInTheDocument();
  });

  it("lets an approved organisation in, with the menu that suits its kind", async () => {
    show();
    expect(await screen.findByRole("heading", { name: "Dashboard page" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Blood stock/ })[0]).toBeInTheDocument();
    expect(screen.getByText("Blood bank portal")).toBeInTheDocument();
  });

  it("does not sign someone out because the server could not be reached", () => {
    auth.current = {
      loading: false,
      signedIn: true,
      user: null,
      loadError: "Could not reach the server. Check your connection.",
      reload: vi.fn(),
      logout: () => {},
    };
    show();
    expect(screen.getByText("Can not reach the server")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
