# Phase 3 QA Checklist

Use this checklist to validate the Phase 3.4 product features in staging or prod.

## Links
- Create link with auto-generated code.
- Create link with custom code; confirm uniqueness check and conflict error.
- Edit link and confirm updates reflect in list and redirect.

## Bulk operations
- Bulk create via JSON in admin; verify created links appear.
- Bulk create via CSV import; confirm error report CSV is downloadable for failed rows.
- Bulk delete a list of short codes; verify removed from list and redirects 404.

## Tags and groups
- Create tags/groups; assign to links.
- Filter by tag and group; confirm list updates correctly.

## UTM builder
- Apply UTM parameters; confirm final URL preview matches expectation.

## Password-protected links
- Set a password; confirm redirect prompts for password.
- Verify correct password grants access; wrong password returns error.
- Clear password; confirm prompt disappears.

## A/B variants
- Create two variants with weights totaling 100.
- Refresh redirect several times; confirm distribution is roughly aligned.
- Remove variants; confirm base destination used.

## Deep links
- Enable deep link and set iOS/Android fallback URLs.
- On desktop, confirm redirect goes to web URL.
- On mobile, confirm deep link page renders and falls back after delay.

## Analytics
- Clicks increment for standard and variant links.
- Geo tables update for country/city if configured.

## UI polish
- Toasts fire for create/update/delete actions.
- QR modal opens in-page (not a new tab).

## Run log
- 2026-01-10 15:53:19 UTC (prod https://okleaf.link)
- Pass: login, tag/group create, short code availability, custom code create, password prompt (401 HTML), deep link page (mobile UA), variants update, bulk create, bulk import, bulk delete, analytics summary.
- Notes: bulk create auto-generates short codes (no custom short_code input); bulk delete expects `codes` in request body.
- Manual pending (UI-only): UTM builder, tags/groups filters, toasts, QR modal, in-admin CSV upload, and click distribution verification for variants.
