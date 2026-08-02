<script>
	import LegalDoc from '#lib/components/LegalDoc.svelte';

	let { data } = $props();
</script>

<LegalDoc
	title="Copyright and DMCA Policy | SNDBNK"
	description="How to report copyright infringement on SNDBNK and how we handle DMCA notices."
	canonical={`${data.siteOrigin}/copyright`}
	origin={data.siteOrigin}
	heading="Copyright & DMCA"
>
	<p>
		The American Spreadsheet Co. respects intellectual property rights and expects SNDBNK users to
		do the same. This page explains how to report alleged copyright infringement on the Service and
		how we respond under the Digital Millennium Copyright Act (17 U.S.C. § 512) and similar laws.
		Related terms appear in our <a href="/terms">Terms of Service</a>.
	</p>

	<h2>1. Our policy</h2>
	<p>
		You may only upload Content that you own or are fully authorized to use. We will respond to
		valid notices of alleged infringement and may remove or disable access to material. In
		appropriate circumstances, we terminate accounts of repeat infringers.
	</p>

	<h2>2. Designated DMCA agent</h2>
	<p>Send copyright notices and counter-notices to our designated agent:</p>
	<p>
		DMCA Agent<br />
		The American Spreadsheet Co. / SNDBNK<br />
		Email: <a href="mailto:copyright@sndbnk.com">copyright@sndbnk.com</a>
	</p>
	<p>
		Email is the preferred method. Put “DMCA Notice” or “DMCA Counter-Notice” in the subject line.
		For other legal matters use <a href="mailto:legal@sndbnk.com">legal@sndbnk.com</a>.
	</p>

	<h2>3. Filing a DMCA notice</h2>
	<p>
		To request removal of material you believe infringes your copyright, send a written notice that
		includes all of the following (as required by 17 U.S.C. § 512(c)(3)):
	</p>
	<ul>
		<li>
			A physical or electronic signature of the copyright owner or a person authorized to act for
			them;
		</li>
		<li>
			Identification of the copyrighted work claimed to have been infringed (or a representative
			list if multiple works);
		</li>
		<li>
			Identification of the material that is claimed to be infringing, and information reasonably
			sufficient to locate it on SNDBNK (for example the track URL, profile URL, and username);
		</li>
		<li>Your name, mailing address, telephone number, and email address;</li>
		<li>
			A statement that you have a good-faith belief that use of the material in the manner
			complained of is not authorized by the copyright owner, its agent, or the law;
		</li>
		<li>
			A statement that the information in the notice is accurate, and under penalty of perjury, that
			you are authorized to act on behalf of the owner of an exclusive right that is allegedly
			infringed.
		</li>
	</ul>
	<p>
		Incomplete notices may delay or prevent action. Knowingly misrepresenting that material is
		infringing may expose you to liability for damages under 17 U.S.C. § 512(f).
	</p>

	<h2>4. What we do after a valid notice</h2>
	<p>
		When we receive a notice that substantially complies with the DMCA, we typically: (1) remove or
		disable access to the identified material; (2) notify the user who posted it; and (3) document
		the notice. We may also suspend or terminate accounts involved in repeated or egregious
		infringement.
	</p>

	<h2>5. Counter-notification</h2>
	<p>
		If your material was removed and you believe it was a mistake or misidentification, you may send
		a counter-notification to
		<a href="mailto:copyright@sndbnk.com">copyright@sndbnk.com</a> that includes:
	</p>
	<ul>
		<li>Your physical or electronic signature;</li>
		<li>Identification of the material that was removed and where it appeared before removal;</li>
		<li>
			A statement under penalty of perjury that you have a good-faith belief the material was
			removed or disabled as a result of mistake or misidentification;
		</li>
		<li>Your name, address, and telephone number;</li>
		<li>
			A statement that you consent to the jurisdiction of the Federal District Court for the
			judicial district where your address is located (or the District of Delaware if outside the
			United States), and that you will accept service of process from the person who filed the
			original notice or their agent.
		</li>
	</ul>
	<p>
		Upon receiving a valid counter-notice, we may forward it to the original complainant. If they do
		not notify us within about 10–14 business days that they have filed an action seeking a court
		order, we may restore the material at our discretion.
	</p>

	<h2>6. Repeat infringers</h2>
	<p>
		We maintain records of DMCA notices. Accounts that receive multiple valid infringement notices,
		or that clearly engage in willful infringement, may be terminated without further notice.
		Termination may include removal of Content and loss of paid plan features without refund, except
		where required by law.
	</p>

	<h2>7. Other intellectual property</h2>
	<p>
		For trademark or other IP concerns that are not copyright takedowns, email
		<a href="mailto:legal@sndbnk.com">legal@sndbnk.com</a> with details and supporting documentation.
		We will review in good faith but may handle non-DMCA claims under different procedures.
	</p>

	<h2>8. Contact</h2>
	<p>
		Copyright / DMCA: <a href="mailto:copyright@sndbnk.com">copyright@sndbnk.com</a><br />
		Legal: <a href="mailto:legal@sndbnk.com">legal@sndbnk.com</a><br />
		Privacy: <a href="mailto:privacy@sndbnk.com">privacy@sndbnk.com</a><br />
		Operator: The American Spreadsheet Co. · Service: SNDBNK ·
		<a href="https://sndbnk.com">sndbnk.com</a>
	</p>
</LegalDoc>
