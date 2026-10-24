# Razorpay payment setup

The backend creates the Razorpay order, saves its buyer/course/amount mapping in MongoDB, and returns the order ID to Checkout. Only a verified captured-payment webhook grants access. The browser only reads the authenticated order status. Receipt and enrollment emails are attempted after fulfillment, never from client-supplied payment details.

## Required configuration

1. Set `RAZORPAY_KEY` and `RAZORPAY_SECRET` on the backend using keys from the same Razorpay account and mode. Checkout receives the public key ID from this backend, so a separate frontend payment key is no longer needed.
2. Deploy the backend to a public HTTPS URL. A plain localhost URL cannot receive Razorpay webhooks. For development, use a public staging backend or a tunnel allowed by Razorpay.
3. In Razorpay Dashboard → Accounts & Settings → Webhooks, register `https://<your-backend>/api/v1/payment/verifySignature`. Enable `payment.captured`. `order.paid` is also supported; enabling both does not duplicate membership or email attempts.
4. Choose a webhook secret in the dashboard and set the identical value as `RAZORPAY_WEBHOOK_SECRET` on the backend. This is a separate value from the API key secret. Do not put either secret in frontend configuration.
5. Enable automatic payment capture in the Razorpay dashboard. Authorization alone does not grant access: this integration requires a captured payment.
6. Restart/redeploy the backend and deploy the updated frontend together. Confirm MongoDB is available and the `Payment` model's unique order/payment indexes exist; Mongoose creates them when automatic indexing is enabled. In environments with automatic indexing disabled, provision them through your normal database migration process before accepting purchases.

New orders are refused if the webhook secret is missing. A configured secret alone cannot prove that the URL/subscription/capture settings are correct; test a complete checkout before accepting real payments.

## Confirm the flow in Test mode

1. Sign in as a Student and buy a published course. Verify that the returned `order_...` appears in Razorpay Dashboard → Transactions → Orders in the same Test/Live mode as the API keys. Creating an order does not mean it has been paid.
2. Complete a test payment. The frontend opens `/dashboard/payment/<order_id>` and waits for the backend's saved status. It shows access ready only after webhook fulfillment.
3. Confirm a successful webhook delivery in the dashboard. The server checks `x-razorpay-signature` against the exact raw bytes using HMAC-SHA256 and `RAZORPAY_WEBHOOK_SECRET`, then verifies captured state, amount, currency, and order ID against the saved purchase. The payment ID comes from `payload.payment.entity.id`.
4. Confirm the `Payment` document is `fulfilled`, with the payment ID and fulfillment time, and that both `Course.studentsEnrolled` and `User.courses` contain the membership.
5. Replay the event. Membership entries and receipt/enrollment email attempts should not duplicate. Also test paying and closing the browser; the webhook still enrolls the student.
6. Try opening full lesson details as an unenrolled account: the endpoint should return 403. Public course previews omit `videoUrl`.

## Endpoints (prefix `/api/v1`)

- `POST /payment/createOrder`: Student JWT required; accepts course IDs. Prices come from the database. Repeated course IDs are counted once; unpublished, missing, already-enrolled, or invalid-price courses are rejected.
- `POST /payment/capturePayment`: compatibility alias for order creation. It does not capture a payment.
- `GET /payment/orders/:orderId`: Student JWT and order ownership required. Returns `created`, `paid` (verified webhook, fulfillment in progress), or `fulfilled`.
- `POST /payment/verifySignature`: webhook HMAC authentication; handles `payment.captured` and `order.paid`. Unknown orders belonging to other integrations are acknowledged and ignored. Invalid signatures or mismatched payments cannot enroll anyone.
- Old `POST /payment/verifyPayment` and `/payment/sendPaymentSuccessEmail`: return 410; browsers cannot grant access or send payment receipts.

## Retry and operational behavior

- Membership writes use `$addToSet`. If a database write fails halfway through fulfillment, the webhook returns 500 and a retry can repair the missing writes. The order is marked fulfilled only after all membership writes succeed. The writes are not a MongoDB transaction; partial memberships can exist during retries, after a verified payment.
- Concurrent events cannot move a fulfilled order back to paid. An atomic completion update claims the email attempt once. SMTP is best effort; access remains granted if mail delivery fails. There is no durable email retry queue, and a crash after fulfillment can lose an email.
- A status-page timeout means confirmation is pending, not that the charge failed. The page offers “Check again”; it can be bookmarked/reloaded. Fulfillment continues on the server after the browser closes. Do not ask a paid customer to pay again just because the webhook is delayed.
- Monitor webhook errors and paid-but-unfulfilled orders. If retries are exhausted, repair the underlying issue and replay the signed event from Razorpay. Do not fulfill using an unsigned browser request.
- Existing enrollments remain intact. Orders created before this change have no saved `Payment` mapping and cannot be automatically fulfilled by the new handler. Resolve any in-flight old checkout before rollout, or reconcile it manually against Razorpay; do not infer entitlements from untrusted client course IDs.
- This change does not implement refunds or revoke course access after refunds. Media files use existing Cloudinary delivery URLs; hiding them in public API responses does not turn previously shared URLs into signed/private media.

## Automated checks

Run `npm test` in `server` for signed webhook, spoofing, ownership, amount/currency, duplicate/concurrent delivery, and partial retry checks. Run `CI=true npm test -- --watchAll=false --runInBand` and `npm run build` in `client` for the frontend checks/build. These use simulated gateway/database behavior and do not replace a full Razorpay Test mode checkout against the registered public URL.

Official references: [orders in the dashboard](https://razorpay.com/docs/payments/orders/dashboard/), [webhook verification](https://razorpay.com/docs/webhooks/validate-test/), [Checkout and capture setup](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).
