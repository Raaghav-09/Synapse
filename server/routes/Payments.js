// Import the required modules
const express = require("express") ;
const router = express.Router() ;

const {
  capturePayment ,
  verifyPayment ,
  sendPaymentSuccessEmail ,
  verifySignature ,
} = require("../controllers/Payments") ;
const { auth, isStudent } = require("../middlewares/auth") ;

router.post("/capturePayment", auth, isStudent, capturePayment) ;
router.post("/verifyPayment", auth, isStudent, verifyPayment) ;
router.post("/sendPaymentSuccessEmail", auth, isStudent, sendPaymentSuccessEmail) ;

// Webhook — called by Razorpay server-to-server, so no auth middleware.
// It authenticates itself with an HMAC signature instead.
router.post("/verifySignature", verifySignature) ;

module.exports = router ;
