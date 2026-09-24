import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  default: { post: vi.fn() },
  errorMessage: (error, fallback) => error?.response?.data?.message || fallback,
  fieldErrors: () => ({}),
}));

const { default: api } = await import("../../lib/api");
const { default: ReceiveBloodModal } = await import("./ReceiveBloodModal");

const setup = (role) => {
  const onDone = vi.fn();
  render(<ReceiveBloodModal role={role} onClose={() => {}} onDone={onDone} />);
  return { onDone };
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Add to stock" }));

beforeEach(() => vi.clearAllMocks());

describe("adding blood to stock", () => {
  it("starts with every field empty and no blood group chosen", () => {
    setup("organisation");
    screen.getAllByRole("textbox").forEach((input) => expect(input).toHaveValue(""));
    const groups = screen.getAllByRole("button").filter((b) => /^(A|B|AB|O)[+-]$/.test(b.textContent));
    expect(groups).toHaveLength(8);
    groups.forEach((button) => expect(button).toHaveAttribute("aria-pressed", "false"));
  });

  it("asks for what is missing, and never calls the server while something is", () => {
    setup("organisation");
    submit();
    expect(screen.getByText("Choose a blood group.")).toBeInTheDocument();
    expect(screen.getByText("Enter the donor's mobile number or name.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("checks that the expiry date is after the collection date", () => {
    setup("organisation");
    fireEvent.click(screen.getByRole("button", { name: "A+" }));
    fireEvent.click(screen.getByRole("button", { name: "450" }));
    fireEvent.change(screen.getByLabelText(/^Donor's name/), { target: { value: "Ravi" } });
    fireEvent.change(screen.getByLabelText(/^Collected on/), { target: { value: "2026-09-20" } });
    fireEvent.change(screen.getByLabelText(/^Expires on/), { target: { value: "2026-09-19" } });
    submit();
    expect(screen.getByText("The expiry date must be after the collection date.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("records a walk-in donation for a blood bank", async () => {
    api.post.mockResolvedValue({ data: {} });
    const { onDone } = setup("organisation");
    fireEvent.click(screen.getByRole("button", { name: "O-" }));
    fireEvent.click(screen.getByRole("button", { name: "350" }));
    fireEvent.change(screen.getByLabelText(/^Donor's name/), { target: { value: "Ravi Kumar" } });
    fireEvent.change(screen.getByLabelText(/^Bag number/), { target: { value: "B-7" } });
    submit();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/stock/receive", {
      bloodGroup: "O-",
      quantity: 350,
      sourceName: "Ravi Kumar",
      bagNumber: "B-7",
      storageLocation: "",
      note: "",
    });
  });

  it("finds a registered donor by mobile number", async () => {
    api.post.mockResolvedValue({ data: {} });
    const { onDone } = setup("organisation");
    fireEvent.click(screen.getByRole("button", { name: "A+" }));
    fireEvent.click(screen.getByRole("button", { name: "450" }));
    fireEvent.change(screen.getByLabelText(/Donor's mobile number/), { target: { value: "9876543210" } });
    submit();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1]).toMatchObject({ sourcePhone: "+919876543210", sourceName: "" });
  });

  it("asks a hospital where the blood came from, in words only", () => {
    setup("hospital");
    expect(screen.queryByLabelText(/mobile number/)).not.toBeInTheDocument();
    submit();
    expect(screen.getByText("Enter who the blood came from.")).toBeInTheDocument();
  });
});
