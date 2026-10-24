const mongoose = require("mongoose");

// Server-owned mapping: never accept course entitlements from Checkout input.
const paymentSchema = new mongoose.Schema({
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true }],
    amount: { type: Number, required: true, min: 100 }, // integer paise
    currency: { type: String, required: true, default: "INR" },
    receipt: { type: String, required: true },
    status: { type: String, enum: ["created", "paid", "fulfilled"], default: "created" },
    fulfilledAt: Date,
    webhookEventId: String,
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
