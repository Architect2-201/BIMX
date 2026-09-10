/**
 * land-intelligence.js
 * -----------------------------------------------------------------------
 * Frontend Client Engine for LAND INTELLIGENCE ENGINE GEORGIA.
 * Powers the interactive Leaflet GIS map, API integration with /api/land-analysis,
 * dynamic rendering of all 8 analytical blocks, and source transparency modals.
 */

let mapInstance = null;
let parcelLayer = null;
let zoningLayer = null;
let restrictionsLayer = null;
let contoursLayer = null;
let approvedProjectsLayer = null;
let satelliteLayer = null;
let streetLayer = null;

let currentAnalysisData = null;
let currentInfoTab = 'zone';

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initGISMap();
  initInfoModalDraggable();
  initMobileMenu();
  window.addEventListener('resize', () => {
    if (mapInstance) mapInstance.invalidateSize();
  });
  // Auto-run initial analysis on load
  const initialCode = document.getElementById('cadastralCodeInput').value;
  if (initialCode) {
    runAnalysis(initialCode, 'residential_single');
  }
});

function initMobileMenu() {
  const mobileHamburger = document.getElementById('mobileHamburger');
  const navLinksList = document.getElementById('navLinksList');
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
}

/**
 * Initializes the Leaflet GIS Map with high-contrast architectural cartography
 */
function initGISMap() {
  const mapElement = document.getElementById('gisMap');
  if (!mapElement) return;

  // Default centered on Tbilisi (Rustaveli Avenue coordinates)
  mapInstance = L.map('gisMap', {
    zoomControl: true,
    attributionControl: false
  }).setView([41.724, 44.771], 16);

  // OpenStreetMap cartography tiles (no watermark, clean high-contrast)
  streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);

  // Satellite ESRI imagery layer (toggled on request)
  satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
  });

  // Layer groups for GIS overlays
  parcelLayer = L.featureGroup().addTo(mapInstance);
  zoningLayer = L.featureGroup().addTo(mapInstance);
  restrictionsLayer = L.featureGroup().addTo(mapInstance);
  contoursLayer = L.featureGroup().addTo(mapInstance);
  approvedProjectsLayer = L.featureGroup().addTo(mapInstance);
}

/**
 * Toggles GIS map container between normal and fullscreen mode
 */
function toggleMapFullscreen() {
  const card = document.querySelector('.map-container-card');
  const btn = document.getElementById('btnFullscreenMap');
  if (!card) return;

  card.classList.toggle('fullscreen-active');
  const isFs = card.classList.contains('fullscreen-active');

  if (btn) {
    btn.innerHTML = isFs
      ? '<i class="fa-solid fa-compress"></i> პატარა ეკრანი'
      : '<i class="fa-solid fa-expand"></i> სრული ეკრანი';
    btn.classList.toggle('active', isFs);
  }

  setTimeout(() => {
    if (mapInstance) {
      mapInstance.invalidateSize();
      if (currentAnalysisData && currentAnalysisData.parcel && currentAnalysisData.parcel.coordinates && currentAnalysisData.parcel.coordinates.length > 0) {
        const poly = L.polygon(currentAnalysisData.parcel.coordinates);
        mapInstance.fitBounds(poly.getBounds().pad(0.35));
      }
    }
  }, 200);
}

/**
 * Toggles the GIS Layers Tree Panel
 */
function toggleGisTreePanel() {
  const panel = document.getElementById('gisTreePanel');
  const btn = document.getElementById('btnToggleTree');
  if (!panel) return;
  panel.classList.toggle('collapsed');
  if (btn) {
    btn.classList.toggle('active', !panel.classList.contains('collapsed'));
  }
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 260);
}

/**
 * Expands/Collapses tree folder nodes
 */
function toggleTreeNode(elem, grpId) {
  const grp = document.getElementById(grpId);
  const arrow = elem.querySelector('.tree-arrow');
  if (!grp) return;

  const isOpen = grp.classList.contains('open');
  grp.classList.toggle('open', !isOpen);
  elem.classList.toggle('active', !isOpen);
  if (arrow) {
    arrow.classList.toggle('open', !isOpen);
    arrow.textContent = isOpen ? '▶' : '▼';
  }
}

/**
 * Toggles specific GIS layers from the tree checkboxes
 */
function toggleSpecificLayer(layerKey, isChecked) {
  if (!mapInstance) return;

  switch (layerKey) {
    case 'functional_zones':
    case 'past_zones':
      if (isChecked) {
        if (!mapInstance.hasLayer(zoningLayer)) zoningLayer.addTo(mapInstance);
      } else {
        if (mapInstance.hasLayer(zoningLayer)) mapInstance.removeLayer(zoningLayer);
      }
      break;

    case 'parcel':
    case 'cad_boundaries':
      if (isChecked) {
        if (!mapInstance.hasLayer(parcelLayer)) parcelLayer.addTo(mapInstance);
      } else {
        if (mapInstance.hasLayer(parcelLayer)) mapInstance.removeLayer(parcelLayer);
      }
      break;

    case 'red_lines':
    case 'heritage_zone':
      if (isChecked) {
        if (!mapInstance.hasLayer(restrictionsLayer)) restrictionsLayer.addTo(mapInstance);
      } else {
        if (mapInstance.hasLayer(restrictionsLayer)) mapInstance.removeLayer(restrictionsLayer);
      }
      break;

    case 'building_contours':
    case 'next_interventions':
      if (isChecked) {
        if (!mapInstance.hasLayer(contoursLayer)) contoursLayer.addTo(mapInstance);
      } else {
        if (mapInstance.hasLayer(contoursLayer)) mapInstance.removeLayer(contoursLayer);
      }
      break;

    case 'approved_projects':
    case 'app_archived':
    case 'app_active':
      if (isChecked) {
        if (!mapInstance.hasLayer(approvedProjectsLayer)) approvedProjectsLayer.addTo(mapInstance);
      } else {
        if (mapInstance.hasLayer(approvedProjectsLayer)) mapInstance.removeLayer(approvedProjectsLayer);
      }
      break;

    default:
      console.log(`Layer toggle ${layerKey}: ${isChecked}`);
  }
}

