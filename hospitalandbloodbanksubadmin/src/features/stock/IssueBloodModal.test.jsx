import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  default: { post: vi.fn() },
  errorMessage: (error, fallback) => error?.response?.data?.message || fallback,
  fieldErrors: () => ({}),
}));

const { default: api } = await import("../../lib/api");
const { default: IssueBloodModal } = await import("./IssueBloodModal");

const stock = {
  groups: [
    { bloodGroup: "A+", available: 900 },
    { bloodGroup: "O-", available: 0 },
  ],
};
const setup = (role = "organisation", props = {}) => {
  const onDone = vi.fn();
  render(<IssueBloodModal role={role} stock={stock} onClose={() => {}} onDone={onDone} {...props} />);
  return { onDone };
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: /Issue blood|Record use/ }));

beforeEach(() => vi.clearAllMocks());

describe("issuing blood", () => {
  it("starts empty and asks for what is missing without calling the server", () => {
    setup();
    submit();
    expect(screen.getByText("Choose a blood group.")).toBeInTheDocument();
    expect(screen.getByText("Enter the amount in ML, as a whole number.")).toBeInTheDocument();
    expect(screen.getByText("Enter the hospital's mobile number or a name.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("says how much of the chosen group there is and refuses more than that", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "A+" }));
    expect(screen.getByText(/900 ML of A\+ in stock/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Amount (ML)"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Ravi" } });
    submit();
    expect(screen.getByText("Only 900 ML of A+ is in stock.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sends a blood bank's issue to a named recipient", async () => {
    api.post.mockResolvedValue({ data: {} });
    const { onDone } = setup();
    fireEvent.click(screen.getByRole("button", { name: "A+" }));
    fireEvent.click(screen.getByRole("button", { name: "450" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: " Mr Sharma " } });
    fireEvent.change(screen.getByLabelText(/^Reference/), { target: { value: "OT-2" } });
    submit();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/stock/issue", {
      bloodGroup: "A+",
      quantity: 450,
      recipientName: "Mr Sharma",
      reference: "OT-2",
      note: "",
    });
  });

  it("turns a hospital's mobile number into an international one", async () => {
    api.post.mockResolvedValue({ data: {} });
    const { onDone } = setup();
    fireEvent.click(screen.getByRole("button", { name: "A+" }));
    fireEvent.click(screen.getByRole("button", { name: "250" }));
    fireEvent.change(screen.getByLabelText(/Hospital's mobile number/), { target: { value: "9876543210" } });
    submit();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1]).toMatchObject({ recipientPhone: "+919876543210", quantity: 250 });
  });

  it("asks a hospital for the patient, and never offers a phone number", () => {
    setup("hospital");
    expect(screen.queryByLabelText(/mobile number/)).not.toBeInTheDocument();
    submit();
    expect(screen.getByText("Enter the patient's name.")).toBeInTheDocument();
  });

  it("shows the server's refusal and lets the person try again", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: "Only 300 ML of A+ is available" } } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "A+" }));
    fireEvent.click(screen.getByRole("button", { name: "450" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Ravi" } });
    submit();
    expect(await screen.findByText("Only 300 ML of A+ is available")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Issue blood" })).not.toBeDisabled());
  });

  it("opens with the group already chosen when it is started from a group's row", () => {
    setup("organisation", { initialGroup: "A+" });
    expect(screen.getByRole("button", { name: "A+" })).toHaveAttribute("aria-pressed", "true");
  });
});
