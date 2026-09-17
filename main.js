/**
 * BIMX Studio - Comprehensive Architectural Platform Controller
 */

// State initialization
let currentLang = localStorage.getItem('bimx_lang') || 'ka';
let currentTheme = localStorage.getItem('bimx_theme') || 'dark';

/* ==========================================================================
   1. Global Theme Engine (Air Glass White & Dark Mode)
   ========================================================================== */
window.applyTheme = function(theme) {
  currentTheme = theme;
  const htmlEl = document.documentElement;
  htmlEl.setAttribute('data-theme', theme);
  if (theme === 'light') {
    htmlEl.classList.remove('dark');
    htmlEl.classList.add('light');
  } else {
    htmlEl.classList.remove('light');
    htmlEl.classList.add('dark');
  }

  if (document.body) {
    document.body.setAttribute('data-theme', theme);
    document.body.classList.toggle('light', theme === 'light');
    document.body.classList.toggle('dark', theme === 'dark');
  }

  try {
    localStorage.setItem('bimx_theme', theme);
  } catch (e) { /* ignore */ }

  // Update all theme toggle buttons across pages
  document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn').forEach(btn => {
    btn.classList.remove('hidden');
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-solid fa-sun text-[15px]' : 'fa-solid fa-moon text-[15px] text-sky-400';
    }
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Air Glass White' : 'Switch to Dark Mode');
    btn.setAttribute('title', theme === 'dark' ? (currentLang === 'en' ? 'Switch to Air Glass White' : 'ნათელი თემა (Air Glass White)') : (currentLang === 'en' ? 'Switch to Dark Mode' : 'მუქი თემა'));
  });

  // Invert white logo in light mode so it appears deep architectural slate/charcoal
  document.querySelectorAll('.brand-logo-img').forEach(img => {
    if (theme === 'light') {
      img.style.filter = 'invert(1) brightness(0.15) contrast(1.1)';
    } else {
      img.style.filter = '';
    }
  });

  window.dispatchEvent(new CustomEvent('bimx-theme-changed', { detail: { theme } }));
};

let isThemeToggling = false;
window.toggleBimxTheme = function(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  if (isThemeToggling) return;
  isThemeToggling = true;
  setTimeout(() => { isThemeToggling = false; }, 250);

  const activeTheme = document.documentElement.getAttribute('data-theme') || 
                      (document.documentElement.classList.contains('light') ? 'light' : 'dark') ||
                      currentTheme || 'dark';
  const newTheme = activeTheme === 'light' ? 'dark' : 'light';
  window.applyTheme(newTheme);
};

/* ==========================================================================
   2. Global Translation Engine (Georgian & English)
   ========================================================================== */
