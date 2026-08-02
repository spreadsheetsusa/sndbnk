<script>
	import LegalDoc from '#lib/components/LegalDoc.svelte';

	let { data } = $props();
</script>

<LegalDoc
	title="Terms of Service | SNDBNK"
	description="The terms that govern your use of SNDBNK."
	canonical={`${data.siteOrigin}/terms`}
	origin={data.siteOrigin}
	heading="Terms of Service"
>
	<p>
		These Terms of Service (“Terms”) are a contract between you and The American Spreadsheet Co.
		(“we,” “us,” or “our”) for use of SNDBNK at
		<a href="https://sndbnk.com">sndbnk.com</a>, related subdomains, and custom domains that point
		to the service (the “Service”). By creating an account or using the Service, you agree to these
		Terms and our <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the
		Service.
	</p>

	<h2>1. The Service</h2>
	<p>
		SNDBNK lets creators upload and host audio, publish public profiles, and share tracks with
		listeners. Features may differ by plan (for example track limits, subdomains, custom domains,
		and bring-your-own storage). We may change, suspend, or discontinue features with reasonable
		notice when practical. The Service is provided from the United States.
	</p>

	<h2>2. Eligibility and accounts</h2>
	<ul>
		<li>
			You must be at least 13 years old (or the higher age required where you live) to use the
			Service.
		</li>
		<li>You must provide accurate registration information and keep it up to date.</li>
		<li>
			You are responsible for activity under your account and for keeping your password
			confidential.
		</li>
		<li>One person or entity per account unless we agree otherwise in writing.</li>
		<li>
			We may refuse, suspend, or terminate accounts that violate these Terms or applicable law.
		</li>
	</ul>

	<h2>3. Your content</h2>
	<p>
		“Content” means audio, images, text, metadata, comments, and other material you upload or
		submit. You retain ownership of your Content. You are solely responsible for it and for having
		all rights needed to upload and share it.
	</p>
	<p>
		By uploading or publishing Content, you grant us a worldwide, non-exclusive, royalty-free
		license to host, store, reproduce, transcode, display, perform, distribute, and create technical
		derivatives (such as waveforms and format conversions) solely as needed to operate, promote, and
		improve the Service. This license ends when you delete the Content or your account, except for
		reasonable residual copies in backups and caches that are overwritten in the ordinary course,
		and except for Content others have lawfully reshared while it was public.
	</p>
	<p>
		Published Content may be publicly accessible, including via direct media URLs, embeds, search,
		and third-party crawlers. Unpublished library items are not shown on public profiles.
	</p>

	<h2>4. Acceptable use</h2>
	<p>You agree not to:</p>
	<ul>
		<li>
			Upload Content you do not have the right to use, including copyrighted material without
			authorization;
		</li>
		<li>Upload malware, or attempt to probe, scan, or disrupt the Service or other users;</li>
		<li>
			Harass, threaten, defame, or exploit others; or post illegal, hateful, or pornographic Content
			involving minors;
		</li>
		<li>Impersonate others or misrepresent your affiliation;</li>
		<li>
			Scrape, bulk-download, or access the Service by automated means except ordinary search
			indexing or APIs we expressly allow;
		</li>
		<li>Circumvent plan limits, paywalls, access controls, or security measures;</li>
		<li>Use the Service to send spam or unsolicited commercial messages; or</li>
		<li>Violate applicable law or the rights of others.</li>
	</ul>
	<p>
		We may remove Content, limit features, or ban accounts for violations. Ban and moderation
		decisions may be made at our reasonable discretion. See also our
		<a href="/copyright">Copyright / DMCA</a> policy.
	</p>

	<h2>5. Plans, billing, and taxes</h2>
	<p>
		Paid plans are billed through Stripe. Prices, features, and limits are described on
		<a href="/plans">/plans</a> and in your account. By purchasing, you authorize us and Stripe to charge
		applicable fees and taxes. Subscriptions renew until canceled through the billing portal in Settings
		or as otherwise offered. Cancellations typically take effect at the end of the current billing period;
		you generally retain paid features until then. Fees are non-refundable except where required by law
		or expressly stated by us. We may change prices with notice; the new price applies to subsequent renewal
		periods.
	</p>

	<h2>6. Storage and domains</h2>
	<p>
		Default media storage is on our infrastructure. If you enable bring-your-own storage, you are
		responsible for that server’s availability, security, backups, and lawful use. Premium
		subdomains and custom domains are privileges of qualifying plans; we may suspend DNS or TLS for
		domains that violate these Terms, fail verification, or after a plan lapses. Domain names you
		register elsewhere remain yours; our mapping to the Service does not transfer ownership.
	</p>

	<h2>7. Intellectual property</h2>
	<p>
		The Service—including software, design, trademarks (including SNDBNK®), and branding—is owned by
		us or our licensors. These Terms do not grant you rights to our marks or code except the limited
		right to use the Service as offered. Feedback you send may be used by us without obligation to
		you.
	</p>

	<h2>8. Third-party services</h2>
	<p>
		The Service integrates third parties such as Stripe (payments) and email delivery providers.
		Their terms and privacy policies govern your use of those services. Links on profiles or in
		Content are not endorsements; we are not responsible for third-party sites.
	</p>

	<h2>9. Disclaimers</h2>
	<p>
		THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE
		DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
		PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE,
		OR ERROR-FREE, OR THAT CONTENT WILL BE PRESERVED WITHOUT LOSS. YOU USE THE SERVICE AT YOUR OWN
		RISK.
	</p>

	<h2>10. Limitation of liability</h2>
	<p>
		TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS
		WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
		DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE,
		EVEN IF ADVISED OF THE POSSIBILITY. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE
		WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS
		BEFORE THE CLAIM OR (B) USD $100. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN THOSE
		CASES OUR LIABILITY IS LIMITED TO THE FULLEST EXTENT PERMITTED.
	</p>

	<h2>11. Indemnity</h2>
	<p>
		You will defend and indemnify us against claims, damages, losses, and expenses (including
		reasonable attorneys’ fees) arising from your Content, your use of the Service, or your
		violation of these Terms or third-party rights.
	</p>

	<h2>12. Termination</h2>
	<p>
		You may stop using the Service at any time. You may request account deletion by contacting
		<a href="mailto:privacy@sndbnk.com">privacy@sndbnk.com</a>. We may suspend or terminate access
		immediately for violations, risk, non-payment, or prolonged inactivity. Sections that by their
		nature should survive (including ownership, licenses for residual copies, disclaimers, liability
		limits, indemnity, and governing law) will survive termination.
	</p>

	<h2>13. Governing law and disputes</h2>
	<p>
		These Terms are governed by the laws of the United States and the State of Delaware, without
		regard to conflict-of-law rules. Courts located in Delaware will have exclusive jurisdiction,
		except that we may seek injunctive relief in any jurisdiction to protect our intellectual
		property or the Service. If you are a consumer in a jurisdiction that requires otherwise,
		mandatory local consumer protections still apply.
	</p>

	<h2>14. Changes</h2>
	<p>
		We may update these Terms by posting a new version on this page and updating the effective date.
		Material changes may be communicated by email or notice when appropriate. Continued use after
		the effective date constitutes acceptance. If you do not agree, stop using the Service and close
		your account.
	</p>

	<h2>15. Miscellaneous</h2>
	<p>
		These Terms are the entire agreement between you and us regarding the Service and supersede
		prior agreements on the same subject. If a provision is unenforceable, the remainder stays in
		effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms
		without our consent; we may assign them in connection with a reorganization or sale. Notices to
		you may be sent to your account email.
	</p>

	<h2>16. Contact</h2>
	<p>
		Legal: <a href="mailto:legal@sndbnk.com">legal@sndbnk.com</a><br />
		Privacy: <a href="mailto:privacy@sndbnk.com">privacy@sndbnk.com</a><br />
		Copyright / DMCA: <a href="mailto:copyright@sndbnk.com">copyright@sndbnk.com</a><br />
		Operator: The American Spreadsheet Co. · Service: SNDBNK ·
		<a href="https://sndbnk.com">sndbnk.com</a>
	</p>
</LegalDoc>
