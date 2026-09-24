import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  errorMessage: (error, fallback = "Something went wrong. Please try again.") =>
    error?.response?.data?.message || fallback,
}));

const { api } = await import("../lib/api");
const { default: authReducer } = await import("../features/auth/authSlice");
const { clearCache } = await import("../lib/dataCache");
const { default: App } = await import("./App");

const organisation = {
  _id: "org1",
  role: "organisation",
  organisationName: "City Blood Bank",
  phone: "+911111111111",
};
const donor = {
  _id: "d1",
  role: "donar",
  name: "Asha",
  phone: "+919876543210",
  address: "Delhi",
  createdAt: "2026-01-05T10:00:00Z",
};
const hospital = {
  _id: "h1",
  role: "hospital",
  hospitalName: "General Hospital",
  phone: "+913333333333",
  address: "Delhi",
};

const stock = [
  { bloodGroup: "A+", totalIn: 800, totalOut: 300, available: 500, expiringSoonMl: 0 },
  { bloodGroup: "O-", totalIn: 100, totalOut: 100, available: 0, expiringSoonMl: 0 },
];
const today = new Date().toISOString();
const records = [
  {
    _id: "r1",
    inventoryType: "in",
    bloodGroup: "A+",
    quantity: 450,
    phone: "+919876543210",
    createdAt: today,
    donar: donor,
    status: "available",
    expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "r2",
    inventoryType: "out",
    bloodGroup: "A+",
    quantity: 300,
    phone: "+912222222222",
    createdAt: today,
    hospital: null,
  },
];

const pendingRequest = {
  _id: "req1",
  requester: hospital,
  organisation,
  patientName: "Ravi Kumar",
  bloodGroup: "O-",
  component: "whole_blood",
  quantity: 300,
  priority: "emergency",
  location: "General Hospital, Ward 2",
  status: "pending",
  note: "",
  createdAt: today,
};

const responses = {
  "/analytics/overview": { data: { stock, records } },
  "/inventory": { data: { records } },
  "/inventory/mine": { data: { records: [{ ...records[0], organisation }] } },
  "/directory/donors": { data: { donors: [donor] } },
  "/directory/organisations": { data: { organisations: [organisation] } },
  "/directory/blood-banks": { data: { organisations: [organisation] } },
  "/requests": { data: { requests: [pendingRequest] } },
  "/requests/mine": { data: { requests: [pendingRequest] } },
  "/requests/nearby": { data: { requests: [] } },
};

const renderApp = (path, session) => {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { loading: false, ...session } },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  clearCache(); // screens show their last answer instantly, so one test's data must not leak into the next
  api.get.mockImplementation(async (url) => {
    if (!responses[url]) throw new Error(`unexpected request ${url}`);
    return responses[url];
  });
});

