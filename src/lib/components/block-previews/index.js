import BlogA from './BlogA.svelte';
import BlogB from './BlogB.svelte';
import BlogC from './BlogC.svelte';
import BlogD from './BlogD.svelte';
import BlogE from './BlogE.svelte';
import CTAA from './CTAA.svelte';
import CTAB from './CTAB.svelte';
import CTAC from './CTAC.svelte';
import CTAD from './CTAD.svelte';
import ContactA from './ContactA.svelte';
import ContactB from './ContactB.svelte';
import ContactC from './ContactC.svelte';
import ContentA from './ContentA.svelte';
import ContentB from './ContentB.svelte';
import ContentC from './ContentC.svelte';
import ContentD from './ContentD.svelte';
import ContentE from './ContentE.svelte';
import ContentF from './ContentF.svelte';
import ContentG from './ContentG.svelte';
import ContentH from './ContentH.svelte';
import EcommerceA from './EcommerceA.svelte';
import EcommerceB from './EcommerceB.svelte';
import EcommerceC from './EcommerceC.svelte';
import FeatureA from './FeatureA.svelte';
import FeatureB from './FeatureB.svelte';
import FeatureC from './FeatureC.svelte';
import FeatureD from './FeatureD.svelte';
import FeatureE from './FeatureE.svelte';
import FeatureF from './FeatureF.svelte';
import FeatureG from './FeatureG.svelte';
import FeatureH from './FeatureH.svelte';
import FooterA from './FooterA.svelte';
import FooterB from './FooterB.svelte';
import FooterC from './FooterC.svelte';
import FooterD from './FooterD.svelte';
import FooterE from './FooterE.svelte';
import GalleryA from './GalleryA.svelte';
import GalleryB from './GalleryB.svelte';
import GalleryC from './GalleryC.svelte';
import HeaderA from './HeaderA.svelte';
import HeaderB from './HeaderB.svelte';
import HeaderC from './HeaderC.svelte';
import HeaderD from './HeaderD.svelte';
import HeroA from './HeroA.svelte';
import HeroB from './HeroB.svelte';
import HeroC from './HeroC.svelte';
import HeroD from './HeroD.svelte';
import HeroE from './HeroE.svelte';
import HeroF from './HeroF.svelte';
import PricingA from './PricingA.svelte';
import PricingB from './PricingB.svelte';
import StatisticA from './StatisticA.svelte';
import StatisticB from './StatisticB.svelte';
import StatisticC from './StatisticC.svelte';
import StepA from './StepA.svelte';
import StepB from './StepB.svelte';
import StepC from './StepC.svelte';
import TeamA from './TeamA.svelte';
import TeamB from './TeamB.svelte';
import TeamC from './TeamC.svelte';
import TestimonialA from './TestimonialA.svelte';
import TestimonialB from './TestimonialB.svelte';
import TestimonialC from './TestimonialC.svelte';

export {
	BlogA,
	BlogB,
	BlogC,
	BlogD,
	BlogE,
	CTAA,
	CTAB,
	CTAC,
	CTAD,
	ContactA,
	ContactB,
	ContactC,
	ContentA,
	ContentB,
	ContentC,
	ContentD,
	ContentE,
	ContentF,
	ContentG,
	ContentH,
	EcommerceA,
	EcommerceB,
	EcommerceC,
	FeatureA,
	FeatureB,
	FeatureC,
	FeatureD,
	FeatureE,
	FeatureF,
	FeatureG,
	FeatureH,
	FooterA,
	FooterB,
	FooterC,
	FooterD,
	FooterE,
	GalleryA,
	GalleryB,
	GalleryC,
	HeaderA,
	HeaderB,
	HeaderC,
	HeaderD,
	HeroA,
	HeroB,
	HeroC,
	HeroD,
	HeroE,
	HeroF,
	PricingA,
	PricingB,
	StatisticA,
	StatisticB,
	StatisticC,
	StepA,
	StepB,
	StepC,
	TeamA,
	TeamB,
	TeamC,
	TestimonialA,
	TestimonialB,
	TestimonialC
};

/** @type {Record<string, typeof BlogA>} */
export const blockPreviews = {
	BlogA,
	BlogB,
	BlogC,
	BlogD,
	BlogE,
	CTAA,
	CTAB,
	CTAC,
	CTAD,
	ContactA,
	ContactB,
	ContactC,
	ContentA,
	ContentB,
	ContentC,
	ContentD,
	ContentE,
	ContentF,
	ContentG,
	ContentH,
	EcommerceA,
	EcommerceB,
	EcommerceC,
	FeatureA,
	FeatureB,
	FeatureC,
	FeatureD,
	FeatureE,
	FeatureF,
	FeatureG,
	FeatureH,
	FooterA,
	FooterB,
	FooterC,
	FooterD,
	FooterE,
	GalleryA,
	GalleryB,
	GalleryC,
	HeaderA,
	HeaderB,
	HeaderC,
	HeaderD,
	HeroA,
	HeroB,
	HeroC,
	HeroD,
	HeroE,
	HeroF,
	PricingA,
	PricingB,
	StatisticA,
	StatisticB,
	StatisticC,
	StepA,
	StepB,
	StepC,
	TeamA,
	TeamB,
	TeamC,
	TestimonialA,
	TestimonialB,
	TestimonialC
};

/**
 * @param {string} id
 * @returns {{ category: string, variant: string }}
 */
function splitBlockId(id) {
	const match = id.match(/^(.*?)([A-Z])$/);
	if (!match) return { category: id, variant: '' };
	return { category: match[1], variant: match[2] };
}

/**
 * Ordered catalog for the builder Blocks HUD and the /dev/block-previews smoke grid.
 * @type {Array<{ id: string, category: string, variant: string, component: typeof BlogA }>}
 */
export const blockCatalog = Object.entries(blockPreviews).map(([id, component]) => {
	const { category, variant } = splitBlockId(id);
	return { id, category, variant, component };
});
