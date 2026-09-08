/**
 * BIMX Studio - Minimalist & Innovative Architectural Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // State initialization
  let currentLang = localStorage.getItem('bimx_lang') || 'ka';
  let currentTheme = localStorage.getItem('bimx_theme') || 'dark';

  /* ==========================================================================
     1. Theme Engine (Light / Dark)
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
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  // Initialize theme
  applyTheme(currentTheme);

  /* ==========================================================================
     2. Translation Engine (Georgian & English)
     ========================================================================== */
  function applyLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('bimx_lang', lang);

    // Update active class on language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Update texts
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (translations[lang][key]) {
        el.placeholder = translations[lang][key];
      }
    });

    // Update page meta
    if (translations[lang].meta_title) document.title = translations[lang].meta_title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && translations[lang].meta_desc) {
      metaDesc.setAttribute('content', translations[lang].meta_desc);
    }

    // Recalculate calculator to refresh currency / language
    updateCalculator();
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
    });
  });

  /* ==========================================================================
     3. Scroll Reveal Animation Engine
     ========================================================================== */
  const revealElements = document.querySelectorAll('.reveal-fade');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  /* ==========================================================================
     4. Sticky Header & Navigation
     ========================================================================== */
  const header = document.getElementById('mainHeader');
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  /* ==========================================================================
     5. BIM Cost & Timeline Calculator
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

    let baseRate = 1.25;
    const type = typeSelect ? typeSelect.value : 'commercial';
    if (type === 'residential') baseRate = 1.05;
    if (type === 'commercial') baseRate = 1.35;
    if (type === 'industrial') baseRate = 1.15;
    if (type === 'public') baseRate = 1.55;

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

    let weeks = Math.round(2 + (area / 2400) * lodMultiplier * (selectedCount || 1) * 0.75);
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
      cb.closest('.calc-checkbox-label').classList.toggle('checked', cb.checked);
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
        const textEn = `Hello, I would like to request an official BIM proposal from BIMX Studio:\n- Area: ${area} m²\n- Type: ${typeText}\n- LOD: ${lodText}\nPlease contact me to discuss.`;
        messageField.value = currentLang === 'ka' ? textKa : textEn;
      }

      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  /* ==========================================================================
     6. Portfolio Filter Engine
     ========================================================================== */
  const filterPills = document.querySelectorAll('.filter-pill');
  const projectItems = document.querySelectorAll('.project-item');

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filter = pill.dataset.filter;
      projectItems.forEach(item => {
        if (filter === 'all' || item.dataset.category === filter) {
          item.style.display = 'flex';
          setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
          }, 30);
        } else {
          item.style.opacity = '0';
          item.style.transform = 'translateY(12px)';
          setTimeout(() => {
            item.style.display = 'none';
          }, 250);
        }
      });
    });
  });

  /* ==========================================================================
     7. Contact Form Controller
     ========================================================================== */
  const contactForm = document.getElementById('contactForm');
  const formFeedback = document.getElementById('formFeedback');

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
        if (formFeedback) {
          formFeedback.textContent = translations[currentLang].contact_form_success;
          formFeedback.style.display = 'block';
        }
        contactForm.reset();
        setTimeout(() => {
          if (formFeedback) formFeedback.style.display = 'none';
        }, 6000);
      }, 700);
    });
  }

  // Initial apply
  applyLanguage(currentLang);
  updateCalculator();
});
