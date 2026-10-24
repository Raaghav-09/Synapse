import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Link, useParams } from "react-router-dom"

import { getPaymentStatus } from "../services/operations/studentFeaturesAPI"
import { removeFromCart } from "../slices/cartSlice"

export default function PaymentStatus() {
  const { orderId } = useParams()
  const { token } = useSelector((state) => state.auth)
  const dispatch = useDispatch()
  const [result, setResult] = useState("waiting")
  const [message, setMessage] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let timer
    const controller = new AbortController()
    const deadline = Date.now() + 120000
    setResult("waiting")
    setMessage("")

    const check = async () => {
      try {
        const payment = await getPaymentStatus(orderId, token, controller.signal)
        if (!active) return
        if (payment.status === "fulfilled") {
          // Preserve unrelated courses added to the cart while payment waited.
          payment.courses.forEach((id) => dispatch(removeFromCart(id)))
          setResult("fulfilled")
          return
        }
      } catch (error) {
        if (!active) return
        if ([400, 401, 403, 404].includes(error.response?.status)) {
          setMessage(error.response?.data?.message || "Unable to view this order. Please sign in with the account that purchased it.")
          setResult("error")
          return
        }
        // Transient network/server errors do not mean the payment failed.
      }
      if (Date.now() >= deadline) {
        setResult("pending")
        return
      }
      timer = setTimeout(check, 2000)
    }
    check()
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [orderId, token, dispatch, attempt])

  return (
    <section className="mx-auto max-w-2xl space-y-6 py-10 text-richblack-5" aria-live="polite">
      <h1 className="text-3xl font-semibold">
        {result === "fulfilled" ? "Payment confirmed" : result === "error" ? "Unable to check payment" : "Confirming your payment"}
      </h1>
      <p className="break-all text-sm text-richblack-200">Order: {orderId}</p>
      {result === "waiting" && <>
        <div className="spinner" aria-label="Checking payment confirmation" />
        <p>We are waiting for payment confirmation. Your courses will become available once it arrives.</p>
      </>}
      {result === "pending" && <p>
        Confirmation is taking longer than usual. If you have paid, please do not pay again.
        You can check again here or return to your enrolled courses later. Course access will be added even if you close this page.
      </p>}
      {result === "error" && <p>{message}</p>}
      {result === "fulfilled" && <p>Your payment is confirmed and your courses are ready.</p>}
      <div className="flex flex-wrap gap-4">
        {["pending", "error"].includes(result) && <button className="yellowButton" onClick={() => setAttempt((value) => value + 1)}>Check again</button>}
        <Link className={result === "fulfilled" ? "yellowButton" : "blackButton"} to="/dashboard/enrolled-courses">Go to enrolled courses</Link>
      </div>
    </section>
  )
}
