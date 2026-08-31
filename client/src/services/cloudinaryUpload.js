import axios from "axios"

import { apiConnector } from "./apiConnector"
import { uploadEndpoints } from "./apis"

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 100 * 1024 * 1024

export async function uploadToCloudinary(file, token, resourceType) {
  if (!(file instanceof File)) {
    throw new Error("Please select a file to upload")
  }

  const maxSize = resourceType === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
  if (file.size > maxSize) {
    const maxSizeMb = maxSize / (1024 * 1024)
    throw new Error(`File is too large. Maximum size is ${maxSizeMb} MB`)
  }

  const signatureResponse = await apiConnector(
    "POST",
    uploadEndpoints.CREATE_UPLOAD_SIGNATURE_API,
    { resourceType },
    { Authorization: `Bearer ${token}` }
  )

  if (!signatureResponse.data?.success) {
    throw new Error(
      signatureResponse.data?.message || "Could not authorize the upload"
    )
  }

  const { apiKey, cloudName, folder, signature, timestamp } =
    signatureResponse.data.data
  const uploadData = new FormData()
  uploadData.append("file", file)
  uploadData.append("api_key", apiKey)
  uploadData.append("folder", folder)
  uploadData.append("signature", signature)
  uploadData.append("timestamp", timestamp)

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    uploadData
  )

  return {
    duration: response.data.duration,
    publicId: response.data.public_id,
    resourceType: response.data.resource_type,
    secureUrl: response.data.secure_url,
    signature: response.data.signature,
    version: response.data.version,
  }
}
