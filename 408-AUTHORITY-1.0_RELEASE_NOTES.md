# 408-AUTHORITY-1.0 Release Notes

Date: 2026-09-01

## Outcome

The 408farmers.com runtime now presents the governing consumer identity in this order:

1. Farmers Insurance official logo.
2. Virginia Tam Insurance Agency, Inc.
3. Dylan Haysbert · CA License #4528400.
4. The inherited 408FARMERS logo as a smaller mnemonic/contact continuity mark.

The top authority strip deliberately does **not** use the Farmers Authorized Agency credential image. It uses the official Farmers Insurance SVG obtained from the official Farmers website and stored locally without graphic modification:

`https://www.farmers.com/content/_farmers/web-assets/images/logos/farmers-logo-desktop.svg`

## Scope

- Added the shared authority-first header to all 28 runtime HTML surfaces.
- Covered campaign, intake, receipt, legal, local, life, professional, score, contact, referral, error, and operations routes.
- Preserved the inherited 408FARMERS mark in the existing secondary site header for mnemonic continuity.
- Preserved all inherited forms, route paths, scripts, consent language, attribution fields, callback handoffs, lead transports, life privacy boundaries, and CoverageFit transitions.
- Added shared responsive styling without changing page-specific hero, form, button, or editorial styling.

## Verification

Command:

```bash
node --test tests/*.test.cjs
```

Result: 20 passed, 0 failed.

The authority-specific gate verifies every runtime page, the official logo reference, agency/producer identity, absence of the Authorized Agency asset in the top strip, and continued 408FARMERS mnemonic branding.

## Baseline

- Baseline archive: `408FARMERS_TECH-PUESTO-LAUNCH-1.0_PROGRESSIVE_CAPTURE_CALLBACK_CHOICES_ROOT_DEPLOYABLE(1).zip`
- Baseline SHA-256: `cf2abf181a001a0e4622e368eb1bd24c93f9e2e395402065a88153f19d66e411`
- Functional files added or modified: 35

