import HeaderA from '#lib/components/block-previews/HeaderA.svelte';
import HeaderB from '#lib/components/block-previews/HeaderB.svelte';
import HeaderC from '#lib/components/block-previews/HeaderC.svelte';
import HeaderD from '#lib/components/block-previews/HeaderD.svelte';
import HeroA from '#lib/components/block-previews/HeroA.svelte';
import HeroB from '#lib/components/block-previews/HeroB.svelte';
import HeroC from '#lib/components/block-previews/HeroC.svelte';
import HeroD from '#lib/components/block-previews/HeroD.svelte';
import HeroE from '#lib/components/block-previews/HeroE.svelte';
import HeroF from '#lib/components/block-previews/HeroF.svelte';
import ContentA from '#lib/components/block-previews/ContentA.svelte';
import ContentE from '#lib/components/block-previews/ContentE.svelte';
import ContentG from '#lib/components/block-previews/ContentG.svelte';
import ContentH from '#lib/components/block-previews/ContentH.svelte';
import CTAA from '#lib/components/block-previews/CTAA.svelte';
import CTAB from '#lib/components/block-previews/CTAB.svelte';
import CTAC from '#lib/components/block-previews/CTAC.svelte';
import CTAD from '#lib/components/block-previews/CTAD.svelte';
import FooterA from '#lib/components/block-previews/FooterA.svelte';
import FooterC from '#lib/components/block-previews/FooterC.svelte';
import FooterD from '#lib/components/block-previews/FooterD.svelte';
import ContentFourListColumns from '#lib/components/blocks/ContentFourListColumns.svelte';
import ContentSplitHeadingBody from '#lib/components/blocks/ContentSplitHeadingBody.svelte';
import ContentThreeMediaCards from '#lib/components/blocks/ContentThreeMediaCards.svelte';
import ContentTwoMediaColumns from '#lib/components/blocks/ContentTwoMediaColumns.svelte';
import CtaCenteredThree from '#lib/components/blocks/CtaCenteredThree.svelte';
import CtaCopyForm from '#lib/components/blocks/CtaCopyForm.svelte';
import CtaEyebrowTwo from '#lib/components/blocks/CtaEyebrowTwo.svelte';
import CtaInlineButton from '#lib/components/blocks/CtaInlineButton.svelte';
import FooterLinkColumnsBar from '#lib/components/blocks/FooterLinkColumnsBar.svelte';
import FooterMinimal from '#lib/components/blocks/FooterMinimal.svelte';
import FooterNewsletterBar from '#lib/components/blocks/FooterNewsletterBar.svelte';
import HeaderCenterLogo from '#lib/components/blocks/HeaderCenterLogo.svelte';
import HeaderLogoCenterNav from '#lib/components/blocks/HeaderLogoCenterNav.svelte';
import HeaderLogoDividerNav from '#lib/components/blocks/HeaderLogoDividerNav.svelte';
import HeaderLogoLinksCta from '#lib/components/blocks/HeaderLogoLinksCta.svelte';
import HeroCenteredImage from '#lib/components/blocks/HeroCenteredImage.svelte';
import HeroCenteredWideCta from '#lib/components/blocks/HeroCenteredWideCta.svelte';
import HeroSplitCopyImage from '#lib/components/blocks/HeroSplitCopyImage.svelte';
import HeroSplitImageCopy from '#lib/components/blocks/HeroSplitImageCopy.svelte';
import HeroSplitImageWideCta from '#lib/components/blocks/HeroSplitImageWideCta.svelte';
import HeroSplitWideCta from '#lib/components/blocks/HeroSplitWideCta.svelte';
import { BLOCK_TYPES } from '#lib/components/blocks/types.js';