describe("blood bank", () => {
  const session = { signedIn: true, user: organisation };

  it("shows stock, recent activity and the blood bank's navigation", async () => {
    renderApp("/", session);

    expect(await screen.findByText("Total in stock")).toBeInTheDocument();
    expect(await screen.findByText("+450")).toBeInTheDocument();
    // 500 ML available across all groups (A+ 500, O- 0).
    expect(screen.getByLabelText("Total blood in stock")).toHaveTextContent("500");
    expect(screen.getByLabelText("Total blood in stock")).toHaveTextContent("900 ML added · 400 ML issued");

    const nav = screen.getByRole("navigation", { name: "Main" });
    ["Home", "Records", "Donors", "Hospitals", "Profile"].forEach((label) =>
      expect(within(nav).getByText(label)).toBeInTheDocument()
    );
  });

  it("falls back to the phone number when the other party was deleted", async () => {
    renderApp("/", session);
    expect(await screen.findByText("+912222222222")).toBeInTheDocument();
  });

  it("moves between tabs and loads each list from its own endpoint", async () => {
    renderApp("/", session);
    await screen.findByText("Total in stock");

    fireEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByText("Donors"));
    expect(await screen.findByRole("heading", { level: 1, name: "Donors" })).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/directory/donors"));
    expect(await screen.findByLabelText("Search")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Call Asha" })).toBeInTheDocument();
  });

  it("opens the add blood sheet and validates before sending", async () => {
    renderApp("/", session);
    fireEvent.click(await screen.findByRole("button", { name: /Add blood/ }));

    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Add to stock" }));
    expect(within(sheet).getByText("Choose a blood group.")).toBeInTheDocument();
    expect(within(sheet).getByText("Enter the amount in ML, as a whole number.")).toBeInTheDocument();
    expect(within(sheet).getByText("Enter a valid mobile number.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sends a valid record and refreshes the stock", async () => {
    api.post.mockResolvedValue({ data: { record: {} } });
    renderApp("/", session);
    fireEvent.click(await screen.findByRole("button", { name: /Add blood/ }));

    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "A+" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "450" }));
    fireEvent.change(within(sheet).getByLabelText(/mobile number/), { target: { value: "98765 43210" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Add to stock" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/inventory", {
        phone: "+919876543210",
        inventoryType: "in",
        bloodGroup: "A+",
        quantity: 450,
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.get.mock.calls.filter(([url]) => url === "/analytics/overview").length).toBeGreaterThan(1);
  });

  it("shows the server's reason when a record is refused", async () => {
    api.post.mockRejectedValue({ response: { data: { message: "Only 100 ML of A+ is available" } } });
    renderApp("/", session);
    fireEvent.click(await screen.findByRole("button", { name: /Issue blood/ }));

    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "A+" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "500" }));
    fireEvent.change(within(sheet).getByLabelText(/mobile number/), { target: { value: "9876543210" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Issue blood" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Only 100 ML of A+ is available");
    expect(within(sheet).getByRole("button", { name: "Issue blood" })).toBeEnabled();
  });

  it("shows a retry when a list fails to load", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "Access denied" } } });
    renderApp("/", session);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts[0]).toHaveTextContent("Access denied");
    expect(within(alerts[0]).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("mentions expiring stock only when there is some", async () => {
    renderApp("/", session);
    await screen.findByText("Total in stock");
    expect(screen.queryByText(/expiring soon/)).not.toBeInTheDocument();

    // A fresh figure, as a "Refresh" would fetch, with one group now expiring soon.
    api.get.mockImplementation(async (url) =>
      url === "/analytics/overview"
        ? { data: { stock: [{ ...stock[0], expiringSoonMl: 150 }, stock[1]], records } }
        : responses[url]
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("150 ML expiring soon")).toBeInTheDocument();
  });

  it("discards an available unit from the Records tab", async () => {
    api.post.mockResolvedValue({ data: { unit: { bloodGroup: "A+", quantity: 450 } } });
    renderApp("/records", session);
    await screen.findByText("Asha");

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    const sheet = screen.getByRole("dialog");
    fireEvent.click(within(sheet).getByRole("radio", { name: "Damaged" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Discard unit" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/inventory/r1/discard", { reason: "damaged", note: "" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.get.mock.calls.filter(([url]) => url === "/inventory").length).toBeGreaterThan(1);
  });

  it("sees requests from hospitals, and fulfils one", async () => {
    api.post.mockResolvedValue({ data: { request: { ...pendingRequest, status: "fulfilled" } } });
    renderApp("/requests", session);

    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getAllByText(/General Hospital/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Emergency/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fulfil" }));
    // Issuing blood asks first, and names what will be issued.
    const dialog = screen.getByRole("alertdialog", { name: "Fulfil this request?" });
    expect(dialog).toHaveTextContent("300 ML of O-");
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue blood" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/requests/req1/fulfil"));
  });

  it("rejects a request with a reason", async () => {
    api.post.mockResolvedValue({ data: { request: { ...pendingRequest, status: "rejected" } } });
    renderApp("/requests", session);
    await screen.findByText("Ravi Kumar");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const sheet = screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Reason"), { target: { value: "No stock" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Reject request" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/requests/req1/reject", { reason: "No stock" })
    );
  });
});

