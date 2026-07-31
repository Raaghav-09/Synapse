const express = require("express") ;
const router = express.Router() ;

const { contactUsController } = require("../controllers/ContactUs") ;

// Public — visitors are not logged in when they use the contact form.
router.post("/contactus", contactUsController) ;

module.exports = router ;