/**
 * @typedef {'text' | 'textarea' | 'url' | 'list'} BlockFieldKind
 *
 * @typedef {{
 *   key: string,
 *   label: string,
 *   kind: BlockFieldKind,
 *   itemFields?: Array<{ key: string, label: string, kind: 'text' | 'textarea' | 'url' }>
 * }} BlockField
 *
 * @typedef {{
 *   type: string,
 *   category: string,
 *   label: string,
 *   preview: import('svelte').Component,
 *   component: import('svelte').Component,
 *   defaults: Record<string, unknown>,
 *   fields: BlockField[]
 * }} BlockDefinition
 */

/** @type {BlockField[]} */
const NAV_FIELDS = [
	{ key: 'logoText', label: 'Logo text', kind: 'text' },
	{
		key: 'links',
		label: 'Nav links',
		kind: 'list',
		itemFields: [
			{ key: 'label', label: 'Label', kind: 'text' },
			{ key: 'href', label: 'URL', kind: 'url' }
		]
	},
	{ key: 'ctaLabel', label: 'CTA label', kind: 'text' },
	{ key: 'ctaHref', label: 'CTA URL', kind: 'url' }
];

/** @type {BlockField[]} */
const HERO_FIELDS = [
	{ key: 'headline', label: 'Headline', kind: 'text' },
	{ key: 'body', label: 'Body', kind: 'textarea' },
	{ key: 'primaryLabel', label: 'Primary button', kind: 'text' },
	{ key: 'primaryHref', label: 'Primary URL', kind: 'url' },
	{ key: 'secondaryLabel', label: 'Secondary button', kind: 'text' },
	{ key: 'secondaryHref', label: 'Secondary URL', kind: 'url' },
	{ key: 'imageLabel', label: 'Image label', kind: 'text' }
];

/** @type {Record<string, unknown>} */
const HERO_DEFAULTS = {
	headline: 'Your sound, your stage',
	body: 'Upload tracks, build a page, and share a link that actually sounds like you.',
	primaryLabel: 'Start listening',
	primaryHref: '/',
	secondaryLabel: 'See the feed',
	secondaryHref: '/',
	imageLabel: 'Cover art'
};

