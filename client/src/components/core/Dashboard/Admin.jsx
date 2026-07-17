import { useEffect, useState } from "react"
import { useSelector } from "react-redux"

import { createCategory } from "../../../services/operations/adminAPI"
import { fetchCourseCategories } from "../../../services/operations/courseDetailsAPI"

export default function Admin() {
  const { token } = useSelector((state) => state.auth)
  const { user } = useSelector((state) => state.profile)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState([])
  const [formData, setFormData] = useState({ name: "", description: "" })

  const loadCategories = async () => {
    setLoading(true)
    const result = await fetchCourseCategories()
    setCategories(result || [])
    setLoading(false)
  }

  useEffect(() => {
    loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOnChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleOnSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    setSubmitting(true)
    await createCategory(formData, token)
    setFormData({ name: "", description: "" })
    await loadCategories()
    setSubmitting(false)
  }

  return (
    <div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-richblack-5">
          Hi {user?.firstName} 👋
        </h1>
        <p className="font-medium text-richblack-200">
          Manage course categories so instructors can start publishing courses
        </p>
      </div>

      <div className="my-6 flex flex-col gap-y-6 lg:flex-row lg:gap-x-6">
        {/* Create Category */}
        <form
          onSubmit={handleOnSubmit}
          className="flex min-w-[300px] flex-col gap-y-4 rounded-md bg-richblack-800 p-6 lg:w-1/3"
        >
          <p className="text-lg font-bold text-richblack-5">
            Create Category
          </p>
          <label>
            <p className="mb-1 text-[0.875rem] text-richblack-5">
              Category Name <sup className="text-pink-200">*</sup>
            </p>
            <input
              required
              type="text"
              name="name"
              value={formData.name}
              onChange={handleOnChange}
              placeholder="e.g. Web Development"
              className="form-style w-full"
            />
          </label>
          <label>
            <p className="mb-1 text-[0.875rem] text-richblack-5">
              Description
            </p>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleOnChange}
              placeholder="Short description shown on the catalog"
              className="form-style min-h-[120px] w-full resize-none"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-[8px] bg-yellow-50 py-[8px] px-[12px] font-medium text-richblack-900 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Category"}
          </button>
        </form>

        {/* Existing Categories */}
        <div className="flex-1 rounded-md bg-richblack-800 p-6">
          <p className="text-lg font-bold text-richblack-5">
            Existing Categories
          </p>
          {loading ? (
            <div className="spinner"></div>
          ) : categories.length > 0 ? (
            <div className="mt-4 flex flex-col gap-y-3">
              {categories.map((category) => (
                <div
                  key={category._id}
                  className="rounded-md border border-richblack-700 p-4"
                >
                  <p className="font-semibold text-richblack-5">
                    {category.name}
                  </p>
                  {category.description && (
                    <p className="mt-1 text-sm text-richblack-300">
                      {category.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-richblack-400">
                    {category.courses?.length || 0} published course(s)
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-richblack-300">
              No categories yet. Create the first one so instructors can
              assign courses to it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
