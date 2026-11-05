# Bilta Web launch review

The new service is available at `/web-design` on the existing frontend. The same deployment renders this page at `/` when its hostname is `web.bilta.com.ng`; the print shop homepage on other hostnames stays unchanged. No separate backend or database migration is required.

## Proposed package inclusions — owner review before publishing

The owner supplied the prices and promotion dates. The inclusions below are proposals and should be confirmed before public launch.

| Package  | Price                    | Proposed scope                                                                                                                                  |
| -------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Starter  | ₦200,000                 | Up to 3 pages; responsive design; contact form and WhatsApp; basic search engine setup; 1 revision round; handover                              |
| Business | ₦400,000                 | Up to 5 pages; Starter features; editable portfolio or blog; tailored enquiry form; analytics setup; 2 revision rounds                          |
| Commerce | ₦600,000                 | Up to 10 pages; Business features; store with up to 20 initial products; payment integration; product management walkthrough; 3 revision rounds |
| Custom   | Quote after brief review | Requirements and costs are reviewed individually; no automatic calculator or fixed estimate                                                     |

Domain, hosting, paid tools, processor fees and maintenance are separate. Delivery dates are agreed after reviewing the brief, not promised on the page.

## Promotion

Business costs ₦220,000 instead of ₦400,000 from 5 November 2026 through 31 January 2027 inclusive in Africa/Lagos. The exclusive cutoff is `2027-02-01T00:00:00+01:00`. Package prices, brief summaries and WhatsApp messages use the same price function. The page refreshes its clock every 30 seconds and removes expired offer banners and FAQ content. Prices should be confirmed when reviewing each enquiry; the client clock is not a payment authority.

## Portfolio

The three entries were supplied by the owner: AHJU, Danajet and HoodMap. Homepage previews are stored locally in `public/web-design/`; visitors follow links to the original websites. Only owner-supplied work is represented as portfolio work. No unrelated online websites have been added as client projects.

Portfolio and package content is configured in `src/data/webDesign.js`. It is not yet an admin-managed CMS.

## Enquiries

The form validates required fields, prepares a brief and shows a Continue to WhatsApp link. The visitor reviews and sends the message to the existing Bilta WhatsApp number. There is no automatic message sending, online payment or saved CRM job. Custom prices are calculated by the business after reviewing the brief.

## Subdomain connection

After approving the page and package inclusions, add `web.bilta.com.ng` to the existing frontend hosting project. Use the DNS records provided by that host, verify ownership and wait for HTTPS provisioning. The current Vercel SPA rewrite supports both `/` and `/web-design`. DNS and hosting configuration have not been changed by this implementation.

Check the three portfolio links, WhatsApp recipient, package scope and promotion before launch. Use `npm run build`, `npm run lint` and `node --test tests/webDesign.test.js` for local verification.
