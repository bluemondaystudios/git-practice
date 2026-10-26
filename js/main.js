// EDRAM Shuttle and Tours: site behaviour

const WHATSAPP_NUMBER = "27812153162";

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Mobile menu
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.getElementById("site-nav");

navToggle.addEventListener("click", () => {
  const open = siteNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});

siteNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    siteNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
  });
});

// Highlight the nav link for the section in view
const navLinks = siteNav.querySelectorAll("a");
const sections = ["fleet", "services", "pricing", "why-us", "contact"]
  .map((id) => document.getElementById(id));

function updateActiveLink() {
  const offset = window.scrollY + window.innerHeight / 3;
  let current = "top";
  sections.forEach((section) => {
    if (section.offsetTop <= offset) current = section.id;
  });
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
  });
}

window.addEventListener("scroll", updateActiveLink, { passive: true });
updateActiveLink();

// Quote form: build a WhatsApp message and open it
const form = document.getElementById("quote-form");
const formError = document.getElementById("form-error");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form));
  const name = data.name.trim();
  const phone = data.phone.trim();

  if (!name || !phone || !data.service) {
    formError.hidden = false;
    return;
  }
  formError.hidden = true;

  const lines = [
    "Hi EDRAM Shuttle and Tours, I'd like a quote / booking.",
    "",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Service: ${data.service}`,
  ];
  if (data.vehicle) lines.push(`Vehicle: ${data.vehicle}`);
  if (data.date) lines.push(`Date: ${data.date}`);
  if (data.details.trim()) lines.push(`Details: ${data.details.trim()}`);

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "noopener");
});
