/**
 * Shared geoblocking configuration for AutoPay Protocol.
 *
 * Single source of truth for blocked country lists.
 * Used by both the Vercel edge middleware (frontend) and the relayer API.
 *
 * Country codes are ISO 3166-1 alpha-2.
 * Last reviewed: 2026-03-02
 */

/** Hard-blocked countries — no service whatsoever.
 *
 * Includes:
 * - OFAC comprehensively sanctioned jurisdictions
 * - UK OFSI sanctioned jurisdictions
 * - EU sanctioned jurisdictions
 * - Countries with outright crypto bans
 */
export const HARD_BLOCKED_COUNTRIES = new Set([
  // --- OFAC / OFSI / EU comprehensive sanctions ---
  'KP', // North Korea
  'IR', // Iran
  'SY', // Syria
  'RU', // Russia
  'BY', // Belarus
  'CU', // Cuba
  'MM', // Myanmar (Burma)
  'VE', // Venezuela
  'SD', // Sudan
  'SS', // South Sudan
  'SO', // Somalia
  'LY', // Libya

  // --- Crypto-banned jurisdictions ---
  'CN', // China — all crypto transactions banned since Sept 2021
  'DZ', // Algeria — Financial Law 2018 prohibits crypto
  'BD', // Bangladesh — central bank prohibition
  'NP', // Nepal — central bank prohibition
  'BO', // Bolivia — central bank prohibition
])

/** Soft-blocked countries — restricted access, enhanced due diligence required.
 *
 * These countries have partial sanctions, crypto restrictions, or are on
 * FATF grey/black lists. Blocked initially for safety; can be revisited
 * with proper compliance infrastructure.
 */
export const SOFT_BLOCKED_COUNTRIES = new Set([
  'EG', // Egypt — de facto crypto ban
  'MA', // Morocco — crypto prohibited since 2017
  'TN', // Tunisia — central bank prohibition
  'QA', // Qatar — crypto services prohibited
  'YE', // Yemen — conflict zone, targeted sanctions
  'IQ', // Iraq — residual OFAC sanctions
  'LB', // Lebanon — Hezbollah-related US sanctions
  'ZW', // Zimbabwe — active US/UK targeted sanctions
  'CD', // DR Congo — targeted sanctions, FATF grey list
  'CF', // Central African Republic — UN/EU sanctions
  'ML', // Mali — EU/UN targeted sanctions, FATF grey list
  'ET', // Ethiopia — US EO targeting conflict parties
  'NI', // Nicaragua — expanding US targeted sanctions
  'PK', // Pakistan — unclear crypto legality
])

/** All blocked countries (hard + soft) combined for simple lookups. */
export const ALL_BLOCKED_COUNTRIES = new Set([
  ...HARD_BLOCKED_COUNTRIES,
  ...SOFT_BLOCKED_COUNTRIES,
])

/** Blocked Ukrainian regions (occupied territories).
 *
 * Russia is already hard-blocked (most IPs in these territories resolve to
 * Russian ISPs anyway). These are an additional check when country === 'UA'.
 *
 * ISO 3166-2 region codes:
 * - UA-43: Crimea (Autonomous Republic of Crimea)
 * - UA-14: Donetsk Oblast
 * - UA-09: Luhansk Oblast
 */
export const BLOCKED_UA_REGIONS = new Set(['UA-43', 'UA-14', 'UA-09'])