/** @type {BlockDefinition[]} */
export const blockDefinitions = [
	{
		type: 'header.logo-links-cta',
		category: 'Header',
		label: 'Logo · links · CTA',
		preview: HeaderA,
		component: HeaderLogoLinksCta,
		defaults: {
			logoText: 'SNDBNK',
			links: [
				{ label: 'Music', href: '/' },
				{ label: 'Shows', href: '/' },
				{ label: 'About', href: '/' },
				{ label: 'Contact', href: '/' }
			],
			ctaLabel: 'Listen',
			ctaHref: '/'
		},
		fields: NAV_FIELDS
	},
	{
		type: 'header.logo-divider-nav',
		category: 'Header',
		label: 'Logo · divider · nav',
		preview: HeaderB,
		component: HeaderLogoDividerNav,
		defaults: {
			logoText: 'SNDBNK',
			links: [
				{ label: 'Releases', href: '/' },
				{ label: 'Mixes', href: '/' },
				{ label: 'Store', href: '/' }
			],
			ctaLabel: 'Join',
			ctaHref: '/'
		},
		fields: NAV_FIELDS
	},
	{
		type: 'header.center-logo',
		category: 'Header',
		label: 'Center logo',
		preview: HeaderC,
		component: HeaderCenterLogo,
		defaults: {
			logoText: 'SNDBNK',
			links: [
				{ label: 'Listen', href: '/' },
				{ label: 'Watch', href: '/' },
				{ label: 'Tour', href: '/' }
			],
			ctaLabel: 'Follow',
			ctaHref: '/'
		},
		fields: NAV_FIELDS
	},
	{
		type: 'header.logo-center-nav',
		category: 'Header',
		label: 'Logo · center nav',
		preview: HeaderD,
		component: HeaderLogoCenterNav,
		defaults: {
			logoText: 'SNDBNK',
			links: [
				{ label: 'Home', href: '/' },
				{ label: 'Music', href: '/' },
				{ label: 'Events', href: '/' },
				{ label: 'Press', href: '/' }
			],
			ctaLabel: 'Book',
			ctaHref: '/'
		},
		fields: NAV_FIELDS
	},
	{
		type: 'hero.split-copy-image',
		category: 'Hero',
		label: 'Split copy + image',
		preview: HeroA,
		component: HeroSplitCopyImage,
		defaults: { ...HERO_DEFAULTS },
		fields: HERO_FIELDS
	},
	{
		type: 'hero.centered-image',
		category: 'Hero',
		label: 'Centered image',
		preview: HeroB,
		component: HeroCenteredImage,
		defaults: {
			...HERO_DEFAULTS,
			headline: 'Drop the next release',
			body: 'A clean page for the track, the story, and the people who show up for it.',
			primaryLabel: 'Upload a track',
			secondaryLabel: 'Browse artists',
			imageLabel: 'Hero visual'
		},
		fields: HERO_FIELDS
	},
	{
		type: 'hero.split-image-copy',
		category: 'Hero',
		label: 'Split image + copy',
		preview: HeroC,
		component: HeroSplitImageCopy,
		defaults: {
			...HERO_DEFAULTS,
			headline: 'Studio tools, listener-ready',
			body: 'Waveforms, playlists, and a profile that works on your domain.',
			primaryLabel: 'Open library',
			secondaryLabel: 'Compare plans',
			imageLabel: 'Studio shot'
		},
		fields: HERO_FIELDS
	},
	{
		type: 'hero.split-wide-cta',
		category: 'Hero',
		label: 'Split · wide CTA',
		preview: HeroD,
		component: HeroSplitWideCta,
		defaults: {
			...HERO_DEFAULTS,
			headline: 'Host the catalog. Own the page.',
			body: 'Bring mixes, samples, and podcasts into one place listeners can actually find.',
			primaryLabel: 'Create your site',
			secondaryLabel: 'How hosting works',
			imageLabel: 'Catalog visual'
		},
		fields: HERO_FIELDS
	},
	{
		type: 'hero.split-image-wide-cta',
		category: 'Hero',
		label: 'Image · wide CTA',
		preview: HeroE,
		component: HeroSplitImageWideCta,
		defaults: {
			...HERO_DEFAULTS,
			headline: 'Play it loud on your domain',
			body: 'Custom domains, accents, and a builder that stays out of the way.',
			primaryLabel: 'Connect a domain',
			secondaryLabel: 'Tour the builder',
			imageLabel: 'Live page'
		},
		fields: HERO_FIELDS
	},
	{
		type: 'hero.centered-wide-cta',
		category: 'Hero',
		label: 'Centered · wide CTA',
		preview: HeroF,
		component: HeroCenteredWideCta,
		defaults: {
			...HERO_DEFAULTS,
			headline: 'One link for every release',
			body: 'Share a page that carries cover art, waveform, and the next listen.',
			primaryLabel: 'Get started',
			secondaryLabel: 'Explore features',
			imageLabel: 'Featured release'
		},
		fields: HERO_FIELDS
	},
	{
		type: 'content.four-list-columns',
		category: 'Content',
		label: 'Four list columns',
		preview: ContentA,
		component: ContentFourListColumns,
		defaults: {
			heading: 'Built for the whole catalog',
			columns: [
				{ title: 'Tracks', items: 'Singles\nEPs\nAlbums' },
				{ title: 'Mixes', items: 'DJ sets\nRadio\nLive' },
				{ title: 'Samples', items: 'One-shots\nLoops\nKits' },
				{ title: 'Shows', items: 'Podcasts\nInterviews\nSeries' }
			],
			ctaLabel: 'See all media types',
			ctaHref: '/'
		},
		fields: [
			{ key: 'heading', label: 'Heading', kind: 'text' },
			{
				key: 'columns',
				label: 'Columns',
				kind: 'list',
				itemFields: [
					{ key: 'title', label: 'Title', kind: 'text' },
					{ key: 'items', label: 'Items (one per line)', kind: 'textarea' }
				]
			},
			{ key: 'ctaLabel', label: 'CTA label', kind: 'text' },
			{ key: 'ctaHref', label: 'CTA URL', kind: 'url' }
		]
	},
	{
		type: 'content.split-heading-body',
		category: 'Content',
		label: 'Split heading · body',
		preview: ContentE,
		component: ContentSplitHeadingBody,
		defaults: {
			heading: 'Less chrome. More signal.',
			body: 'Keep the page focused on the music: clear headlines, short copy, and a single next step for listeners.',
			ctaLabel: 'Read the approach',
			ctaHref: '/'
		},
		fields: [
			{ key: 'heading', label: 'Heading', kind: 'text' },
			{ key: 'body', label: 'Body', kind: 'textarea' },
			{ key: 'ctaLabel', label: 'CTA label', kind: 'text' },
			{ key: 'ctaHref', label: 'CTA URL', kind: 'url' }
		]
	},
	{
		type: 'content.two-media-columns',
		category: 'Content',
		label: 'Two media columns',
		preview: ContentG,
		component: ContentTwoMediaColumns,
		defaults: {
			leftTitle: 'For artists',
			leftBody: 'Upload, tag, and publish without leaving the deck.',
			leftCtaLabel: 'Go to library',
			leftCtaHref: '/',
			leftImageLabel: 'Artist tools',
			rightTitle: 'For listeners',
			rightBody: 'Follow profiles, queue mixes, and keep the player with you.',
			rightCtaLabel: 'Open the feed',
			rightCtaHref: '/',
			rightImageLabel: 'Listener tools'
		},
		fields: [
			{ key: 'leftTitle', label: 'Left title', kind: 'text' },
			{ key: 'leftBody', label: 'Left body', kind: 'textarea' },
			{ key: 'leftCtaLabel', label: 'Left CTA', kind: 'text' },
			{ key: 'leftCtaHref', label: 'Left CTA URL', kind: 'url' },
			{ key: 'leftImageLabel', label: 'Left image label', kind: 'text' },
			{ key: 'rightTitle', label: 'Right title', kind: 'text' },
			{ key: 'rightBody', label: 'Right body', kind: 'textarea' },
			{ key: 'rightCtaLabel', label: 'Right CTA', kind: 'text' },
			{ key: 'rightCtaHref', label: 'Right CTA URL', kind: 'url' },
			{ key: 'rightImageLabel', label: 'Right image label', kind: 'text' }
		]
	},
	{
		type: 'content.three-media-cards',
		category: 'Content',
		label: 'Three media cards',
		preview: ContentH,
		component: ContentThreeMediaCards,
		defaults: {
			heading: 'From the vault',
			subcopy: 'Three ways to show the work without burying the waveform.',
			cards: [
				{
					title: 'Latest single',
					body: 'Lead with cover art and a short hook.',
					linkLabel: 'Play',
					linkHref: '/',
					imageLabel: 'Single'
				},
				{
					title: 'Club mix',
					body: 'Long-form audio with room to breathe.',
					linkLabel: 'Open mix',
					linkHref: '/',
					imageLabel: 'Mix'
				},
				{
					title: 'Sample pack',
					body: 'Loops and one-shots ready for the next session.',
					linkLabel: 'Browse',
					linkHref: '/',
					imageLabel: 'Pack'
				}
			]
		},
		fields: [
			{ key: 'heading', label: 'Heading', kind: 'text' },
			{ key: 'subcopy', label: 'Subcopy', kind: 'textarea' },
			{
				key: 'cards',
				label: 'Cards',
				kind: 'list',
				itemFields: [
					{ key: 'title', label: 'Title', kind: 'text' },
					{ key: 'body', label: 'Body', kind: 'textarea' },
					{ key: 'linkLabel', label: 'Link label', kind: 'text' },
					{ key: 'linkHref', label: 'Link URL', kind: 'url' },
					{ key: 'imageLabel', label: 'Image label', kind: 'text' }
				]
			}
		]
	},
	{
		type: 'cta.inline-button',
		category: 'CTA',
		label: 'Inline button',
		preview: CTAA,
		component: CtaInlineButton,
		defaults: {
			heading: 'Ready to put a page live?',
			subheading: 'Start with a root page and drop in blocks.',
			ctaLabel: 'Open builder',
			ctaHref: '/'
		},
		fields: [
			{ key: 'heading', label: 'Heading', kind: 'text' },
			{ key: 'subheading', label: 'Subheading', kind: 'text' },
			{ key: 'ctaLabel', label: 'CTA label', kind: 'text' },
			{ key: 'ctaHref', label: 'CTA URL', kind: 'url' }
		]
	},
	{
		type: 'cta.copy-form',
		category: 'CTA',
		label: 'Copy + form',
		preview: CTAB,
		component: CtaCopyForm,
		defaults: {
			heading: 'Stay on the list',
			body: 'Drop drops, tour dates, and new mixes — no spam, just signal.',
			panelTitle: 'Join the mailing list',
			emailLabel: 'Email',
			nameLabel: 'Name',
			submitLabel: 'Subscribe'
		},
		fields: [
			{ key: 'heading', label: 'Heading', kind: 'text' },
			{ key: 'body', label: 'Body', kind: 'textarea' },
			{ key: 'panelTitle', label: 'Panel title', kind: 'text' },
			{ key: 'nameLabel', label: 'Name label', kind: 'text' },
			{ key: 'emailLabel', label: 'Email label', kind: 'text' },
			{ key: 'submitLabel', label: 'Submit label', kind: 'text' }
		]
	},
	{
		type: 'cta.centered-three',
		category: 'CTA',
		label: 'Centered three buttons',
		preview: CTAC,
		component: CtaCenteredThree,
		defaults: {
			heading: 'Pick a next move',
			body: 'Whether you are shipping a single or standing up a label site, start here.',
			primaryLabel: 'Start free',
			primaryHref: '/',
			secondaryLabel: 'View plans',
			secondaryHref: '/',
			tertiaryLabel: 'Talk to us',
			tertiaryHref: '/'
		},
		fields: [
			{ key: 'heading', label: 'Heading', kind: 'text' },
			{ key: 'body', label: 'Body', kind: 'textarea' },
			{ key: 'primaryLabel', label: 'Primary', kind: 'text' },
			{ key: 'primaryHref', label: 'Primary URL', kind: 'url' },
			{ key: 'secondaryLabel', label: 'Secondary', kind: 'text' },
			{ key: 'secondaryHref', label: 'Secondary URL', kind: 'url' },
			{ key: 'tertiaryLabel', label: 'Tertiary', kind: 'text' },
			{ key: 'tertiaryHref', label: 'Tertiary URL', kind: 'url' }
		]
	},
	{
		type: 'cta.eyebrow-two',
		category: 'CTA',
		label: 'Eyebrow · two buttons',
		preview: CTAD,
		component: CtaEyebrowTwo,
		defaults: {
			eyebrow: 'New',
			heading: 'Bring your own storage when you are ready',
			primaryLabel: 'Storage settings',
			primaryHref: '/',
			secondaryLabel: 'Learn more',
			secondaryHref: '/'
		},
		fields: [
			{ key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
			{ key: 'heading', label: 'Heading', kind: 'text' },
			{ key: 'primaryLabel', label: 'Primary', kind: 'text' },
			{ key: 'primaryHref', label: 'Primary URL', kind: 'url' },
			{ key: 'secondaryLabel', label: 'Secondary', kind: 'text' },
			{ key: 'secondaryHref', label: 'Secondary URL', kind: 'url' }
		]
	},
	{
		type: 'footer.link-columns-bar',
		category: 'Footer',
		label: 'Link columns + bar',
		preview: FooterA,
		component: FooterLinkColumnsBar,
		defaults: {
			logoText: 'SNDBNK',
			columns: [
				{ title: 'Product', links: 'Feed\nLibrary\nPlans' },
				{ title: 'Creators', links: 'Upload\nSites\nDomains' },
				{ title: 'Company', links: 'About\nPrivacy\nTerms' },
				{ title: 'Help', links: 'Support\nStatus\nContact' }
			],
			copyright: '© SNDBNK',
			meta: 'Audio multi-tool'
		},
		fields: [
			{ key: 'logoText', label: 'Logo text', kind: 'text' },
			{
				key: 'columns',
				label: 'Columns',
				kind: 'list',
				itemFields: [
					{ key: 'title', label: 'Title', kind: 'text' },
					{ key: 'links', label: 'Links (one per line)', kind: 'textarea' }
				]
			},
			{ key: 'copyright', label: 'Copyright', kind: 'text' },
			{ key: 'meta', label: 'Meta', kind: 'text' }
		]
	},
	{
		type: 'footer.newsletter-bar',
		category: 'Footer',
		label: 'Newsletter columns',
		preview: FooterC,
		component: FooterNewsletterBar,
		defaults: {
			columns: [
				{ title: 'Listen', links: 'Feed\nCharts\nNew' },
				{ title: 'Create', links: 'Upload\nPlaylists\nSites' },
				{ title: 'Account', links: 'Settings\nBilling\nStorage' },
				{ title: 'Legal', links: 'Terms\nPrivacy\nCopyright' },
				{ title: 'Social', links: 'X\nInstagram\nYouTube' }
			],
			newsletterTitle: 'Get release notes',
			emailPlaceholder: 'you@example.com',
			submitLabel: 'Join',
			copyright: '© SNDBNK',
			meta: 'Made for artists & listeners'
		},
		fields: [
			{
				key: 'columns',
				label: 'Columns',
				kind: 'list',
				itemFields: [
					{ key: 'title', label: 'Title', kind: 'text' },
					{ key: 'links', label: 'Links (one per line)', kind: 'textarea' }
				]
			},
			{ key: 'newsletterTitle', label: 'Newsletter title', kind: 'text' },
			{ key: 'emailPlaceholder', label: 'Email placeholder', kind: 'text' },
			{ key: 'submitLabel', label: 'Submit label', kind: 'text' },
			{ key: 'copyright', label: 'Copyright', kind: 'text' },
			{ key: 'meta', label: 'Meta', kind: 'text' }
		]
	},
	{
		type: 'footer.minimal',
		category: 'Footer',
		label: 'Minimal bar',
		preview: FooterD,
		component: FooterMinimal,
		defaults: {
			logoText: 'SNDBNK',
			meta: 'Audio host for creators',
			rightMeta: 'sndbnk.com'
		},
		fields: [
			{ key: 'logoText', label: 'Logo text', kind: 'text' },
			{ key: 'meta', label: 'Meta', kind: 'text' },
			{ key: 'rightMeta', label: 'Right meta', kind: 'text' }
		]
	}
];

/** @type {Map<string, BlockDefinition>} */
const byType = new Map(blockDefinitions.map((d) => [d.type, d]));

/**
 * @param {string} type
 * @returns {BlockDefinition | null}
 */
export function getBlockDefinition(type) {
	return byType.get(type) ?? null;
}

/**
 * Catalog entries for the Blocks HUD (first slice only).
 */
export const insertableBlockCatalog = blockDefinitions.map((d) => ({
	type: d.type,
	category: d.category,
	label: d.label,
	preview: d.preview
}));

/** Page body catalog — headers/footers are site chrome, not page inserts. */
export const pageInsertableBlockCatalog = insertableBlockCatalog.filter(
	(d) => d.category !== 'Header' && d.category !== 'Footer'
);

export const headerBlockCatalog = insertableBlockCatalog.filter((d) => d.category === 'Header');
export const footerBlockCatalog = insertableBlockCatalog.filter((d) => d.category === 'Footer');

// Dev-time sanity: registry types must match the server allowlist.
if (blockDefinitions.length !== BLOCK_TYPES.length) {
	console.warn(
		`[blocks] registry has ${blockDefinitions.length} types; types.js has ${BLOCK_TYPES.length}`
	);
}
