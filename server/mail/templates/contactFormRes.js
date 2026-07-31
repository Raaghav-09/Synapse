exports.contactUsEmail = (
	email,
	firstname,
	lastname,
	message,
	phoneNo,
	countrycode
) => {
	return `<!DOCTYPE html>
	<html>

	<head>
		<meta charset="UTF-8">
		<title>Contact Form Confirmation</title>
		<style>
			body {
				background-color: #ffffff;
				font-family: Arial, sans-serif;
				font-size: 16px;
				line-height: 1.4;
				color: #333333;
				margin: 0;
				padding: 0;
			}

			.container {
				max-width: 600px;
				margin: 0 auto;
				padding: 20px;
				text-align: left;
			}

			.message {
				font-size: 18px;
				font-weight: bold;
				margin-bottom: 20px;
			}

			.highlight {
				font-weight: bold;
			}
		</style>
	</head>

	<body>
		<div class="container">
			<div class="message">Contact Form Confirmation</div>
			<div class="body">
				<p>Dear ${firstname} ${lastname},</p>
				<p>Thank you for contacting Synapse. We have received your message and
				   will get back to you shortly.</p>
				<p>Here are the details you submitted:</p>
				<p><span class="highlight">Name:</span> ${firstname} ${lastname}</p>
				<p><span class="highlight">Email:</span> ${email}</p>
				<p><span class="highlight">Phone:</span> ${countrycode || ""} ${phoneNo || "-"}</p>
				<p><span class="highlight">Message:</span> ${message}</p>
			</div>
		</div>
	</body>

	</html>`;
};
