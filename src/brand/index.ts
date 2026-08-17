/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE ONE IMPORT SITE for the active brand.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS: forty files importing `@brand` directly. Each
 * one is a place the next brand has to be checked, and the checking is done by
 * a person, so some of it is not done. Funnelling every read through one module
 * means the blast radius of a brand swap is this file plus theme.ts, and the
 * gate can enforce that by grepping for `@brand` outside this directory.
 *
 * `COLORS` is FROZEN. Tokens are read tens of thousands of times a frame and
 * written zero times; freezing turns a stray assignment from a rendering
 * mystery into a thrown error at the line that caused it.
 */

import * as active from '@brand';
import { buildTheme, type Theme } from './theme';
import type { BrandModule } from './types';

const brand = active as unknown as BrandModule;

export const COLORS: Readonly<Theme> = Object.freeze(buildTheme(brand));

export const IDENTITY = brand.identity;
export const BRAND_COLORS = brand.colors;
export const BRAND_TYPE = brand.type;
export const SHAPE = brand.shape;
export const BRAND_AD = brand.ad;
export const VOCAB = brand.vocab;
export const BRAND_COPY = brand.copy;
export const LOGO = brand.logo;

export { withAlpha, mix } from './theme';
export type { Theme } from './theme';

/**
 * Storage keys DERIVED FROM THE SLUG, never written out.
 *
 * Two brands built from this template will be installed on the same device by
 * the same person during a review. Sharing a key means brand B reads brand A's
 * unlocked levels and high score, which looks like a bug in the save system and
 * gets debugged as one.
 */
export const SAVE_KEY = `${brand.identity.slug}.deliveryclimb.save.v1`;

/** Discriminates our history entry from anything else on the page. */
export const HISTORY_STATE = `${brand.identity.slug}:deliveryclimb`;
