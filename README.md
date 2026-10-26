# EDRAM Shuttle and Tours: website

Static website for **EDRAM Shuttle and Tours** (Gezina, Pretoria), to be served at
[edramshuttle.co.za](https://edramshuttle.co.za).

## Structure

```
index.html          single-page site (Home, Fleet, Services, Pricing, Why Us, Contact)
css/styles.css      styles (brand colours are CSS variables at the top)
js/main.js          mobile menu, active nav link, quote form → WhatsApp
assets/favicon.svg  site icon
CNAME               custom domain for GitHub Pages
```

## Preview locally

Open `index.html` in a browser, or run `python3 -m http.server` and visit http://localhost:8000.

## Editing

- **Prices**: in the `#pricing` section of `index.html` (Price List 2026).
- **Phone / WhatsApp**: `081 215 3162` appears in `index.html`; the WhatsApp number
  used by the quote form is `WHATSAPP_NUMBER` in `js/main.js`.
- **Hero photo**: add a photo at `assets/hero.jpg` (e.g. one of the vehicles) and it
  will appear behind the hero text automatically.

## Quote form

The "Get a Quote / Book Now" form has no server. On submit, it opens WhatsApp with
the customer's details pre-filled, ready to send to 081 215 3162.
