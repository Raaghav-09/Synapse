const mongoose = require("mongoose");

const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course");
const SubSection = require("../models/SubSection");

// ---------------- POST /course/updateCourseProgress ----------------
// Marks one lecture as completed for the logged-in student.
exports.updateCourseProgress = async (req, res) => {
	try {
		// the client sends subsectionId with a lowercase "s"
		const { courseId, subsectionId } = req.body;
		const userId = req.user.id;

		if (!courseId || !subsectionId) {
			return res.status(400).json({
				success: false,
				error: "courseId and subsectionId are required",
			});
		}

		if (
			!mongoose.isValidObjectId(courseId) ||
			!mongoose.isValidObjectId(subsectionId)
		) {
			return res.status(400).json({
				success: false,
				error: "Invalid courseId or subsectionId",
			});
		}

		// the lecture must actually exist
		const subSection = await SubSection.findById(subsectionId);
		if (!subSection) {
			return res.status(404).json({
				success: false,
				error: "Lecture not found",
			});
		}

		// Authorization, not just authentication: a student may only record
		// progress on a course they are enrolled in.
		const course = await Course.findById(courseId).select("studentsEnrolled");
		if (!course) {
			return res.status(404).json({
				success: false,
				error: "Course not found",
			});
		}
		const isEnrolled = course.studentsEnrolled.some(
			(id) => id.toString() === userId
		);
		if (!isEnrolled) {
			return res.status(403).json({
				success: false,
				error: "You must be enrolled in this course to track progress",
			});
		}

		// Single atomic upsert. $addToSet makes this idempotent, so clicking
		// "Mark as completed" twice is harmless rather than an error, and two
		// concurrent requests cannot trip the unique index.
		const progress = await CourseProgress.findOneAndUpdate(
			{ courseID: courseId, userId },
			{ $addToSet: { completedVideos: subsectionId } },
			{ upsert: true, new: true, setDefaultsOnInsert: true }
		);

		return res.status(200).json({
			success: true,
			message: "Course progress updated",
			completedVideos: progress.completedVideos,
		});
	} catch (error) {
		console.error("UPDATE COURSE PROGRESS ERROR:", error);
		return res.status(500).json({
			success: false,
			error: "Could not update course progress",
		});
	}
};
