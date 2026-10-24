const router = require("express").Router();
const { createOrder, getOrderStatus, verifySignature } = require("../controllers/Payments");
const { auth, isStudent } = require("../middlewares/auth");

router.post("/createOrder", auth, isStudent, createOrder);
// Old order-creation URL remains usable by deployed clients.
router.post("/capturePayment", auth, isStudent, createOrder);
router.get("/orders/:orderId", auth, isStudent, getOrderStatus);

// Retired browser endpoints must never grant access or send receipts.
router.post(["/verifyPayment", "/sendPaymentSuccessEmail"], auth, isStudent, (req, res) =>
    res.status(410).json({ success: false, message: "Payment confirmation now uses webhooks. Refresh the app to check your order status." })
);

// Server-to-server; authenticates raw request bytes with HMAC instead of JWT.
router.post("/verifySignature", verifySignature);
module.exports = router;