window.applyLanguage = function(lang) {
  const dict = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : (window.translations && window.translations[lang]);
  if (!dict) return;
  currentLang = lang;
  localStorage.setItem('bimx_lang', lang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-lang') === lang || btn.textContent.trim().toLowerCase() === lang.toLowerCase();
    btn.classList.toggle('active', isTarget);
  });

  // Update standard navigation items
  document.querySelectorAll('[data-path="gis-analysis"]').forEach(el => {
    el.textContent = lang === 'en' ? 'GIS Analysis' : 'GIS ანალიზი';
  });
  document.querySelectorAll('[data-path="parcel-ai"]').forEach(el => {
    el.textContent = lang === 'en' ? 'AI Analysis' : 'AI ანალიზი';
  });
  document.querySelectorAll('[data-path="contact"]').forEach(el => {
    el.textContent = lang === 'en' ? 'Contact' : 'კონტაქტი';
  });
  document.querySelectorAll('[data-path="consultation"]').forEach(el => {
    el.textContent = lang === 'en' ? 'Consultation' : 'კონსულტაცია';
  });

  // Mobile nav drawer links
  document.querySelectorAll('#mobileNavDrawer a, #mobile-nav-drawer a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href.includes('land-intelligence')) link.textContent = lang === 'en' ? 'GIS Analysis' : 'GIS ანალიზი';
    else if (href.includes('parcel-ai')) link.textContent = lang === 'en' ? 'AI Analysis' : 'AI ანალიზი';
    else if (href.includes('contact')) link.textContent = lang === 'en' ? 'Contact' : 'კონტაქტი';
  });

  // Landing Page Hero updates
  const heroH1 = document.querySelector('#hero-section h1');
  if (heroH1) {
    if (lang === 'en') {
      heroH1.innerHTML = 'Digital Engineering & BIM Technology <span class="text-secondary-fixed-dim">From Practicing</span> Engineers';
    } else {
      heroH1.innerHTML = 'ციფრული ინჟინერია და BIM ტექნოლოგია <span class="text-secondary-fixed-dim">პრაქტიკოსი</span> ინჟინრებისგან';
    }
  }
  const heroP = document.querySelector('#hero-section p');
  if (heroP && !heroP.hasAttribute('data-i18n')) {
    if (lang === 'en') {
      heroP.textContent = 'Architectural and engineering modeling, international standards (ISO 19650), Clash Detection, and digital twins for large-scale developments.';
    } else {
      heroP.textContent = 'არქიტექტურული და საინჟინრო მოდელირება, საერთაშორისო სტანდარტები (ISO 19650), Clash Detection და ციფრული ტყუპები მასშტაბური მშენებლობებისთვის.';
    }
  }
  const heroCalcBtn = document.querySelector('#hero-section a[href="#calculator"] span.relative');
  if (heroCalcBtn) {
    heroCalcBtn.innerHTML = (lang === 'en' ? 'Calculator' : 'კალკულატორი') + '<span class="material-symbols-outlined ml-2 text-[18px] group-hover:rotate-12 transition-transform duration-200">calculate</span>';
  }
  const heroServBtn = document.querySelector('#hero-section a[href="#modules"]');
  if (heroServBtn) {
    heroServBtn.innerHTML = (lang === 'en' ? 'Explore Services' : 'სერვისების ნახვა') + '<span class="material-symbols-outlined ml-2 text-[18px] group-hover:translate-x-1.5 transition-transform duration-200">arrow_forward</span>';
  }

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (dict[key]) {
      el.placeholder = dict[key];
    }
  });

  if (dict.meta_title) document.title = dict.meta_title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && dict.meta_desc) {
    metaDesc.setAttribute('content', dict.meta_desc);
  }

  if (typeof updateCalculator === 'function') {
    try { updateCalculator(); } catch (err) { /* ignore */ }
  }

  window.dispatchEvent(new CustomEvent('bimx-lang-changed', { detail: { lang } }));
};

// Document-level event delegation for theme and language toggles
document.addEventListener('click', (e) => {
  const langBtn = e.target.closest('.lang-btn');
  if (langBtn) {
    e.preventDefault();
    const lang = langBtn.getAttribute('data-lang') || (langBtn.textContent.trim().toLowerCase() === 'en' ? 'en' : 'ka');
    if (window.applyLanguage) {
      window.applyLanguage(lang);
    }
    return;
  }
  const themeBtn = e.target.closest('#themeToggleBtn, .theme-toggle-btn');
  if (themeBtn) {
    e.preventDefault();
    e.stopPropagation();
    if (window.toggleBimxTheme) {
      window.toggleBimxTheme(e);
    }
    return;
  }
});

/* ==========================================================================
   3. Main Platform Initializer
   ========================================================================== */
