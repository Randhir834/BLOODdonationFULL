import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RequestRow from "./RequestRow";

const bank = { _id: "org1", organisationName: "City Blood Bank" };

const base = {
  _id: "r1",
  patientName: "Jane Doe",
  bloodGroup: "A+",
  component: "whole_blood",
  quantity: 450,
  priority: "normal",
  location: "City Hospital",
  status: "pending",
  createdAt: "2026-09-20T10:00:00Z",
};

describe("RequestRow", () => {
  it("shows the patient, amount, group and who it involves", () => {
    render(
      <ul>
        <RequestRow request={base} party={bank} partyLabel="To" />
      </ul>
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/450 ML/)).toBeInTheDocument();
    expect(screen.getByText("A+")).toBeInTheDocument();
    expect(screen.getByText(/City Blood Bank/)).toBeInTheDocument();
    expect(screen.getByText(/City Hospital/)).toBeInTheDocument();
  });

  it("mentions the component only when it is not whole blood, and priority only when it is not normal", () => {
    render(
      <ul>
        <RequestRow request={base} party={bank} partyLabel="To" />
      </ul>
    );
    expect(screen.queryByText(/Plasma/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Normal/)).not.toBeInTheDocument();

    render(
      <ul>
        <RequestRow
          request={{ ...base, component: "plasma", priority: "emergency" }}
          party={bank}
          partyLabel="To"
        />
      </ul>
    );
    expect(screen.getByText(/Plasma/)).toBeInTheDocument();
    expect(screen.getByText(/Emergency/)).toBeInTheDocument();
  });

  it("shows the status once a request has been answered, and the reason if rejected", () => {
    render(
      <ul>
        <RequestRow
          request={{ ...base, status: "rejected", rejectionReason: "No stock right now" }}
          party={bank}
          partyLabel="To"
        />
      </ul>
    );
    expect(screen.getByText(/Rejected/)).toBeInTheDocument();
    expect(screen.getByText("Reason: No stock right now")).toBeInTheDocument();
  });

  it("shows a still-pending request past its needed-by date as expired", () => {
    render(
      <ul>
        <RequestRow request={{ ...base, requiredAt: "2020-01-01T00:00" }} party={bank} partyLabel="To" />
      </ul>
    );
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });

  it("offers only the actions it is given, and only while pending", () => {
    const onFulfil = vi.fn();
    const onReject = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <ul>
        <RequestRow request={base} party={bank} partyLabel="From" onFulfil={onFulfil} onReject={onReject} />
      </ul>
    );
    expect(screen.getByRole("button", { name: "Fulfil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

    rerender(
      <ul>
        <RequestRow request={base} party={bank} partyLabel="To" onCancel={onCancel} />
      </ul>
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    rerender(
      <ul>
        <RequestRow
          request={{ ...base, status: "fulfilled" }}
          party={bank}
          partyLabel="To"
          onCancel={onCancel}
        />
      </ul>
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("offers to edit only while pending, and only when given a handler", () => {
    const onEdit = vi.fn();
    const { rerender } = render(
      <ul>
        <RequestRow request={base} party={bank} partyLabel="To" onEdit={onEdit} />
      </ul>
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    rerender(
      <ul>
        <RequestRow request={{ ...base, status: "fulfilled" }} party={bank} partyLabel="To" onEdit={onEdit} />
      </ul>
    );
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("disables its actions while busy", () => {
    render(
      <ul>
        <RequestRow request={base} party={bank} partyLabel="From" onFulfil={vi.fn()} busy />
      </ul>
    );
    expect(screen.getByRole("button", { name: "Fulfil" })).toBeDisabled();
  });

  it("shows the broadcast city instead of a party when a request has no target blood bank", () => {
    render(
      <ul>
        <RequestRow request={{ ...base, city: "Bengaluru" }} party={null} partyLabel="To" />
      </ul>
    );
    expect(screen.getByText("Visible in Bengaluru")).toBeInTheDocument();
  });

  it("offers to respond only while pending, and to view responses regardless of status", () => {
    const onRespond = vi.fn();
    const onViewResponses = vi.fn();
    const { rerender } = render(
      <ul>
        <RequestRow
          request={base}
          party={bank}
          partyLabel="From"
          onRespond={onRespond}
          onViewResponses={onViewResponses}
        />
      </ul>
    );
    expect(screen.getByRole("button", { name: "Respond" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Responses" })).toBeInTheDocument();

    rerender(
      <ul>
        <RequestRow
          request={{ ...base, status: "fulfilled" }}
          party={bank}
          partyLabel="From"
          onRespond={onRespond}
          onViewResponses={onViewResponses}
        />
      </ul>
    );
    expect(screen.queryByRole("button", { name: "Respond" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Responses" })).toBeInTheDocument();
  });
});
