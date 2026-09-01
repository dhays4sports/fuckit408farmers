# A/B Flyer Campaign Identifiers

Use the same two campaign variants in every ZIP:

| Flyer | Variant input | Canonical identifier |
|---|---|---|
| A — local competitive-rate proof | `rate` or `A` | `home_flyer_<ZIP>_rate` |
| B — personal-fit curiosity | `fit` or `B` | `home_flyer_<ZIP>_fit` |

## QR URL templates

Use these canonical human-readable QR destinations on new printed material:

```text
https://408farmers.com/home/qr/<ZIP>/rate/
```

```text
https://408farmers.com/home/qr/<ZIP>/fit/
```

For the current 95118 flyer, use `https://408farmers.com/home/qr/95118/rate/`.

The earlier query-string format remains supported for already-printed QR codes:

```text
https://408farmers.com/home/?campaign_zip=<ZIP>&campaign_variant=rate&utm_source=flyer&utm_medium=qr&utm_campaign=home_flyer
```

```text
https://408farmers.com/home/?campaign_zip=<ZIP>&campaign_variant=fit&utm_source=flyer&utm_medium=qr&utm_campaign=home_flyer
```

Examples for 95118 become `home_flyer_95118_rate` and `home_flyer_95118_fit`. Examples for 10001 become `home_flyer_10001_rate` and `home_flyer_10001_fit`. The implementation accepts any five-digit ZIP and is not tied to those examples.

Do not manually place a homeowner name, street address, phone number, email, or report identifier in campaign parameters.
