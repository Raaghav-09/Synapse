import React, { useEffect, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate, useParams } from "react-router-dom"

import "video-react/dist/video-react.css"
import { BigPlayButton, Player } from "video-react"

import { markLectureAsComplete } from "../../../services/operations/courseDetailsAPI"
import { updateCompletedLectures } from "../../../slices/viewCourseSlice"
import IconBtn from "../../Common/IconBtn"
import DoubtAssistant from "./DoubtAssistant"

const VideoDetails = () => {
  const { courseId, sectionId, subSectionId } = useParams()
  const navigate = useNavigate()
  const playerRef = useRef(null)
  const dispatch = useDispatch()
  const { token } = useSelector((state) => state.auth)
  const { courseSectionData, courseEntireData, completedLectures } =
    useSelector((state) => state.viewCourse)

  // null, not [] — an empty array is truthy, so `!videoData` would be false
  // and the player would render with an undefined src instead of the thumbnail
  const [videoData, setVideoData] = useState(null)
  const [previewSource, setPreviewSource] = useState("")
  const [videoEnded, setVideoEnded] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      if (!courseSectionData.length) return
      if (!courseId && !sectionId && !subSectionId) {
        navigate(`/dashboard/enrolled-courses`)
      } else {
        // console.log("courseSectionData", courseSectionData)
        const filteredData = courseSectionData.filter(
          (course) => course._id === sectionId
        )
        // console.log("filteredData", filteredData)
        const filteredVideoData = filteredData?.[0]?.subSection?.filter(
          (data) => data._id === subSectionId
        )
        // The URL params may not resolve — a stale link, a deleted section, or
        // ids belonging to another course. Fall back to null instead of
        // indexing into undefined.
        setVideoData(filteredVideoData?.[0] ?? null)
        setPreviewSource(courseEntireData?.thumbnail ?? "")
        setVideoEnded(false)
      }
    })()
  }, [
    courseEntireData,
    courseId,
    courseSectionData,
    navigate,
    sectionId,
    subSectionId,
  ])

  // Resolve the current position in the course, or null if the URL params
  // don't match any loaded section/lecture. findIndex returns -1 on no match,
  // and courseSectionData[-1] is undefined — indexing into it is what crashed
  // the page during render.
  const getCurrentIndices = () => {
    const sectionIndx = courseSectionData.findIndex(
      (data) => data._id === sectionId
    )
    if (sectionIndx === -1) return null

    const subSections = courseSectionData[sectionIndx]?.subSection
    if (!Array.isArray(subSections)) return null

    const subSectionIndx = subSections.findIndex(
      (data) => data._id === subSectionId
    )
    if (subSectionIndx === -1) return null

    return { sectionIndx, subSectionIndx, subSections }
  }

  // check if the lecture is the first video of the course
  const isFirstVideo = () => {
    const pos = getCurrentIndices()
    // unknown position -> hide the nav button rather than crash
    if (!pos) return true
    return pos.sectionIndx === 0 && pos.subSectionIndx === 0
  }

  // go to the next video
  const goToNextVideo = () => {
    const pos = getCurrentIndices()
    if (!pos) return

    const currentSectionIndx = pos.sectionIndx
    const currentSubSectionIndx = pos.subSectionIndx
    const noOfSubsections = pos.subSections.length

    if (currentSubSectionIndx !== noOfSubsections - 1) {
      const nextSubSectionId =
        courseSectionData[currentSectionIndx].subSection[
          currentSubSectionIndx + 1
        ]._id
      navigate(
        `/view-course/${courseId}/section/${sectionId}/sub-section/${nextSubSectionId}`
      )
    } else {
      // Skip forward past any sections that have no lectures yet — an
      // instructor can create an empty section, and jumping straight to
      // subSection[0] of one would crash.
      for (let i = currentSectionIndx + 1; i < courseSectionData.length; i++) {
        const nextSubSectionId = courseSectionData[i]?.subSection?.[0]?._id
        if (nextSubSectionId) {
          navigate(
            `/view-course/${courseId}/section/${courseSectionData[i]._id}/sub-section/${nextSubSectionId}`
          )
          return
        }
      }
    }
  }

  // check if the lecture is the last video of the course
  const isLastVideo = () => {
    const pos = getCurrentIndices()
    // unknown position -> hide the nav button rather than crash
    if (!pos) return true
    return (
      pos.sectionIndx === courseSectionData.length - 1 &&
      pos.subSectionIndx === pos.subSections.length - 1
    )
  }

  // go to the previous video
  const goToPrevVideo = () => {
    const pos = getCurrentIndices()
    if (!pos) return

    const currentSectionIndx = pos.sectionIndx
    const currentSubSectionIndx = pos.subSectionIndx

    if (currentSubSectionIndx !== 0) {
      const prevSubSectionId =
        courseSectionData[currentSectionIndx].subSection[
          currentSubSectionIndx - 1
        ]._id
      navigate(
        `/view-course/${courseId}/section/${sectionId}/sub-section/${prevSubSectionId}`
      )
    } else {
      // Skip backward past any empty sections, same reason as goToNextVideo.
      for (let i = currentSectionIndx - 1; i >= 0; i--) {
        const prevSubSections = courseSectionData[i]?.subSection
        const prevSubSectionId =
          prevSubSections?.[prevSubSections.length - 1]?._id
        if (prevSubSectionId) {
          navigate(
            `/view-course/${courseId}/section/${courseSectionData[i]._id}/sub-section/${prevSubSectionId}`
          )
          return
        }
      }
    }
  }

  const handleLectureCompletion = async () => {
    setLoading(true)
    const res = await markLectureAsComplete(
      { courseId: courseId, subsectionId: subSectionId },
      token
    )
    if (res) {
      dispatch(updateCompletedLectures(subSectionId))
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-5 text-white">
      {!videoData ? (
        <img
          src={previewSource}
          alt="Preview"
          className="h-full w-full rounded-md object-cover"
        />
      ) : (
        <Player
          ref={playerRef}
          aspectRatio="16:9"
          playsInline
          onEnded={() => setVideoEnded(true)}
          src={videoData?.videoUrl}
        >
          <BigPlayButton position="center" />
          {/* Render When Video Ends */}
          {videoEnded && (
            <div
              style={{
                backgroundImage:
                  "linear-gradient(to top, rgb(0, 0, 0), rgba(0,0,0,0.7), rgba(0,0,0,0.5), rgba(0,0,0,0.1)",
              }}
              className="full absolute inset-0 z-[100] grid h-full place-content-center font-inter"
            >
              {!completedLectures.includes(subSectionId) && (
                <IconBtn
                  disabled={loading}
                  onclick={() => handleLectureCompletion()}
                  text={!loading ? "Mark As Completed" : "Loading..."}
                  customClasses="text-xl max-w-max px-4 mx-auto"
                />
              )}
              <IconBtn
                disabled={loading}
                onclick={() => {
                  if (playerRef?.current) {
                    // set the current time of the video to 0
                    playerRef?.current?.seek(0)
                    setVideoEnded(false)
                  }
                }}
                text="Rewatch"
                customClasses="text-xl max-w-max px-4 mx-auto mt-2"
              />
              <div className="mt-10 flex min-w-[250px] justify-center gap-x-4 text-xl">
                {!isFirstVideo() && (
                  <button
                    disabled={loading}
                    onClick={goToPrevVideo}
                    className="blackButton"
                  >
                    Prev
                  </button>
                )}
                {!isLastVideo() && (
                  <button
                    disabled={loading}
                    onClick={goToNextVideo}
                    className="blackButton"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )}
        </Player>
      )}

      <h1 className="mt-4 text-3xl font-semibold">{videoData?.title}</h1>
      <p className="pt-2 pb-6">{videoData?.description}</p>

      <DoubtAssistant courseId={courseId} subSectionId={subSectionId} />
    </div>
  )
}

export default VideoDetails
// video
