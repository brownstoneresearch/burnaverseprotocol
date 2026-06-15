# Burnaverse Protocol Website

Domain: burnaverseprotocol.xyz

## What’s included
- Multi-page static website (HTML/CSS/JS)
- Contract copy + Add-to-MetaMask button
- SEO basics (meta tags), sitemap.xml, robots.txt
- Placeholder social links (edit in `assets/app.js`)

## Quick deploy
- Netlify / Vercel / GitHub Pages: upload the folder contents.

## Update social links
Edit `assets/app.js` and set:
- telegram, x, discord, medium, whitepaper, audit, github

Contract:
0xd14Ec02A022D2BD4117a0EEba966423253a48ad1


## Advanced upgrade added
- Advanced CSS layer with glassmorphism, improved focus states, reveal animations, responsive calculator cards, floating quick actions and install prompt.
- PWA support: manifest.webmanifest + sw.js for installable/offline-friendly static delivery.
- Live DEX snapshot remains connected to DexScreener and now has smoother UI behavior.
- New V2 Liquidity Planner on the homepage for BUV/BNB ratio, starting price, pool value and FDV calculations.
- Smart share button, scroll progress bar, accessibility skip-link and improved mobile interaction.
- Added email-confirmation-template.html for official project representation emails.

## Notes
- PancakeSwap link now points directly to the BSC swap screen with BUV as output token.
- Service worker requires HTTPS or localhost. It will not run from file://.
- For production, update BNB price in the liquidity planner or connect a live price API if desired.
