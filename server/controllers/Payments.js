const crypto = require("crypto");
const mongoose = require("mongoose");
const { instance } = require("../config/razorpay");
const Payment = require("../models/Payment");
const Course = require("../models/Course");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");

const safeCompare = (expected, received) => {
    if (typeof received !== "string" || !/^[a-f0-9]{64}$/i.test(received)) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
};

// Only the webhook calls this helper. Replaying partial fulfillment repairs
// missing memberships. A single atomic completion transition claims emails.
const fulfillPayment = async (payment, entity, eventId) => {
    if (payment.status === "fulfilled") return;
    const claimed = await Payment.findOneAndUpdate({
        _id: payment._id,
        status: { $ne: "fulfilled" },
        $or: [
            { razorpayPaymentId: { $exists: false } },
            { razorpayPaymentId: entity.id },
        ],
    }, { $set: { razorpayPaymentId: entity.id, status: "paid" } }, { new: true });
    // Another delivery may have completed while this one was reading.
    if (!claimed) {
        const latest = await Payment.findOne({ _id: payment._id });
        if (latest?.status === "fulfilled" && latest.razorpayPaymentId === entity.id) return;
        throw new Error("Order is already linked to a different payment");
    }

    const student = await User.findById(payment.user);
    const courses = await Course.find({ _id: { $in: payment.courses } });
    if (!student || courses.length !== payment.courses.length) {
        throw new Error("Paid order references a missing student or course");
    }
    for (const courseId of payment.courses) {
        const result = await Course.updateOne(
            { _id: courseId }, { $addToSet: { studentsEnrolled: payment.user } }
        );
        if (result.matchedCount !== 1) throw new Error("Course disappeared during fulfillment");
    }
    const result = await User.updateOne(
        { _id: payment.user }, { $addToSet: { courses: { $each: payment.courses } } }
    );
    if (result.matchedCount !== 1) throw new Error("Student disappeared during fulfillment");
    const completed = await Payment.findOneAndUpdate(
        { _id: payment._id, status: { $ne: "fulfilled" } },
        { $set: { status: "fulfilled", fulfilledAt: new Date(), webhookEventId: eventId } },
        { new: true }
    );
    if (!completed) return;

    // Best effort, after access is granted. Duplicates cannot send more emails.
    // A process crash here may lose an email, never the enrollment.
    const name = `${student.firstName} ${student.lastName}`;
    const messages = [
        ["Payment Received", paymentSuccessEmail(name, payment.amount / 100,
            payment.razorpayOrderId, entity.id)],
        ...courses.map((course) => [
            `Successfully Enrolled into ${course.courseName}`,
            courseEnrollmentEmail(course.courseName, name),
        ]),
    ];
    return { email: student.email, messages };
};

exports.createOrder = async (req, res) => {
    try {
        if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
            return res.status(503).json({ success: false, message: "Payments are unavailable until the payment webhook is configured" });
        }
        const { courses } = req.body;
        if (!Array.isArray(courses) || courses.length === 0 || courses.length > 50 ||
            courses.some((id) => typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id) || !mongoose.isValidObjectId(id))) {
            return res.status(400).json({ success: false, message: "Provide between 1 and 50 valid course IDs" });
        }
        const courseIds = [...new Set(courses.map((id) => id.toLowerCase()))];
        const selected = await Course.find({ _id: { $in: courseIds } });
        if (selected.length !== courseIds.length) {
            return res.status(404).json({ success: false, message: "One or more courses were not found" });
        }
        let amount = 0;
        for (const course of selected) {
            if (course.status !== "Published") {
                return res.status(400).json({ success: false, message: "Only published courses can be purchased" });
            }
            if (course.studentsEnrolled.some((id) => id.toString() === req.user.id)) {
                return res.status(400).json({ success: false, message: "You are already enrolled in one of these courses" });
            }
            const paise = Math.round(course.price * 100);
            if (!Number.isFinite(course.price) || !Number.isSafeInteger(paise) || paise < 100) {
                return res.status(400).json({ success: false, message: "A course has an invalid price" });
            }
            amount += paise;
        }
        if (!Number.isSafeInteger(amount)) {
            return res.status(400).json({ success: false, message: "Invalid order total" });
        }
        const receipt = crypto.randomUUID();
        const order = await instance.orders.create({
            amount, currency: "INR", receipt, partial_payment: false,
            notes: { userId: req.user.id },
        });
        // Expose an order to Checkout only after its mapping is durable.
        // Notes are informational; they never authorize enrollment.
        if (!order.id || order.amount !== amount || order.currency !== "INR") {
            throw new Error("Unexpected Razorpay order response");
        }
        await Payment.create({
            razorpayOrderId: order.id, user: req.user.id, courses: courseIds,
            amount, currency: "INR", receipt,
        });
        return res.status(200).json({
            success: true,
            data: { id: order.id, amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY },
        });
    } catch (error) {
        console.error("CREATE PAYMENT ORDER ERROR:", error.message);
        return res.status(500).json({ success: false, message: "Could not create payment order. Please try again." });
    }
};

