# Design

This site follows the **foundations** of the Oberon Logistics design language, `DESIGN.md` in
[oberonlogistics-common](https://github.com/oberonlogistics/oberonlogistics-common), at **v2.2.0**
(commit `60bbbac`). It is a public marketing site, not a signed-in app, so it takes the foundations only.

## What the site follows

| Guide section | How |
|---|---|
| §2.1–2.2 Colour roles, light and dark | `public/brand/tokens.css`. The `--color-*` names in `public/css/style.css` are aliases for `--ol-*` tokens, so dark mode comes from the tokens. |
| §2.3 Type | Plus Jakarta Sans 400–700, self-hosted from `public/brand/fonts.css` and `public/brand/fonts/`. No Google Fonts. Body text uses `--ol-font-sans`. |
| §2.4 Space and radius | Tokens are available; the existing layout keeps its Bootstrap spacing. |
| §2.5 Icons | `public/brand/icons.svg` is vendored for new work. Existing pages keep Bootstrap Icons. |
| §9 Writing | Applies to new copy. |

## What it does not take

- The shared chrome (§5), app tiles (§6), notifications (§7) and the layout patterns (§3). The site keeps its own navbar, hero and marketing sections.
- `components.css` and `outsider.css`. Buttons stay Bootstrap buttons styled in `style.css`.
- The theme key. `js/theme.js` keeps `localStorage["theme"]` (§2.2 names `ol-theme`). There is no account to sync the choice to, and changing the key would reset visitors' saved choice.

## Local differences

- Dark-mode shadows in `style.css` are darker than the token shadows, so cards still lift off the dark page.
- Photo scrims and white text over the navy hero are site styles, not brand roles.
- `<html data-theme="light">` is in the markup, and `js/theme.js` replaces it before first paint. Without script, the page stays light, because the Bootstrap overrides for dark mode key off `data-theme="dark"`.

## Updating

Copy `tokens.css`, `fonts.css`, `fonts/` and `icons.svg` from `packages/brand` at the new tag into `public/brand/`. Then update the version above and check light and dark on the home, Carriers, Careers, Jobs and job posting pages.
