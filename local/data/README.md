# 408FARMERS Local merchant data

Current catalog state: **408-LOCAL-1.9 — Pilot Merchant Launch candidate**

This directory is the static source-of-truth layer for the Local MVP. The structure is intentionally storage-neutral so the same merchant IDs, perk IDs, slugs, statuses, and date semantics can later move to Cloudflare KV/D1 or another server-side store without changing consumer URLs.

## Canonical catalog

`catalog.json` contains two normalized collections:

- `merchants[]` — one record per merchant;
- `perks[]` — one record per merchant-owned offer, joined by `merchant_id`.

Keeping merchants and perks separate avoids duplicating merchant profile data when a business eventually has seasonal or replacement offers.

## Stable identifiers

- `merchant_id` is the internal durable key and must never be recycled.
- `slug` is the canonical consumer-route key: `/local/{slug}/`.
- `perk_id` is the durable offer key used later for attribution and redemption analytics.

Changing a display name must not require changing `merchant_id`. A slug change should be treated as a routing migration and eventually receive an explicit redirect.

## Merchant lifecycle

- `draft` — model/onboarding record; never public.
- `active` — eligible for public discovery; its current perk is resolved independently, so the merchant may remain discoverable while an offer is temporarily unavailable.
- `paused` — temporarily hidden from active discovery.
- `inactive` — retired/removed from active discovery.

## Perk lifecycle

A perk is renderable as active only when all of the following are true:

1. merchant status is `active`;
2. perk status is `active`;
3. current time is not before `start_at`, when supplied;
4. current time is not after `end_at`, when supplied;
5. an evergreen perk does not require an end date;
6. every perk contains the independent-offer language.

Expired, paused, inactive, scheduled, or draft offers may be retained in data for history but cannot present as active.

## Insurance / endorsement boundary

Merchant copy must not say or imply that Farmers Insurance or 408FARMERS recommends, certifies, approves, guarantees, vets, or endorses a participating business. Participation is a marketing/community relationship only.

Every perk must carry:

> Offer provided by the participating business and subject to its terms and availability. No insurance purchase or quote required.

Local participation and perk access remain independent of insurance pricing, discounts, eligibility, underwriting, coverage, purchase, or quote activity.

## Fixture records

The three records in `catalog.json` are explicitly marked `fixture:true`, remain `draft`, and are not rendered on `/local/`. They exist only to prove the schema and reusable renderer across Eat & Drink, Home, and Auto before real merchants are activated in `408-LOCAL-1.9`.

## Runtime helper

`/shared/local-data-model.js` owns validation, status/date resolution, stable route construction, merchant/perk joining, and the single reusable fixture-card renderer used by QA. `408-LOCAL-1.3` can consume these helpers to build the public discovery directory without changing the underlying contract.

## 408-LOCAL-1.4 merchant detail / redemption consumption

`/local/{slug}/` now consumes this same catalog through `shared/local-merchant.js`. Only active, non-fixture merchants can resolve publicly. An active, in-window perk exposes the MVP `Use This Perk` show-your-screen action only when `redemption_method` is `show_screen`; other configured redemption methods fail closed until their required instructions/data are modeled in a later sprint. No account, consumer identity, insurance quote, or insurance purchase is required.


## 408-LOCAL-1.9 pilot activation

The catalog now contains the first real, non-fixture active merchant: **Stevie's Bar & Grill** (`stevies-bar-grill-sj`) with the canonical route `/local/stevies-bar-grill/` and one active show-your-screen perk (`stevies-food-na-20`).

The original three model fixtures remain `draft` and non-public. No Auto or Home business is published until a real participating merchant is selected and its exact merchant-owned offer/terms are supplied.
