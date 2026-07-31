const bcrypt = require("bcrypt");
const User = require("../models/User");
const OTP = require("../models/OTP");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const mailSender = require("../utils/mailSender");
const { passwordUpdated } = require("../mail/templates/passwordUpdate");
const Profile = require("../models/Profile");
require("dotenv").config();

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// How many wrong guesses an OTP tolerates before it is destroyed.
const MAX_OTP_ATTEMPTS = 5;

// Signup Controller for Registering USers

exports.signup = async (req, res) => {
	try {
		// Destructure fields from the request body
		const {firstName,lastName,email,password,confirmPassword,accountType,contactNumber,otp,} = req.body;
		const normalizedEmail = email?.toLowerCase().trim();
		// Check if All Details are there or not
		if ( !firstName || !lastName || !normalizedEmail || !password || !confirmPassword || !otp ) {
			return res.status(403).send({
				success: false,
				message: "All Fields are required",
			});
		}
		// Check if password and confirm password match
		if (password !== confirmPassword) {
			return res.status(400).json({
				success: false,
				message:
					"Password and Confirm Password do not match. Please try again.",
			});
		}

		// Check if user already exists
		const existingUser = await User.findOne({
			email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
		});
		if (existingUser) {
			return res.status(400).json({
				success: false,
				message: "User already exists. Please sign in to continue.",
			});
		}

		// Find the most recent OTP for the email
		const otpRecord = await OTP.findOne({ email: normalizedEmail }).sort({
			createdAt: -1,
		});

		if (!otpRecord) {
			return res.status(400).json({
				success: false,
				message: "The OTP is invalid or has expired",
			});
		}

		// Cap the number of guesses — a 6-digit numeric code is only 10^6
		// possibilities, which is trivially brute-forced without a limit.
		if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
			await OTP.deleteOne({ _id: otpRecord._id });
			return res.status(400).json({
				success: false,
				message: "Too many incorrect attempts. Please request a new OTP.",
			});
		}

		if (otp !== otpRecord.otp) {
			await OTP.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
			return res.status(400).json({
				success: false,
				message: "The OTP is not valid",
			});
		}

		// Consume the OTP so it cannot be replayed within its TTL window.
		await OTP.deleteOne({ _id: otpRecord._id });

		// Hash the password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Instructors start unapproved and require review; everyone else is
		// approved immediately. (This previously compared an empty string to
		// "Instructor", so the condition was always false and every account —
		// including instructors — was auto-approved.)
		const approved = accountType !== "Instructor";

		// Create the Additional Profile For User
		const profileDetails = await Profile.create({
			gender: null,
			dateOfBirth: null,
			about: null,
			contactNumber: null,
		});
		const user = await User.create({
			firstName,
			lastName,
			email: normalizedEmail,
			contactNumber,
			password: hashedPassword,
			accountType: accountType,
			approved: approved,
			additionalDetails: profileDetails._id,
			image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName}%20${lastName}`,
		});

		return res.status(200).json({
			success: true,
			user,
			message: "User registered successfully",
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			success: false,
			message: "User cannot be registered. Please try again.",
		});
	}
};

// Login controller for authenticating users
exports.login = async (req, res) => {
	try {
		// Get email and password from request body
		const { email, password } = req.body;
		const normalizedEmail = email?.toLowerCase().trim();

		// Check if email or password is missing
		if (!normalizedEmail || !password) {
			// Return 400 Bad Request status code with error message
			return res.status(400).json({
				success: false,
				message: `Please Fill up All the Required Fields`,
			});
		}

		// Emails are stored lowercase, so an exact match works and can use the
		// index — unlike the previous case-insensitive regex, which forced a
		// full collection scan on every login attempt.
		const user = await User.findOne({
			email: normalizedEmail,
		}).populate("additionalDetails");

		// Deliberately identical to the wrong-password message below. Telling
		// the caller which of the two failed lets an attacker enumerate which
		// email addresses have accounts.
		if (!user) {
			return res.status(401).json({
				success: false,
				message: `Invalid email or password`,
			});
		}

		// Generate JWT token and Compare Password
		if (user.password && await bcrypt.compare(password, user.password)) {
			const token = jwt.sign(
				{ email: user.email, id: user._id, accountType : user.accountType },
				process.env.JWT_SECRET,
				{
					expiresIn: "24h",
				}
			);

			// Save token to user document in database
			user.token = token;
			user.password = undefined;
			// Set cookie for token and return success response
			// In production the SPA and API sit on different sites (e.g. Vercel
			// + Render), so the cookie needs SameSite=None + Secure or the
			// browser drops it. Locally that combination would break http://,
			// hence the environment switch.
			const isProduction = process.env.NODE_ENV === "production";
			const options = {
				// match the 24h JWT expiry rather than outliving the token
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
				httpOnly: true,
				sameSite: isProduction ? "none" : "lax",
				secure: isProduction,
			};
			res.cookie("token", token, options).status(200).json({
				success: true,
				token,
				user,
				message: `User Login Success`,
			});
		} else {
			return res.status(401).json({
				success: false,
				// same message as the unknown-email case above, on purpose
				message: `Invalid email or password`,
			});
		}
	} catch (error) {
		console.error(error);
		// Return 500 Internal Server Error status code with error message
		return res.status(500).json({
			success: false,
			message: `Login Failure Please Try Again`,
		});
	}
};
// Send OTP For Email Verification
exports.sendotp = async (req, res) => {
	try {
		const { email } = req.body;
		const normalizedEmail = email?.toLowerCase().trim();

		if (!normalizedEmail) {
			return res.status(400).json({
				success: false,
				message: "Email is required",
			});
		}

		// Check if user is already present
		const checkUserPresent = await User.findOne({ email: normalizedEmail });

		// If user found with provided email
		if (checkUserPresent) {
			// Return 401 Unauthorized status code with error message
			return res.status(401).json({
				success: false,
				message: `User is Already Registered`,
			});
		}

		var otp = otpGenerator.generate(6, {
			upperCaseAlphabets: false,
			lowerCaseAlphabets: false,
			specialChars: false,
		});
		const result = await OTP.findOne({ otp: otp });
		console.log("Result is Generate OTP Func");
		console.log("OTP", otp);
		console.log("Result", result);
		while (result) {
			otp = otpGenerator.generate(6, {
				upperCaseAlphabets: false,
			});
		}
		const otpPayload = { email: normalizedEmail, otp };
		await OTP.create(otpPayload);

		// The OTP is returned in the response so signup can be tested and demoed
		// without access to the target mailbox.
		// NOTE: this means anyone who can call this endpoint can verify an email
		// address they do not own — remove `otp` below before any real use.
		res.status(200).json({
			success: true,
			message: `OTP Sent Successfully`,
			otp,
		});
	} catch (error) {
		console.log(error.message);
		return res.status(500).json({ success: false, error: error.message });
	}
};

// Controller for Changing Password
exports.changePassword = async (req, res) => {
	try {
		// Get user data from req.user
		const userDetails = await User.findById(req.user.id);

		// Get old password, new password, and confirm new password from req.body
		const { oldPassword, newPassword, confirmNewPassword } = req.body;

		// Validate old password
		const isPasswordMatch = await bcrypt.compare(
			oldPassword,
			userDetails.password
		);
		if (!isPasswordMatch) {
			// If old password does not match, return a 401 (Unauthorized) error
			return res
				.status(401)
				.json({ success: false, message: "The password is incorrect" });
		}

		// Match new password and confirm new password
		if (newPassword !== confirmNewPassword) {
			// If new password and confirm new password do not match, return a 400 (Bad Request) error
			return res.status(400).json({
				success: false,
				message: "The password and confirm password does not match",
			});
		}

		// Update password
		const encryptedPassword = await bcrypt.hash(newPassword, 10);
		const updatedUserDetails = await User.findByIdAndUpdate(
			req.user.id,
			{ password: encryptedPassword },
			{ new: true }
		);

		// Send notification email
		try {
			const emailResponse = await mailSender(
				updatedUserDetails.email,
				passwordUpdated(
					updatedUserDetails.email,
					`Password updated successfully for ${updatedUserDetails.firstName} ${updatedUserDetails.lastName}`
				)
			);
			console.log("Email sent successfully:", emailResponse);
		} catch (error) {
			// If there's an error sending the email, log the error and return a 500 (Internal Server Error) error
			console.error("Error occurred while sending email:", error);
			return res.status(500).json({
				success: false,
				message: "Error occurred while sending email",
				error: error.message,
			});
		}

		// Return success response
		return res
			.status(200)
			.json({ success: true, message: "Password updated successfully" });
	} catch (error) {
		// If there's an error updating the password, log the error and return a 500 (Internal Server Error) error
		console.error("Error occurred while updating password:", error);
		return res.status(500).json({
			success: false,
			message: "Error occurred while updating password",
			error: error.message,
		});
	}
};