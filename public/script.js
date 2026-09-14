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

// Examples: run demo animations when each example scrolls into view
const exampleObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      exampleObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.05 });
document.querySelectorAll('.example').forEach(el => exampleObserver.observe(el));

// Examples: campaign website persona switcher
(function () {
  const root = document.getElementById('example-website');
  if (!root) return;
  const personas = {
    city:   { name: 'Sarah Chen for City Council',     tag: 'District 4 | Building Stronger Neighborhoods', short: 'S. Chen',      color: '#1E3A5F' },
    school: { name: 'Maria Rodriguez for School Board', tag: 'Plano ISD | Every Child, Every Classroom',     short: 'M. Rodriguez', color: '#065F46' },
    county: { name: 'Robert Okonkwo for County Council', tag: 'Fulton County | Common-Sense Leadership',      short: 'R. Okonkwo',   color: '#B91C1C' },
    state:  { name: 'David Chen for State House',       tag: 'PA-128 | Real Solutions for Working Families',  short: 'D. Chen',      color: '#7C3AED' }
  };
  const q = s => root.querySelector(s);
  const btns = root.querySelectorAll('.persona-btn');
  btns.forEach(b => b.addEventListener('click', () => {
    const p = personas[b.dataset.persona];
    if (!p) return;
    q('.persona-name').textContent = p.name;
    q('.persona-tag').textContent = p.tag;
    q('.persona-hero').style.background = p.color;
    q('.persona-name-mobile').textContent = p.short;
    q('.persona-hero-mobile').style.background = p.color;
    btns.forEach(x => x.classList.toggle('is-active', x === b));
  }));
})();

// On-this-page side nav: show after the hero, highlight the section in view
(function () {
  const nav = document.querySelector('.sidenav');
  if (!nav) return;
  const links = new Map();
  nav.querySelectorAll('a[data-spy]').forEach(a => links.set(a.dataset.spy, a));
  const targets = [...links.keys()].map(id => document.getElementById(id)).filter(Boolean);

  function update() {
    const line = window.innerHeight * 0.35;
    let current = null;
    for (const el of targets) {
      if (el.getBoundingClientRect().top <= line) current = el.id; else break;
    }
    links.forEach((a, id) => a.classList.toggle('is-active', id === current));
    // the parent "Examples" stays lit while any example is in view
    if (current && current.startsWith('example-')) links.get('examples').classList.add('is-active');
    nav.classList.toggle('is-shown', current !== null);
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  update();
})();
