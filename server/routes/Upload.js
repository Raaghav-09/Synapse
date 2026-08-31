const express = require("express")

const { createUploadSignature } = require("../controllers/Upload")
const { auth } = require("../middlewares/auth")

const router = express.Router()

router.post("/signature", auth, createUploadSignature)

module.exports = router
