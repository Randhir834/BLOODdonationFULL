import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  errorMessage: (error) => error?.response?.data?.message || "Something went wrong",
}));

const { default: api } = await import("../lib/api");
const { AuthContext } = await import("../features/auth/authContext");
const { default: ToastProvider } = await import("../components/ToastProvider");
const { default: App } = await import("./App");

const admin = { uid: "a1", email: "boss@example.com" };

const day = (i) => ({
  date: `2026-09-${String(i + 1).padStart(2, "0")}`,
  in: i === 29 ? 450 : 0,
  out: 0,
  records: i === 29 ? 1 : 0,
});
const user = {
  _id: "u1",
  role: "donar",
  name: "Asha",
  phone: "+919876543210",
  address: "Delhi",
  status: "active",
  createdAt: "2026-09-21T10:00:00Z",
};
const dashboard = {
  generatedAt: "2026-09-22T10:00:00Z",
  timezone: "Asia/Kolkata",
  lowStockMl: 1000,
  users: { total: 12, donors: 8, hospitals: 3, organisations: 1, newLast7Days: 2, suspended: 1 },
  records: { total: 40, today: 1, last7Days: 5, mlInLast30Days: 900, mlOutLast30Days: 300 },
  stock: [
    { bloodGroup: "A+", totalIn: 900, totalOut: 300, available: 600, status: "low" },
    { bloodGroup: "O-", totalIn: 0, totalOut: 0, available: 0, status: "out" },
  ],
  trend: Array.from({ length: 30 }, (_, i) => day(i)),
  attention: [{ severity: "critical", title: "1 blood group out of stock", detail: "O-" }],
  recent: { records: [], signups: [user] },
};
const system = {
  firestore: { ok: true, latencyMs: 30 },
  auth: { ok: true, latencyMs: 20 },
  server: { uptimeSeconds: 3700, mode: "development" },
};
const page = { total: 0, page: 1, pageSize: 25, truncated: false };

const respond = (url) => {
  if (url === "/dashboard") return { data: { dashboard } };
  if (url === "/system") return { data: { system } };
  if (url === "/users") return { data: { users: [user], ...page, total: 1 } };
  if (url === "/users/u1") return { data: { user, stock: null, records: [] } };
  if (url === "/inventory") return { data: { records: [], ...page } };
  if (url === "/admins") {
    const account = {
      _id: "a1",
      email: admin.email,
      name: "Boss",
      createdAt: "2026-09-01T00:00:00Z",
      createdBy: "system",
    };
    return { data: { admins: [account] } };
  }
  throw new Error(`unexpected request ${url}`);
};

const login = vi.fn();
const logout = vi.fn();
const renderApp = (path, session = { loading: false, admin, notice: null }) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthContext.Provider value={{ ...session, login, logout }}>
          <App />
        </AuthContext.Provider>
      </ToastProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url) => respond(url));
});

describe("signed in", () => {
  it("shows the dashboard: numbers, what needs attention and system health", async () => {
    renderApp("/");
    // The heading is also on the loading placeholder, so wait for the data itself.
    expect(await screen.findByText("1 blood group out of stock")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(await screen.findAllByText("All systems working")).not.toHaveLength(0);
    expect(await screen.findByText(/Up 1h 1m/)).toBeInTheDocument();
    expect(screen.getByText("boss@example.com")).toBeInTheDocument();
  });

  it("opens a user from the address, as the dashboard links do", async () => {
    renderApp("/users?open=u1");
    const dialog = await screen.findByRole("dialog", { name: "Asha" });
    expect(await within(dialog).findByText("+919876543210")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Suspend" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/users/u1", { params: {} });
  });

  it("suspends a user only with a reason", async () => {
    api.post.mockResolvedValue({ data: {} });
    renderApp("/users?open=u1");
    const detail = await screen.findByRole("dialog", { name: "Asha" });
    fireEvent.click(await within(detail).findByRole("button", { name: "Suspend" }));

    const suspend = screen.getByRole("dialog", { name: "Suspend Asha" });
    const confirm = within(suspend).getByRole("button", { name: "Suspend" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(suspend).getByRole("textbox"), { target: { value: "Spam" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/users/u1/suspend", { reason: "Spam" }));
    expect(await screen.findByText("User suspended")).toBeInTheDocument();
  });

  it("makes the admin type a word before deleting a user", async () => {
    renderApp("/users?open=u1");
    const detail = await screen.findByRole("dialog", { name: "Asha" });
    fireEvent.click(await within(detail).findByRole("button", { name: "Delete" }));

    const confirm = screen.getByRole("dialog", { name: "Delete Asha?" });
    expect(within(confirm).getByRole("button", { name: "Delete user" })).toBeDisabled();
    fireEvent.change(within(confirm).getByRole("textbox"), { target: { value: "delete" } });
    expect(within(confirm).getByRole("button", { name: "Delete user" })).toBeEnabled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("puts filters in the address and sends them to the API", async () => {
    renderApp("/inventory");
    fireEvent.change(await screen.findByLabelText("Blood group"), { target: { value: "A+" } });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        "/inventory",
        expect.objectContaining({ params: expect.objectContaining({ bloodGroup: "A+" }) })
      )
    );
    expect(await screen.findByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("lists admins and does not offer to remove yourself", async () => {
    renderApp("/admins");
    expect(await screen.findByText("You")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add admin" }));
    expect(screen.getByRole("dialog", { name: "Add an admin" })).toBeInTheDocument();
  });

  it("shows the reason a list could not load, with a retry", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "Access denied" } } });
    renderApp("/users");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Access denied");
    const callsBefore = api.get.mock.calls.length;
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("signs out", async () => {
    renderApp("/");
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalled();
  });
});

describe("signed out", () => {
  it("only offers the sign-in form, whatever address was asked for", async () => {
    renderApp("/users", {
      loading: false,
      admin: null,
      notice: "You were signed out after 30 minutes of inactivity.",
    });
    expect(await screen.findByRole("heading", { name: "Blood Bank Admin" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("30 minutes of inactivity");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("passes the typed details to the sign-in", async () => {
    login.mockResolvedValue(undefined);
    renderApp("/", { loading: false, admin: null, notice: null });
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: " boss@example.com " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-password-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(login).toHaveBeenCalledWith("boss@example.com", "secret-password-1"));
  });
});
