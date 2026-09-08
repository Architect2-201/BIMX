/**
 * BIMX Studio - Comprehensive Architectural Platform Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // State initialization
  let currentLang = localStorage.getItem('bimx_lang') || 'ka';
  let currentTheme = localStorage.getItem('bimx_theme') || 'dark';

  /* ==========================================================================
     1. Theme Engine (Light & Dark Mode)
     ========================================================================== */
  const htmlEl = document.documentElement;
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  function applyTheme(theme) {
    currentTheme = theme;
    htmlEl.setAttribute('data-theme', theme);
    localStorage.setItem('bimx_theme', theme);

    if (themeToggleBtn) {
      const icon = themeToggleBtn.querySelector('i');
      if (icon) {
        icon.className = theme === 'dark' ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
      }
      themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  applyTheme(currentTheme);

  /* ==========================================================================
     2. Translation Engine (Georgian & English)
     ========================================================================== */
  function applyLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('bimx_lang', lang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (translations[lang][key]) {
        el.placeholder = translations[lang][key];
      }
    });

    if (translations[lang].meta_title) document.title = translations[lang].meta_title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && translations[lang].meta_desc) {
      metaDesc.setAttribute('content', translations[lang].meta_desc);
    }

    updateCalculator();
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
    });
  });

  /* ==========================================================================
     3. Architectural Viewport Switcher (3D Model / MEP / LiDAR Scan)
     ========================================================================== */
  const viewportImg = document.getElementById('viewportImg');
  const modeBtns = document.querySelectorAll('.mode-btn');

  const viewportSources = {
    render: 'assets/images/hero-bim.jpg',
    mep: 'assets/images/mep-coordination.jpg',
    scan: 'assets/images/scan-to-bim.jpg'
  };

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const viewKey = btn.dataset.view;
      if (viewportImg && viewportSources[viewKey]) {
        viewportImg.style.opacity = '0.3';
        setTimeout(() => {
          viewportImg.src = viewportSources[viewKey];
          viewportImg.style.opacity = '1';
        }, 150);
      }
    });
  });

  /* ==========================================================================
     4. Animated Counter Numbers
     ========================================================================== */
  let countersAnimated = false;
  function animateCounters() {
    if (countersAnimated) return;
    const counters = document.querySelectorAll('.stat-counter-number[data-target]');
    counters.forEach(counter => {
      const target = parseInt(counter.dataset.target, 10);
      const suffix = '+';
      const duration = 1600;
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(ease * target);
        counter.textContent = current.toLocaleString() + suffix;

        if (progress < 1) {
          requestAnimationFrame(update);
        }
      }
      requestAnimationFrame(update);
    });
    countersAnimated = true;
  }

  /* ==========================================================================
     5. Scroll Reveal Engine
     ========================================================================== */
  const animElements = document.querySelectorAll('.anim-reveal');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in-view');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  animElements.forEach(el => revealObserver.observe(el));

  // Trigger counters on first scroll or immediately
  setTimeout(animateCounters, 600);

  /* ==========================================================================
     6. Header & Mobile Menu
     ========================================================================== */
  const header = document.getElementById('mainHeader');
  const mobileHamburger = document.getElementById('mobileHamburger');
  const navLinksList = document.getElementById('navLinksList');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  if (mobileHamburger && navLinksList) {
    mobileHamburger.addEventListener('click', () => {
      navLinksList.classList.toggle('open');
    });

    document.querySelectorAll('.nav-link-item').forEach(link => {
      link.addEventListener('click', () => {
        navLinksList.classList.remove('open');
      });
    });
  }

  /* ==========================================================================
     7. BIM Cost & Timeline Calculator
     ========================================================================== */
  const areaSlider = document.getElementById('calcArea');
  const areaValueDisplay = document.getElementById('calcAreaVal');
  const typeSelect = document.getElementById('calcType');
  const lodSelect = document.getElementById('calcLod');
  const discCheckboxes = document.querySelectorAll('.calc-disc-checkbox');
  const resultCost = document.getElementById('calcResultCost');
  const resultTime = document.getElementById('calcResultTime');
  const applyCalcBtn = document.getElementById('applyCalcBtn');

  function updateCalculator() {
    if (!areaSlider || !resultCost || !resultTime) return;

    const area = parseInt(areaSlider.value, 10);
    areaValueDisplay.textContent = area.toLocaleString() + ' m²';

    let baseRate = 1.3;
    const type = typeSelect ? typeSelect.value : 'commercial';
    if (type === 'residential') baseRate = 1.1;
    if (type === 'commercial') baseRate = 1.4;
    if (type === 'industrial') baseRate = 1.2;
    if (type === 'public') baseRate = 1.6;

    let lodMultiplier = 1.0;
    const lod = lodSelect ? lodSelect.value : '300';
    if (lod === '200') lodMultiplier = 0.75;
    if (lod === '300') lodMultiplier = 1.0;
    if (lod === '350') lodMultiplier = 1.35;
    if (lod === '400') lodMultiplier = 1.8;

    let discMultiplier = 0.4;
    let selectedCount = 0;
    discCheckboxes.forEach(cb => {
      if (cb.checked) {
        selectedCount++;
        if (cb.value === 'arch') discMultiplier += 0.35;
        if (cb.value === 'struct') discMultiplier += 0.35;
        if (cb.value === 'mep') discMultiplier += 0.45;
        if (cb.value === 'clash') discMultiplier += 0.25;
      }
    });

    if (selectedCount === 0) discMultiplier = 0.5;

    const rawCost = Math.round(area * baseRate * lodMultiplier * discMultiplier);
    const finalCost = Math.max(rawCost, 900);

    let weeks = Math.round(2 + (area / 2200) * lodMultiplier * (selectedCount || 1) * 0.75);
    weeks = Math.max(weeks, 2);

    const currencySymbol = currentLang === 'ka' ? '₾' : '$';
    const localizedCost = currentLang === 'ka' ? Math.round(finalCost * 2.7) : finalCost;

    resultCost.textContent = `${currencySymbol} ${localizedCost.toLocaleString()}`;
    const weekLabel = currentLang === 'ka' ? 'კვირა' : 'weeks';
    resultTime.textContent = `${weeks} ${weekLabel}`;
  }

  if (areaSlider) areaSlider.addEventListener('input', updateCalculator);
  if (typeSelect) typeSelect.addEventListener('change', updateCalculator);
  if (lodSelect) lodSelect.addEventListener('change', updateCalculator);

  discCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.check-pill-option').classList.toggle('checked', cb.checked);
      updateCalculator();
    });
  });

  if (applyCalcBtn) {
    applyCalcBtn.addEventListener('click', () => {
      const area = areaSlider.value;
      const typeText = typeSelect.options[typeSelect.selectedIndex].text;
      const lodText = lodSelect.options[lodSelect.selectedIndex].text;

      const messageField = document.getElementById('contactMsg');
      if (messageField) {
        const textKa = `მოგესალმებით, მსურს BIMX Studio-სგან შეთავაზების მიღება:\n- ფართობი: ${area} მ²\n- შენობის ტიპი: ${typeText}\n- დეტალიზაცია: ${lodText}\nგთხოვთ დამიკავშირდეთ დეტალების განსახილველად.`;
        const textEn = `Hello, I would like to request an official proposal from BIMX Studio:\n- Area: ${area} m²\n- Type: ${typeText}\n- LOD: ${lodText}\nPlease contact me to discuss.`;
        messageField.value = currentLang === 'ka' ? textKa : textEn;
      }

      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  /* ==========================================================================
     8. Portfolio Filter
     ========================================================================== */
  const filterPills = document.querySelectorAll('.filter-btn-pill');
  const portfolioCards = document.querySelectorAll('.portfolio-card-item');

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filter = pill.dataset.filter;
      portfolioCards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = 'flex';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 30);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(15px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 250);
        }
      });
    });
  });

  /* ==========================================================================
     9. Contact Form Controller
     ========================================================================== */
  const contactForm = document.getElementById('contactForm');
  const formAlertMsg = document.getElementById('formAlertMsg');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = currentLang === 'ka' ? 'იგზავნება...' : 'Sending...';

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        if (formAlertMsg) {
          formAlertMsg.textContent = translations[currentLang].contact_form_success;
          formAlertMsg.style.display = 'block';
        }
        contactForm.reset();
        setTimeout(() => {
          if (formAlertMsg) formAlertMsg.style.display = 'none';
        }, 6000);
      }, 700);
    });
  }

  // Initialize
  applyLanguage(currentLang);
  updateCalculator();
});
