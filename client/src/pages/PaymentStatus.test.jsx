import { act, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import PaymentStatus from "./PaymentStatus"
import { getPaymentStatus } from "../services/operations/studentFeaturesAPI"

const mockDispatch = jest.fn()
jest.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
  useSelector: (select) => select({ auth: { token: "token" } }),
}))
jest.mock("../services/operations/studentFeaturesAPI", () => ({ getPaymentStatus: jest.fn() }))
jest.mock("../slices/cartSlice", () => ({ removeFromCart: (id) => ({ type: "remove", payload: id }) }))

function page() {
  return render(<MemoryRouter initialEntries={["/dashboard/payment/order_test"]}>
    <Routes><Route path="/dashboard/payment/:orderId" element={<PaymentStatus />} /></Routes>
  </MemoryRouter>)
}

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers() })
afterEach(() => jest.useRealTimers())

test("does not claim success or remove cart courses before webhook fulfillment", async () => {
  getPaymentStatus.mockResolvedValue({ status: "created", courses: ["course1"] })
  page()
  await act(async () => {})
  expect(screen.getByText("Confirming your payment")).toBeTruthy()
  expect(mockDispatch).not.toHaveBeenCalled()
  getPaymentStatus.mockResolvedValue({ status: "fulfilled", courses: ["course1"] })
  await act(async () => { jest.advanceTimersByTime(2000) })
  expect(screen.getByText("Payment confirmed")).toBeTruthy()
  expect(mockDispatch).toHaveBeenCalledWith({ type: "remove", payload: "course1" })
  expect(mockDispatch).toHaveBeenCalledTimes(1)
})

test("late confirmation shows pending with a retry instead of a payment failure", async () => {
  getPaymentStatus.mockResolvedValue({ status: "created" })
  page()
  await act(async () => {})
  await act(async () => { jest.advanceTimersByTime(120000) })
  expect(screen.getByText("Check again")).toBeTruthy()
  expect(screen.getByText(/please do not pay again/)).toBeTruthy()
  expect(mockDispatch).not.toHaveBeenCalled()
})

test("a status page reload can discover an already fulfilled order", async () => {
  getPaymentStatus.mockResolvedValue({ status: "fulfilled", courses: [] })
  page()
  await act(async () => {})
  expect(screen.getByText("Payment confirmed")).toBeTruthy()
})

test("an ownership/auth error stops polling without granting access", async () => {
  getPaymentStatus.mockRejectedValue({ response: { status: 404, data: { message: "Order not found" } } })
  page()
  await act(async () => {})
  expect(screen.getByText("Order not found")).toBeTruthy()
  expect(mockDispatch).not.toHaveBeenCalled()
  await act(async () => { jest.advanceTimersByTime(10000) })
  expect(getPaymentStatus).toHaveBeenCalledTimes(1)
})

test("unmount aborts an in-flight status request", async () => {
  getPaymentStatus.mockImplementation(() => new Promise(() => {}))
  const view = page()
  const signal = getPaymentStatus.mock.calls[0][2]
  view.unmount()
  expect(signal.aborted).toBe(true)
})
