const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const path = require("node:path");

const USER = "a".repeat(24);
const OTHER = "b".repeat(24);
const COURSE = "c".repeat(24);
const SECOND = "d".repeat(24);
const SECRET = "test-webhook-secret";
const clone = (value) => value == null ? value : structuredClone(value);

function loadController(filename, mocks, env = {}) {
    const file = path.resolve(__dirname, "../controllers", filename);
    const realRequire = createRequire(file);
    const exports = {};
    vm.runInNewContext(fs.readFileSync(file, "utf8"), {
        require: (id) => Object.hasOwn(mocks, id) ? mocks[id] : realRequire(id),
        exports, Buffer, Date,
        process: { env: { RAZORPAY_WEBHOOK_SECRET: SECRET, RAZORPAY_KEY: "rzp_test_fixture", ...env } },
        console: { error() {}, warn() {}, log() {} },
    }, { filename: file });
    return exports;
}

function fixture(env = {}) {
    const state = {
        payment: null, mail: [], orderRequests: [], userCourses: [], failUserWrite: false,
        failOrderSave: false, failMail: false,
        courses: [
            { _id: COURSE, courseName: "Course 1", status: "Published", price: 499.99, studentsEnrolled: [] },
            { _id: SECOND, courseName: "Course 2", status: "Published", price: 100, studentsEnrolled: [] },
        ],
    };
    function matches(query) {
        const p = state.payment;
        return p && (!query._id || query._id === p._id) &&
            (!query.razorpayOrderId || query.razorpayOrderId === p.razorpayOrderId) &&
            (!query.user || query.user === p.user) &&
            (!query.status || p.status !== query.status.$ne) &&
            (!query.$or || p.razorpayPaymentId === undefined || p.razorpayPaymentId === query.$or[1].razorpayPaymentId);
    }
    const Payment = {
        async create(data) {
            if (state.failOrderSave) throw new Error("Order persistence failed");
            state.payment = { _id: "localPayment", status: "created", ...clone(data) };
        },
        async findOne(query) { return matches(query) ? clone(state.payment) : null; },
        async findOneAndUpdate(query, update) {
            if (!matches(query)) return null;
            Object.assign(state.payment, clone(update.$set));
            return clone(state.payment);
        },
    };
    const Course = {
        async find(query) { return clone(state.courses.filter((c) => query._id.$in.includes(c._id))); },
        async updateOne(query, update) {
            const course = state.courses.find((c) => c._id === query._id);
            if (!course) return { matchedCount: 0 };
            if (!course.studentsEnrolled.includes(update.$addToSet.studentsEnrolled)) {
                course.studentsEnrolled.push(update.$addToSet.studentsEnrolled);
            }
            return { matchedCount: 1 };
        },
    };
    const User = {
        async findById() { return { firstName: "Test", lastName: "Student", email: "test@example.invalid" }; },
        async updateOne(query, update) {
            if (state.failUserWrite) throw new Error("Simulated database outage");
            state.userCourses = [...new Set([...state.userCourses, ...update.$addToSet.courses.$each])];
            return { matchedCount: 1 };
        },
    };
    const controller = loadController("Payments.js", {
        "../config/razorpay": { instance: { orders: { async create(options) {
            state.orderRequests.push(clone(options));
            return { id: "order_fixture", amount: options.amount, currency: options.currency };
        } } } },
        "../models/Payment": Payment, "../models/Course": Course, "../models/User": User,
        "../utils/mailSender": async (...args) => {
            if (state.failMail) throw new Error("SMTP unavailable");
            state.mail.push(args);
        },
    }, env);
    return { controller, state };
}

function response() {
    return {
        statusCode: 200, headers: {},
        status(code) { this.statusCode = code; return this; },
        set(key, value) { this.headers[key] = value; return this; },
        json(body) { this.body = body; return this; },
    };
}
async function create(f, courses = [COURSE]) {
    const res = response();
    await f.controller.createOrder({ body: { courses }, user: { id: USER } }, res);
    return res;
}
function webhook(overrides = {}, event = "payment.captured") {
    const body = { event, payload: { payment: { entity: {
        id: "pay_fixture", order_id: "order_fixture", amount: 49999,
        currency: "INR", status: "captured", captured: true, ...overrides,
    } } } };
    const rawBody = Buffer.from(JSON.stringify(body, null, 2));
    const signature = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
    return { body, rawBody, headers: { "x-razorpay-signature": signature, "x-razorpay-event-id": "event_fixture" } };
}
async function deliver(f, req = webhook()) {
    const res = response();
    await f.controller.verifySignature(req, res);
    return res;
}

