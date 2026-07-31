const mongoose = require("mongoose");

const courseProgressSchema = new mongoose.Schema({
	courseID: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Course",
		required: true,
	},
	// Progress is per student — without this, every student enrolled in a
	// course would share a single progress document.
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	completedVideos: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "SubSection",
		},
	],
});

// One progress document per (student, course), enforced by the database.
courseProgressSchema.index({ courseID: 1, userId: 1 }, { unique: true });

// Registered as "CourseProgress" to match the ref in models/User.js —
// mongoose model names are case-sensitive, so the old lowercase name meant any
// populate("courseProgress") would have thrown MissingSchemaError. Both names
// map to the same "courseprogresses" collection, so no data migration.
module.exports = mongoose.model("CourseProgress", courseProgressSchema);
