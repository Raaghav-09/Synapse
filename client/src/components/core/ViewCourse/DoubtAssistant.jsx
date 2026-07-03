import React, { useEffect, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { BsChatDots, BsSend } from "react-icons/bs"

import {
  askDoubt,
  fetchChatHistory,
} from "../../../services/operations/assistantAPI"

const MAX_QUESTION_CHARS = 1000

const DoubtAssistant = ({ courseId, subSectionId }) => {
  const { token } = useSelector((state) => state.auth)

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const bottomRef = useRef(null)

  // restore the saved conversation the first time the panel is opened
  useEffect(() => {
    if (!open || historyLoaded) return
    ;(async () => {
      const history = await fetchChatHistory(token, courseId)
      setMessages(history.map((m) => ({ role: m.role, text: m.text })))
      setHistoryLoaded(true)
    })()
  }, [open, historyLoaded, token, courseId])

  // keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, open])

  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return

    setMessages((prev) => [...prev, { role: "user", text: question }])
    setInput("")
    setLoading(true)

    const result = await askDoubt(token, courseId, subSectionId, question)
    if (result) {
      setMessages((prev) => [...prev, { role: "model", text: result.answer }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="rounded-lg border border-richblack-700 bg-richblack-800">
      {/* header / toggle */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-x-2 text-lg font-semibold text-richblack-5">
          <BsChatDots className="text-yellow-50" />
          Ask a Doubt
        </span>
        <span className="text-sm text-richblack-300">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-richblack-700 p-4">
          {/* messages */}
          <div className="mb-4 flex max-h-[320px] min-h-[120px] flex-col gap-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && !loading && (
              <p className="my-auto text-center text-sm text-richblack-300">
                Ask anything about this course — I answer using the course
                content.
              </p>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "self-end bg-yellow-50 text-richblack-900"
                    : "self-start bg-richblack-700 text-richblack-5"
                }`}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="self-start rounded-lg bg-richblack-700 px-3 py-2 text-sm text-richblack-300">
                Thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="flex items-end gap-x-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_QUESTION_CHARS}
              rows={1}
              placeholder="Type your doubt and press Enter"
              className="min-h-[44px] w-full resize-none rounded-lg bg-richblack-700 p-3 text-sm text-richblack-5 outline-none placeholder:text-richblack-400"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-richblack-900 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send question"
            >
              <BsSend />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoubtAssistant
