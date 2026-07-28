<script>
	import { onMount } from 'svelte';
	import { resolvedTheme } from '#lib/stores/theme.js';

	/**
	 * SoundCloud-style bar waveform rendered from pre-computed peaks.
	 * Never fetches or decodes audio: progress is driven externally via
	 * `currentTime` and clicks are reported through `onseek`.
	 *
	 * @type {{
	 *   peaks: number[] | null,
	 *   durationMs: number | null,
	 *   currentTime?: number,
	 *   height?: number,
	 *   onseek?: (seconds: number) => void
	 * }}
	 */
	let { peaks, durationMs, currentTime = 0, height = 66, onseek } = $props();

	/** @type {HTMLDivElement} */
	let container;
	/** @type {import('wavesurfer.js').default | null} */
	let wavesurfer = $state.raw(null);

	const durationSec = $derived(Math.max((durationMs ?? 0) / 1000, 0.001));

	function normalizedPeaks() {
		if (peaks && peaks.length > 0) {
			return peaks.map((v) => v / 100);
		}
		// Placeholder bars for tracks without generated waveforms yet.
		return Array.from({ length: 200 }, (_, i) => 0.12 + 0.06 * Math.abs(Math.sin(i / 3)));
	}

	function resolveColors() {
		const styles = getComputedStyle(container);
		const ink = styles.getPropertyValue('--ink').trim() || '#11110f';
		const accent = styles.getPropertyValue('--accent').trim() || '#c8ff3d';
		return {
			waveColor: hexWithAlpha(ink, 0.32),
			progressColor: accent
		};
	}

	/**
	 * Canvas colors cannot use CSS vars or color-mix, so build rgba from hex.
	 * @param {string} hex
	 * @param {number} alpha
	 */
	function hexWithAlpha(hex, alpha) {
		const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
		if (!match) return hex;
		const n = Number.parseInt(match[1], 16);
		const r = (n >> 16) & 0xff;
		const g = (n >> 8) & 0xff;
		const b = n & 0xff;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	onMount(() => {
		let destroyed = false;

		(async () => {
			const { default: WaveSurfer } = await import('wavesurfer.js');
			if (destroyed) return;

			const instance = WaveSurfer.create({
				container,
				height,
				...resolveColors(),
				barWidth: 2,
				barGap: 1,
				barRadius: 0,
				cursorWidth: 0,
				interact: true,
				dragToSeek: false,
				fillParent: true,
				peaks: [normalizedPeaks()],
				duration: durationSec
			});

			instance.on('interaction', (newTime) => {
				onseek?.(newTime);
			});

			wavesurfer = instance;
		})();

		return () => {
			destroyed = true;
			wavesurfer?.destroy();
			wavesurfer = null;
		};
	});

	// Drive the rendered progress from the global player position.
	$effect(() => {
		const time = currentTime;
		if (wavesurfer) {
			wavesurfer.setTime(time);
		}
	});

	// Re-render peaks if the track data changes under us.
	$effect(() => {
		const nextPeaks = peaks;
		const nextDuration = durationSec;
		if (wavesurfer) {
			wavesurfer.setOptions({
				peaks: [
					nextPeaks && nextPeaks.length > 0
						? nextPeaks.map((v) => v / 100)
						: normalizedPeaks()
				],
				duration: nextDuration
			});
		}
	});

	// Re-resolve canvas colors when the theme flips.
	$effect(() => {
		const theme = $resolvedTheme;
		if (wavesurfer && theme) {
			wavesurfer.setOptions(resolveColors());
		}
	});
</script>

<div class="waveform" bind:this={container} style:height="{height}px"></div>

<style>
	.waveform {
		width: 100%;
		cursor: pointer;
	}
</style>
