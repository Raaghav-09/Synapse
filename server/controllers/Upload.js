const cloudinary = require("cloudinary").v2

const ALLOWED_RESOURCE_TYPES = new Set(["image", "video"])

exports.createUploadSignature = async (req, res) => {
  try {
    const resourceType = req.body.resourceType || "image"

    if (!ALLOWED_RESOURCE_TYPES.has(resourceType)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported upload resource type",
      })
    }

    if (resourceType === "video" && req.user.accountType !== "Instructor") {
      return res.status(403).json({
        success: false,
        message: "Only instructors can upload videos",
      })
    }

    const { CLOUD_NAME, API_KEY, API_SECRET, FOLDER_NAME } = process.env
    if (!CLOUD_NAME || !API_KEY || !API_SECRET || !FOLDER_NAME) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary is not configured",
      })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const folder = `${FOLDER_NAME}/${resourceType === "video" ? "videos" : "images"}`
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
      API_SECRET
    )

    return res.status(200).json({
      success: true,
      data: {
        apiKey: API_KEY,
        cloudName: CLOUD_NAME,
        folder,
        resourceType,
        signature,
        timestamp,
      },
    })
  } catch (error) {
    console.error("CREATE UPLOAD SIGNATURE ERROR:", error)
    return res.status(500).json({
      success: false,
      message: "Could not authorize the upload",
    })
  }
}
