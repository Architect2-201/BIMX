/**
 * BIMX.GE - Core Logic & Interactive Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Current language state
  let currentLang = localStorage.getItem('bimx_lang') || 'ka';

  /* ==========================================================================
     1. Language Translation Engine
     ========================================================================== */
  const setLanguage = (lang) => {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('bimx_lang', lang);

    // Update active class on buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Translate all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    });

    // Translate input placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (translations[lang][key]) {
        el.placeholder = translations[lang][key];
      }
    });

    // Update document title & description
    if (translations[lang].meta_title) {
      document.title = translations[lang].meta_title;
    }
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && translations[lang].meta_desc) {
      metaDesc.setAttribute('content', translations[lang].meta_desc);
    }

    // Re-run calculator to update currency / localized strings
    updateCalculator();
  };

  // Attach event listeners to language switcher buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLanguage(btn.dataset.lang);
    });
  });

  /* ==========================================================================
     2. Sticky Header & Scroll Effects
     ========================================================================== */
  const header = document.querySelector('.header');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Active link highlighting based on scroll position
    let scrollY = window.pageYOffset;
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');
      const navLink = document.querySelector(`.nav-link[href*="${sectionId}"]`);

      if (navLink) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          navLink.classList.add('active');
        } else {
          navLink.classList.remove('active');
        }
      }
    });
  });

  /* ==========================================================================
     3. Mobile Navigation Menu
     ========================================================================== */
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    // Close mobile menu on link click
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  /* ==========================================================================
     4. Interactive BIM Cost & Timeline Calculator
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

    // Base rate per square meter ($ / sq.m)
    let baseRate = 1.2;
    const type = typeSelect ? typeSelect.value : 'commercial';
    if (type === 'residential') baseRate = 1.0;
    if (type === 'commercial') baseRate = 1.3;
    if (type === 'industrial') baseRate = 1.1;
    if (type === 'public') baseRate = 1.5;

    // LOD multiplier
    let lodMultiplier = 1.0;
    const lod = lodSelect ? lodSelect.value : '300';
    if (lod === '200') lodMultiplier = 0.75;
    if (lod === '300') lodMultiplier = 1.0;
    if (lod === '350') lodMultiplier = 1.35;
    if (lod === '400') lodMultiplier = 1.75;

    // Disciplines weight
    let discMultiplier = 0.4; // base
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

    // Total estimated budget calculation
    const rawCost = Math.round(area * baseRate * lodMultiplier * discMultiplier);
    // Format minimum reasonable project threshold
    const finalCost = Math.max(rawCost, 800);

    // Timeline calculation (weeks)
    let weeks = Math.round(2 + (area / 2500) * lodMultiplier * (selectedCount || 1) * 0.8);
    weeks = Math.max(weeks, 2);

    const currencySymbol = currentLang === 'ka' ? '₾' : '$';
    // If GEL, multiply approximately by 2.7
    const localizedCost = currentLang === 'ka' ? Math.round(finalCost * 2.7) : finalCost;

    resultCost.textContent = `${currencySymbol} ${localizedCost.toLocaleString()}`;
    const weekLabel = currentLang === 'ka' ? 'კვირა' : 'weeks';
    resultTime.textContent = `${weeks} ${weekLabel}`;
  }

  if (areaSlider) {
    areaSlider.addEventListener('input', updateCalculator);
  }
  if (typeSelect) {
    typeSelect.addEventListener('change', updateCalculator);
  }
  if (lodSelect) {
    lodSelect.addEventListener('change', updateCalculator);
  }
  discCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.checkbox-card').classList.toggle('checked', cb.checked);
      updateCalculator();
    });
  });

  // Apply to form button
  if (applyCalcBtn) {
    applyCalcBtn.addEventListener('click', () => {
      const area = areaSlider.value;
      const typeText = typeSelect.options[typeSelect.selectedIndex].text;
      const lodText = lodSelect.options[lodSelect.selectedIndex].text;
      
      const messageField = document.getElementById('contactMsg');
      if (messageField) {
        const textKa = `მოგესალმებით, მსურს BIM პროექტის დაკვეთა:\n- ფართობი: ${area} მ²\n- შენობის ტიპი: ${typeText}\n- დეტალიზაცია: ${lodText}\nგთხოვთ დამიკავშირდეთ დეტალების განსახილველად.`;
        const textEn = `Hello, I would like to request a proposal for a BIM project:\n- Area: ${area} m²\n- Building Type: ${typeText}\n- LOD: ${lodText}\nPlease contact me to discuss further.`;
        messageField.value = currentLang === 'ka' ? textKa : textEn;
      }

      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  /* ==========================================================================
     5. Portfolio Category Filter
     ========================================================================== */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      projectCards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = 'block';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 50);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(15px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 300);
        }
      });
    });
  });

  /* ==========================================================================
     6. Contact Form Submission Handling
     ========================================================================== */
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');

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
        if (formStatus) {
          formStatus.className = 'form-status success';
          formStatus.textContent = translations[currentLang].contact_form_success;
          formStatus.style.display = 'block';
        }
        contactForm.reset();
        setTimeout(() => {
          if (formStatus) formStatus.style.display = 'none';
        }, 6000);
      }, 800);
    });
  }

  // Initialize
  setLanguage(currentLang);
  updateCalculator();
});
