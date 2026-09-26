import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock("./requestsApi", () => ({ createRequest: vi.fn(), updateRequest: vi.fn() }));

const { notify } = await import("../../lib/notify");
const { createRequest, updateRequest } = await import("./requestsApi");
const { default: NewRequestSheet } = await import("./NewRequestSheet");

beforeEach(() => {
  vi.clearAllMocks();
});

const submit = (label = "Send request") => fireEvent.click(screen.getByRole("button", { name: label }));

const fillRequired = () => {
  fireEvent.change(screen.getByLabelText("Patient / recipient name"), { target: { value: "Jane Doe" } });
  fireEvent.click(screen.getByRole("button", { name: "A+" }));
  fireEvent.click(screen.getByRole("button", { name: "450" }));
  fireEvent.change(screen.getByLabelText("Hospital / location"), { target: { value: "City Hospital" } });
};

describe("NewRequestSheet: creating", () => {
  it("starts every field blank, with no pre-filled value", () => {
    render(<NewRequestSheet onClose={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByLabelText("Patient / recipient name")).toHaveValue("");
    expect(screen.getByLabelText("Hospital / location")).toHaveValue("");
    expect(screen.getByLabelText("Contact phone (optional)")).toHaveValue("");
  });

  it("validates before sending", () => {
    render(<NewRequestSheet onClose={vi.fn()} onDone={vi.fn()} />);
    submit();

    expect(screen.getByText("Choose a blood group.")).toBeInTheDocument();
    expect(screen.getByText("Enter the patient's name.")).toBeInTheDocument();
    expect(screen.getByText("Enter the hospital or location.")).toBeInTheDocument();
    expect(screen.getByText("Enter the amount in ML, as a whole number.")).toBeInTheDocument();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("sends a valid request with the chosen priority and component", async () => {
    createRequest.mockResolvedValue({ _id: "r1" });
    const onDone = vi.fn();
    render(<NewRequestSheet onClose={vi.fn()} onDone={onDone} />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Emergency" }));
    submit();

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith({
        patientName: "Jane Doe",
        bloodGroup: "A+",
        component: "whole_blood",
        quantity: 450,
        priority: "emergency",
        requiredAt: undefined,
        location: "City Hospital",
        contactName: "",
        contactPhone: "",
        note: "",
      })
    );
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Request sent"));
    expect(onDone).toHaveBeenCalled();
  });

  it("defaults to normal priority", async () => {
    createRequest.mockResolvedValue({ _id: "r1" });
    render(<NewRequestSheet onClose={vi.fn()} onDone={vi.fn()} />);
    fillRequired();
    submit();
    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({ priority: "normal" }))
    );
  });

  it("shows why sending failed and lets the person try again", async () => {
    createRequest.mockRejectedValue({
      response: { data: { message: "Could not send the request" } },
    });
    render(<NewRequestSheet onClose={vi.fn()} onDone={vi.fn()} />);
    fillRequired();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not send the request");
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });
});

describe("NewRequestSheet: editing", () => {
  const request = {
    _id: "r1",
    bloodGroup: "A+",
    component: "plasma",
    priority: "urgent",
    patientName: "Jane Doe",
    quantity: 450,
    location: "City Hospital",
    note: "Ward 4",
  };

  it("pre-fills only blood group, component and priority; every other field is blank", () => {
    render(<NewRequestSheet request={request} onClose={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole("button", { name: "A+" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Component / type")).toHaveValue("plasma");
    expect(screen.getByRole("button", { name: "Urgent" })).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByLabelText("Patient / recipient name")).toHaveValue("");
    expect(screen.getByLabelText("Hospital / location")).toHaveValue("");
    expect(screen.getByLabelText("Units required")).toHaveValue(null);
    expect(screen.getByText("Leave a field blank to keep its current value.")).toBeInTheDocument();
  });

  it("sends only the fields the person actually typed into, plus the always-sent choices", async () => {
    updateRequest.mockResolvedValue({ ...request, patientName: "John Smith" });
    const onDone = vi.fn();
    render(<NewRequestSheet request={request} onClose={vi.fn()} onDone={onDone} />);

    fireEvent.change(screen.getByLabelText("Patient / recipient name"), { target: { value: "John Smith" } });
    submit("Save changes");

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith("r1", {
        bloodGroup: "A+",
        component: "plasma",
        priority: "urgent",
        patientName: "John Smith",
      })
    );
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith("Request updated"));
    expect(onDone).toHaveBeenCalled();
  });

  it("does not require the patient name, location or amount again, since a blank one keeps its value", async () => {
    updateRequest.mockResolvedValue(request);
    render(<NewRequestSheet request={request} onClose={vi.fn()} onDone={vi.fn()} />);
    submit("Save changes");

    expect(screen.queryByText("Enter the patient's name.")).not.toBeInTheDocument();
    expect(screen.queryByText("Enter the hospital or location.")).not.toBeInTheDocument();
    expect(screen.queryByText("Enter the amount in ML, as a whole number.")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith("r1", {
        bloodGroup: "A+",
        component: "plasma",
        priority: "urgent",
      })
    );
  });
});
