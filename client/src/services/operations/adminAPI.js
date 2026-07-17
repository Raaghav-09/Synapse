import { toast } from "react-hot-toast"

import { adminEndpoints } from "../apis"
import { apiConnector } from "../apiConnector"

const { CREATE_CATEGORY_API } = adminEndpoints

export const createCategory = async (data, token) => {
  let result = null
  const toastId = toast.loading("Loading...")
  try {
    const response = await apiConnector("POST", CREATE_CATEGORY_API, data, {
      Authorization: `Bearer ${token}`,
    })
    console.log("CREATE CATEGORY API RESPONSE............", response)
    if (!response?.data?.success) {
      throw new Error(response?.data?.message || "Could Not Create Category")
    }
    toast.success("Category Created Successfully")
    result = response?.data?.data
  } catch (error) {
    console.log("CREATE CATEGORY API ERROR............", error)
    toast.error(error.response?.data?.message || error.message)
  }
  toast.dismiss(toastId)
  return result
}
