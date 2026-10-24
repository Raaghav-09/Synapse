import { BuyCourse, getPaymentStatus } from "./studentFeaturesAPI"
import { apiConnector } from "../apiConnector"
import { toast } from "react-hot-toast"

jest.mock("../apiConnector", () => ({ apiConnector: jest.fn() }))
jest.mock("react-hot-toast", () => ({ toast: Object.assign(jest.fn(), {
  loading: jest.fn(() => "toast"), dismiss: jest.fn(), error: jest.fn(),
}) }))

beforeEach(() => jest.clearAllMocks())
afterEach(() => delete window.Razorpay)

test("server-created order opens Checkout; callback only navigates to status", async () => {
  let options
  const open = jest.fn()
  window.Razorpay = jest.fn((value) => {
    options = value
    return { open, on: jest.fn() }
  })
  apiConnector.mockResolvedValue({ data: { success: true, data: {
    id: "order_test", amount: 50000, currency: "INR", keyId: "rzp_test_backend",
  } } })
  const navigate = jest.fn()
  const dispatch = jest.fn()
  await BuyCourse("token", ["course"], { firstName: "A", lastName: "B", email: "test@example.invalid" }, navigate, dispatch)
  expect(apiConnector).toHaveBeenCalledWith("POST", "/payment/createOrder", { courses: ["course"] }, { Authorization: "Bearer token" })
  expect(options).toMatchObject({ key: "rzp_test_backend", order_id: "order_test", amount: 50000 })
  expect(open).toHaveBeenCalledTimes(1)
  options.handler({ razorpay_payment_id: "pay_forged", razorpay_signature: "forged" })
  expect(navigate).toHaveBeenCalledWith("/dashboard/payment/order_test")
  expect(apiConnector).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ payload: false }))
})

test("order errors never open Checkout and always clear the loading state", async () => {
  window.Razorpay = jest.fn()
  apiConnector.mockRejectedValue({ response: { data: { message: "Webhook is not configured" } } })
  const dispatch = jest.fn()
  await BuyCourse("token", ["course"], {}, jest.fn(), dispatch)
  expect(window.Razorpay).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith("Webhook is not configured")
  expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ payload: false }))
  expect(toast.dismiss).toHaveBeenCalled()
})

test("status is a read-only authenticated request with abort/timeout support", async () => {
  apiConnector.mockResolvedValue({ data: { success: true, data: { status: "created" } } })
  const controller = new AbortController()
  await expect(getPaymentStatus("order_test", "token", controller.signal)).resolves.toEqual({ status: "created" })
  expect(apiConnector).toHaveBeenCalledWith("GET", "/payment/orders/order_test", null,
    { Authorization: "Bearer token" }, undefined, { signal: controller.signal, timeout: 10000 })
})
