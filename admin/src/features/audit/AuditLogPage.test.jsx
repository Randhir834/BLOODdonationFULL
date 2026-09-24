import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  default: { get: vi.fn() },
  errorMessage: (error) => error?.response?.data?.message || "Something went wrong",
}));

const { default: api } = await import("../../lib/api");
const { default: AuditLogPage } = await import("./AuditLogPage");

const logs = [
  {
    _id: "l1",
    at: "2026-09-22T10:00:00Z",
    actorType: "user",
    actorLabel: "City Blood Bank",
    actorRole: "organisation",
    action: "inventory.issue",
    targetLabel: "300 ML A+",
    details: { bloodGroup: "A+", quantity: 300, phone: "+912000000001" },
  },
  {
    _id: "l2",
    at: "2026-09-22T09:00:00Z",
    actorType: "user",
    actorLabel: "General Hospital",
    actorRole: "hospital",
    action: "user.register",
    targetLabel: "General Hospital",
    details: { role: "hospital", verification: "pending" },
  },
  {
    _id: "l3",
    at: "2026-09-22T09:30:00Z",
    actorType: "admin",
    actorLabel: "boss@example.com",
    adminEmail: "boss@example.com",
    action: "user.reject",
    targetLabel: "Fake Blood Bank",
    details: { reason: "Licence not found" },
  },
  {
    // written before actors were recorded: admin only, and has just an email
    _id: "l4",
    at: "2026-09-20T09:30:00Z",
    adminEmail: "old@example.com",
    action: "user.suspend",
    targetLabel: "Someone",
    details: { reason: "Spam" },
  },
];

const rowFor = (text) => screen.getByText(text).closest("tr");

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { logs } });
});

describe("AuditLogPage", () => {
  it("shows who did each thing, whether an admin or someone in the app", async () => {
    render(<AuditLogPage />);
    await screen.findByText("City Blood Bank");

    const bank = rowFor("City Blood Bank");
    expect(within(bank).getByText("Organisation")).toBeInTheDocument();
    expect(within(bank).getByText("Issued blood")).toBeInTheDocument();
    expect(within(bank).getByText("300 ML A+")).toBeInTheDocument();
    expect(within(bank).getByText("To hospital +912000000001")).toBeInTheDocument();

    const admin = rowFor("boss@example.com");
    expect(within(admin).getByText("Admin")).toBeInTheDocument();
    expect(within(admin).getByText("Rejected a registration")).toBeInTheDocument();
    expect(within(admin).getByText("Reason: Licence not found")).toBeInTheDocument();
  });

  it("describes a new sign-up that is waiting for approval", async () => {
    render(<AuditLogPage />);
    const row = (await screen.findAllByText("General Hospital"))[0].closest("tr");
    expect(within(row).getByText("Signed up")).toBeInTheDocument();
    expect(within(row).getByText("Signed up as Hospital, waiting for approval")).toBeInTheDocument();
  });

  it("still shows entries written before actors were recorded, as admin actions", async () => {
    render(<AuditLogPage />);
    const row = (await screen.findByText("old@example.com")).closest("tr");
    expect(within(row).getByText("Admin")).toBeInTheDocument();
    expect(within(row).getByText("Suspended a user")).toBeInTheDocument();
  });

  it("describes blood requests: the priority asked for, and the reason for a rejection", async () => {
    api.get.mockResolvedValue({
      data: {
        logs: [
          {
            _id: "r1",
            at: "2026-09-22T10:00:00Z",
            actorType: "user",
            actorLabel: "General Hospital",
            actorRole: "hospital",
            action: "request.create",
            targetLabel: "300 ML O-",
            details: { organisation: "org1", priority: "emergency" },
          },
          {
            _id: "r2",
            at: "2026-09-22T10:05:00Z",
            actorType: "user",
            actorLabel: "City Blood Bank",
            actorRole: "organisation",
            action: "request.reject",
            targetLabel: "300 ML O-",
            details: { reason: "No stock right now" },
          },
        ],
      },
    });
    render(<AuditLogPage />);
    const created = (await screen.findAllByText("300 ML O-"))[0].closest("tr");
    expect(within(created).getByText("Requested blood")).toBeInTheDocument();
    expect(within(created).getByText("Priority: emergency")).toBeInTheDocument();

    const rejected = screen.getAllByText("300 ML O-")[1].closest("tr");
    expect(within(rejected).getByText("Rejected a blood request")).toBeInTheDocument();
    expect(within(rejected).getByText("Reason: No stock right now")).toBeInTheDocument();
  });

  it("filters by who did it", async () => {
    render(<AuditLogPage />);
    await screen.findByText("City Blood Bank");
    const filter = screen.getByLabelText("Done by");

    fireEvent.change(filter, { target: { value: "admin" } });
    expect(screen.getByText("boss@example.com")).toBeInTheDocument();
    expect(screen.getByText("old@example.com")).toBeInTheDocument();
    expect(screen.queryByText("City Blood Bank")).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: "user" } });
    expect(screen.getByText("City Blood Bank")).toBeInTheDocument();
    expect(screen.queryByText("boss@example.com")).not.toBeInTheDocument();

    fireEvent.change(filter, { target: { value: "" } });
    expect(screen.getByText("boss@example.com")).toBeInTheDocument();
  });

  it("says so when the filter leaves nothing", async () => {
    api.get.mockResolvedValue({ data: { logs: [logs[2]] } });
    render(<AuditLogPage />);
    await screen.findByText("boss@example.com");
    fireEvent.change(screen.getByLabelText("Done by"), { target: { value: "user" } });
    expect(screen.getByText(/Nothing matches this filter/)).toBeInTheDocument();
  });

  it("says when nothing has happened yet", async () => {
    api.get.mockResolvedValue({ data: { logs: [] } });
    render(<AuditLogPage />);
    expect(await screen.findByText("Nothing has been done yet.")).toBeInTheDocument();
  });
});
