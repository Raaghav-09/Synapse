const crypto = require("crypto");
const mongoose = require("mongoose");

const { instance } = require("../config/razorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");

// Compare two secrets without leaking information through timing.
const safeCompare = (a = "", b = "") => {
    const bufA = Buffer.from(String(a), "utf8");
    const bufB = Buffer.from(String(b), "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

// Enroll one student into a list of courses.
// $addToSet (not $push) keeps this idempotent, so a retried or duplicated
// request cannot enroll the same student twice.
const enrollStudents = async (courses, userId) => {
    for (const courseId of courses) {
        const enrolledCourse = await Course.findOneAndUpdate(
            { _id: courseId },
            { $addToSet: { studentsEnrolled: userId } },
            { new: true }
        );
        if (!enrolledCourse) {
            throw new Error(`Course not found: ${courseId}`);
        }

        const enrolledStudent = await User.findByIdAndUpdate(
            userId,
            { $addToSet: { courses: courseId } },
            { new: true }
        );

        // The student has already paid at this point, so a mail failure must
        // never fail the enrollment — log it and carry on.
        try {
            await mailSender(
                enrolledStudent.email,
                `Successfully Enrolled into ${enrolledCourse.courseName}`,
                courseEnrollmentEmail(
                    enrolledCourse.courseName,
                    `${enrolledStudent.firstName} ${enrolledStudent.lastName}`
                )
            );
        } catch (error) {
            console.error("ENROLLMENT EMAIL FAILED:", error.message);
        }
    }
};

// ---------------- POST /payment/capturePayment ----------------
// Creates a single Razorpay order covering every course in the cart.
exports.capturePayment = async (req, res) => {
    try {
        const { courses } = req.body;
        const userId = req.user.id;

        if (!Array.isArray(courses) || courses.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide at least one course to buy",
            });
        }

        let totalAmount = 0;

        for (const course_id of courses) {
            if (!mongoose.isValidObjectId(course_id)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid course id: ${course_id}`,
                });
            }

            const course = await Course.findById(course_id);
            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: "Could not find the course",
                });
            }

            if (course.studentsEnrolled.some((id) => id.toString() === userId)) {
                return res.status(400).json({
                    success: false,
                    message: "Student is already enrolled in one of these courses",
                });
            }

            totalAmount += course.price;
        }

        const options = {
            // Razorpay works in the smallest currency unit (paise), which also
            // keeps money as an integer instead of a float.
            amount: Math.round(totalAmount * 100),
            currency: "INR",
            receipt: crypto.randomUUID(),
        };

        const paymentResponse = await instance.orders.create(options);

        // The client reads response.data.data.{id,amount,currency}
        return res.status(200).json({
            success: true,
            data: paymentResponse,
        });
    } catch (error) {
        console.error("CAPTURE PAYMENT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not initiate order",
        });
    }
};

// ---------------- POST /payment/verifyPayment ----------------
// Verifies the signature Razorpay Checkout hands back to the browser, then
// fulfils the enrollment. The browser cannot forge this signature, because
// only Razorpay and this server know RAZORPAY_SECRET.
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            courses,
        } = req.body;
        const userId = req.user.id;

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature ||
            !Array.isArray(courses) ||
            courses.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment details are incomplete",
            });
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (!safeCompare(expectedSignature, razorpay_signature)) {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed",
            });
        }

        await enrollStudents(courses, userId);

        return res.status(200).json({
            success: true,
            message: "Payment Verified",
        });
    } catch (error) {
        console.error("VERIFY PAYMENT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not verify payment",
        });
    }
};

// ---------------- POST /payment/sendPaymentSuccessEmail ----------------
exports.sendPaymentSuccessEmail = async (req, res) => {
    try {
        const { orderId, paymentId, amount } = req.body;
        const userId = req.user.id;

        if (!orderId || !paymentId || !amount) {
            return res.status(400).json({
                success: false,
                message: "Please provide all the payment details",
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        await mailSender(
            user.email,
            "Payment Received",
            paymentSuccessEmail(
                `${user.firstName} ${user.lastName}`,
                // the client forwards the order amount in paise
                amount / 100,
                orderId,
                paymentId
            )
        );

        return res.status(200).json({
            success: true,
            message: "Payment confirmation email sent",
        });
    } catch (error) {
        console.error("PAYMENT SUCCESS EMAIL ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Could not send payment confirmation email",
        });
    }
};

// ---------------- POST /payment/verifySignature (webhook) ----------------
// Secondary, authoritative fulfilment path. The browser callback above gives
// the user instant feedback, but it never fires if they close the tab after
// paying — Razorpay's server-to-server webhook does, and it is retried.
exports.verifySignature = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
            return res.status(500).json({
                success: false,
                message: "Webhook is not configured",
            });
        }

        const signature = req.headers["x-razorpay-signature"];

        // HMAC must be computed over the exact bytes Razorpay signed, not over
        // a re-serialized body — key order and spacing would differ.
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        const digest = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

        if (!safeCompare(digest, signature)) {
            return res.status(400).json({
                success: false,
                message: "Invalid signature",
            });
        }

        const notes = req.body?.payload?.payment?.entity?.notes || {};
        const { courseId, userId } = notes;

        if (!courseId || !userId) {
            // Acknowledge so Razorpay stops retrying an event we cannot action.
            return res.status(200).json({
                success: true,
                message: "Event ignored (no enrollment notes)",
            });
        }

        await enrollStudents([courseId], userId);

        return res.status(200).json({
            success: true,
            message: "Signature verified and course added",
        });
    } catch (error) {
        console.error("WEBHOOK ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Webhook processing failed",
        });
    }
};
