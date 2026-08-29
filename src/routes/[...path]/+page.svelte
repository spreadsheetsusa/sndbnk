<script>
	import TenantSitePage from '#lib/components/site/TenantSitePage.svelte';
	import { restorableList } from '#lib/lists/restorable-list.svelte.js';

	let { data } = $props();

	/** @type {HTMLElement | undefined} */
	let container = $state.raw();
	/** @type {import('svelte/attachments').Attachment} */
	const captureContainer = (node) => {
		container = node;
		return () => {
			if (container === node) container = undefined;
		};
	};

	const paged = restorableList(
		() => ({
			scope:
				data.catalog?.tab === 'likes'
					? 'likes'
					: data.catalog?.tab === 'history'
						? 'history'
						: 'profile',
			username: data.catalog?.profile.username ?? null
		}),
		() => data.catalog ?? { items: [], nextCursor: null },
		() => container
	);

	export const snapshot = paged.snapshot;
</script>

<div {@attach captureContainer}>
	<TenantSitePage {data} profileList={data.catalog ? paged.current : null} />
</div>
