const crypto = require("crypto")
const cloudinary = require("cloudinary").v2

const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""), "utf8")
  const rightBuffer = Buffer.from(String(right || ""), "utf8")

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  )
}

exports.verifyCloudinaryAsset = (asset, expectedResourceType) => {
  if (
    !asset ||
    !asset.secureUrl ||
    !asset.publicId ||
    !asset.version ||
    !asset.signature
  ) {
    throw new Error("Cloudinary upload details are incomplete")
  }

  if (asset.resourceType !== expectedResourceType) {
    throw new Error(`Expected a Cloudinary ${expectedResourceType} upload`)
  }

  const expectedSignature = cloudinary.utils.api_sign_request(
    { public_id: asset.publicId, version: asset.version },
    process.env.API_SECRET
  )

  if (!safeCompare(expectedSignature, asset.signature)) {
    throw new Error("Cloudinary upload signature is invalid")
  }

  const assetUrl = new URL(asset.secureUrl)
  const expectedPathPrefix = `/${process.env.CLOUD_NAME}/${expectedResourceType}/upload/`
  if (
    assetUrl.protocol !== "https:" ||
    assetUrl.hostname !== "res.cloudinary.com" ||
    !assetUrl.pathname.startsWith(expectedPathPrefix)
  ) {
    throw new Error("Cloudinary upload URL is invalid")
  }

  return {
    duration: asset.duration,
    secureUrl: asset.secureUrl,
  }
}
