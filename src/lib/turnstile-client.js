/**
 * Browser helper for Cloudflare Turnstile tokens (checkout / fetch flows).
 * @param {{ siteKey: string, action: string, containerId?: string }} input
 * @returns {Promise<string>}
 */
export function requestTurnstileToken({ siteKey, action, containerId = 'turnstile-host' }) {
	return new Promise((resolve, reject) => {
		const run = () => {
			const api = /** @type {{ turnstile?: any }} */ (window).turnstile;
			if (!api) {
				reject(new Error('Security check still loading. Try again in a moment.'));
				return;
			}

			let host = document.getElementById(containerId);
			if (!host) {
				host = document.createElement('div');
				host.id = containerId;
				host.setAttribute('aria-hidden', 'true');
				host.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden';
				document.body.appendChild(host);
			} else {
				host.replaceChildren();
			}

			api.render(host, {
				sitekey: siteKey,
				size: 'invisible',
				appearance: 'interaction-only',
				action,
				callback: (/** @type {string} */ token) => resolve(token),
				'error-callback': () => reject(new Error('Security check failed. Please try again.')),
				'expired-callback': () => reject(new Error('Security check expired. Please try again.'))
			});
		};

		if (/** @type {{ turnstile?: any }} */ (window).turnstile) {
			run();
			return;
		}

		const existing = document.querySelector('script[data-sndbnk-turnstile]');
		if (existing) {
			existing.addEventListener('load', run, { once: true });
			existing.addEventListener(
				'error',
				() => reject(new Error('Security check unavailable. Please try again.')),
				{ once: true }
			);
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.dataset.sndbnkTurnstile = '1';
		script.addEventListener('load', run, { once: true });
		script.addEventListener(
			'error',
			() => reject(new Error('Security check unavailable. Please try again.')),
			{ once: true }
		);
		document.head.appendChild(script);
	});
}
