type MagicLinkTemplateOptions = {
	actionLabel: string;
	intro: string;
	magicLink: string;
};

export const magicLinkTemplate = ({
	actionLabel,
	intro,
	magicLink,
}: MagicLinkTemplateOptions) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
        .wrapper { padding: 40px 20px; }
        .container { background-color: #ffffff; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        h2 { color: #1a1a1a; margin-top: 0; }
        p { color: #4a4a4a; line-height: 1.6; font-size: 16px; }
        .button-container { text-align: center; margin: 32px 0; }
        .button { background-color: #0077A6; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 999px; display: inline-block; font-weight: 600; font-size: 16px; }
        .footer { margin-top: 32px; font-size: 13px; color: #999; text-align: center; }
        .divider { border-top: 1px solid #eee; margin: 32px 0; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <h2>ComprehendMe</h2>
            <p>${intro}</p>
            
            <div class="button-container">
                <a href="${magicLink}" class="button">${actionLabel}</a>
            </div>
            
            <p>This link will expire in <strong>5 minutes</strong>. If you did not request this email, you can ignore it.</p>
            
            <div class="divider"></div>
            <p style="font-size: 14px; color: #888;">If the button does not work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; font-size: 12px; color: #007bff;">${magicLink}</p>
        </div>
        <div class="footer">
            &copy; 2026 ComprehendMe.
        </div>
    </div>
</body>
</html>
`;

export const signupTemplate = (magicLink: string) =>
	magicLinkTemplate({
		actionLabel: 'Verify email',
		intro:
			'Welcome! Click the button below to verify your email address and finish creating your ComprehendMe account.',
		magicLink,
	});

export const loginTemplate = (magicLink: string) =>
	magicLinkTemplate({
		actionLabel: 'Sign in',
		intro:
			'We received a request to sign in to your account. Use the button below to complete sign-in with your magic link.',
		magicLink,
	});

export const emailChangeTemplate = (confirmLink: string, newEmail: string) =>
	magicLinkTemplate({
		actionLabel: 'Confirm email change',
		intro: `You requested to change your ComprehendMe email address to <strong>${newEmail}</strong>. Click the button below to confirm this change. If you did not request this, you can safely ignore this email.`,
		magicLink: confirmLink,
	});
