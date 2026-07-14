# Xtra TV Pro

A modern live IPTV streaming platform. Browse channels by category, search, add your own custom channels via `.m3u` / `.m3u8` playlist links, and enjoy live TV directly in the browser.

## Features

### Viewer-facing
- Live channel streaming via HLS (`.m3u8`)
- Category-based browsing and search
- Add custom channels from `.m3u` / `.m3u8` playlist files or direct links
- Favorites and local preferences saved per device
- Scrolling news/announcement ticker
- Auto screen-orientation handling for fullscreen playback (`js/orientation-web.js`)

### Admin Dashboard
- **Channel Guide Manager** — add, edit, delete channels (name, url, logo, category, country, DRM keys)
  - **Bulk Export/Backup (JSON)** — download the full channel list as a single JSON file, not just an M3U playlist
  - **Restore Backup (JSON)** — re-import channels from an exported file (or any JSON shaped like `{ "channels": [...] }` / a plain array of channel objects)
  - **Dead-Link Checker** — tests every channel's stream URL with the same hls.js engine the player uses, so a pass means it will actually play; runs 5 at a time so large lists don't freeze the tab; each channel gets up to 9s before being marked `BROKEN`. Results show as `UNCHECKED`, `OK`, `OK*` (weaker fallback check, e.g. Safari's native HLS path), or `BROKEN`
  - **Bulk category reassign** — select multiple channels via checkboxes (current page only, filtered-out channels unaffected) and reassign them to a category in one action
- **Visitor Analytics** — traffic charts with date-range filters (today/week/month/year/custom)
  - **Most-Watched Channels report** — ranks channels by anonymous view-count events logged to the `channel_hits` Firestore collection (no personal data — just channel id/name, timestamp, device type), with the same date-range filter and a "clear channel-view history" action
- **Admins & Roles** (visible to **Owner** role only) — create new admin accounts (email + temporary password via Firebase Auth) and assign roles:
  - **Owner** — full access, including managing other admins
  - **Editor** — add/edit/delete channels, no admin management
  - **Viewer** — read-only dashboard
  - The first admin to open the dashboard is auto-assigned Owner. Roles are enforced both in the UI and in `firestore.rules`: only an Owner can change or remove a role record, and only Owner/Editor accounts can write channel data — a Viewer's database access is read-only.
- Firebase Authentication (email/password) admin login

## Project Structure
- `index.html` — entry point
- `js/app.js` — main application bundle (React, hls.js, Firebase, Vite build output)
- `js/auth-web.js` — Firebase Authentication helper for admin login/logout and admin-account creation
- `js/firestore-rest.js` — Firestore REST API calls (authenticated requests using the admin's ID token)
- `js/analytics-web.js` — visitor & channel-hit analytics logging/aggregation
- `js/storage-web.js` — local storage of per-device preferences/favorites
- `js/orientation-web.js` — screen-orientation handling for fullscreen playback
- `css/app.css` — application styles
- `svg/logo.svg` — app logo / favicon
- `img/banner.jpg` — promo/banner image
- `firestore.rules` — Firestore security rules (channels, analytics, admin roles)
- `LICENSE` — MIT license text

## Data
Channel data is stored and synced in real time via **Firebase Firestore**. Live streams are played directly from their HLS (`.m3u8`) sources.

## Deployment
This is a fully static site and can be deployed anywhere that serves static files:

1. **Netlify / Vercel**: drag and drop this folder — no build step required
2. **GitHub Pages**: push the contents to a repository and enable Pages
3. **Local testing**: run `python3 -m http.server 8000` and open `localhost:8000`

## Notes
- Some HLS streams may be blocked in certain browsers or regions due to CORS or geo-restrictions, depending on the source provider.
- The Firebase config in `js/app.js` (`projectId`, `apiKey`, etc.) is meant to be public in client-side apps — it is **not** a secret. Real protection comes from your **Firestore security rules**. A starting-point example is included in [`firestore.rules`](./firestore.rules); publish your own before deploying.
- Admin login uses **Firebase Authentication** (email/password) — see `js/auth-web.js`. Before deploying:
  1. In the Firebase Console, go to **Authentication → Sign-in method** and enable **Email/Password**.
  2. Under **Authentication → Users**, add one user per admin (email + password).
  3. Make sure `firestore.rules` requires `request.auth != null` for writes (already reflected in [`firestore.rules`](./firestore.rules)), then publish the rules.
  - No credentials live in the code — the bundle only shows *how* login works, not *who* can log in.
- This repo contains the built/bundled production output (`js/app.js` is a single minified Vite bundle including React, hls.js, Firebase, etc.), not the original unbundled source project.
- `firestore.rules` includes rules for the `channel_hits` (Most-Watched Channels) and `admin_roles` (Admins & Roles) collections used by the admin dashboard — deploy it via Firebase Console → Firestore → Rules, or `firebase deploy --only firestore:rules`, before using those features.