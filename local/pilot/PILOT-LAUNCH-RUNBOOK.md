# 408-LOCAL-1.9 — Pilot Merchant Launch runbook

## Current operational state
The first real pilot merchant, **Stevie's Bar & Grill**, is loaded as an active Eat & Drink merchant with its merchant-owned Local perk. Two required pilot slots remain intentionally unfilled: one Auto merchant and one Home merchant.

No fake or placeholder business is published for those slots. The existing fixture records remain draft and non-public.

## To operationally close 408-LOCAL-1.9
For each remaining merchant, capture and validate:

- exact business name;
- public address / city / neighborhood;
- official website and social URL when available;
- merchant category (`auto` or `home`);
- exact merchant-owned offer wording;
- exact merchant terms and availability;
- whether offer is evergreen or has start/end dates;
- show-your-screen redemption approval;
- merchant staff acknowledgment of the Local/insurance separation rule.

Then:

1. create a stable merchant ID and canonical slug;
2. add the merchant to `local/data/catalog.json` with `fixture:false` and `status:active` only after validation;
3. add one approved active perk joined by `merchant_id`;
4. generate at least table/counter/placard QR campaign URLs carrying `partner_id`, `perk_id`, `merchant_slug`, `surface`, campaign, variant, and UTM values;
5. verify QR decode and canonical route resolution;
6. confirm the offer renders and **Use This Perk** works without any insurance action;
7. give merchant staff the redemption guide;
8. physically test at least one printed QR at the merchant before broad distribution.

## Approved offer frameworks awaiting merchant identity
- Auto pilot slot: **10% off services**.
- Home pilot slot: **15% off services**.

These frameworks are not public offers until a real merchant owns and approves the exact terms.

## Frozen program boundary
Perks are merchant-funded/merchant-owned and publicly usable. No insurance purchase, quote, lead submission, or CoverageFit assessment may be required to view or redeem them.
