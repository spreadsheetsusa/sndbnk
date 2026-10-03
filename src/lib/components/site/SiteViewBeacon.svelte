<script>
	import { afterNavigate } from '$app/navigation';

	// Counts a real in-site navigation. The first document load is counted on the server,
	// and hover preload does not run afterNavigate.
	afterNavigate((nav) => {
		if (nav.type === 'enter' || !nav.to) return;
		const path = nav.to.url.pathname;
		if (nav.type === 'form' && nav.from?.url.pathname === path) return;

		const body = JSON.stringify({ path });
		const blob = new Blob([body], { type: 'application/json' });
		if (navigator.sendBeacon('/api/site-views', blob)) return;

		fetch('/api/site-views', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body,
			keepalive: true
		}).catch(() => {
			// The page already rendered; a missed count is better than a console error.
		});
	});
</script>
