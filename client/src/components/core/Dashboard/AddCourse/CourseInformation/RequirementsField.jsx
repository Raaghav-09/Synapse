import { useEffect, useState } from "react"
import { useSelector } from "react-redux"

export default function RequirementsField({
  name,
  label,
  register,
  setValue,
  errors,
  getValues,
}) {
  const { editCourse, course } = useSelector((state) => state.course)
  const [requirement, setRequirement] = useState("")
  const [requirementsList, setRequirementsList] = useState([])

  useEffect(() => {
    const initialList =
      editCourse && Array.isArray(course?.instructions) ? course.instructions : []
    setRequirementsList(initialList)
    register(name, {
      required: true,
      validate: (value) => Array.isArray(value) && value.length > 0,
    })
    setValue(name, initialList)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // shouldValidate clears the "required" error as soon as an item is added,
  // rather than leaving it on screen until the next submit attempt.
  const commitList = (newList) => {
    setRequirementsList(newList)
    setValue(name, newList, { shouldValidate: true })
  }

  const handleAddRequirement = () => {
    const value = requirement.trim()
    if (value && !requirementsList.includes(value)) {
      commitList([...requirementsList, value])
    }
    setRequirement("")
  }

  const handleRemoveRequirement = (index) => {
    commitList(requirementsList.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm text-richblack-5" htmlFor={name}>
        {label} <sup className="text-pink-200">*</sup>
      </label>
      <div className="flex flex-col items-start space-y-2">
        <input
          type="text"
          id={name}
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAddRequirement()
            }
          }}
          onBlur={handleAddRequirement}
          className="form-style w-full"
        />
        <button
          type="button"
          onClick={handleAddRequirement}
          className="font-semibold text-yellow-50"
        >
          Add
        </button>
      </div>
      {requirementsList.length > 0 && (
        <ul className="mt-2 list-inside list-disc">
          {requirementsList.map((requirement, index) => (
            <li key={index} className="flex items-center text-richblack-5">
              <span>{requirement}</span>
              <button
                type="button"
                className="ml-2 text-xs text-pure-greys-300 "
                onClick={() => handleRemoveRequirement(index)}
              >
                clear
              </button>
            </li>
          ))}
        </ul>
      )}
      {errors[name] && (
        <span className="ml-2 text-xs tracking-wide text-pink-200">
          {label} is required
        </span>
      )}
    </div>
  )
}
