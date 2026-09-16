import { initCanvas, setCanvasVisibility } from './canvas-fx.js';

const DEADLINE = new Date('2026-09-23T23:59:59+05:30').getTime();

// Smooth Scrolling (Lenis)
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // https://www.desmos.com/calculator/brs54l4xou
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 2,
  infinite: false,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Preloader
const preloader = document.getElementById('preloader');
window.addEventListener('load', function () {
  setTimeout(function () {
    preloader.classList.add('hidden');
    preloader.addEventListener('transitionend', () => preloader.remove());
  }, 2400);
});

// Gallery Drag-to-Scroll & Wheel Scroll
const gallery = document.querySelector('.gallery-container');
if (gallery) {
  let isDown = false;
  let startX;
  let scrollLeft;

  gallery.addEventListener('mousedown', (e) => {
    isDown = true;
    gallery.style.cursor = 'grabbing';
    startX = e.pageX - gallery.offsetLeft;
    scrollLeft = gallery.scrollLeft;
  });
  gallery.addEventListener('mouseleave', () => {
    isDown = false;
    gallery.style.cursor = 'grab';
  });
  gallery.addEventListener('mouseup', () => {
    isDown = false;
    gallery.style.cursor = 'grab';
  });
  gallery.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - gallery.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed
    gallery.scrollLeft = scrollLeft - walk;
  });

  // Also map vertical wheel scroll to horizontal scroll when hovering gallery
  gallery.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      gallery.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

// Countdown
const cdDays  = document.getElementById('cd-days');
const cdHours = document.getElementById('cd-hours');
const cdMins  = document.getElementById('cd-mins');
const cdSecs  = document.getElementById('cd-secs');
const cdBox   = document.getElementById('countdown');

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function updateCountdown() {
  const now = Date.now();
  const diff = DEADLINE - now;

  if (diff <= 0) {
    if(cdBox) cdBox.innerHTML = '<span class="countdown-expired">🔒 Applications Closed</span>';
    const ctaWrapper = document.querySelector('.cta-wrapper');
    if (ctaWrapper) {
      ctaWrapper.innerHTML = '<div style="padding: 1.1rem 2rem; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 60px; backdrop-filter: blur(12px); color: rgba(196, 181, 253, 0.9); font-size: 1rem; font-weight: 500; text-align: center; line-height: 1.5; margin: 0 auto; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);">Sorry you are late to register, but we hope you will volunteer in <strong style="color: #fff; font-weight: 700;">Hackaccino 5.0</strong>!</div>';
    }
    return;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  if(cdDays) cdDays.textContent  = pad(d);
  if(cdHours) cdHours.textContent = pad(h);
  if(cdMins) cdMins.textContent  = pad(m);
  if(cdSecs) cdSecs.textContent  = pad(s);

  setTimeout(updateCountdown, 1000);
}
updateCountdown();

// CTA Ripple Effect
const ctaBtn = document.getElementById('cta-apply');
if (ctaBtn) {
  ctaBtn.addEventListener('click', function (e) {
    let rect = ctaBtn.getBoundingClientRect();
    let ripple = document.createElement('span');
    ripple.className = 'cta-ripple';
    let size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    ctaBtn.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
  });
}

// Scroll Reveal
const revealEls = document.querySelectorAll('.scroll-reveal');
const revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach(function (el) {
  revealObserver.observe(el);
});

// Canvas Visibility Observer
const heroSection = document.querySelector('.main-container');
if (heroSection && window.IntersectionObserver) {
  const observer = new IntersectionObserver((entries) => {
    setCanvasVisibility(entries[0].isIntersecting);
  }, { rootMargin: '100px' });
  observer.observe(heroSection);
}

// Logo Tilt Effect
const logoEl = document.querySelector('.logo');
const logoWrapper = document.querySelector('.logo-wrapper');
if (logoEl && logoWrapper) {
  logoWrapper.addEventListener('mousemove', function(e) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = logoWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const tiltX = -(y / (rect.height / 2)) * 15;
    const tiltY = (x / (rect.width / 2)) * 15;
    logoEl.style.setProperty('--logo-tilt-x', `${tiltY}deg`);
    logoEl.style.setProperty('--logo-tilt-y', `${tiltX}deg`);
  });
  logoWrapper.addEventListener('mouseleave', function() {
    logoEl.style.setProperty('--logo-tilt-x', '0deg');
    logoEl.style.setProperty('--logo-tilt-y', '0deg');
  });
}

// Scroll Indicator Fade
const scrollIndicator = document.getElementById('scroll-indicator');
window.addEventListener('scroll', function() {
  if (!scrollIndicator) return;
  const scrollY = window.scrollY;
  if (scrollY > 5) {
    scrollIndicator.style.opacity = Math.max(0, 1 - (scrollY / 150));
  }
}, { passive: true });

// FAQ Logic
document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const faqItem = button.parentElement;
    faqItem.classList.toggle('active');
  });
});

// Lightbox Logic
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const galleryImages = document.querySelectorAll('.gallery-img');
const closeLightboxBtn = document.querySelector('.lightbox-close');

if (lightbox && lightboxImg) {
  galleryImages.forEach(img => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightbox.classList.add('active');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden'; // Prevent scrolling
    });
  });

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { lightboxImg.src = ''; }, 300); // Clear src after animation
  };

  closeLightboxBtn?.addEventListener('click', closeLightbox);
  
  // Close on background click
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });
}

// Init Canvas (Battery Saver included)
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  initCanvas();
}

// Custom Cursor Logic
if (window.matchMedia('(pointer: fine)').matches) {
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  
  if (dot && ring) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top = mouseY + 'px';
    });
    
    const renderCursor = () => {
      // Spring physics for the ring
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
      requestAnimationFrame(renderCursor);
    };
    requestAnimationFrame(renderCursor);
    
    // Add hover states
    const addHover = (selector, className = 'hovered') => {
      document.querySelectorAll(selector).forEach(el => {
        el.addEventListener('mouseenter', () => { dot.classList.add(className); ring.classList.add(className); });
        el.addEventListener('mouseleave', () => { dot.classList.remove(className); ring.classList.remove(className); });
      });
    };
    
    addHover('a, button, .faq-question, .gallery-img', 'hovered');
    addHover('p, h1, h2, h3, h4, span, li', 'hovered-text');
  }
}
