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

/**
 * THE MENU — palettes and names, passed through from the brand.
 *
 * Exported here rather than as Theme tokens, and that is deliberate. `Theme` is
 * flat strings by construction: the per-brand override map in theme.ts assigns
 * strings into it by key, so a nested array field would be assignable to by a
 * typo with nothing to complain. A dish's colours are also read as a SET, so
 * they stay a set rather than being flattened into `food0Body`, `food0Shade`, …
 */
export const FOOD_PALETTE = brand.colors.foods;
export const FOOD_NAMES = brand.vocab.foods;

/**
 * Wraps, so a level's `kind` index can never be out of range.
 *
 * A level authored against a brand with five dishes must not crash on a brand
 * that ships three — it should serve dish 0 again. An out-of-range index here
 * would be a level-data error surfacing as an undefined-colour render, which is
 * a blank sprite and a very cold trail back to the cause.
 */
export function foodKind(kind: number): number {
  const n = FOOD_PALETTE.length;
  return ((kind % n) + n) % n;
}

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
