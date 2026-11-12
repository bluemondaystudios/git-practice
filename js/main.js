// EDRAM Shuttle and Tours: site behaviour

const WHATSAPP_NUMBER = "27812153162";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

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

// Hero headline: wrap each word so it can slide up on its own
const heroTitle = document.querySelector(".hero h1");
const titleText = heroTitle.textContent.trim();
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

heroTitle.setAttribute("aria-label", titleText);
heroTitle.innerHTML = titleText
  .split(/\s+/)
  .map((word, i) => `<span class="word" aria-hidden="true"><span style="--i:${i}">${escapeHtml(word)}</span></span>`)
  .join(" ");

// Scroll effects: header state, progress bar, active nav link, hero parallax
const header = document.querySelector(".site-header");
const hero = document.querySelector(".hero");
const heroInner = document.querySelector(".hero-inner");
const navLinks = siteNav.querySelectorAll("a");
const sections = ["fleet", "services", "funerals", "quote", "why-us", "contact"]
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

function onScroll() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;

  header.classList.toggle("scrolled", y > 10);
  header.style.setProperty("--progress", max > 0 ? Math.min(y / max, 1) : 0);
  updateActiveLink();

  // At the very bottom, reveal anything the observer's margin kept hidden
  if (y >= max - 2) {
    document.querySelectorAll(".reveal:not(.in)").forEach(show);
  }

  if (!reduceMotion && y < hero.offsetHeight) {
    hero.style.setProperty("--parallax", `${y * 0.35}px`);
    heroInner.style.setProperty("--hero-drift", `${y * 0.18}px`);
  }
}

let scrollTicking = false;
window.addEventListener("scroll", () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    onScroll();
    scrollTicking = false;
  });
}, { passive: true });
onScroll();

// Scroll reveal: elements fade/slide in, staggered with their siblings
const revealGroups = [
  [".section-title", ""],
  [".section-subtitle", ""],
  [".fleet-card", ""],
  [".service-card", ""],
  [".funeral-intro", "reveal-calm"],
  [".funeral-values li", "reveal-calm"],
  [".funeral-note", "reveal-calm"],
  [".quote-section .eyebrow", ""],
  [".quote-statement", ""],
  [".quote-lead", ""],
  [".quote-step", "reveal-zoom"],
  [".quote-actions", ""],
  [".why-card", "reveal-zoom"],
  [".contact-list li", "reveal-left"],
  [".map-card", ""],
  [".quote-form", ""],
  [".footer-slogan", ""],
];

const revealEls = [];
revealGroups.forEach(([selector, variant]) => {
  document.querySelectorAll(selector).forEach((el) => {
    const index = Array.prototype.indexOf.call(el.parentElement.children, el);
    el.classList.add("reveal");
    if (variant) el.classList.add(variant);
    el.style.setProperty("--d", `${Math.min(index, 6) * 0.09}s`);
    revealEls.push(el);
  });
});

// Once revealed, drop the reveal classes so hover transitions feel snappy again
function settle(el) {
  el.classList.remove("reveal", "reveal-left", "reveal-zoom");
  el.style.removeProperty("--d");
}

function show(el) {
  el.classList.add("in");
  if (reduceMotion) {
    settle(el);
    return;
  }
  const onEnd = (event) => {
    if (event.target !== el || event.propertyName !== "transform") return;
    el.removeEventListener("transitionend", onEnd);
    settle(el);
  };
  el.addEventListener("transitionend", onEnd);
}

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      revealObserver.unobserve(entry.target);
      show(entry.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach(show);
}

// Pointer-only effects: card tilt + glare, magnetic buttons, pricing spotlight
if (finePointer && !reduceMotion) {
  document.querySelectorAll(".fleet-card, .why-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (card.classList.contains("reveal")) return;
      const r = card.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width;
      const y = (event.clientY - r.top) / r.height;
      card.style.transform =
        `perspective(700px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 12}deg) translateY(-6px)`;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  document.querySelectorAll(".hero .btn, .header-cta, .quote-actions .btn").forEach((btn) => {
    btn.addEventListener("pointermove", (event) => {
      const r = btn.getBoundingClientRect();
      const dx = event.clientX - (r.left + r.width / 2);
      const dy = event.clientY - (r.top + r.height / 2);
      btn.style.translate = `${dx * 0.2}px ${dy * 0.3}px`;
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.translate = "";
    });
  });

  document.querySelectorAll(".section-dark").forEach((section) => {
    section.addEventListener("pointermove", (event) => {
      const r = section.getBoundingClientRect();
      section.style.setProperty("--sx", `${event.clientX - r.left}px`);
      section.style.setProperty("--sy", `${event.clientY - r.top}px`);
    });
  });
}

// Click ripple on every button
if (!reduceMotion) {
  document.addEventListener("pointerdown", (event) => {
    const btn = event.target.closest(".btn");
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - r.left - size / 2}px`;
    ripple.style.top = `${event.clientY - r.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });
}

// Quote form: build a WhatsApp message and open it
const form = document.getElementById("quote-form");

// "Get a quote" links pre-select the service or vehicle, then bring the form into focus
document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-service], [data-vehicle]");
  if (!link) return;
  if (link.dataset.service) form.elements.service.value = link.dataset.service;
  if (link.dataset.vehicle) form.elements.vehicle.value = link.dataset.vehicle;
  form.classList.remove("flash");
  void form.offsetWidth; // restart the animation
  form.classList.add("flash");
  setTimeout(() => form.elements.name.focus({ preventScroll: true }), 700);
});
const formError = document.getElementById("form-error");
const submitBtn = form.querySelector('button[type="submit"]');
const submitLabel = submitBtn.textContent;

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form));
  const name = data.name.trim();
  const phone = data.phone.trim();

  if (!name || !phone || !data.service) {
    formError.hidden = false;
    form.classList.remove("shake");
    void form.offsetWidth; // restart the animation
    form.classList.add("shake");
    return;
  }
  formError.hidden = true;

  const lines = [
    "Hi EDRAM Shuttle and Tours, I'd like a quote please.",
    "",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Service: ${data.service}`,
  ];
  if (data.pickup.trim()) lines.push(`Pickup: ${data.pickup.trim()}`);
  if (data.destination.trim()) lines.push(`Destination: ${data.destination.trim()}`);
  if (data.date) lines.push(`Date: ${data.date}`);
  if (data.time) lines.push(`Time: ${data.time}`);
  if (data.passengers) lines.push(`Passengers: ${data.passengers}`);
  if (data.vehicle) lines.push(`Vehicle: ${data.vehicle}`);
  if (data.details.trim()) lines.push(`Details: ${data.details.trim()}`);

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "noopener");

  submitBtn.classList.add("sent");
  submitBtn.textContent = "✓ Opening WhatsApp…";
  setTimeout(() => {
    submitBtn.classList.remove("sent");
    submitBtn.textContent = submitLabel;
  }, 3000);
});