// Read only: the browser callback cannot grant access.
exports.getOrderStatus = async (req, res) => {
    try {
        if (!/^order_[a-zA-Z0-9]+$/.test(req.params.orderId)) {
            return res.status(400).json({ success: false, message: "Invalid order ID" });
        }
        const payment = await Payment.findOne({ razorpayOrderId: req.params.orderId, user: req.user.id });
        if (!payment) return res.status(404).json({ success: false, message: "Order not found" });
        res.set("Cache-Control", "no-store");
        return res.status(200).json({ success: true, data: {
            orderId: payment.razorpayOrderId, status: payment.status,
            courses: payment.courses, paymentId: payment.razorpayPaymentId,
        } });
    } catch (error) {
        console.error("PAYMENT STATUS ERROR:", error.message);
        return res.status(500).json({ success: false, message: "Could not fetch payment status" });
    }
};

exports.verifySignature = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) return res.status(503).json({ success: false, message: "Webhook is not configured" });
        if (!Buffer.isBuffer(req.rawBody)) {
            return res.status(400).json({ success: false, message: "Raw webhook body is required" });
        }
        const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
        if (!safeCompare(expected, req.headers["x-razorpay-signature"])) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }
        if (!["payment.captured", "order.paid"].includes(req.body?.event)) {
            return res.status(200).json({ success: true, message: "Event ignored" });
        }
        const entity = req.body?.payload?.payment?.entity;
        if (!entity || typeof entity.id !== "string" || !/^pay_[a-zA-Z0-9]+$/.test(entity.id) ||
            typeof entity.order_id !== "string" || entity.status !== "captured" || entity.captured !== true) {
            return res.status(400).json({ success: false, message: "A captured payment with an order ID is required" });
        }
        const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
        if (!payment) {
            console.warn("Webhook received for an unknown order:", entity.order_id);
            return res.status(200).json({ success: true, message: "Unknown order ignored" });
        }
        if (entity.amount !== payment.amount || entity.currency !== payment.currency ||
            (payment.razorpayPaymentId && payment.razorpayPaymentId !== entity.id)) {
            return res.status(400).json({ success: false, message: "Payment does not match the saved order" });
        }
        const notification = await fulfillPayment(payment, entity, req.headers["x-razorpay-event-id"]);
        res.status(200).json({ success: true, message: "Payment confirmed and access granted" });
        // Acknowledge durable fulfillment before SMTP work. A slow mail server
        // must not cause Razorpay to time out an otherwise completed webhook.
        if (notification) {
            void Promise.allSettled(notification.messages.map(([title, body]) =>
                Promise.resolve().then(() => mailSender(notification.email, title, body))
            ));
        }
        return res;
    } catch (error) {
        // Non-2xx lets Razorpay retry partial fulfillment safely.
        console.error("PAYMENT WEBHOOK ERROR:", error.message);
        return res.status(500).json({ success: false, message: "Webhook processing failed; retry required" });
    }
};