test("order uses database prices, deduplicates IDs, saves mapping and returns the backend public key", async () => {
    const f = fixture();
    const res = await create(f, [COURSE, COURSE, SECOND]);
    assert.equal(res.statusCode, 200);
    assert.equal(f.state.orderRequests[0].amount, 59999);
    assert.equal(f.state.orderRequests[0].partial_payment, false);
    assert.deepEqual(f.state.payment.courses, [COURSE, SECOND]);
    assert.equal(f.state.payment.user, USER);
    assert.equal(f.state.payment.status, "created");
    assert.equal(res.body.data.keyId, "rzp_test_fixture");
    assert.equal(f.state.mail.length, 0);
    assert.deepEqual(f.state.userCourses, []);
});

for (const [name, courses, prepare, status] of [
    ["empty", [], () => {}, 400],
    ["invalid ID", ["bad"], () => {}, 400],
    ["object injection", [{ $ne: null }], () => {}, 400],
    ["missing course", [OTHER], () => {}, 404],
    ["draft course", [COURSE], (s) => { s.courses[0].status = "Draft"; }, 400],
    ["already enrolled", [COURSE], (s) => { s.courses[0].studentsEnrolled.push(USER); }, 400],
    ["invalid price", [COURSE], (s) => { s.courses[0].price = NaN; }, 400],
]) test(`rejects ${name} before contacting Razorpay`, async () => {
    const f = fixture(); prepare(f.state);
    assert.equal((await create(f, courses)).statusCode, status);
    assert.equal(f.state.orderRequests.length, 0);
});

test("signed captured payment enrolls saved buyer/courses, disregarding forged notes", async () => {
    const f = fixture(); await create(f);
    const req = webhook({ notes: { userId: OTHER, courses: JSON.stringify([SECOND]) } });
    assert.equal((await deliver(f, req)).statusCode, 200);
    assert.deepEqual(f.state.userCourses, [COURSE]);
    assert.deepEqual(f.state.courses[0].studentsEnrolled, [USER]);
    assert.deepEqual(f.state.courses[1].studentsEnrolled, []);
    assert.equal(f.state.payment.razorpayPaymentId, "pay_fixture");
    assert.equal(f.state.payment.status, "fulfilled");
    assert.equal(f.state.mail.length, 2);
});

test("invalid, missing, wrong-length and mutated-body signatures cannot enroll", async () => {
    for (const variant of ["missing", "short", "wrong", "mutated", "rawMissing"]) {
        const f = fixture(); await create(f);
        const req = webhook();
        if (variant === "missing") delete req.headers["x-razorpay-signature"];
        if (variant === "short") req.headers["x-razorpay-signature"] = "aa";
        if (variant === "wrong") req.headers["x-razorpay-signature"] = "0".repeat(64);
        if (variant === "mutated") req.rawBody = Buffer.concat([req.rawBody, Buffer.from(" ")]);
        if (variant === "rawMissing") delete req.rawBody;
        assert.equal((await deliver(f, req)).statusCode, 400, variant);
        assert.deepEqual(f.state.userCourses, []);
        assert.equal(f.state.mail.length, 0);
    }
});

for (const [name, changes] of [
    ["amount", { amount: 100 }], ["currency", { currency: "USD" }],
    ["uncaptured", { captured: false }], ["authorized", { status: "authorized" }],
    ["missing payment ID", { id: undefined }],
]) test(`rejects signed payment with mismatched ${name}`, async () => {
    const f = fixture(); await create(f);
    assert.equal((await deliver(f, webhook(changes))).statusCode, 400);
    assert.deepEqual(f.state.userCourses, []);
});

test("unknown signed orders are ignored; no enrollment from notes", async () => {
    const f = fixture();
    assert.equal((await deliver(f)).statusCode, 200);
    assert.deepEqual(f.state.userCourses, []);
});

test("authorization events do not fulfill; order.paid with captured payment does", async () => {
    const f = fixture(); await create(f);
    assert.equal((await deliver(f, webhook({}, "payment.authorized"))).statusCode, 200);
    assert.equal(f.state.payment.status, "created");
    assert.equal((await deliver(f, webhook({}, "order.paid"))).statusCode, 200);
    assert.equal(f.state.payment.status, "fulfilled");
});

test("duplicate and concurrent webhook events fulfill once and attempt emails once", async () => {
    const f = fixture(); await create(f);
    const results = await Promise.all([deliver(f), deliver(f), deliver(f, webhook({}, "order.paid"))]);
    results.forEach((res) => assert.equal(res.statusCode, 200));
    await deliver(f);
    assert.equal(f.state.payment.status, "fulfilled");
    assert.deepEqual(f.state.userCourses, [COURSE]);
    assert.deepEqual(f.state.courses[0].studentsEnrolled, [USER]);
    assert.equal(f.state.mail.length, 2);
});

