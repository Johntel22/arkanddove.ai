// Ark & Dove Campaigns - Site JS

// Fade-in on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// Mobile nav toggle
const toggle = document.getElementById('nav-toggle');
const menu = document.getElementById('nav-menu');

toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});

// Close mobile menu on link click (but not the dropdown trigger)
menu.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', (e) => {
    const dropdown = link.closest('.nav__dropdown');
    if (dropdown && window.innerWidth <= 768) {
      e.preventDefault();
      dropdown.classList.toggle('open');
      return;
    }
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  });
});

// Header scroll effect
let lastScroll = 0;
const header = document.getElementById('header');

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (y > 100) {
    header.style.boxShadow = '0 1px 8px rgba(0,0,0,0.06)';
  } else {
    header.style.boxShadow = 'none';
  }
  lastScroll = y;
}, { passive: true });
