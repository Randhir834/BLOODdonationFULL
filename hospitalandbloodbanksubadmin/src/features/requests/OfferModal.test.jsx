import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  errorMessage: (error, fallback) => error?.response?.data?.message || fallback,
}));

const { default: api } = await import("../../lib/api");
const { default: OfferModal } = await import("./OfferModal");

const request = { _id: "r1", bloodGroup: "A+", quantity: 900, patientName: "Jane Doe" };
const detail = (availableMl) => ({ data: { stock: { bloodGroup: "A+", availableMl, neededMl: 900 } } });

beforeEach(() => vi.clearAllMocks());

describe("offering blood for someone's request", () => {
  it("says how many units the stock covers and refuses to promise more", async () => {
    api.get.mockResolvedValue(detail(1000));
    render(<OfferModal request={request} onClose={() => {}} onDone={() => {}} />);
    expect(await screen.findByText(/enough for 2 units/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Units you can give"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Send offer" }));
    expect(screen.getByText(`You have ${(1000).toLocaleString()} ML, enough for 2 units.`)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sends the offer", async () => {
    api.get.mockResolvedValue(detail(1000));
    api.post.mockResolvedValue({ data: {} });
    const onDone = vi.fn();
    render(<OfferModal request={request} onClose={() => {}} onDone={onDone} />);
    await screen.findByText(/enough for 2 units/);
    fireEvent.change(screen.getByLabelText("Units you can give"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Send offer" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/requests/r1/offer", { unitsOffered: 2 });
  });

  it("does not let an organisation with less than one unit offer at all", async () => {
    api.get.mockResolvedValue(detail(300));
    render(<OfferModal request={request} onClose={() => {}} onDone={() => {}} />);
    expect(await screen.findByText(/not enough for one unit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send offer" })).toBeDisabled();
    expect(screen.getByLabelText("Units you can give")).toBeDisabled();
  });

  it("offers a retry when the stock could not be read", async () => {
    api.get.mockRejectedValue({ response: { data: { message: "Could not reach the server" } } });
    render(<OfferModal request={request} onClose={() => {}} onDone={() => {}} />);
    expect(await screen.findByText("Could not reach the server")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send offer" })).toBeDisabled();
  });
});
