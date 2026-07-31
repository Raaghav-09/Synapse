const mailSender = require("../utils/mailSender");
const { contactUsEmail } = require("../mail/templates/contactFormRes");

// ---------------- POST /contact/contactus ----------------
// Public endpoint — no auth, since visitors are not logged in.
exports.contactUsController = async (req, res) => {
	const { email, firstname, lastname, message, phoneNo, countrycode } = req.body;

	if (!email || !firstname || !message) {
		return res.status(400).json({
			success: false,
			message: "Name, email and message are required",
		});
	}

	try {
		// auto-acknowledgement to the visitor
		await mailSender(
			email,
			"Your message has been received",
			contactUsEmail(email, firstname, lastname, message, phoneNo, countrycode)
		);

		// notification to the site owner, if an inbox is configured
		const ownerInbox = process.env.CONTACT_MAIL_TO || process.env.MAIL_USER;
		if (ownerInbox) {
			await mailSender(
				ownerInbox,
				`New contact form submission from ${firstname} ${lastname || ""}`.trim(),
				contactUsEmail(email, firstname, lastname, message, phoneNo, countrycode)
			);
		}

		return res.status(200).json({
			success: true,
			message: "Your message has been sent successfully",
		});
	} catch (error) {
		console.error("CONTACT US ERROR:", error);
		return res.status(500).json({
			success: false,
			message: "Could not send your message, please try again later",
		});
	}
};