describe("donor", () => {
  const session = { signedIn: true, user: donor };

  it("sees their own donations and no blood bank screens", async () => {
    renderApp("/", session);
    expect(await screen.findByText("Total donated")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/inventory/mine", { params: { type: "in" } });

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByText("Requests")).toBeInTheDocument();
    expect(within(nav).getByText("Blood banks")).toBeInTheDocument();
    expect(within(nav).queryByText("Records")).not.toBeInTheDocument();
  });

  it("can ask a blood bank for blood too, on behalf of someone else", async () => {
    api.post.mockResolvedValue({ data: { request: { ...pendingRequest, requester: donor, _id: "req3" } } });
    renderApp("/requests", session);

    fireEvent.click(await screen.findByRole("button", { name: /Request blood/ }));
    const sheet = screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Patient / recipient name"), {
      target: { value: "Asha's uncle" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "B+" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "450" }));
    fireEvent.change(within(sheet).getByLabelText("Hospital / location"), {
      target: { value: "City Hospital" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Send request" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/requests",
        expect.objectContaining({ patientName: "Asha's uncle", bloodGroup: "B+" })
      )
    );
  });

  it("is sent home from a screen that belongs to blood banks", async () => {
    renderApp("/records", session);
    expect(await screen.findByText("Total donated")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/inventory");
  });

  it("lists the blood banks that dealt with them", async () => {
    renderApp("/organisations", session);
    expect(await screen.findByText("City Blood Bank")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call City Blood Bank" })).toHaveAttribute(
      "href",
      "tel:+911111111111"
    );
  });

  it("confirms before logging out", async () => {
    renderApp("/profile", session);
    fireEvent.click(await screen.findByRole("button", { name: /Log out/ }));
    const dialog = screen.getByRole("alertdialog", { name: "Log out?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("hospital", () => {
  const session = { signedIn: true, user: hospital };

  it("sees a Requests tab, alongside blood received and blood banks", async () => {
    renderApp("/", session);
    expect(await screen.findByRole("heading", { level: 1, name: "Blood received" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByText("Home")).toBeInTheDocument();
    expect(within(nav).getByText("Requests")).toBeInTheDocument();
  });

  it("sends a new request, broadcast to its own city", async () => {
    api.post.mockResolvedValue({ data: { request: { ...pendingRequest, _id: "req2" } } });
    renderApp("/requests", session);

    fireEvent.click(await screen.findByRole("button", { name: /Request blood/ }));
    const sheet = screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Patient / recipient name"), {
      target: { value: "Ravi Kumar" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "O-" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "250" }));
    fireEvent.change(within(sheet).getByLabelText("Hospital / location"), {
      target: { value: "General Hospital, Ward 2" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Send request" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/requests", {
        patientName: "Ravi Kumar",
        bloodGroup: "O-",
        component: "whole_blood",
        quantity: 250,
        priority: "normal",
        requiredAt: undefined,
        location: "General Hospital, Ward 2",
        contactName: "",
        contactPhone: "",
        note: "",
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancels its own pending request", async () => {
    api.post.mockResolvedValue({ data: { request: { ...pendingRequest, status: "cancelled" } } });
    renderApp("/requests", session);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("alertdialog", { name: "Cancel this request?" });
    // "Keep request" backs out without calling the server.
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep request" }));
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel request" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/requests/req1/cancel"));
  });
});

describe("signed out", () => {
  it("is sent to the sign-in screen, which asks for a mobile number", async () => {
    renderApp("/records", { signedIn: false, user: null });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile number")).toBeInTheDocument();
    expect(document.getElementById("recaptcha-container")).toBeInTheDocument();
  });

  it("asks a verified number without a profile to set up an account", async () => {
    renderApp("/login", { signedIn: true, user: null });
    expect(await screen.findByRole("heading", { name: "Set up your account" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Donor/ })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your address.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe("hospital or blood bank waiting for approval", () => {
  const waiting = { ...organisation, verification: "pending", registrationNumber: "KA/BB/2041" };
  const session = { signedIn: true, user: waiting };
  const waitingHeading = () => screen.findByRole("heading", { level: 1, name: "Waiting for approval" });

  it("sees the waiting screen instead of the app", async () => {
    renderApp("/", session);
    expect(await waitingHeading()).toBeInTheDocument();
    expect(screen.getByText("KA/BB/2041")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("can not get to a screen by typing its address", async () => {
    renderApp("/records", session);
    expect(await waitingHeading()).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/inventory");
  });

  it("is told why a registration was rejected", async () => {
    renderApp("/", {
      signedIn: true,
      user: { ...waiting, verification: "rejected", verificationReason: "Licence not found" },
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Registration not approved" })
    ).toBeInTheDocument();
    expect(screen.getByText("Reason: Licence not found")).toBeInTheDocument();
  });

  it("opens the app as soon as an admin has approved it", async () => {
    api.get.mockImplementation(async (url) =>
      url === "/auth/me" ? { data: { user: { ...waiting, verification: "approved" } } } : responses[url]
    );
    renderApp("/", session);
    fireEvent.click(await screen.findByRole("button", { name: "Check again" }));

    expect(await screen.findByText("Total in stock")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("keeps waiting while the admin has not decided", async () => {
    api.get.mockImplementation(async (url) =>
      url === "/auth/me" ? { data: { user: waiting } } : responses[url]
    );
    renderApp("/", session);
    fireEvent.click(await screen.findByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Nothing has changed yet.")).toBeInTheDocument();
    expect(await waitingHeading()).toBeInTheDocument();
  });

  it("never holds back a donor", async () => {
    renderApp("/", { signedIn: true, user: { ...donor, verification: "approved" } });
    expect(await screen.findByText("Total donated")).toBeInTheDocument();
  });
});
