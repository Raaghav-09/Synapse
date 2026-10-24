import { toast } from "react-hot-toast"

import rzpLogo from "../../assets/Logo/rzp_logo.png"
import { setPaymentLoading } from "../../slices/courseSlice"
import { apiConnector } from "../apiConnector"
import { studentEndpoints } from "../apis"

let checkoutScript
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(true)
  if (checkoutScript) return checkoutScript
  checkoutScript = new Promise((resolve) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    const finish = (loaded) => {
      clearTimeout(timeout)
      if (!loaded) {
        script.remove()
        checkoutScript = undefined
      }
      resolve(loaded)
    }
    const timeout = setTimeout(() => finish(false), 15000)
    script.onload = () => finish(Boolean(window.Razorpay))
    script.onerror = () => finish(false)
    document.body.appendChild(script)
  })
  return checkoutScript
}

export async function BuyCourse(token, courses, user, navigate, dispatch) {
  const toastId = toast.loading("Preparing checkout...")
  dispatch(setPaymentLoading(true))
  try {
    if (!(await loadCheckout())) throw new Error("Could not load checkout. Check your internet connection.")
    const response = await apiConnector("POST", studentEndpoints.COURSE_PAYMENT_API, { courses }, {
      Authorization: `Bearer ${token}`,
    })
    if (!response.data.success) throw new Error(response.data.message)
    const order = response.data.data
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      name: "Synapse",
      description: "Course purchase",
      image: rzpLogo,
      prefill: { name: `${user.firstName} ${user.lastName}`, email: user.email },
      // This callback only opens the status page. Only a signed server webhook
      // can mark the order fulfilled and grant the purchased course access.
      handler: () => navigate(`/dashboard/payment/${order.id}`),
      modal: {
        ondismiss: () => toast("Checkout closed. If you paid, access will appear after payment confirmation."),
      },
    })
    checkout.on("payment.failed", () => toast.error("Payment attempt failed. You can retry in checkout."))
    checkout.open()
  } catch (error) {
    toast.error(error.response?.data?.message || error.message || "Could not start payment.")
  } finally {
    toast.dismiss(toastId)
    dispatch(setPaymentLoading(false))
  }
}

export async function getPaymentStatus(orderId, token, signal) {
  const response = await apiConnector("GET",
    `${studentEndpoints.COURSE_PAYMENT_STATUS_API}/${encodeURIComponent(orderId)}`,
    null, { Authorization: `Bearer ${token}` }, undefined, { signal, timeout: 10000 })
  if (!response.data.success) throw new Error(response.data.message)
  return response.data.data
}
