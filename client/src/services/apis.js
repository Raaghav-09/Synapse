export const categories = {
  CATEGORIES_API: "/course/showAllCategories",
}

export const ratingsEndpoints = {
  REVIEWS_DETAILS_API: "/course/getReviews",
}

export const contactusEndpoint = {
  CONTACT_US_API: "/contact/contactus",
}

export const settingsEndpoints = {
  UPDATE_DISPLAY_PICTURE_API: "/profile/updateDisplayPicture",
  UPDATE_PROFILE_API: "/profile/updateProfile",
  CHANGE_PASSWORD_API: "/auth/changepassword",
  DELETE_PROFILE_API: "/profile/deleteProfile",
}

export const endpoints = {
  SENDOTP_API: "/auth/sendotp",
  SIGNUP_API: "/auth/signup",
  LOGIN_API: "/auth/login",
  RESETPASSTOKEN_API: "/auth/reset-password-token",
  RESETPASSWORD_API: "/auth/reset-password",
}

export const courseEndpoints = {
  GET_ALL_COURSE_API: "/course/getAllCourses",
  COURSE_DETAILS_API: "/course/getCourseDetails",
  EDIT_COURSE_API: "/course/editCourse",
  COURSE_CATEGORIES_API: "/course/showAllCategories",
  CREATE_COURSE_API: "/course/createCourse",
  CREATE_SECTION_API: "/course/addSection",
  CREATE_SUBSECTION_API: "/course/addSubSection",
  UPDATE_SECTION_API: "/course/updateSection",
  UPDATE_SUBSECTION_API: "/course/updateSubSection",
  GET_ALL_INSTRUCTOR_COURSES_API: "/course/getInstructorCourses",
  DELETE_SECTION_API: "/course/deleteSection",
  DELETE_SUBSECTION_API: "/course/deleteSubSection",
  DELETE_COURSE_API: "/course/deleteCourse",
  GET_FULL_COURSE_DETAILS_AUTHENTICATED: "/course/getFullCourseDetails",
  LECTURE_COMPLETION_API: "/course/updateCourseProgress",
  CREATE_RATING_API: "/course/createRating",
}

export const catalogData = {
  CATALOGPAGEDATA_API: "/course/getCategoryPageDetails",
}

export const profileEndpoints = {
  GET_USER_DETAILS_API: "/profile/getUserDetails",
  GET_USER_ENROLLED_COURSES_API: "/profile/getEnrolledCourses",
  GET_INSTRUCTOR_DATA_API: "/profile/instructorDashboard",
}

export const assistantEndpoints = {
  ASK_DOUBT_API: "/assistant/ask",
  CHAT_HISTORY_API: "/assistant/history",
}

export const uploadEndpoints = {
  CREATE_UPLOAD_SIGNATURE_API: "/upload/signature",
}

export const studentEndpoints = {
  COURSE_PAYMENT_API: "/payment/createOrder",
  COURSE_PAYMENT_STATUS_API: "/payment/orders",
}

export const adminEndpoints = {
  CREATE_CATEGORY_API: "/course/createCategory",
}