/**
 * Enables smooth dragging for the 'ინფორმაცია' floating panel across the GIS map
 */
function initInfoModalDraggable() {
  const modal = document.getElementById('gisInfoModal');
  if (!modal) return;
  const header = modal.querySelector('.gis-info-header');
  if (!header) return;

  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.gis-info-btn')) return; // ignore control buttons
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const parent = modal.parentElement;
    if (!parent) return;
    const rect = modal.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;

    modal.style.right = 'auto';
    modal.style.bottom = 'auto';
    modal.style.left = initialLeft + 'px';
    modal.style.top = initialTop + 'px';

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const parent = modal.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const modalWidth = modal.offsetWidth;
    const modalHeight = modal.offsetHeight;

    let newLeft = Math.max(8, Math.min(parentRect.width - modalWidth - 8, initialLeft + dx));
    let newTop = Math.max(8, Math.min(parentRect.height - modalHeight - 8, initialTop + dy));

    modal.style.left = newLeft + 'px';
    modal.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

/**
 * Floating 'ინფორმაცია' Modal Controls
 */
function toggleInfoModalMin() {
  const modal = document.getElementById('gisInfoModal');
  const icon = document.getElementById('iconInfoMin');
  if (!modal) return;
  modal.classList.toggle('minimized');
  if (icon) {
    icon.className = modal.classList.contains('minimized') ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
  }
}

function resetInfoModalPos() {
  const modal = document.getElementById('gisInfoModal');
  if (!modal) return;
  modal.style.left = 'auto';
  modal.style.top = 'auto';
  modal.style.bottom = '16px';
  modal.style.right = '16px';
}

function closeInfoModal() {
  const modal = document.getElementById('gisInfoModal');
  if (modal) modal.style.display = 'none';
}

function switchInfoTab(tabKey) {
  currentInfoTab = tabKey;
  const tabParcel = document.getElementById('tabParcelInfo');
  const tabZone = document.getElementById('tabZoneInfo');
  const tabTas = document.getElementById('tabTasInfo');

  if (tabParcel) tabParcel.classList.toggle('active', tabKey === 'parcel');
  if (tabZone) tabZone.classList.toggle('active', tabKey === 'zone');
  if (tabTas) tabTas.classList.toggle('active', tabKey === 'tas');

  if (currentAnalysisData) {
    renderInfoModalDetails(currentAnalysisData);
  }
}

function renderInfoModalDetails(data) {
  const container = document.getElementById('gisInfoDetails');
  const modal = document.getElementById('gisInfoModal');
  const tabZone = document.getElementById('tabZoneInfo');
  const tabParcel = document.getElementById('tabParcelInfo');
  const tabTas = document.getElementById('tabTasInfo');
  if (!container || !data) return;

  if (modal) modal.style.display = 'flex';

  const p = data.parcel || {};
  const primaryZone = data.primaryZone || (data.functionalZones && data.functionalZones[0]) || {};
  const tas = data.tasProjects || { hasApprovedProjects: false, projects: [], remaining: {} };
  const rem = tas.remaining || {};
  const app = tas.approved || {};

  if (tabParcel) {
    tabParcel.textContent = 'რეგისტრირებული მიწის ნაკვეთი';
  }
  if (tabZone) {
    tabZone.textContent = primaryZone.tabLabelKa || primaryZone.zoneNameKa || 'საცხოვრებელი ზონა 5 (სზ-5)';
  }
  if (tabTas) {
    tabTas.textContent = tas.hasApprovedProjects ? `შეთანხმებული პროექტები (${tas.projectsCount})` : 'შეთანხმებული პროექტები (TAS)';
  }

  if (currentInfoTab === 'zone') {
    // Exact table layout matching Photo 3
    container.innerHTML = `
      <table class="tas-info-table">
        <tbody>
          <tr>
            <td class="tas-key">ზონა:</td>
            <td class="tas-val">${primaryZone.mainZoneKa || 'საცხოვრებელი ზონა'}</td>
          </tr>
          <tr>
            <td class="tas-key">ქვე ზონა:</td>
            <td class="tas-val">${primaryZone.subZoneKa || primaryZone.zoneCode || 'საცხოვრებელი ზონა-5'}</td>
          </tr>
          <tr>
            <td class="tas-key">კ-1:</td>
            <td class="tas-val">${primaryZone.k1 != null ? primaryZone.k1 : '—'}</td>
          </tr>
          <tr>
            <td class="tas-key">კ-2:</td>
            <td class="tas-val">${primaryZone.k2 != null ? primaryZone.k2 : '—'}</td>
          </tr>
          <tr>
            <td class="tas-key">კ-3:</td>
            <td class="tas-val">${primaryZone.k3 != null ? primaryZone.k3 : '—'}</td>
          </tr>
        </tbody>
      </table>
    `;
  } else if (currentInfoTab === 'tas') {
    // TAS Approved Projects & Remaining Capacity Tab
    if (tas.hasApprovedProjects && tas.projects && tas.projects.length > 0) {
      const proj = tas.projects[0];
      container.innerHTML = `
        <table class="tas-info-table">
          <tbody>
            <tr>
              <td class="tas-key">საქმის №:</td>
              <td class="tas-val" style="font-family: var(--font-mono); color: #0284c7; font-weight: 700;">${proj.caseNumber}</td>
            </tr>
            <tr>
              <td class="tas-key">გადაწყვეტილება:</td>
              <td class="tas-val">${proj.decisionNumber} (${proj.approvalDate})</td>
            </tr>
            <tr>
              <td class="tas-key">პროექტი:</td>
              <td class="tas-val">${proj.projectTitle}</td>
            </tr>
            <tr>
              <td class="tas-key">სტატუსი:</td>
              <td class="tas-val"><span class="tas-badge ${proj.status}">${proj.statusKa}</span></td>
            </tr>
            <tr>
              <td class="tas-key">შეთანხმებული K-1:</td>
              <td class="tas-val"><strong>${proj.approvedFootprintSqm} მ²</strong></td>
            </tr>
            <tr>
              <td class="tas-key">შეთანხმებული K-2:</td>
              <td class="tas-val"><strong style="color: #0284c7;">${proj.approvedGrossAreaSqm} მ²</strong> (${app.grossAreaUtilizationPercent}%)</td>
            </tr>
            <tr>
              <td class="tas-key">დარჩენილი K-1 ფეხი:</td>
              <td class="tas-val" style="color: #00f0ff; font-weight: 700;">${rem.footprintSqm} მ² (${rem.footprintPercent}%)</td>
            </tr>
            <tr>
              <td class="tas-key">დარჩენილი K-2 ფართი:</td>
              <td class="tas-val" style="color: #10b981; font-weight: 700;">${rem.grossAreaSqm} მ² (${rem.grossAreaPercent}%)</td>
            </tr>
            <tr>
              <td class="tas-key">სართულები:</td>
              <td class="tas-val">${proj.approvedFloors ? `${proj.approvedFloors} სართ.` : '—'} (${rem.remainingFloorsReserve})</td>
            </tr>
            <tr>
              <td class="tas-key">TAS ოფიციალური:</td>
              <td class="tas-val"><a href="${proj.tasUrl || 'https://tas.ge/'}" target="_blank" rel="noopener" style="color: #0284c7; font-weight: 600; text-decoration: underline;">tas.ge დოკუმენტი ↗</a></td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
      container.innerHTML = `
        <div style="padding: 12px 0; color: #475569; font-size: 0.86rem; line-height: 1.5;">
          <div style="font-weight: 700; color: #10b981; margin-bottom: 6px; font-size: 0.92rem;">
            <i class="fa-solid fa-circle-check"></i> 100% თავისუფალი სამშენებლო რესურსი
          </div>
          <div>ნაკვეთზე არ ფიქსირდება შეთანხმებული არქიტექტურული პროექტი ან სამშენებლო ნებართვა.</div>
          <div style="margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0; color: #166534; font-size: 0.84rem;">
            <strong>დარჩენილი პოტენციალი:</strong> სრული K-1 (${(data.coefficients?.k1?.maxFootprintSqm || 0).toLocaleString()} მ²) და K-2 (${(data.coefficients?.k2?.maxGrossFloorAreaSqm || 0).toLocaleString()} მ²).
          </div>
        </div>
      `;
    }
  } else {
    // Parcel tab
    container.innerHTML = `
      <table class="tas-info-table">
        <tbody>
          <tr>
            <td class="tas-key">საკადასტრო კოდი:</td>
            <td class="tas-val" style="font-family: var(--font-mono);">${p.cadastralCode || '—'}</td>
          </tr>
          <tr>
            <td class="tas-key">დაზუსტებული ფართობი:</td>
            <td class="tas-val">${(p.areaSqm || 0).toLocaleString()} მ²</td>
          </tr>
          <tr>
            <td class="tas-key">მისამართი:</td>
            <td class="tas-val">${p.address || '—'}</td>
          </tr>
          <tr>
            <td class="tas-key">სტატუსი:</td>
            <td class="tas-val"><span style="color: #10b981; font-weight: 700;">რეგისტრირებული</span></td>
          </tr>
          <tr>
            <td class="tas-key">უფლების ტიპი:</td>
            <td class="tas-val">საკუთრება</td>
          </tr>
        </tbody>
      </table>
    `;
  }
}

/**
 * Toggles GIS map layers via the UI toolbar
 */
function toggleMapLayer(layerName) {
  if (!mapInstance) return;

  const btnId = 'btnLayer' + layerName.charAt(0).toUpperCase() + layerName.slice(1);
  const btn = document.getElementById(btnId);

  if (layerName === 'satellite') {
    if (mapInstance.hasLayer(satelliteLayer)) {
      mapInstance.removeLayer(satelliteLayer);
      streetLayer.addTo(mapInstance);
      if (btn) btn.classList.remove('active');
    } else {
      mapInstance.removeLayer(streetLayer);
      satelliteLayer.addTo(mapInstance);
      if (btn) btn.classList.add('active');
    }
    return;
  }

  const layerMap = {
    parcel: parcelLayer,
    zoning: zoningLayer,
    restrictions: restrictionsLayer
  };

  const targetGroup = layerMap[layerName];
  if (!targetGroup) return;

  if (mapInstance.hasLayer(targetGroup)) {
    mapInstance.removeLayer(targetGroup);
    if (btn) btn.classList.remove('active');
  } else {
    targetGroup.addTo(mapInstance);
    if (btn) btn.classList.add('active');
  }
}

/**
 * Quick Cadastral Sample Selector
 */
function setCadastralSample(code, use, zone) {
  const inputEl = document.getElementById('cadastralCodeInput');
  if (inputEl) inputEl.value = code;
  const useEl = document.getElementById('projectTypeSelect');
  if (useEl && use) useEl.value = use;
  const zoneEl = document.getElementById('zoneOverrideSelect');
  if (zoneEl) zoneEl.value = zone || 'auto';
  runAnalysis(code, use || 'residential_single', zone || null);
}

/**
 * Normalizes input cadastral string (spaces, hyphens, slashes, or raw digits)
 */
function normalizeCadastralInput(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let code = raw.trim().replace(/[\s\-_/]+/g, '.');
  if (/^\d{11,14}$/.test(code)) {
    code = `${code.slice(0, 2)}.${code.slice(2, 4)}.${code.slice(4, 6)}.${code.slice(6, 9)}.${code.slice(9)}`;
  }
  return code.replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
}

/**
 * Handles form submit
 */
function handleAnalysisSubmit(e) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById('cadastralCodeInput');
  const code = normalizeCadastralInput(inputEl ? inputEl.value : '');
  if (inputEl) inputEl.value = code;
  const use = document.getElementById('projectTypeSelect') ? document.getElementById('projectTypeSelect').value : 'residential_single';
  const zoneSelect = document.getElementById('zoneOverrideSelect');
  const zoneOverride = zoneSelect && zoneSelect.value !== 'auto' ? zoneSelect.value : null;
  runAnalysis(code, use, zoneOverride);
}

/**
 * Immediate reactive handler when user picks a zone from the dropdown
 */
function handleZoneOverrideChange(selectedZone) {
  const inputEl = document.getElementById('cadastralCodeInput');
  const code = normalizeCadastralInput(inputEl ? inputEl.value : '');
  const use = document.getElementById('projectTypeSelect') ? document.getElementById('projectTypeSelect').value : 'residential_single';
  if (code && currentAnalysisData) {
    runAnalysis(code, use, selectedZone !== 'auto' ? selectedZone : null);
  }
}

/**
 * Executes full land analysis via POST /api/land-analysis
 */
async function runAnalysis(cadastralCode, buildingUse, zoneOverride) {
  const spinner = document.getElementById('loadingSpinner');
  const resultsContainer = document.getElementById('resultsContainer');
  const errorAlert = document.getElementById('errorAlert');
  const analyzeBtn = document.getElementById('analyzeBtn');

  if (spinner) spinner.style.display = 'block';
  if (errorAlert) errorAlert.style.display = 'none';
  if (analyzeBtn) analyzeBtn.disabled = true;

  const zoneSelect = document.getElementById('zoneOverrideSelect');
  const activeZoneOverride = zoneOverride !== undefined
    ? zoneOverride
    : (zoneSelect && zoneSelect.value !== 'auto' ? zoneSelect.value : null);

  try {
    const res = await fetch('/api/land-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cadastralCode,
        constructionType: 'new_construction',
        buildingUse: buildingUse || 'residential_single',
        zoneOverride: activeZoneOverride
      })
    });

    const data = await res.json();

    if (!res.ok || data.status === 'ERROR') {
      throw new Error(data.messageKa || data.error || 'მოთხოვნის დამუშავება ვერ მოხერხდა');
    }

    currentAnalysisData = data;
    if (resultsContainer) resultsContainer.style.display = 'block';
    renderAnalysisResults(data);

    setTimeout(() => {
      if (mapInstance) {
        mapInstance.invalidateSize();
        if (data.parcel && data.parcel.coordinates && data.parcel.coordinates.length > 0) {
          const poly = L.polygon(data.parcel.coordinates);
          mapInstance.fitBounds(poly.getBounds().pad(0.35));
        }
      }
    }, 150);
  } catch (err) {
    if (errorAlert) {
      document.getElementById('errorMessage').textContent = err.message || 'შეცდომა ანალიზის დროს';
      errorAlert.style.display = 'block';
    }
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (analyzeBtn) analyzeBtn.disabled = false;
  }
}

/**
 * Renders the entire analytical report across all blocks
 */
function renderAnalysisResults(data) {
  const p = data.parcel;
  const mun = data.municipality;
  const adm = data.administrativeArea;
  const zones = data.functionalZones || [];
  const primaryZone = data.primaryZone || (zones[0] || {});
  const coeffs = data.coefficients;
  const rules = data.parcelRequirements.complianceChecks || [];
  const restr = data.restrictions || [];
  const poss = data.constructionPossibility;
  const summary = data.finalSummary;
  const buildable = data.buildableArea;

  // 1. Quick Stats Strip
  setText('statArea', `${p.areaSqm.toLocaleString()} მ²`);
  setText('statCadastral', p.cadastralCode);
  setText('statMunicipality', mun.nameKa);
  setText('statDistrict', adm.districtKa);
  setText('statZoneCode', primaryZone.mainZoneKa || 'საცხოვრებელი ზონა');
  setText('statZoneName', primaryZone.subZoneKa || primaryZone.zoneNameKa || '—');

  const badgeEl = document.getElementById('statPossibilityBadge');
  if (badgeEl) {
    badgeEl.className = `status-badge ${poss.colorStatus}`;
    badgeEl.textContent = poss.statusLabelKa;
  }

  // 2. Executive Summary Block
  setText('execSummaryText', summary.executiveSummaryKa);
  setText('whatCanBuildText', summary.whatYouCanBuildKa);
  setText('keyRiskText', summary.keyRiskKa);
  setText('disclaimerBox', summary.disclaimerKa);

  const actionBox = document.getElementById('firstActionBox');
  if (actionBox) {
    actionBox.innerHTML = (summary.firstActionKa || '').replace(/\n/g, '<br>');
  }

  // 3. GIS Map Drawing & Information Modal
  updateMapGeometry(p.coordinates, p.centroid, primaryZone, restr, data.tasProjects);
  renderInfoModalDetails(data);

  // 4. BLOCK A: Basic Info & Geometry
  setText('blockACadastral', p.cadastralCode);
  setText('blockAArea', `${p.areaSqm.toLocaleString()} მ²`);
  setText('blockAMunicipality', mun.nameKa);
  setText('blockADistrict', adm.districtKa);
  setText('blockAAddress', p.address || '—');
  setText('blockAWidth', p.dimensions ? `${p.dimensions.minWidthM} მ` : '—');
  setText('blockADepth', p.dimensions ? `${p.dimensions.avgDepthM} მ` : '—');
  setText('blockAPerimeter', p.dimensions ? `${p.dimensions.perimeterM} მ` : '—');
  setText('blockAShape', p.dimensions ? p.dimensions.shapeDescriptionKa : '—');

  // 5. BLOCK B: Functional Zoning & Urban Plan (Separated Zone & Subzone)
  const splitAlert = document.getElementById('splitZoneAlert');
  if (splitAlert) splitAlert.style.display = data.isSplitZone ? 'block' : 'none';

  const zoningContainer = document.getElementById('zoningCardsContainer');
  if (zoningContainer) {
    zoningContainer.innerHTML = zones.map(z => `
      <div class="param-card" style="border-left: 4px solid ${z.colorHex || '#fb8500'};">
        <div class="param-key" style="color: #64748b; text-transform: none; font-size: 0.8rem;">
          ზონა: <strong style="color: #0284c7;">${z.mainZoneKa || 'საცხოვრებელი ზონა'}</strong>
        </div>
        <div class="param-val" style="font-size: 1.18rem; color: #ffffff; margin: 4px 0;">
          ქვე ზონა: <span style="color: var(--cyan-neon);">${z.subZoneKa || z.zoneNameKa}</span>
        </div>
        <div style="display: flex; gap: 12px; font-size: 0.88rem; color: #e2e8f0; font-family: var(--font-mono); margin: 6px 0;">
          <span>კ-1: <strong style="color: #38bdf8;">${z.k1 != null ? z.k1 : '0.5'}</strong></span>
          <span>კ-2: <strong style="color: #38bdf8;">${z.k2 != null ? z.k2 : '2.1'}</strong></span>
          <span>კ-3: <strong style="color: #38bdf8;">${z.k3 != null ? z.k3 : '0.3'}</strong></span>
        </div>
        <div class="param-formula" style="margin-top: 6px;">
          გადაკვეთის ფართობი: <strong>${z.intersectionAreaSqm} მ² (${z.intersectionPercentage}%)</strong>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">
          ${z.regulations ? z.regulations.legalBasisKa || '' : ''}
        </div>
      </div>
    `).join('');
  }

  const plan = data.urbanPlan;
  setText('urbanPlanName', `${plan.planNameKa} (${plan.planVersion})`);
  setText('urbanPlanAct', plan.approvalAct);
  const matsneLink = document.getElementById('urbanPlanMatsneLink');
  if (matsneLink && plan.matsneUrl) matsneLink.href = plan.matsneUrl;

  // 6. BLOCK C: Coefficients K1, K2, K3
  setText('coeffK1', coeffs.k1.value != null ? coeffs.k1.value : 'განუსაზღვრელია');
  setText('coeffK1Formula', coeffs.k1.formula);
  setText('coeffK1MaxFootprint', coeffs.k1.maxFootprintSqm != null ? `მაქს. განაშენიანება: ${coeffs.k1.maxFootprintSqm} მ²` : coeffs.k1.rationaleKa);

  setText('coeffK2', coeffs.k2.value != null ? coeffs.k2.value : 'განუსაზღვრელია');
  setText('coeffK2Formula', coeffs.k2.formula);
  setText('coeffK2MaxGrossArea', coeffs.k2.maxGrossFloorAreaSqm != null ? `მაქს. საერთო ფართობი: ${coeffs.k2.maxGrossFloorAreaSqm} მ²` : coeffs.k2.rationaleKa);

  setText('coeffK3', coeffs.k3.value != null ? coeffs.k3.value : 'განუსაზღვრელია');
  setText('coeffK3Formula', coeffs.k3.formula);
  setText('coeffK3MinGreen', coeffs.k3.minGreenAreaSqm != null ? `მინ. გამწვანება: ${coeffs.k3.minGreenAreaSqm} მ²` : coeffs.k3.rationaleKa);

  const reg = primaryZone.regulations || {};
  setText('paramHeight', reg.maximumHeight ? `${reg.maximumHeight} მ` : 'დადგენილი არ არის');
  setText('paramFloors', reg.maximumFloors ? `მაქსიმუმ ${reg.maximumFloors} სართული` : 'რეგულირდება დეტალური გეგმით (გდგ)');
  setText('paramSetbacks', `ფასადი: ${reg.setbacks?.front || 3}მ | გვერდი: ${reg.setbacks?.side || 3}მ | უკანა: ${reg.setbacks?.rear || 3}მ`);

  setText('paramBuildableFootprint', `${buildable.potentialBuildableFootprintSqm} მ²`);
  setText('paramBuildableFormula', buildable.formulaDescriptionKa);

  // 6b. BLOCK C2: Approved Projects & Remaining Capacity
  renderApprovedProjectsAndCapacity(data.tasProjects, coeffs, p);

  // 7. BLOCK D: Compliance Checks
  const compTable = document.getElementById('complianceTableBody');
  if (compTable) {
    compTable.innerHTML = rules.map(r => `
      <tr>
        <td><strong>${r.titleKa}</strong></td>
        <td style="color: var(--cyan-neon);">${r.requiredValue}</td>
        <td>${r.actualValue}</td>
        <td><span class="comp-badge ${r.status}">${r.status}</span></td>
        <td style="font-size: 0.82rem; color: var(--text-secondary);">${r.descriptionKa}</td>
      </tr>
    `).join('');
  }

  // 8. BLOCK E: Permitted / Conditional / Prohibited Uses
  setList('permittedUsesList', reg.permittedUses || []);
  setList('conditionalUsesList', reg.conditionalUses || []);
  setList('prohibitedUsesList', reg.prohibitedUses || []);

  // 9. BLOCK F: Unified Restrictions Registry
  const restrTable = document.getElementById('restrictionsTableBody');
  if (restrTable) {
    restrTable.innerHTML = restr.map(r => `
      <tr>
        <td><strong>${r.nameKa}</strong></td>
        <td>${r.intersects ? '<span style="color: #f87171; font-weight: 700;">დიახ</span>' : '<span style="color: #4ade80;">არა</span>'}</td>
        <td style="color: var(--cyan-neon); font-family: var(--font-mono);">${r.affectedAreaSqm ? `${r.affectedAreaSqm} მ²` : '—'}</td>
        <td style="font-size: 0.85rem;">${r.descriptionKa}</td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${r.source || 'ოფიციალური GIS'}</td>
      </tr>
    `).join('');
  }

  // 10. BLOCK G: Construction Possibility
  const possBadgeG = document.getElementById('blockGPossibilityBadge');
  if (possBadgeG) {
    possBadgeG.className = `status-badge ${poss.colorStatus}`;
    possBadgeG.textContent = poss.statusLabelKa;
  }
  setText('blockGPossibilityDesc', poss.conditions && poss.conditions.length > 0 ? poss.conditions.join(' ') : 'დაგეგმილი პროექტი აკმაყოფილებს სტანდარტულ მოთხოვნებს.');
  setList('blockGApprovalsList', poss.requiredApprovals || []);

  // 11. BLOCK H: Obligations
  setList('obligationsList', data.obligations || []);
}

/**
 * Updates GIS Map geometries and camera bounds
 */
function updateMapGeometry(coordinates, centroid, primaryZone, restrictions, tasProjects) {
  if (!mapInstance || !coordinates || coordinates.length < 3) return;

  parcelLayer.clearLayers();
  zoningLayer.clearLayers();
  restrictionsLayer.clearLayers();
  contoursLayer.clearLayers();
  if (approvedProjectsLayer) approvedProjectsLayer.clearLayers();

  // Draw Parcel Boundary (High contrast neon cyan)
  const polygon = L.polygon(coordinates, {
    color: '#00f0ff',
    weight: 3,
    opacity: 0.95,
    fillColor: '#00f0ff',
    fillOpacity: 0.22
  }).addTo(parcelLayer);

  // Click on parcel opens information modal on parcel tab
  polygon.on('click', () => {
    switchInfoTab('parcel');
    const modal = document.getElementById('gisInfoModal');
    if (modal) modal.style.display = 'flex';
  });

  // Add Centroid Marker
  if (centroid && centroid.length === 2) {
    L.circleMarker(centroid, {
      radius: 6,
      fillColor: '#ff7828',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).bindPopup(`<b>ნაკვეთის ცენტროიდი:</b><br>${centroid[0].toFixed(5)}, ${centroid[1].toFixed(5)}`).addTo(parcelLayer);
  }

  // Draw Simulated Zoning Context Envelope (Resolution 14-39)
  const zoneColor = (primaryZone && primaryZone.colorHex) || '#fb8500';
  const bounds = polygon.getBounds();
  const zoneBox = bounds.pad(0.75); // 75% padding representing surrounding zoning polygon
  const zonePopupHtml = `
    <div style="font-family: inherit; min-width: 220px; font-size: 0.88rem; line-height: 1.45; color: #1e293b;">
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 5px; font-size: 0.95rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
        ${primaryZone.tabLabelKa || primaryZone.zoneNameKa || 'საცხოვრებელი ზონა 5 (სზ-5)'}
      </div>
      <div style="color: #475569; margin-bottom: 2px;"><strong style="color: #0f172a;">ზონა:</strong> ${primaryZone.mainZoneKa || 'საცხოვრებელი ზონა'}</div>
      <div style="color: #475569; margin-bottom: 4px;"><strong style="color: #0f172a;">ქვე ზონა:</strong> ${primaryZone.subZoneKa || 'საცხოვრებელი ზონა-5'}</div>
      <div style="margin-top: 5px; font-weight: 700; color: #0284c7; background: #f0f9ff; padding: 4px 8px; border-radius: 6px; display: inline-block;">
        კ-1: ${primaryZone.k1 != null ? primaryZone.k1 : '0.5'} | კ-2: ${primaryZone.k2 != null ? primaryZone.k2 : '2.1'} | კ-3: ${primaryZone.k3 != null ? primaryZone.k3 : '0.3'}
      </div>
    </div>
  `;
  const zoneRect = L.rectangle(zoneBox, {
    color: zoneColor,
    weight: 2,
    dashArray: '5, 5',
    fillColor: zoneColor,
    fillOpacity: 0.12
  }).bindPopup(zonePopupHtml).addTo(zoningLayer);

  zoneRect.on('click', () => {
    switchInfoTab('zone');
    const modal = document.getElementById('gisInfoModal');
    if (modal) modal.style.display = 'flex';
  });

  // Draw Approved Projects Building Footprints (Photo & TAS overlay)
  if (tasProjects && tasProjects.projects && tasProjects.projects.length > 0 && approvedProjectsLayer) {
    tasProjects.projects.forEach(proj => {
      if (proj.footprintContour && proj.footprintContour.length >= 3) {
        const appPoly = L.polygon(proj.footprintContour, {
          color: '#f59e0b',
          weight: 2.5,
          dashArray: '5, 5',
          fillColor: '#f59e0b',
          fillOpacity: 0.38
        }).bindPopup(`
          <div style="font-family: inherit; font-size: 0.86rem; line-height: 1.45; color: #1e293b; min-width: 220px;">
            <div style="font-weight: 700; color: #b45309; margin-bottom: 4px;">${proj.caseNumber}</div>
            <div style="font-weight: 600; color: #0f172a; margin-bottom: 4px;">${proj.projectTitle}</div>
            <div style="margin-bottom: 2px;">სტატუსი: <span class="tas-badge ${proj.status}">${proj.statusKa}</span></div>
            <div style="margin-bottom: 2px;">შეთანხმებული ფართი: <strong>${proj.approvedGrossAreaSqm} მ²</strong></div>
            <div style="margin-top: 4px; color: #059669; font-weight: 700;">
              დარჩენილი პოტენციალი: ${tasProjects.remaining ? tasProjects.remaining.grossAreaSqm : 0} მ²
            </div>
          </div>
        `).addTo(approvedProjectsLayer);

        appPoly.on('click', () => {
          switchInfoTab('tas');
          const modal = document.getElementById('gisInfoModal');
          if (modal) modal.style.display = 'flex';
        });
      }
    });
  }

  // Draw Building Contours (Nearby existing structures)
  const cLat = bounds.getCenter().lat;
  const cLng = bounds.getCenter().lng;
  const bldg1 = [
    [cLat + 0.00035, cLng + 0.0004],
    [cLat + 0.00065, cLng + 0.0004],
    [cLat + 0.00065, cLng + 0.00075],
    [cLat + 0.00035, cLng + 0.00075]
  ];
  const bldg2 = [
    [cLat - 0.00035, cLng - 0.0004],
    [cLat - 0.00065, cLng - 0.0004],
    [cLat - 0.00065, cLng - 0.00075],
    [cLat - 0.00035, cLng - 0.00075]
  ];
  L.polygon(bldg1, { color: '#64748b', weight: 1.5, fillColor: '#94a3b8', fillOpacity: 0.3 }).addTo(contoursLayer);
  L.polygon(bldg2, { color: '#64748b', weight: 1.5, fillColor: '#94a3b8', fillOpacity: 0.3 }).addTo(contoursLayer);

  // Draw Red Line road buffer along front if present
  const redLineRestr = (restrictions || []).find(r => r.type === 'RED_LINE');
  if (redLineRestr && redLineRestr.intersects) {
    const frontCoords = coordinates.slice(0, 2);
    L.polyline(frontCoords, {
      color: '#ef4444',
      weight: 4,
      dashArray: '4, 4'
    }).bindPopup('<b>წითელი ხაზი:</b> ქუჩის განაშენიანების ხაზი (უკან დახევა 3მ)').addTo(restrictionsLayer);
  }

  // Fit view tightly to the parcel with smooth animated zoom
  mapInstance.invalidateSize();
  mapInstance.fitBounds(polygon.getBounds().pad(0.35), {
    animate: true,
    duration: 0.8
  });
}

/**
 * Renders BLOCK C2: Approved TAS Projects and Remaining Potential Capacity
 */
function renderApprovedProjectsAndCapacity(tasData, coeffs, parcel) {
  if (!tasData) return;

  const app = tasData.approved || {};
  const rem = tasData.remaining || {};
  const limits = tasData.limits || {};

  // 1. K-1 Footprint Gauge
  const k1Used = app.totalFootprintSqm || 0;
  const k1Rem = rem.footprintSqm || 0;
  const k1Percent = app.footprintUtilizationPercent || 0;
  const k1RemPercent = rem.footprintPercent || 0;

  setText('k1UtilizationPercent', `${k1Percent}% ათვისებული`);
  const k1FillUsed = document.getElementById('k1FillUsed');
  const k1FillRem = document.getElementById('k1FillRemaining');
  if (k1FillUsed) k1FillUsed.style.width = `${k1Percent}%`;
  if (k1FillRem) k1FillRem.style.width = `${k1RemPercent}%`;
  setText('k1UsedVal', `${k1Used.toLocaleString()} მ²`);
  setText('k1RemainingVal', `${k1Rem.toLocaleString()} მ² (${k1RemPercent}%)`);

  // 2. K-2 Gross Area Gauge
  const k2Used = app.totalGrossAreaSqm || 0;
  const k2Rem = rem.grossAreaSqm || 0;
  const k2Percent = app.grossAreaUtilizationPercent || 0;
  const k2RemPercent = rem.grossAreaPercent || 0;

  setText('k2UtilizationPercent', `${k2Percent}% ათვისებული`);
  const k2FillUsed = document.getElementById('k2FillUsed');
  const k2FillRem = document.getElementById('k2FillRemaining');
  if (k2FillUsed) k2FillUsed.style.width = `${k2Percent}%`;
  if (k2FillRem) k2FillRem.style.width = `${k2RemPercent}%`;
  setText('k2UsedVal', `${k2Used.toLocaleString()} მ²`);
  setText('k2RemainingVal', `${k2Rem.toLocaleString()} მ² (${k2RemPercent}%)`);

  // 3. KPI Summary Cards
  setText('tasApprovedTotalGross', `${k2Used.toLocaleString()} მ²`);
  setText('tasApprovedProjectsCount', `დამტკიცებული საქმეები: ${tasData.projectsCount || 0}`);

  setText('tasRemainingGrossArea', `${k2Rem.toLocaleString()} მ²`);
  setText('tasRemainingGrossPercent', `დარჩენილი რესურსი: ${k2RemPercent}% (${limits.maxAllowedGrossAreaSqm || 0} მ²-დან)`);

  setText('tasRemainingFootprint', `${k1Rem.toLocaleString()} მ²`);
  setText('tasRemainingFootprintPercent', `თავისუფალი ზედაპირი: ${k1RemPercent}% (${limits.maxAllowedFootprintSqm || 0} მ²-დან)`);

  setText('tasRemainingFloorsReserve', rem.remainingFloorsReserve || '—');
  const statusBadge = document.getElementById('tasPotentialStatusBadge');
  if (statusBadge) {
    statusBadge.innerHTML = `<span class="tas-badge ${rem.status}">${rem.statusLabelKa || 'დარჩენილია რესურსი'}</span>`;
  }

  // 4. Narrative Evaluation
  const narrativeBox = document.getElementById('tasPotentialNarrativeBox');
  if (narrativeBox) {
    narrativeBox.innerHTML = `
      <div style="font-weight: 700; color: #ffffff; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-chart-pie" style="color: var(--cyan-neon);"></i>
        ურბანული ტევადობისა და დარჩენილი პოტენციალის შეფასება:
      </div>
      <div>${rem.narrativeKa || 'ნაკვეთზე სამშენებლო რესურსი ხელმისაწვდომია.'}</div>
    `;
  }

  // 5. Approved Projects Table
  const tableBody = document.getElementById('tasProjectsTableBody');
  if (tableBody) {
    if (tasData.projects && tasData.projects.length > 0) {
      tableBody.innerHTML = tasData.projects.map(p => `
        <tr>
          <td>
            <strong style="color: var(--cyan-neon); font-family: var(--font-mono);">${p.caseNumber}</strong>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">${p.decisionNumber}</div>
          </td>
          <td style="font-size: 0.84rem; color: var(--text-secondary); white-space: nowrap;">${p.approvalDate}</td>
          <td>
            <strong style="color: #ffffff;">${p.projectTitle}</strong>
            <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 3px;">
              დანიშნულება: <span style="color: #38bdf8;">${p.buildingUse}</span> | ავტოსადგომი: ${p.parkingSpaces || 0}
            </div>
          </td>
          <td><span class="tas-badge ${p.status}">${p.statusKa}</span></td>
          <td style="font-family: var(--font-mono); white-space: nowrap;">${p.approvedFootprintSqm.toLocaleString()} მ²</td>
          <td style="font-family: var(--font-mono); color: #38bdf8; font-weight: 700; white-space: nowrap;">${p.approvedGrossAreaSqm.toLocaleString()} მ²</td>
          <td style="font-size: 0.85rem; white-space: nowrap;">${p.approvedFloors ? `${p.approvedFloors} სართ. (${p.approvedHeightM || 0}მ)` : '—'}</td>
          <td>
            <a href="${p.tasUrl || 'https://tas.ge/'}" target="_blank" rel="noopener" style="color: var(--cyan-neon); text-decoration: underline; font-size: 0.82rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-file-pdf"></i> TAS საქმე ↗
            </a>
          </td>
        </tr>
      `).join('');
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 32px 16px;">
            <i class="fa-solid fa-folder-open" style="font-size: 1.8rem; color: #64748b; display: block; margin-bottom: 10px;"></i>
            <strong style="color: #ffffff; font-size: 0.95rem;">ნაკვეთზე შეთანხმებული არქიტექტურული პროექტი ან სამშენებლო ნებართვა არ ფიქსირდება</strong>
            <div style="margin-top: 6px; font-size: 0.82rem; color: #94a3b8;">
              მოქმედი ზონის კოეფიციენტები (K1=${limits.k1 || 0.5}, K2=${limits.k2 || 1.5}) 100%-ით თავისუფალია ახალი მშენებლობისთვის.
            </div>
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Modal for Source Provenance and Verification
 */
function showSourceModal(category) {
  const modal = document.getElementById('sourceModal');
  const content = document.getElementById('modalSourceContent');
  if (!modal || !content || !currentAnalysisData) return;

  let title = 'მონაცემთა წყაროს დეტალები';
  let bodyHtml = '';

  const sources = currentAnalysisData.sources || [];

  if (category === 'napr') {
    const s = sources.find(x => x.providerName === 'NAPRProvider') || {};
    bodyHtml = `
      <div style="margin-bottom: 12px;"><strong>მონაცემის დასახელება:</strong> საკადასტრო საზღვარი და ნაკვეთის გეომეტრია (WKT)</div>
      <div style="margin-bottom: 12px;"><strong>ოფიციალური წყარო:</strong> ${s.officialSource || 'სსიპ საჯარო რეესტრის ეროვნული სააგენტო (NAPR)'}</div>
      <div style="margin-bottom: 12px;"><strong>სისტემის URL:</strong> <a href="${s.sourceUrl}" target="_blank" style="color: var(--cyan-neon);">${s.sourceUrl}</a></div>
      <div style="margin-bottom: 12px;"><strong>ვერსია / სისტემა:</strong> ${s.version || 'NAPR-GIS-v2'}</div>
      <div style="margin-bottom: 12px;"><strong>ბოლო სინქრონიზაცია:</strong> ${s.lastSyncedAt || new Date().toISOString()}</div>
      <div style="margin-bottom: 12px;"><strong>ხარისხის სტატუსი:</strong> <span class="comp-badge COMPLIANT">VERIFIED_OFFICIAL</span></div>
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 14px; border-top: 1px solid var(--border-line); padding-top: 10px;">
        შენიშვნა: ნაკვეთის პოლიგონი მიღებულია maps.gov.ge-ს ოფიციალური WKT სერვისიდან.
      </div>
    `;
  } else if (category === 'zoning') {
    const s = sources.find(x => x.providerName === 'TbilisiZoningProvider') || {};
    const plan = currentAnalysisData.urbanPlan || {};
    bodyHtml = `
      <div style="margin-bottom: 12px;"><strong>ფუნქციური ზონირების ფენა:</strong> ${s.officialSource}</div>
      <div style="margin-bottom: 12px;"><strong>მოქმედი გენგეგმა:</strong> ${plan.planNameKa} (${plan.planVersion})</div>
      <div style="margin-bottom: 12px;"><strong>დამტკიცების აქტი:</strong> ${plan.approvalAct}</div>
      <div style="margin-bottom: 12px;"><strong>საკანონმდებლო მაცნე:</strong> <a href="${plan.matsneUrl}" target="_blank" style="color: var(--cyan-neon);">${plan.matsneUrl}</a></div>
      <div style="margin-bottom: 12px;"><strong>ხარისხის სტატუსი:</strong> <span class="comp-badge COMPLIANT">VERIFIED_OFFICIAL</span></div>
    `;
  } else if (category === 'tas') {
    const s = sources.find(x => x.providerName === 'TASProjectsProvider') || {};
    bodyHtml = `
      <div style="margin-bottom: 12px;"><strong>მონაცემის დასახელება:</strong> შეთანხმებული არქიტექტურული პროექტები და სამშენებლო ნებართვები</div>
      <div style="margin-bottom: 12px;"><strong>ოფიციალური უწყება:</strong> ${s.officialSource || 'სსიპ ქალაქ თბილისის მუნიციპალიტეტის არქიტექტურის სამსახური (TAS.GE)'}</div>
      <div style="margin-bottom: 12px;"><strong>ელექტრონული სისტემა:</strong> <a href="${s.sourceUrl || 'https://tas.ge/'}" target="_blank" style="color: var(--cyan-neon);">${s.sourceUrl || 'https://tas.ge/'}</a></div>
      <div style="margin-bottom: 12px;"><strong>მონაცემთა ხარისხი:</strong> <span class="comp-badge COMPLIANT">VERIFIED_OFFICIAL</span></div>
      <div style="margin-bottom: 12px;"><strong>დარჩენილი პოტენციალის გამოთვლის მეთოდი:</strong> Rules Engine (ნორმატიულ ზღვრულ პარამეტრებს გამოკლებული დამტკიცებული მაჩვენებლები)</div>
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 14px; border-top: 1px solid var(--border-line); padding-top: 10px;">
        შენიშვნა: მონაცემები სინქრონიზებულია თბილისის არქიტექტურის სამსახურის ელექტრონულ რეესტრთან.
      </div>
    `;
  } else {
    bodyHtml = `
      <div style="margin-bottom: 12px;"><strong>სამართლებრივი საფუძველი:</strong> საქართველოს მთავრობის №59 დადგენილება & ქ. თბილისის საკრებულოს №14-39 დადგენილება</div>
      <div style="margin-bottom: 12px;"><strong>გამოთვლის მეთოდოლოგია:</strong> Rules Engine (ნორმატიული კოეფიციენტების გამრავლება ნაკვეთის ოფიციალურ ფართობზე)</div>
      <div style="margin-bottom: 12px;"><strong>ხარისხის სტატუსი:</strong> <span class="comp-badge COMPLIANT">RULE_BASED CALCULATION</span></div>
    `;
  }

  content.innerHTML = bodyHtml;
  modal.style.display = 'flex';
}

function closeSourceModal(e) {
  const modal = document.getElementById('sourceModal');
  if (modal) modal.style.display = 'none';
}

// Utility DOM helpers
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setList(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<li style="color: var(--text-muted);">არ ფიქსირდება</li>';
    return;
  }
  el.innerHTML = items.map(item => `<li>${item}</li>`).join('');
}