function initBimxPlatform() {
  window.applyTheme(currentTheme);
  window.applyLanguage(currentLang);

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
      mobileHamburger.classList.toggle('active');
    });

    document.querySelectorAll('.nav-link-item').forEach(link => {
      link.addEventListener('click', () => {
        navLinksList.classList.remove('open');
        mobileHamburger.classList.remove('active');
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

  /* ==========================================================================
     10. Smooth Page Transition Navigation Interceptor
     ========================================================================== */
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Skip external links, mailto, tel, empty links, or javascript
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#') || href.startsWith('javascript:')) {
      return;
    }
    
    // Skip if new tab
    if (link.getAttribute('target') === '_blank') return;

    link.addEventListener('click', (e) => {
      // Check if target is same page anchor with page name, e.g., index.html#services when on index.html
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      const [targetFile, targetHash] = href.split('#');

      if ((targetFile === currentPath || (targetFile === '' && targetHash)) && targetHash) {
        const anchorEl = document.getElementById(targetHash);
        if (anchorEl) {
          e.preventDefault();
          anchorEl.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }

      e.preventDefault();
      document.body.classList.add('page-is-leaving');
      setTimeout(() => {
        window.location.href = href;
      }, 180);
    });
  });

  /* ==========================================================================
     11. Catalog Filter & Real-Time Search (Apps & Plugins)
     ========================================================================== */
  const catalogGrid = document.getElementById('catalogGrid');
  const catalogSearchInput = document.getElementById('catalogSearchInput');
  const catalogFilterBtns = document.querySelectorAll('.catalog-filter-btn');
  const catalogEmptyState = document.getElementById('catalogEmptyState');

  function filterCatalog() {
    if (!catalogGrid) return;

    const query = catalogSearchInput ? catalogSearchInput.value.toLowerCase().trim() : '';
    const activeBtn = document.querySelector('.catalog-filter-btn.active');
    const activeFilter = activeBtn ? activeBtn.dataset.filter : 'all';

    const cards = catalogGrid.querySelectorAll('.catalog-item-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const category = card.dataset.category || 'all';
      const title = (card.querySelector('.card-title-lg') || {}).textContent || '';
      const desc = (card.querySelector('.card-desc-body') || {}).textContent || '';
      const specs = (card.querySelector('.card-specs-list') || {}).textContent || '';
      const combinedText = `${title} ${desc} ${specs} ${category}`.toLowerCase();

      const matchesFilter = activeFilter === 'all' || category === activeFilter;
      const matchesSearch = query === '' || combinedText.includes(query);

      if (matchesFilter && matchesSearch) {
        card.style.display = 'flex';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
        visibleCount++;
      } else {
        card.style.display = 'none';
        card.style.opacity = '0';
      }
    });

    if (catalogEmptyState) {
      catalogEmptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  if (catalogFilterBtns.length > 0) {
    catalogFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        catalogFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterCatalog();
      });
    });
  }

  if (catalogSearchInput) {
    catalogSearchInput.addEventListener('input', filterCatalog);
  }

  /* ==========================================================================
     12. Interactive Download Buttons
     ========================================================================== */
  function attachDownloadHandlers() {
    document.querySelectorAll('.btn-download-action:not([data-bound])').forEach(btn => {
      btn.setAttribute('data-bound', 'true');
      btn.addEventListener('click', () => {
        const originalHtml = btn.innerHTML;
        const filename = btn.dataset.filename || 'BIMX-Package.zip';
        
        btn.classList.add('downloading');
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${currentLang === 'ka' ? 'მზადდება...' : 'Preparing...'}</span>`;

        setTimeout(() => {
          btn.classList.remove('downloading');
          btn.classList.add('downloaded');
          btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>${currentLang === 'ka' ? 'ჩამოიტვირთა ✓' : 'Downloaded ✓'}</span>`;

          // Trigger client simulated download
          const blob = new Blob([
            `BIMX Studio Software Package\nFile: ${filename}\nVersion: Release Candidate\nArchitectural BIM & Digital Engineering\nOfficial Website: https://www.bimx.ge/`
          ], { type: 'text/plain;charset=utf-8' });
          const downloadUrl = URL.createObjectURL(blob);
          const tempLink = document.createElement('a');
          tempLink.href = downloadUrl;
          tempLink.download = filename;
          document.body.appendChild(tempLink);
          tempLink.click();
          document.body.removeChild(tempLink);
          URL.revokeObjectURL(downloadUrl);

          setTimeout(() => {
            btn.classList.remove('downloaded');
            btn.innerHTML = originalHtml;
          }, 3500);
        }, 1200);
      });
    });
  }
  attachDownloadHandlers();

  /* ==========================================================================
     13. Upload Modal Dialog & Dynamic Item Insertion
     ========================================================================== */
  const openUploadModalBtn = document.getElementById('openUploadModalBtn');
  const uploadModalOverlay = document.getElementById('uploadModalOverlay');
  const closeUploadModalBtn = document.getElementById('closeUploadModalBtn');
  const modalDropzone = document.getElementById('modalDropzone');
  const modalFileInput = document.getElementById('modalFileInput');
  const selectedFileBadge = document.getElementById('selectedFileBadge');
  const selectedFileName = document.getElementById('selectedFileName');
  const uploadAppForm = document.getElementById('uploadAppForm');
  const uploadPluginForm = document.getElementById('uploadPluginForm');
  const modalAlertSuccess = document.getElementById('modalAlertSuccess');

  if (openUploadModalBtn && uploadModalOverlay) {
    openUploadModalBtn.addEventListener('click', () => {
      uploadModalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    function closeModal() {
      uploadModalOverlay.classList.remove('active');
      document.body.style.overflow = '';
      if (modalAlertSuccess) modalAlertSuccess.style.display = 'none';
      if (selectedFileBadge) selectedFileBadge.style.display = 'none';
      if (uploadAppForm) uploadAppForm.reset();
      if (uploadPluginForm) uploadPluginForm.reset();
    }

    if (closeUploadModalBtn) {
      closeUploadModalBtn.addEventListener('click', closeModal);
    }

    uploadModalOverlay.addEventListener('click', (e) => {
      if (e.target === uploadModalOverlay) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && uploadModalOverlay.classList.contains('active')) {
        closeModal();
      }
    });

    // Drag & Drop
    if (modalDropzone && modalFileInput) {
      modalDropzone.addEventListener('click', () => modalFileInput.click());

      modalDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        modalDropzone.classList.add('dragover');
      });

      modalDropzone.addEventListener('dragleave', () => {
        modalDropzone.classList.remove('dragover');
      });

      modalDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        modalDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileSelect(e.dataTransfer.files[0]);
        }
      });

      modalFileInput.addEventListener('change', () => {
        if (modalFileInput.files && modalFileInput.files[0]) {
          handleFileSelect(modalFileInput.files[0]);
        }
      });

      function handleFileSelect(file) {
        if (selectedFileName && selectedFileBadge) {
          selectedFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
          selectedFileBadge.style.display = 'inline-flex';
        }
      }
    }

    // Handle App Form Upload
    if (uploadAppForm) {
      uploadAppForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('uploadSubmitBtn');
        const origText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${currentLang === 'ka' ? 'იტვირთება...' : 'Uploading...'}</span>`;

        const name = document.getElementById('appName').value.trim();
        const version = document.getElementById('appVersion').value.trim();
        const category = document.getElementById('appCategory').value;
        const fileSize = document.getElementById('appFileSize').value.trim() || 'Windows 10/11 · 64-bit';
        const desc = document.getElementById('appDesc').value.trim();

        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
          if (modalAlertSuccess) modalAlertSuccess.style.display = 'block';

          // Create and insert new app card
          const newCard = document.createElement('div');
          newCard.className = 'catalog-item-card anim-reveal is-in-view';
          newCard.setAttribute('data-category', category);
          newCard.style.border = '1px solid var(--cyan-neon)';
          newCard.innerHTML = `
            <div>
              <div class="card-top-badge-row">
                <span class="platform-pill">
                  <i class="fa-solid fa-cloud-arrow-up"></i> ${category.toUpperCase()}
                </span>
                <span class="version-pill">
                  <i class="fa-solid fa-code-branch"></i> ${version} · ${fileSize}
                </span>
              </div>
              <h3 class="card-title-lg">${name}</h3>
              <p class="card-desc-body">${desc}</p>
              <ul class="card-specs-list">
                <li><i class="fa-solid fa-check"></i> <span>მომხმარებლის მიერ ატვირთული აპლიკაცია</span></li>
                <li><i class="fa-solid fa-check"></i> <span>სრული თავსებადობა და შემოწმებული არქივი</span></li>
              </ul>
            </div>
            <div class="card-action-footer">
              <button type="button" class="btn-download-action" data-filename="${name.replace(/\s+/g, '-')}-${version}.exe">
                <i class="fa-solid fa-download"></i>
                <span>${currentLang === 'ka' ? 'ჩამოტვირთვა (.EXE)' : 'Download (.EXE)'}</span>
              </button>
              <button type="button" class="btn-docs-action">
                <i class="fa-solid fa-book"></i>
                <span>${currentLang === 'ka' ? 'დოკუმენტაცია' : 'Docs'}</span>
              </button>
            </div>
          `;

          if (catalogGrid) {
            catalogGrid.insertBefore(newCard, catalogGrid.firstChild);
          }

          // Save to localStorage
          saveCustomItem('bimx_custom_apps', { name, version, category, fileSize, desc, type: 'app' });
          attachDownloadHandlers();

          setTimeout(() => {
            closeModal();
          }, 1400);
        }, 800);
      });
    }

    // Handle Plugin Form Upload
    if (uploadPluginForm) {
      uploadPluginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('uploadSubmitBtn');
        const origText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${currentLang === 'ka' ? 'იტვირთება...' : 'Uploading...'}</span>`;

        const name = document.getElementById('pluginName').value.trim();
        const version = document.getElementById('pluginVersion').value.trim();
        const category = document.getElementById('pluginCategory').value;
        const fileSize = document.getElementById('pluginFileSize').value.trim() || 'Add-in Package';
        const desc = document.getElementById('pluginDesc').value.trim();

        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
          if (modalAlertSuccess) modalAlertSuccess.style.display = 'block';

          // Create and insert new plugin card
          const newCard = document.createElement('div');
          newCard.className = 'catalog-item-card anim-reveal is-in-view';
          newCard.setAttribute('data-category', category);
          newCard.style.border = '1px solid var(--cyan-neon)';
          newCard.innerHTML = `
            <div>
              <div class="card-top-badge-row">
                <span class="platform-pill">
                  <i class="fa-solid fa-plug"></i> ${category.toUpperCase()}
                </span>
                <span class="version-pill">
                  <i class="fa-solid fa-code-branch"></i> ${version} · ${fileSize}
                </span>
              </div>
              <h3 class="card-title-lg">${name}</h3>
              <p class="card-desc-body">${desc}</p>
              <ul class="card-specs-list">
                <li><i class="fa-solid fa-check"></i> <span>მომხმარებლის მიერ ატვირთული BIM პლაგინი</span></li>
                <li><i class="fa-solid fa-check"></i> <span>ინსტალაციის ინსტრუქცია და DLL ბიბლიოთეკა</span></li>
              </ul>
            </div>
            <div class="card-action-footer">
              <button type="button" class="btn-download-action" data-filename="${name.replace(/\s+/g, '-')}-${version}.zip">
                <i class="fa-solid fa-download"></i>
                <span>${currentLang === 'ka' ? 'ჩამოტვირთვა (.ZIP)' : 'Download (.ZIP)'}</span>
              </button>
              <button type="button" class="btn-docs-action">
                <i class="fa-solid fa-book"></i>
                <span>${currentLang === 'ka' ? 'გზამკვლევი' : 'Guide'}</span>
              </button>
            </div>
          `;

          if (catalogGrid) {
            catalogGrid.insertBefore(newCard, catalogGrid.firstChild);
          }

          // Save to localStorage
          saveCustomItem('bimx_custom_plugins', { name, version, category, fileSize, desc, type: 'plugin' });
          attachDownloadHandlers();

          setTimeout(() => {
            closeModal();
          }, 1400);
        }, 800);
      });
    }
  }

  function saveCustomItem(storageKey, item) {
    try {
      const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
      items.unshift(item);
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (err) {
      console.warn('Could not save to localStorage', err);
    }
  }

  function loadCustomItems() {
    if (!catalogGrid) return;
    const isAppPage = window.location.pathname.includes('apps') || document.getElementById('uploadAppForm');
    const isPluginPage = window.location.pathname.includes('plugins') || document.getElementById('uploadPluginForm');

    const storageKey = isAppPage ? 'bimx_custom_apps' : (isPluginPage ? 'bimx_custom_plugins' : null);
    if (!storageKey) return;

    try {
      const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
      items.forEach(item => {
        const newCard = document.createElement('div');
        newCard.className = 'catalog-item-card anim-reveal is-in-view';
        newCard.setAttribute('data-category', item.category);
        newCard.style.border = '1px solid var(--cyan-neon)';
        const ext = isAppPage ? '.exe' : '.zip';
        const label = isAppPage ? (currentLang === 'ka' ? 'ჩამოტვირთვა (.EXE)' : 'Download (.EXE)') : (currentLang === 'ka' ? 'ჩამოტვირთვა (.ZIP)' : 'Download (.ZIP)');
        newCard.innerHTML = `
          <div>
            <div class="card-top-badge-row">
              <span class="platform-pill">
                <i class="fa-solid fa-cloud-arrow-up"></i> ${item.category.toUpperCase()}
              </span>
              <span class="version-pill">
                <i class="fa-solid fa-code-branch"></i> ${item.version} · ${item.fileSize}
              </span>
            </div>
            <h3 class="card-title-lg">${item.name}</h3>
            <p class="card-desc-body">${item.desc}</p>
            <ul class="card-specs-list">
              <li><i class="fa-solid fa-check"></i> <span>მომხმარებლის მიერ ატვირთული პაკეტი</span></li>
              <li><i class="fa-solid fa-check"></i> <span>სრული თავსებადობა და შემოწმებული არქივი</span></li>
            </ul>
          </div>
          <div class="card-action-footer">
            <button type="button" class="btn-download-action" data-filename="${item.name.replace(/\s+/g, '-')}-${item.version}${ext}">
              <i class="fa-solid fa-download"></i>
              <span>${label}</span>
            </button>
            <button type="button" class="btn-docs-action">
              <i class="fa-solid fa-book"></i>
              <span>${currentLang === 'ka' ? 'დოკუმენტაცია' : 'Docs'}</span>
            </button>
          </div>
        `;
        catalogGrid.insertBefore(newCard, catalogGrid.firstChild);
      });
      attachDownloadHandlers();
    } catch (err) {
      console.warn('Could not load from localStorage', err);
    }
  }

  loadCustomItems();

  // Mobile Hamburger Toggle for secondary drawer
  const drawerToggleBtn = document.getElementById('mobileHamburger');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer') || document.getElementById('mobile-nav-drawer');
  if (drawerToggleBtn && mobileNavDrawer) {
    drawerToggleBtn.addEventListener('click', () => {
      mobileNavDrawer.classList.toggle('hidden');
      drawerToggleBtn.classList.toggle('active');
    });
  }

  // Initialize
  if (window.applyLanguage) window.applyLanguage(currentLang);
  if (typeof updateCalculator === 'function') updateCalculator();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBimxPlatform);
} else {
  initBimxPlatform();
}
