import { toast } from "react-hot-toast"

import { apiConnector } from "../apiConnector"
import { assistantEndpoints } from "../apis"

const { ASK_DOUBT_API, CHAT_HISTORY_API } = assistantEndpoints

// Returns { answer, stubbed } on success, null on failure
export const askDoubt = async (token, courseId, subSectionId, question) => {
  let result = null
  try {
    const response = await apiConnector(
      "POST",
      ASK_DOUBT_API,
      { courseId, subSectionId, question },
      { Authorization: `Bearer ${token}` }
    )
    if (!response?.data?.success) {
      throw new Error(response?.data?.message)
    }
    result = { answer: response.data.answer, stubbed: response.data.stubbed }
  } catch (error) {
    console.log("ASK_DOUBT_API ERROR............", error)
    toast.error(
      error?.response?.data?.message || "The assistant is unavailable right now"
    )
  }
  return result
}

// Returns the saved conversation for this course, [] if none or on failure
export const fetchChatHistory = async (token, courseId) => {
  let result = []
  try {
    const response = await apiConnector(
      "GET",
      `${CHAT_HISTORY_API}/${courseId}`,
      null,
      { Authorization: `Bearer ${token}` }
    )
    if (!response?.data?.success) {
      throw new Error(response?.data?.message)
    }
    result = response.data.messages
  } catch (error) {
    console.log("CHAT_HISTORY_API ERROR............", error)
  }
  return result
}