test("a partial write returns 500; retry repairs enrollment and sends emails only after success", async () => {
    const f = fixture(); await create(f);
    f.state.failUserWrite = true;
    assert.equal((await deliver(f)).statusCode, 500);
    assert.equal(f.state.payment.status, "paid");
    assert.equal(f.state.mail.length, 0);
    f.state.failUserWrite = false;
    assert.equal((await deliver(f)).statusCode, 200);
    assert.equal(f.state.payment.status, "fulfilled");
    assert.deepEqual(f.state.courses[0].studentsEnrolled, [USER]);
    assert.deepEqual(f.state.userCourses, [COURSE]);
    assert.equal(f.state.mail.length, 2);
});

test("a second payment ID cannot take over an already fulfilled order", async () => {
    const f = fixture(); await create(f); await deliver(f);
    assert.equal((await deliver(f, webhook({ id: "pay_other" }))).statusCode, 400);
    assert.equal(f.state.payment.razorpayPaymentId, "pay_fixture");
});

test("status is owner-only, read-only, and never fulfills an order", async () => {
    const f = fixture(); await create(f);
    const req = { params: { orderId: "order_fixture" }, user: { id: USER } };
    const own = response(); await f.controller.getOrderStatus(req, own);
    assert.equal(own.body.data.status, "created");
    assert.equal(own.headers["Cache-Control"], "no-store");
    const other = response(); await f.controller.getOrderStatus({ ...req, user: { id: OTHER } }, other);
    assert.equal(other.statusCode, 404);
    assert.deepEqual(f.state.userCourses, []);
});

test("missing webhook configuration rejects orders before the customer can pay", async () => {
    const f = fixture({ RAZORPAY_WEBHOOK_SECRET: "" });
    assert.equal((await create(f)).statusCode, 503);
    assert.equal(f.state.orderRequests.length, 0);
    assert.equal((await deliver(f)).statusCode, 503);
});

test("a failed local order save never returns the Razorpay order to Checkout", async () => {
    const f = fixture();
    f.state.failOrderSave = true;
    const res = await create(f);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.data, undefined);
    assert.equal(f.state.payment, null);
});

test("mail failure cannot undo access or fail a successfully fulfilled webhook", async () => {
    const f = fixture(); await create(f);
    f.state.failMail = true;
    assert.equal((await deliver(f)).statusCode, 200);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.state.payment.status, "fulfilled");
    assert.deepEqual(f.state.userCourses, [COURSE]);
});

test("public course preview excludes video URLs from populated lectures", async () => {
    const populations = [];
    const query = {
        populate(value) { populations.push(value); return this; },
        async exec() { return { _id: COURSE }; },
    };
    const controller = loadController("Course.js", {
        "../models/Course": { findOne() { return query; } },
        "../models/Category": {}, "../models/User": {},
        "../models/CourseProgress": {}, "../utils/cloudinaryAsset": {},
    });
    const res = response();
    await controller.getCourseDetails({ body: { courseId: COURSE } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(populations.some((p) => p.path === "courseContent" && p.populate.select === "-videoUrl"));
});

test("payment schema enforces unique order and sparse unique payment IDs", () => {
    const model = require("../models/Payment");
    const indexes = model.schema.indexes();
    assert.ok(indexes.some(([keys, options]) => keys.razorpayOrderId === 1 && options.unique));
    assert.ok(indexes.some(([keys, options]) => keys.razorpayPaymentId === 1 && options.unique && options.sparse));
});

for (const [name, enrolled, owner, role, expected] of [
    ["unpaid student", false, false, "Student", 403],
    ["enrolled student", true, false, "Student", 200],
    ["course owner", false, true, "Instructor", 200],
    ["administrator", false, false, "Admin", 200],
]) test(`lesson access: ${name}`, async () => {
    const course = { studentsEnrolled: enrolled ? [USER] : [], instructor: { _id: owner ? USER : OTHER } };
    const query = { populate() { return this; }, async exec() { return course; } };
    const controller = loadController("Course.js", {
        "../models/Course": { findOne() { return query; } },
        "../models/Category": {}, "../models/User": {},
        "../models/CourseProgress": { async findOne() { return null; } },
        "../utils/cloudinaryAsset": {},
    });
    const res = response();
    await controller.getFullCourseDetails({ body: { courseId: COURSE }, user: { id: USER, accountType: role } }, res);
    assert.equal(res.statusCode, expected);
});
