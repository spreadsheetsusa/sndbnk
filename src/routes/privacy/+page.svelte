<script>
	import LegalDoc from '#lib/components/LegalDoc.svelte';

	let { data } = $props();
</script>

<LegalDoc
	title="Privacy Policy | SNDBNK"
	description="How SNDBNK collects, uses, and shares personal information."
	canonical={`${data.siteOrigin}/privacy`}
	origin={data.siteOrigin}
	heading="Privacy Policy"
>
	<p>
		This Privacy Policy explains how The American Spreadsheet Co. (“we,” “us,” or “our”) collects,
		uses, and shares information when you use SNDBNK at
		<a href="https://sndbnk.com">sndbnk.com</a>, related subdomains, and custom domains that point
		to the service (together, the “Service”). By using the Service, you agree to this Policy.
	</p>

	<h2>1. Who we are</h2>
	<p>
		SNDBNK is an audio hosting and listening platform operated by The American Spreadsheet Co.
		Questions about this Policy: <a href="mailto:privacy@sndbnk.com">privacy@sndbnk.com</a>. Legal
		notices: <a href="mailto:legal@sndbnk.com">legal@sndbnk.com</a>.
	</p>

	<h2>2. Information we collect</h2>
	<p>
		We collect information in three ways: you provide it, we collect it automatically, and we
		receive it from service providers.
	</p>
	<ul>
		<li>
			<strong>Account data.</strong> Name, username, email address, and password (stored as a secure hash).
			You may also add a profile bio, location, avatar, and labeled external links.
		</li>
		<li>
			<strong>Content you upload.</strong> Audio files, cover art, and metadata you enter or that we read
			from your files (for example title, artist, album, genre, year, BPM, ISRC, and embedded tags). Comments,
			likes, follows, and reposts are also stored.
		</li>
		<li>
			<strong>Storage settings.</strong> If you connect bring-your-own storage (SFTP/SSH), we store connection
			details and encrypt private keys and passphrases at rest before saving them.
		</li>
		<li>
			<strong>Billing data.</strong> If you subscribe to a paid plan, we collect the plan and subscription
			status needed to provide billing. Payment card details are processed by Stripe; we do not store
			full card numbers on our servers.
		</li>
		<li>
			<strong>Technical and session data.</strong> When you sign in, we create a session that may include
			IP address and user agent. Our servers and reverse proxy also process standard request logs (for
			example IP, timestamps, and requested paths) for security and reliability.
		</li>
		<li>
			<strong>Preferences on your device.</strong> Theme, accent color, player queue, and similar UI preferences
			may be stored in your browser’s local storage. These are not used for advertising.
		</li>
	</ul>

	<h2>3. How we use information</h2>
	<p>We use information to:</p>
	<ul>
		<li>
			Provide, maintain, and improve the Service (accounts, profiles, playback, uploads, search
			surfaces);
		</li>
		<li>Process subscriptions, invoices, and plan changes;</li>
		<li>
			Send transactional email (welcome, email verification, password reset, billing notices);
		</li>
		<li>Enforce our Terms, prevent abuse, and protect the Service and users;</li>
		<li>Comply with law and respond to lawful requests; and</li>
		<li>Communicate about the Service when you contact us.</li>
	</ul>
	<p>We do not sell your personal information, and we do not use it for third-party advertising.</p>

	<h2>4. How we share information</h2>
	<p>We share information only as needed to run the Service:</p>
	<ul>
		<li>
			<strong>Public by design.</strong> Public profiles, published tracks, covers, waveforms, comments,
			and similar public activity are visible to anyone who can reach that page or media URL. Unpublished
			library items stay private to your account.
		</li>
		<li>
			<strong>Stripe.</strong> Payment processing, customer records, subscriptions, invoices, and the
			customer portal. See Stripe’s privacy materials for how they handle payment data.
		</li>
		<li>
			<strong>Email delivery (AWS SES).</strong> Transactional messages are sent through our mail provider
			using your email address and message content.
		</li>
		<li>
			<strong>Hosting infrastructure.</strong> The Service runs on cloud hosting (currently AWS Lightsail).
			Database records and default media storage live on that infrastructure.
		</li>
		<li>
			<strong>Your own storage (optional).</strong> If you enable bring-your-own storage, audio and cover
			files for those tracks are stored on the server you configure. We access that server only to provide
			the features you request.
		</li>
		<li>
			<strong>Legal and safety.</strong> We may disclose information if required by law, or if we believe
			disclosure is necessary to protect rights, safety, or the integrity of the Service.
		</li>
		<li>
			<strong>Business transfers.</strong> If we are involved in a merger, acquisition, or asset sale,
			information may transfer as part of that transaction, subject to this Policy or a successor policy.
		</li>
	</ul>

	<h2>5. Cookies and similar technologies</h2>
	<p>
		We use essential cookies for authentication and short-lived notices (for example a one-shot
		message after sign-in). In production, the session cookie may be scoped across
		<code>*.sndbnk.com</code> so you stay signed in on creator subdomains. We do not use third-party advertising
		cookies or analytics trackers on the Service today. You can control cookies in your browser; blocking
		essential cookies will prevent sign-in.
	</p>

	<h2>6. Retention</h2>
	<p>
		We keep account, profile, content, and billing records for as long as your account is active and
		as needed to provide the Service, resolve disputes, enforce agreements, and meet legal
		obligations. Session and verification tokens expire. Server logs are retained for a limited
		operational period. If you ask us to delete your account, we will delete or de-identify personal
		data we control, except where we must retain it (for example billing records, abuse prevention,
		or legal holds). Files on bring-your-own storage remain under your control on your server.
	</p>

	<h2>7. Your choices and rights</h2>
	<p>Depending on where you live, you may have rights to:</p>
	<ul>
		<li>Access, correct, or update account and profile information in Settings;</li>
		<li>Delete individual tracks from your library;</li>
		<li>Cancel or manage a paid subscription through the Stripe customer portal in Settings;</li>
		<li>
			Request deletion of your account and associated personal data by emailing
			<a href="mailto:privacy@sndbnk.com">privacy@sndbnk.com</a>; and
		</li>
		<li>
			Opt out of non-essential communications (transactional mail required to run the account will
			continue).
		</li>
	</ul>
	<p>
		Residents of the EEA, UK, Switzerland, California, and other jurisdictions may have additional
		rights (access, deletion, portability, restriction, objection, or appeal). To exercise them,
		email <a href="mailto:privacy@sndbnk.com">privacy@sndbnk.com</a>. We will not discriminate
		against you for exercising privacy rights. If we decline a request where allowed, you may appeal
		by replying to our decision.
	</p>

	<h2>8. Children</h2>
	<p>
		The Service is not directed to children under 13 (or the minimum age required in your country).
		We do not knowingly collect personal information from children. If you believe a child has
		provided us information, contact
		<a href="mailto:privacy@sndbnk.com">privacy@sndbnk.com</a> and we will take appropriate steps.
	</p>

	<h2>9. Security</h2>
	<p>
		We use industry-standard measures appropriate to our size and the nature of the data, including
		HTTPS, hashed passwords, encrypted storage secrets for BYOS credentials, and access controls on
		production systems. No method of transmission or storage is perfectly secure. Please use a
		strong unique password and protect your account.
	</p>

	<h2>10. International users</h2>
	<p>
		We operate primarily from the United States. If you access the Service from another country, you
		understand that your information may be processed in the United States and other locations where
		we or our providers operate, which may have different data-protection rules than your home
		country.
	</p>

	<h2>11. Changes</h2>
	<p>
		We may update this Policy from time to time. We will post the revised version on this page and
		update the effective date. Material changes may also be announced by email or an in-product
		notice when appropriate. Continued use after the effective date means you accept the updated
		Policy.
	</p>

	<h2>12. Contact</h2>
	<p>
		Privacy questions and requests:
		<a href="mailto:privacy@sndbnk.com">privacy@sndbnk.com</a><br />
		Legal notices: <a href="mailto:legal@sndbnk.com">legal@sndbnk.com</a><br />
		Copyright / DMCA: <a href="mailto:copyright@sndbnk.com">copyright@sndbnk.com</a><br />
		Operator: The American Spreadsheet Co. · Service: SNDBNK ·
		<a href="https://sndbnk.com">sndbnk.com</a>
	</p>
</LegalDoc>
