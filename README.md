# EDRAM Shuttle and Tours: website

Static website for **EDRAM Shuttle and Tours** (Gezina, Pretoria), to be served at
[edramshuttle.co.za](https://edramshuttle.co.za).

## Structure

```
index.html          single-page site (Home, Fleet, Services, Funerals, Quotes, Why Us, Contact)
css/styles.css      styles (brand colours are CSS variables at the top)
js/main.js          mobile menu, motion, quote form → WhatsApp
assets/favicon.svg  site icon
CNAME               custom domain for GitHub Pages
```

## Preview locally

Open `index.html` in a browser, or run `python3 -m http.server` and visit http://localhost:8000.

## Editing

- **Pricing**: the site shows no prices; the `#quote` section explains how to get a
  quote, and every "Get a quote" link pre-fills the form at `#contact`.
- **Funeral shuttles**: the `#funerals` section in `index.html`.
- **Map**: the Google Maps embed in the `#contact` section (`.map-card`).
- **Phone / WhatsApp**: `081 215 3162` appears in `index.html`; the WhatsApp number
  used by the quote form is `WHATSAPP_NUMBER` in `js/main.js`.
- **Hero photos**: `assets/hero.jpg` (wide, shown beside the text on desktop) and
  `assets/hero-mobile.jpg` (tall, fills the landing screen behind the text on phones
  and tablets; its top fades to black so the headline stays readable). Replace them
  with real fleet photos when available, keeping the same file names.

## Quote form

The "Get a Quote / Book Now" form has no server. On submit, it opens WhatsApp with
the customer's details pre-filled, ready to send to 081 215 3162.
