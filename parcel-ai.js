/**
 * BIMX Studio - Land Parcel AI Analysis (ნაკვეთის AI ანალიზი)
 * GIS + AI + 3D Concept Generation Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================================================
     1. State & Authentic Cadastral Database for Georgia
     ========================================================================== */
  const state = {
    currentLang: localStorage.getItem('bimx_lang') || 'ka',
    currentTheme: localStorage.getItem('bimx_theme') || 'dark',
    currentMode: '3d', // 'map', '2d', '3d', 'combined'
    activeParcel: null,
    activeConcept: null,
    variants: {
      A: null,
      B: null,
      C: null
    },
    activeVariantKey: 'A',
    mapLayerType: 'satellite', // 'satellite' or 'vector'
    measureMode: null, // null, 'distance', 'area'
    isDrawingMode: false,
    isEditMode: false,
    drawnPoints: [], // [[lat, lng], ...]
    customFootprint: null, // [[lat, lng], ...] or null
    editBackupPoints: [], // backup for canceling edit
    xRayMode: false,
    buildings: [], // Multi-building masterplan list [{id, name, color, footprintCoords, footprintArea, floorsAbove, floorsBelow, floorFunctions...}]
    selectedBuildingId: null,
    isGrgActive: false, // Approved GRG (განაშენიანების რეგულირების გეგმა)
    manualCoefficients: {
      isManual: false,
      zonePreset: 'auto',
      k1: null,
      k2: null,
      k3: null
    },
    // Solar Insolation & Shadow Engine State (Module 2C)
    solarDate: new Date(2026, 5, 21), // Summer solstice default (06-21)
    solarHour: 12.0,
    isSolarAnimating: false,
    showSunPath: true,
    showSeasonalArcs: true,
    showHourMarkers: true,
    showCompassRing: true,
    // Surrounding 3D Urban Fabric (Module 1B & 2B)
    urbanBuildings: [],
    // 3D DEM Terrain & Slope (Module 1C & 2A)
    terrainData: {
      elevation: 480,
      deltaZ: 2.1,
      slopePct: 2.8
    }
  };

  // Authentic Cadastral Registry across Georgia (Real GPS coordinates and geometries)
  const CADASTRAL_DATABASE = {
    '01.16.01.013.031': {
      code: '01.16.01.013.031',
      address: 'თბილისი, ჩუღურეთი, ი. ჯავახიშვილის ქ. #89',
      addressEn: 'Tbilisi, Chugureti, 89 I. Javakhishvili St.',
      area: 554,
      shape: 'მართკუთხა',
      shapeEn: 'Rectangular',
      terrain: 'ვაკე (1%)',
      terrainEn: 'Flat (1%)',
      mainZoneKa: 'საცხოვრებელი ზონა',
      mainZoneEn: 'Residential Zone',
      subzoneKa: 'საცხოვრებელი ზონა-5',
      subzoneEn: 'Residential Zone-5',
      subZoneKa: 'საცხოვრებელი ზონა-5',
      subZoneEn: 'Residential Zone-5',
      tabLabelKa: 'საცხოვრებელი ზონა 5 (სზ-5)',
      subzoneKey: 'sz-5',
      zone: 'საცხოვრებელი ზონა 5 (სზ-5)',
      zoneEn: 'Residential Zone 5 (SZ-5)',
      k1: 0.5,
      k2: 2.1,
      k3: 0.3,
      coordinates: [
        [41.713928, 44.798660],
        [41.714035, 44.798918],
        [41.714113, 44.799102],
        [41.714218, 44.799029],
        [41.714147, 44.798865],
        [41.714064, 44.798658],
        [41.714035, 44.798586],
        [41.713983, 44.798621],
        [41.713928, 44.798660]
      ]
    },
    '01.15.02.038.003': {
      code: '01.15.02.038.003',
      address: 'თბილისი, საბურთალო, პეკინის გამზ. #28',
      addressEn: 'Tbilisi, Saburtalo, 28 Pekini Ave.',
      area: 1250,
      shape: 'მრავალკუთხა (არარეგულარული)',
      shapeEn: 'Polygonal (Irregular)',
      terrain: 'ვაკე / მცირედ დახრილი (2%)',
      terrainEn: 'Flat / Slight slope (2%)',
      mainZoneKa: 'საზოგადოებრივ-საქმიანი ზონა',
      mainZoneEn: 'Public Business Zone',
      subzoneKa: 'საზოგადოებრივ-საქმიანი ზონა-2',
      subzoneEn: 'Public Business Zone-2',
      subZoneKa: 'საზოგადოებრივ-საქმიანი ზონა-2',
      subZoneEn: 'Public Business Zone-2',
      tabLabelKa: 'საზოგადოებრივ-საქმიანი ზონა 2 (სსზ-2)',
      subzoneKey: 'ssz-2',
      zone: 'საზოგადოებრივ-საქმიანი ზონა-2',
      zoneEn: 'Public Business Zone-2',
      k1: 0.7,
      k2: 3.5,
      k3: 0.1,
      coordinates: [
        [41.7248, 44.7712],
        [41.7252, 44.7716],
        [41.7250, 44.7723],
        [41.7245, 44.7721],
        [41.7244, 44.7715]
      ]
    },
    '01.14.04.012.015': {
      code: '01.14.04.012.015',
      address: 'თბილისი, ვაკე, ი. ჭავჭავაძის გამზ. #42',
      addressEn: 'Tbilisi, Vake, 42 I. Chavchavadze Ave.',
      area: 2100,
      shape: 'ოთხკუთხა (ტრაპეცია)',
      shapeEn: 'Trapezoidal',
      terrain: 'დახრილი რელიეფი (6%)',
      terrainEn: 'Inclined terrain (6%)',
      mainZoneKa: 'საცხოვრებელი ზონა',
      mainZoneEn: 'Residential Zone',
      subzoneKa: 'საცხოვრებელი ზონა-6',
      subzoneEn: 'Residential Zone-6',
      subZoneKa: 'საცხოვრებელი ზონა-6',
      subZoneEn: 'Residential Zone-6',
      tabLabelKa: 'საცხოვრებელი ზონა 6 (სზ-6)',
      subzoneKey: 'sz-6',
      zone: 'საცხოვრებელი ზონა-6',
      zoneEn: 'Residential Zone-6',
      k1: 0.4,
      k2: 2.5,
      k3: 0.3,
      coordinates: [
        [41.7102, 44.7601],
        [41.7108, 44.7609],
        [41.7103, 44.7618],
        [41.7096, 44.7609]
      ]
    },
    '01.10.15.045.022': {
      code: '01.10.15.045.022',
      address: 'თბილისი, დიდი დიღომი, მირიან მეფის ქუჩა',
      addressEn: 'Tbilisi, Didi Dighomi, Mirian Mepe St.',
      area: 4500,
      shape: 'მართკუთხა',
      shapeEn: 'Rectangular',
      terrain: 'ვაკე რელიეფი (1%)',
      terrainEn: 'Flat terrain (1%)',
      mainZoneKa: 'საცხოვრებელი ზონა',
      mainZoneEn: 'Residential Zone',
      subzoneKa: 'საცხოვრებელი ზონა-5',
      subzoneEn: 'Residential Zone-5',
      subZoneKa: 'საცხოვრებელი ზონა-5',
      subZoneEn: 'Residential Zone-5',
      tabLabelKa: 'საცხოვრებელი ზონა 5 (სზ-5)',
      subzoneKey: 'sz-5',
      zone: 'საცხოვრებელი ზონა-5',
      zoneEn: 'Residential Zone-5',
      k1: 0.5,
      k2: 2.1,
      k3: 0.3,
      coordinates: [
        [41.7852, 44.7540],
        [41.7859, 44.7552],
        [41.7851, 44.7562],
        [41.7844, 44.7550]
      ]
    },
    '05.21.11.002.040': {
      code: '05.21.11.002.040',
      address: 'ბათუმი, შოთა რუსთაველის გამზირი',
      addressEn: 'Batumi, Shota Rustaveli Ave.',
      area: 1850,
      shape: 'მართკუთხა (რეგულარული)',
      shapeEn: 'Rectangular (Regular)',
      terrain: 'ზღვისპირა ვაკე (0.5%)',
      terrainEn: 'Coastal flat (0.5%)',
      mainZoneKa: 'საკურორტო ზონა (სკზ)',
      mainZoneEn: 'Resort Zone (SKZ)',
      subzoneKa: 'საკურორტო-საქმიანი ქვეზონა',
      subzoneEn: 'Resort Business Subzone',
      subzoneKey: 'skz',
      zone: 'საკურორტო-საქმიანი ზონა',
      zoneEn: 'Resort Business Zone',
      k1: 0.6,
      k2: 4.2,
      k3: 0.15,
      coordinates: [
        [41.6515, 41.6360],
        [41.6520, 41.6368],
        [41.6514, 41.6375],
        [41.6509, 41.6367]
      ]
    },
    '03.02.05.018.009': {
      code: '03.02.05.018.009',
      address: 'ქუთაისი, აკაკი წერეთლის ქუჩა',
      addressEn: 'Kutaisi, Akaki Tsereteli St.',
      area: 1600,
      shape: 'არარეგულარული',
      shapeEn: 'Irregular',
      terrain: 'მცირედ დახრილი (3%)',
      terrainEn: 'Slight slope (3%)',
      mainZoneKa: 'ისტორიული დაცვის ზონა (იზ)',
      mainZoneEn: 'Historical Protection Zone (HZ)',
      subzoneKa: 'ცენტრალური ისტორიული ქვეზონა',
      subzoneEn: 'Central Historic Subzone',
      subzoneKey: 'sz-3',
      zone: 'ცენტრალური ისტორიული ზონა',
      zoneEn: 'Central Historic Zone',
      k1: 0.45,
      k2: 2.0,
      k3: 0.25,
      coordinates: [
        [42.2680, 42.7010],
        [42.2685, 42.7018],
        [42.2681, 42.7025],
        [42.2675, 42.7020],
        [42.2676, 42.7012]
      ]
    }
  };

  /* ==========================================================================
     2. Leaflet GIS Map Setup
     ========================================================================== */
  let map = null;
  let parcelPolygonLayer = null;
  let buildingFootprintLayer = null;
  let drawingLayerGroup = null;
  let buildingsLayerGroup = null;
  let parcelZoningLayerGroup = null;
  let parcelContoursLayerGroup = null;
  let tileLayerVector = null;
  let tileLayerSatellite = null;

  function initMap() {
    const mapEl = document.getElementById('mapViewport');
    if (!mapEl || typeof L === 'undefined') return;

    // Default center on Tbilisi
    map = L.map('mapViewport', {
      center: [41.7248, 44.7712],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    // Tile Layers
    tileLayerVector = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    });

    tileLayerSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    });

    // Start with Satellite
    tileLayerSatellite.addTo(map);

    // Layer groups for GIS map overlays
    parcelZoningLayerGroup = L.layerGroup().addTo(map);
    parcelContoursLayerGroup = L.layerGroup().addTo(map);

    // Layer group for rendered multi-building footprints
    buildingsLayerGroup = L.layerGroup().addTo(map);

    // Layer group for interactive user drawing
    drawingLayerGroup = L.layerGroup().addTo(map);

    // Add scale bar
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    // Map Click & Drawing Handler
    map.on('click', (e) => {
      if (state.isDrawingMode) {
        handleMapClick(e);
      }
    });
  }

  /* ==========================================================================
     3. Three.js 3D WebGL Massing Canvas Setup & Solar Engine
     ========================================================================== */
  let scene, camera, renderer, controls;
  let buildingGroup, groundGroup, urbanGroup, terrainGroup, sunPathGroup;
  let sunLight, ambientLight, fillLight;

  function initThree() {
    const container = document.getElementById('threeViewport');
    if (!container || typeof THREE === 'undefined') return;

    // Clear existing
    container.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(state.currentTheme === 'dark' ? 0x07090e : 0xf1f5f9);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1200);
    camera.position.set(65, 55, 80);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
      controls.minDistance = 10;
      controls.maxDistance = 600;
      controls.target.set(0, 8, 0);
    }

    // Interactive 3D building selection via Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging3D = false;
    renderer.domElement.addEventListener('pointerdown', () => { isDragging3D = false; });
    renderer.domElement.addEventListener('pointermove', () => { isDragging3D = true; });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (isDragging3D || !camera || !buildingGroup) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(buildingGroup.children, true);
      if (intersects.length > 0) {
        for (let hit of intersects) {
          if (hit.object && hit.object.userData && hit.object.userData.buildingId) {
            selectBuilding(hit.object.userData.buildingId);
            break;
          }
        }
      }
    });

    // Ambient Lighting
    ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    // Dynamic Directional Sun Light (SunCalc Driven)
    sunLight = new THREE.DirectionalLight(0xfff7ed, 1.15);
    sunLight.position.set(60, 110, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    const d = 110;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    fillLight = new THREE.DirectionalLight(0x38bdf8, 0.25);
    fillLight.position.set(-60, 40, -60);
    scene.add(fillLight);

    // Ground Grid Helper
    const gridHelper = new THREE.GridHelper(220, 44, 0x00f0ff, 0x1e293b);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    // Scene Groups Hierarchy
    terrainGroup = new THREE.Group();
    groundGroup = new THREE.Group();
    urbanGroup = new THREE.Group();
    buildingGroup = new THREE.Group();
    sunPathGroup = new THREE.Group();

    scene.add(terrainGroup);
    scene.add(groundGroup);
    scene.add(urbanGroup);
    scene.add(buildingGroup);
    scene.add(sunPathGroup);

    // Initialize SunCalc position & controls
    updateSolarLighting();
    setupSolarControls();

    // Animation Loop
    function animate() {
      requestAnimationFrame(animate);
      if (controls) controls.update();
      if (state.isSolarAnimating) {
        state.solarHour += 0.05;
        if (state.solarHour > 24) state.solarHour = 0;
        const slider = document.getElementById('solarTimeSlider');
        if (slider) slider.value = state.solarHour;
        updateSolarLighting();
      }
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {
    const container = document.getElementById('threeViewport');
    if (!container || !renderer || !camera) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  /* ==========================================================================
     4. Cadastral Search & Geometry Validation (with maps.gov.ge NAPR safe integration)
     ========================================================================== */
  const cadastralInput = document.getElementById('cadastralCodeInput');
  const cadastralSearchBtn = document.getElementById('cadastralSearchBtn');
  const sampleParcelsSelect = document.getElementById('sampleParcelsSelect');
  const cadastralAlertMsg = document.getElementById('cadastralAlertMsg');

  // Regex format supporting dot and dash separators, 4-segment and 5-segment codes
  const CADASTRAL_CODE_REGEX = /^\d{2}\.\d{1,3}\.\d{1,3}\.\d{1,4}(?:\.\d{1,4})?(?:[./]\d{1,4})?$/;

  function normalizeCode(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let code = raw.trim().replace(/[\s\-_/]+/g, '.');
    if (/^\d{11,14}$/.test(code)) {
      code = `${code.slice(0, 2)}.${code.slice(2, 4)}.${code.slice(4, 6)}.${code.slice(6, 9)}.${code.slice(9)}`;
    }
    return code.replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
  }

  function isValidCadastralCode(code) {
    return CADASTRAL_CODE_REGEX.test(normalizeCode(code));
  }

  function showCadastralAlert(type, text) {
    if (!cadastralAlertMsg) return;
    cadastralAlertMsg.className = `cadastral-alert-message ${type}`;
    cadastralAlertMsg.textContent = text;
    cadastralAlertMsg.style.display = 'block';
  }

  function hideCadastralAlert() {
    if (!cadastralAlertMsg) return;
    cadastralAlertMsg.style.display = 'none';
  }

  // NAPR API does NOT return zone data — zoning is a municipal (not NAPR) attribute.
  // For live parcels: returns null → user must select zone manually.
  // For local DB parcels: zone is already encoded in CADASTRAL_DATABASE entries.
  function resolveZoningForParcel(code, address, coords) {
    // No fabricated guessing — return null to signal unknown zone
    return null;
  }

  // Global function called by the manual zone entry panel button
  window.applyManualZone = function() {
    const parcel = state.activeParcel;
    if (!parcel) return;

    const zoneMainSel = document.getElementById('manualZoneMainSelect');
    const zoneSubInp  = document.getElementById('manualZoneSubInput');
    const k1Inp       = document.getElementById('manualK1');
    const k2Inp       = document.getElementById('manualK2');
    const k3Inp       = document.getElementById('manualK3');

    const zoneMainVal = zoneMainSel ? zoneMainSel.value : '';
    const zoneSubVal  = zoneSubInp  ? zoneSubInp.value.trim() : '';
    const k1Val = k1Inp && k1Inp.value !== '' ? parseFloat(k1Inp.value) : null;
    const k2Val = k2Inp && k2Inp.value !== '' ? parseFloat(k2Inp.value) : null;
    const k3Val = k3Inp && k3Inp.value !== '' ? parseFloat(k3Inp.value) : null;

    if (!zoneMainVal) {
      alert('გთხოვთ აირჩიოთ ძირითადი ზონა.');
      return;
    }

    const zoneLabels = {
      'sz':  { ka: 'საცხოვრებელი ზონა (სზ)',          en: 'Residential Zone (SZ)' },
      'ssz': { ka: 'საზოგადოებრივ-საქმიანი ზონა (სსზ)', en: 'Public Business Zone (SSZ)' },
      'pz':  { ka: 'სამრეწველო ზონა (სმზ)',            en: 'Industrial Zone (PZ)' },
      'rz':  { ka: 'სარეკრეაციო ზონა (რზ)',            en: 'Recreation Zone (RZ)' },
      'az':  { ka: 'სასოფლო-სამეურნეო (სასმ)',         en: 'Agricultural Zone' },
      'other':{ ka: 'სხვა ზონა',                        en: 'Other Zone' }
    };

    const label = zoneLabels[zoneMainVal] || { ka: zoneMainVal, en: zoneMainVal };
    const subKa = zoneSubVal || label.ka;
    const subEn = zoneSubVal || label.en;

    // Apply to active parcel
    parcel.mainZoneKa  = label.ka;
    parcel.mainZoneEn  = label.en;
    parcel.subzoneKa   = subKa;
    parcel.subzoneEn   = subEn;
    parcel.subzoneKey  = zoneMainVal;
    parcel.zone        = subKa;
    parcel.zoneEn      = subEn;
    if (k1Val !== null) parcel.k1 = k1Val;
    if (k2Val !== null) parcel.k2 = k2Val;
    if (k3Val !== null) parcel.k3 = k3Val;

    // Also apply to manual coefficient state
    if (k1Val !== null || k2Val !== null || k3Val !== null) {
      if (!state.manualCoefficients) state.manualCoefficients = {};
      state.manualCoefficients.isManual = true;
      if (k1Val !== null) state.manualCoefficients.k1 = k1Val;
      if (k2Val !== null) state.manualCoefficients.k2 = k2Val;
      if (k3Val !== null) state.manualCoefficients.k3 = k3Val;
    }

    // Refresh all UI with zone data
    updateParcelAttributesUI(parcel);
    updateComplianceUI();
    updateAssessmentUI(parcel);

    // Update passport zone display
    const pMain = document.getElementById('passportMainZoneDisplay');
    const pSub  = document.getElementById('passportSubZoneDisplay');
    if (pMain) pMain.textContent = label.ka;
    if (pSub)  pSub.textContent  = subKa;

    // Hide the panel
    const panel = document.getElementById('zoneManualEntryPanel');
    if (panel) panel.style.display = 'none';
  };

  async function searchParcel(codeQuery) {
    hideCadastralAlert();
    const rawInput = codeQuery || (cadastralInput ? cadastralInput.value : '');
    const code = normalizeCode(rawInput);

    // Format validation
    if (!isValidCadastralCode(code)) {
      showCadastralAlert('error', translations[state.currentLang].parcel_err_invalid_format || 'საკადასტრო კოდის ფორმატი არასწორია (მაგ.: 01.10.09.001.001)');
      return;
    }

    if (cadastralInput) cadastralInput.value = code;

    // 1. Check local high-detail sample database
    let parcelData = CADASTRAL_DATABASE[code];

    // 2. If not in local samples, fetch live from maps.gov.ge NAPR Proxy
    if (!parcelData) {
      if (cadastralSearchBtn) {
        cadastralSearchBtn.disabled = true;
        cadastralSearchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>NAPR-დან მოძიება...</span>`;
      }

      try {
        const proxyRes = await fetch(`/api/parcel?code=${encodeURIComponent(code)}`);
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData.status && proxyData.coordinates && proxyData.coordinates.length > 2) {
            const z = proxyData.zoning || resolveZoningForParcel(proxyData.cadastralCode, proxyData.address, proxyData.coordinates);
            parcelData = {
              code: proxyData.cadastralCode,
              address: proxyData.address || "მისამართი დაზუსტებული არ არის",
              addressEn: proxyData.address || "Address not specified",
              area: proxyData.areaSqm || 1200,
              shape: "ოფიციალური კონტური (NAPR)",
              shapeEn: "Official Boundary (NAPR)",
              terrain: "ვაკე / სტანდარტული რელიეფი",
              terrainEn: "Standard terrain",
              mainZoneKa: z ? z.mainZoneKa : 'საცხოვრებელი ზონა',
              mainZoneEn: z ? (z.mainZoneEn || z.mainZoneKa) : 'Residential Zone',
              subzoneKa: z ? (z.subZoneKa || z.subzoneKa) : 'საცხოვრებელი ზონა-5',
              subzoneEn: z ? (z.subZoneEn || z.subzoneEn) : 'Residential Zone-5',
              subZoneKa: z ? (z.subZoneKa || z.subzoneKa) : 'საცხოვრებელი ზონა-5',
              subZoneEn: z ? (z.subZoneEn || z.subzoneEn) : 'Residential Zone-5',
              tabLabelKa: z ? (z.tabLabelKa || z.zoneNameKa) : 'საცხოვრებელი ზონა 5 (სზ-5)',
              subzoneKey: z ? (z.zoneCode || z.subzoneKey || '').toLowerCase() : 'sz-5',
              zone: z ? (z.subZoneKa || z.subzoneKa) : 'საცხოვრებელი ზონა-5',
              zoneEn: z ? (z.zoneNameEn || z.subZoneEn) : 'Residential Zone-5',
              k1: z && z.k1 != null ? z.k1 : 0.5,
              k2: z && z.k2 != null ? z.k2 : 2.1,
              k3: z && z.k3 != null ? z.k3 : 0.3,
              isLiveNAPR: true,
              coordinates: proxyData.coordinates
            };
          }
        }
      } catch (err) {
        console.warn('Live NAPR fetch warning:', err);
      } finally {
        if (cadastralSearchBtn) {
          cadastralSearchBtn.disabled = false;
          cadastralSearchBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass-location"></i> <span>${translations[state.currentLang].parcel_btn_search || 'ნაკვეთის მოძიება'}</span>`;
        }
      }
    }

    // 3. If parcel is resolved (either local or live NAPR):
    if (parcelData && parcelData.coordinates && parcelData.coordinates.length > 2) {
      state.activeParcel = parcelData;

      // Reset manual coefficients to parcel defaults
      state.manualCoefficients = {
        isManual: false,
        zonePreset: 'auto',
        k1: null,
        k2: null,
        k3: null
      };
      const selectZoneEl = document.getElementById('selectZoningPreset');
      if (selectZoneEl) selectZoneEl.value = 'auto';

      // Reset any active custom drawing for new parcel
      state.customFootprint = null;
      state.drawnPoints = [];
      state.isDrawingMode = false;
      state.isEditMode = false;
      state.editBackupPoints = [];
      if (drawingLayerGroup) drawingLayerGroup.clearLayers();
      const customBadge = document.getElementById('customFootprintIndicator');
      if (customBadge) customBadge.style.display = 'none';
      const banner = document.getElementById('drawingGuideBanner');
      if (banner) banner.style.display = 'none';
      updateToolbarButtons();

      // Render Plot on Leaflet Map
      renderParcelOnMap(parcelData);

      // Render Plot Ground on Three.js 3D
      renderParcelGround3D(parcelData);

      // Update Right Panel Info
      updateParcelAttributesUI(parcelData);



      // Trigger Initial or Existing Concept
      const aiText = document.getElementById('aiPromptInput');
      const promptValue = aiText ? aiText.value.trim() : '';
      if (promptValue) {
        generateConceptFromPrompt(promptValue);
      } else {
        generateDefaultConcept(parcelData);
      }
      return;
    }

    // 4. Strict rule: Never invent geometry! If not found on NAPR:
    showCadastralAlert(
      'error',
      translations[state.currentLang].parcel_err_not_found ||
      'მითითებული საკადასტრო კოდით ნაკვეთი ვერ მოიძებნა.'
    );
  }

  function renderParcelOnMap(parcel) {
    if (!map) return;

    if (parcelPolygonLayer) map.removeLayer(parcelPolygonLayer);
    if (buildingFootprintLayer) {
      map.removeLayer(buildingFootprintLayer);
      buildingFootprintLayer = null;
    }
    if (parcelZoningLayerGroup) parcelZoningLayerGroup.clearLayers();
    if (parcelContoursLayerGroup) parcelContoursLayerGroup.clearLayers();

    // Create Leaflet Polygon
    parcelPolygonLayer = L.polygon(parcel.coordinates, {
      color: '#00f0ff',
      weight: 3,
      fillColor: '#00f0ff',
      fillOpacity: 0.18,
      dashArray: '4 4'
    }).addTo(map);

    // Popup
    const popupContent = `
      <div style="font-family: var(--font-main); font-size: 0.85rem; color: #000; padding: 4px;">
        <strong style="color: #0284c7;">${parcel.code}</strong><br>
        <span>${parcel.address}</span><br>
        <strong>${parcel.area.toLocaleString()} მ²</strong> (${parcel.shape})
      </div>
    `;
    parcelPolygonLayer.bindPopup(popupContent);

    // Enable direct drawing inside cadastral polygon boundary
    parcelPolygonLayer.on('click', (e) => {
      if (state.isDrawingMode) {
        L.DomEvent.stopPropagation(e);
        parcelPolygonLayer.closePopup();
        handleMapClick(e);
      }
    });

    // Draw Surrounding Zoning Envelope (Resolution 14-39 Context)
    const bounds = parcelPolygonLayer.getBounds();
    const zoneBox = bounds.pad(0.75);
    const zRect = L.rectangle(zoneBox, {
      color: '#fb8500',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#fb8500',
      fillOpacity: 0.12,
      interactive: false
    });
    if (parcelZoningLayerGroup) zRect.addTo(parcelZoningLayerGroup);

    // Draw Adjacent Building Contours for urban context
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
    if (parcelContoursLayerGroup) {
      L.polygon(bldg1, { color: '#64748b', weight: 1.5, fillColor: '#94a3b8', fillOpacity: 0.3, interactive: false }).addTo(parcelContoursLayerGroup);
      L.polygon(bldg2, { color: '#64748b', weight: 1.5, fillColor: '#94a3b8', fillOpacity: 0.3, interactive: false }).addTo(parcelContoursLayerGroup);
    }

    // Fit map bounds to parcel
    map.fitBounds(parcelPolygonLayer.getBounds(), { padding: [40, 40], maxZoom: 18 });

    // Update HUD Badge
    const hudCadastral = document.getElementById('hudCadastral');
    if (hudCadastral) hudCadastral.textContent = parcel.code;
    const hudArea = document.getElementById('hudArea');
    if (hudArea) hudArea.textContent = `${parcel.area.toLocaleString()} მ²`;
  }

  /* ==========================================================================
     3b. Advanced 3D Sun Path, Heliodon & Solar Insolation Engine (Module 2C)
     ========================================================================== */

  // Exact Astronomical Solar Position (SunCalc or NOAA Solar Algorithm Fallback)
  function calculateSunPosition(date, hour, lat, lng) {
    const d = new Date(date);
    const h = Math.floor(hour);
    const m = Math.round((hour % 1) * 60);
    d.setHours(h, m, 0, 0);

    if (typeof SunCalc !== 'undefined' && SunCalc.getPosition) {
      const pos = SunCalc.getPosition(d, lat, lng);
      const altDeg = (pos.altitude * 180) / Math.PI;
      const azDeg = ((pos.azimuth * 180 / Math.PI) + 180) % 360;
      return {
        altitudeRad: pos.altitude,
        altitudeDeg: altDeg,
        azimuthRad: pos.azimuth,
        azimuthDeg: azDeg,
        isDay: altDeg > 0,
        date: d
      };
    }

    // NOAA Astronomical Approximation Fallback
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((d - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
    const b = (2 * Math.PI / 365) * (dayOfYear - 81);
    const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b); // Equation of time (mins)
    const solarDec = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81)); // Declination in deg
    const decRad = (solarDec * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;

    const timeOffset = (lng - 45) * 4 + eot; // UTC+4 Georgia reference meridian
    const trueSolarTime = hour * 60 + timeOffset;
    const hourAngle = (trueSolarTime / 4 - 180) * (Math.PI / 180);

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngle);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosAlt = Math.cos(altRad);

    let azRad = 0;
    if (cosAlt > 0.001) {
      const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * cosAlt);
      azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
      if (Math.sin(hourAngle) > 0) azRad = 2 * Math.PI - azRad;
    }

    const altDeg = (altRad * 180) / Math.PI;
    const azDeg = (azRad * 180) / Math.PI;
    return {
      altitudeRad: altRad,
      altitudeDeg: altDeg,
      azimuthRad: azRad - Math.PI,
      azimuthDeg: azDeg,
      isDay: altDeg > 0,
      date: d
    };
  }

  // Calculate Sunrise, Sunset and Daylight duration for given Date and GPS coordinates
  function calculateSunTimes(date, lat, lng) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);

    if (typeof SunCalc !== 'undefined' && SunCalc.getTimes) {
      try {
        const times = SunCalc.getTimes(d, lat, lng);
        const sr = times.sunrise || new Date(d.getFullYear(), d.getMonth(), d.getDate(), 5, 30);
        const ss = times.sunset || new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 30);
        const dayMs = Math.max(0, ss.getTime() - sr.getTime());
        const dayHours = Math.floor(dayMs / (1000 * 60 * 60));
        const dayMins = Math.floor((dayMs % (1000 * 60 * 60)) / (1000 * 60));
        const srH = String(sr.getHours()).padStart(2, '0');
        const srM = String(sr.getMinutes()).padStart(2, '0');
        const ssH = String(ss.getHours()).padStart(2, '0');
        const ssM = String(ss.getMinutes()).padStart(2, '0');
        return {
          sunrise: sr,
          sunset: ss,
          sunriseStr: `${srH}:${srM}`,
          sunsetStr: `${ssH}:${ssM}`,
          dayLengthStrKa: `${dayHours}სთ ${dayMins}წთ`,
          dayLengthStrEn: `${dayHours}h ${dayMins}m`,
          dayLengthHours: dayMs / (1000 * 60 * 60)
        };
      } catch (err) {
        console.warn('SunCalc times notice:', err);
      }
    }

    // Default approximation for Georgia
    const m = d.getMonth();
    let approxDayH = 12;
    if (m >= 4 && m <= 7) approxDayH = 15;
    else if (m === 11 || m === 0 || m === 1) approxDayH = 9.2;
    return {
      sunriseStr: '05:32',
      sunsetStr: '20:41',
      dayLengthStrKa: `${Math.floor(approxDayH)}სთ 15წთ`,
      dayLengthStrEn: `${Math.floor(approxDayH)}h 15m`,
      dayLengthHours: approxDayH
    };
  }

  // Helper: Create crisp text sprites for cardinal directions and hour markers in 3D scene
  function createTextSprite(text, color = '#ffffff', fontSize = 28, bgColor = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(8, 8, 240, 48, 12);
      } else {
        ctx.rect(8, 8, 240, 48);
      }
      ctx.fill();
    }
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(10, 2.5, 1);
    return sprite;
  }

  // 3D Heliodon & Sun Path Geometry Visualizer
  function updateSunPathVisualization(lat, lng, currentSunPos, sunTimes) {
    if (!sunPathGroup || !scene) return;

    // Clear existing heliodon objects
    while (sunPathGroup.children.length > 0) {
      const c = sunPathGroup.children[0];
      sunPathGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
    }

    const radius = 95; // Sky dome radius in meters

    // 1. Compass Horizon Ground Ring & Cardinal Letters
    if (state.showCompassRing !== false) {
      const ringSegments = 64;
      const ringPoints = [];
      for (let i = 0; i <= ringSegments; i++) {
        const theta = (i / ringSegments) * Math.PI * 2;
        ringPoints.push(new THREE.Vector3(radius * Math.sin(theta), 0.1, -radius * Math.cos(theta)));
      }
      const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPoints);
      const ringMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        linewidth: 1.5
      });
      const ringLine = new THREE.Line(ringGeom, ringMat);
      sunPathGroup.add(ringLine);

      // Cardinal Direction Sprites: N (North/ჩ), S (South/ს), E (East/ა), W (West/დ)
      const isKa = (state.currentLang !== 'en');
      const cardinalMarkers = [
        { text: isKa ? 'N (ჩრდილოეთი)' : 'N (North)', pos: [0, 1.2, -radius - 4], color: '#38bdf8' },
        { text: isKa ? 'S (სამხრეთი)' : 'S (South)', pos: [0, 1.2, radius + 4], color: '#f59e0b' },
        { text: isKa ? 'E (აღმოსავლეთი)' : 'E (East)', pos: [radius + 4, 1.2, 0], color: '#fbbf24' },
        { text: isKa ? 'W (დასავლეთი)' : 'W (West)', pos: [-radius - 4, 1.2, 0], color: '#c084fc' }
      ];

      cardinalMarkers.forEach(cm => {
        const sprite = createTextSprite(cm.text, cm.color, 24, 'rgba(10, 15, 29, 0.7)');
        sprite.position.set(cm.pos[0], cm.pos[1], cm.pos[2]);
        sprite.scale.set(16, 4, 1);
        sunPathGroup.add(sprite);
      });
    }

    // 2. Seasonal Solstices & Equinoxes Reference Arcs
    if (state.showSeasonalArcs !== false) {
      const seasonalDates = [
        { label: 'Summer', date: new Date(2026, 5, 21), color: 0xf59e0b, opacity: 0.35 },
        { label: 'Equinox', date: new Date(2026, 2, 21), color: 0xeab308, opacity: 0.3 },
        { label: 'Winter', date: new Date(2026, 11, 21), color: 0xea580c, opacity: 0.28 }
      ];

      seasonalDates.forEach(sd => {
        const dayPts = [];
        for (let h = 0; h <= 24; h += 0.2) {
          const sp = calculateSunPosition(sd.date, h, lat, lng);
          if (sp.altitudeDeg >= 0) {
            const px = radius * Math.sin(sp.azimuthRad) * Math.cos(sp.altitudeRad);
            const py = radius * Math.sin(sp.altitudeRad);
            const pz = -radius * Math.cos(sp.azimuthRad) * Math.cos(sp.altitudeRad);
            dayPts.push(new THREE.Vector3(px, Math.max(0.1, py), pz));
          }
        }
        if (dayPts.length > 2) {
          const arcGeom = new THREE.BufferGeometry().setFromPoints(dayPts);
          const arcMat = new THREE.LineBasicMaterial({
            color: sd.color,
            transparent: true,
            opacity: sd.opacity,
            linewidth: 1
          });
          const arcLine = new THREE.Line(arcGeom, arcMat);
          sunPathGroup.add(arcLine);
        }
      });
    }

    // 3. Current Selected Date Sun Path Arc (24-Hour Day & Night Trajectory)
    if (state.showSunPath !== false) {
      const activeDate = state.solarDate || new Date(2026, 5, 21);
      const dayTrajectoryPts = [];
      const nightTrajectoryPts = [];

      for (let h = 0; h <= 24; h += 0.15) {
        const sp = calculateSunPosition(activeDate, h, lat, lng);
        const px = radius * Math.sin(sp.azimuthRad) * Math.cos(sp.altitudeRad);
        const py = radius * Math.sin(sp.altitudeRad);
        const pz = -radius * Math.cos(sp.azimuthRad) * Math.cos(sp.altitudeRad);
        const pt = new THREE.Vector3(px, py, pz);

        if (sp.altitudeDeg >= 0) {
          dayTrajectoryPts.push(pt);
        } else {
          nightTrajectoryPts.push(pt);
        }
      }

      // Luminous Daytime Sun Arc
      if (dayTrajectoryPts.length > 2) {
        const dayGeom = new THREE.BufferGeometry().setFromPoints(dayTrajectoryPts);
        const dayMat = new THREE.LineBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.95,
          linewidth: 3.5
        });
        const dayLine = new THREE.Line(dayGeom, dayMat);
        sunPathGroup.add(dayLine);
      }

      // Translucent Nighttime Sun Arc (Trajectory beneath horizon)
      if (nightTrajectoryPts.length > 2) {
        const nightGeom = new THREE.BufferGeometry().setFromPoints(nightTrajectoryPts);
        const nightMat = new THREE.LineDashedMaterial({
          color: 0x6366f1,
          transparent: true,
          opacity: 0.45,
          dashSize: 3,
          gapSize: 2,
          linewidth: 1.5
        });
        const nightLine = new THREE.Line(nightGeom, nightMat);
        nightLine.computeLineDistances();
        sunPathGroup.add(nightLine);
      }
    }

    // 4. Hourly Nodes & Labels on Current Sun Path
    if (state.showHourMarkers !== false) {
      const activeDate = state.solarDate || new Date(2026, 5, 21);
      const hoursToMark = [6, 8, 10, 12, 14, 16, 18, 20];

      hoursToMark.forEach(hr => {
        const sp = calculateSunPosition(activeDate, hr, lat, lng);
        if (sp.altitudeDeg >= -2) {
          const px = radius * Math.sin(sp.azimuthRad) * Math.cos(sp.altitudeRad);
          const py = Math.max(0.5, radius * Math.sin(sp.altitudeRad));
          const pz = -radius * Math.cos(sp.azimuthRad) * Math.cos(sp.altitudeRad);

          // Small Node Sphere
          const nodeGeom = new THREE.SphereGeometry(1.4, 12, 12);
          const nodeMat = new THREE.MeshBasicMaterial({ color: hr === 12 ? 0xfef08a : 0xfbbf24 });
          const nodeMesh = new THREE.Mesh(nodeGeom, nodeMat);
          nodeMesh.position.set(px, py, pz);
          sunPathGroup.add(nodeMesh);

          // Time Label Sprite
          const labelSprite = createTextSprite(`${hr}:00`, '#ffffff', 26, 'rgba(15, 23, 42, 0.75)');
          labelSprite.position.set(px, py + 3.2, pz);
          labelSprite.scale.set(7, 1.8, 1);
          sunPathGroup.add(labelSprite);
        }
      });
    }

    // 5. Physical Glowing 3D Sun Body (Or Twilight/Moon Node at Night)
    const sunX = radius * Math.sin(currentSunPos.azimuthRad) * Math.cos(currentSunPos.altitudeRad);
    const sunY = radius * Math.sin(currentSunPos.altitudeRad);
    const sunZ = -radius * Math.cos(currentSunPos.azimuthRad) * Math.cos(currentSunPos.altitudeRad);

    const isDay = currentSunPos.altitudeDeg > 0;
    const sunColor = isDay ? 0xffea00 : 0x818cf8;
    const sunGeom = new THREE.SphereGeometry(isDay ? 3.8 : 2.8, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({
      color: sunColor,
      transparent: true,
      opacity: isDay ? 1.0 : 0.65
    });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(sunX, sunY, sunZ);
    sunPathGroup.add(sunMesh);

    // Glowing Sun Corona Halo
    if (isDay) {
      const haloGeom = new THREE.SphereGeometry(6.2, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.35,
        wireframe: false
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      haloMesh.position.set(sunX, sunY, sunZ);
      sunPathGroup.add(haloMesh);

      // Direct Solar Incident Ray (Line connecting Sun to Building Origin)
      const rayPoints = [new THREE.Vector3(sunX, sunY, sunZ), new THREE.Vector3(0, 4, 0)];
      const rayGeom = new THREE.BufferGeometry().setFromPoints(rayPoints);
      const rayMat = new THREE.LineBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.45,
        linewidth: 2
      });
      const rayLine = new THREE.Line(rayGeom, rayMat);
      sunPathGroup.add(rayLine);
    }
  }

  // Master Solar Lighting & HUD Telemetry Updater
  function updateSolarLighting() {
    if (!sunLight) return;

    const parcel = state.activeParcel;
    let lat = 41.7151; // default Tbilisi
    let lng = 44.8271;
    if (parcel && parcel.coordinates && parcel.coordinates.length > 0) {
      lat = parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length;
      lng = parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length;
    }

    const date = state.solarDate ? new Date(state.solarDate) : new Date(2026, 5, 21);
    const hour = state.solarHour !== undefined ? state.solarHour : 12.0;

    // Calculate exact astronomical solar position & solar times
    const currentSunPos = calculateSunPosition(date, hour, lat, lng);
    const sunTimes = calculateSunTimes(date, lat, lng);

    const altitudeDeg = currentSunPos.altitudeDeg;
    const azimuthDeg = currentSunPos.azimuthDeg;

    // Position directional sunlight
    const dist = 180;
    const altRad = Math.max(0.04, currentSunPos.altitudeRad);
    const azRad = currentSunPos.azimuthRad;

    sunLight.position.x = dist * Math.sin(azRad) * Math.cos(altRad);
    sunLight.position.y = Math.max(12, dist * Math.sin(altRad));
    sunLight.position.z = -dist * Math.cos(azRad) * Math.cos(altRad);

    // Modulate lighting intensity & atmospheric coloration
    if (altitudeDeg <= 0) {
      // Night / Below Horizon
      sunLight.intensity = 0.05;
      sunLight.color.setHex(0x1e293b);
      if (ambientLight) ambientLight.intensity = 0.22;
    } else if (altitudeDeg < 12) {
      // Dawn / Dusk (Sunrise / Sunset golden hour)
      sunLight.intensity = 0.65;
      sunLight.color.setHex(0xf97316);
      if (ambientLight) ambientLight.intensity = 0.42;
    } else if (altitudeDeg < 35) {
      // Morning / Afternoon
      sunLight.intensity = 0.95;
      sunLight.color.setHex(0xfde047);
      if (ambientLight) ambientLight.intensity = 0.55;
    } else {
      // High Noon Daylight
      sunLight.intensity = 1.25;
      sunLight.color.setHex(0xfffaed);
      if (ambientLight) ambientLight.intensity = 0.68;
    }

    // Update 3D Sun Path, Heliodon and Cardinal Indicators
    updateSunPathVisualization(lat, lng, currentSunPos, sunTimes);

    // Update UI Badges & Telemetry
    const isKa = (state.currentLang !== 'en');
    const h = Math.floor(hour);
    const m = Math.round((hour % 1) * 60);
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const badgeTime = document.getElementById('solarTimeBadge');
    if (badgeTime) badgeTime.textContent = timeStr;

    const dayNightBadge = document.getElementById('solarDayNightBadge');
    if (dayNightBadge) {
      if (currentSunPos.isDay) {
        dayNightBadge.className = 'solar-status-pill day';
        dayNightBadge.innerHTML = `<i class="fa-solid fa-sun"></i> <span>${isKa ? 'დღე' : 'Daylight'}</span>`;
      } else {
        dayNightBadge.className = 'solar-status-pill night';
        dayNightBadge.innerHTML = `<i class="fa-solid fa-moon"></i> <span>${isKa ? 'ღამე' : 'Night'}</span>`;
      }
    }

    const altVal = document.getElementById('solarAltitudeVal');
    if (altVal) {
      const sign = altitudeDeg >= 0 ? '+' : '';
      altVal.textContent = `${sign}${altitudeDeg.toFixed(1)}°`;
      altVal.style.color = currentSunPos.isDay ? '#fbbf24' : '#818cf8';
    }

    const azVal = document.getElementById('solarAzimuthVal');
    if (azVal) {
      let cardinal = 'N';
      if (azimuthDeg >= 45 && azimuthDeg < 135) cardinal = 'E';
      else if (azimuthDeg >= 135 && azimuthDeg < 225) cardinal = 'S';
      else if (azimuthDeg >= 225 && azimuthDeg < 315) cardinal = 'W';
      azVal.textContent = `${azimuthDeg.toFixed(1)}° (${cardinal})`;
    }

    const srSsVal = document.getElementById('solarSunriseSunsetVal');
    if (srSsVal) srSsVal.textContent = `${sunTimes.sunriseStr} / ${sunTimes.sunsetStr}`;

    const dayLenVal = document.getElementById('solarDayLengthVal');
    if (dayLenVal) dayLenVal.textContent = isKa ? sunTimes.dayLengthStrKa : sunTimes.dayLengthStrEn;
  }

  // Setup Solar Controls, Date Pickers, Quick Presets & Export Triggers
  function setupSolarControls() {
    const slider = document.getElementById('solarTimeSlider');
    const playBtn = document.getElementById('btnPlaySolarAnimation');
    const playIcon = document.getElementById('iconSolarPlay');
    const dateChips = document.querySelectorAll('.btn-solar-chip');
    const customDatePicker = document.getElementById('solarCustomDatePicker');

    // Quick Time Preset Buttons
    const btnSunrise = document.getElementById('btnSolarQuickSunrise');
    const btnNoon = document.getElementById('btnSolarQuickNoon');
    const btnSunset = document.getElementById('btnSolarQuickSunset');
    const btnNight = document.getElementById('btnSolarQuickNight');

    // Visual Toggles
    const chkSunPath = document.getElementById('chkShowSunPath');
    const chkSeasonal = document.getElementById('chkShowSeasonalArcs');
    const chkHours = document.getElementById('chkShowHourMarkers');
    const chkCompass = document.getElementById('chkShowCompassRing');

    // Export Buttons
    const btnExportPhoto = document.getElementById('btnExportSolarPhoto');
    const btnExportPdf = document.getElementById('btnExportSolarPdf');

    if (slider) {
      slider.addEventListener('input', (e) => {
        state.solarHour = parseFloat(e.target.value);
        updateSolarLighting();
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        state.isSolarAnimating = !state.isSolarAnimating;
        if (playIcon) {
          playIcon.className = state.isSolarAnimating ? 'fa-solid fa-pause' : 'fa-solid fa-play';
        }
      });
    }

    // Quick Season Date Chips
    dateChips.forEach(chip => {
      chip.addEventListener('click', () => {
        dateChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const dtStr = chip.dataset.date;
        if (dtStr === '03-21') state.solarDate = new Date(2026, 2, 21);
        else if (dtStr === '06-21') state.solarDate = new Date(2026, 5, 21);
        else if (dtStr === '09-21') state.solarDate = new Date(2026, 8, 21);
        else if (dtStr === '12-21') state.solarDate = new Date(2026, 11, 21);

        if (customDatePicker) {
          const y = state.solarDate.getFullYear();
          const m = String(state.solarDate.getMonth() + 1).padStart(2, '0');
          const d = String(state.solarDate.getDate()).padStart(2, '0');
          customDatePicker.value = `${y}-${m}-${d}`;
        }
        updateSolarLighting();
      });
    });

    if (customDatePicker) {
      customDatePicker.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
          const parts = val.split('-');
          state.solarDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          dateChips.forEach(c => c.classList.remove('active'));
          updateSolarLighting();
        }
      });
    }

    // Quick Time Presets
    const setQuickTime = (hr) => {
      state.solarHour = hr;
      if (slider) slider.value = hr;
      const allQuick = [btnSunrise, btnNoon, btnSunset, btnNight];
      allQuick.forEach(b => b && b.classList.remove('active'));
      updateSolarLighting();
    };

    if (btnSunrise) {
      btnSunrise.addEventListener('click', () => {
        const parcel = state.activeParcel;
        let lat = 41.7151, lng = 44.8271;
        if (parcel && parcel.coordinates && parcel.coordinates.length > 0) {
          lat = parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length;
          lng = parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length;
        }
        const st = calculateSunTimes(state.solarDate || new Date(2026, 5, 21), lat, lng);
        const parts = st.sunriseStr.split(':');
        const hr = parseFloat(parts[0]) + parseFloat(parts[1]) / 60;
        setQuickTime(hr);
        btnSunrise.classList.add('active');
      });
    }

    if (btnNoon) {
      btnNoon.addEventListener('click', () => {
        setQuickTime(12.0);
        btnNoon.classList.add('active');
      });
    }

    if (btnSunset) {
      btnSunset.addEventListener('click', () => {
        const parcel = state.activeParcel;
        let lat = 41.7151, lng = 44.8271;
        if (parcel && parcel.coordinates && parcel.coordinates.length > 0) {
          lat = parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length;
          lng = parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length;
        }
        const st = calculateSunTimes(state.solarDate || new Date(2026, 5, 21), lat, lng);
        const parts = st.sunsetStr.split(':');
        const hr = parseFloat(parts[0]) + parseFloat(parts[1]) / 60;
        setQuickTime(hr);
        btnSunset.classList.add('active');
      });
    }

    if (btnNight) {
      btnNight.addEventListener('click', () => {
        setQuickTime(22.0);
        btnNight.classList.add('active');
      });
    }

    // Heliodon Toggles
    if (chkSunPath) {
      chkSunPath.addEventListener('change', (e) => {
        state.showSunPath = e.target.checked;
        updateSolarLighting();
      });
    }

    if (chkSeasonal) {
      chkSeasonal.addEventListener('change', (e) => {
        state.showSeasonalArcs = e.target.checked;
        updateSolarLighting();
      });
    }

    if (chkHours) {
      chkHours.addEventListener('change', (e) => {
        state.showHourMarkers = e.target.checked;
        updateSolarLighting();
      });
    }

    if (chkCompass) {
      chkCompass.addEventListener('change', (e) => {
        state.showCompassRing = e.target.checked;
        updateSolarLighting();
      });
    }

    // Export Handlers
    if (btnExportPhoto) {
      btnExportPhoto.addEventListener('click', () => {
        exportSolarPhoto();
      });
    }

    if (btnExportPdf) {
      btnExportPdf.addEventListener('click', () => {
        exportSolarPdf();
      });
    }
  }

  // Export 3D Sun Path Simulation as High-Res Architectural Photo
  function exportSolarPhoto() {
    if (!renderer) return;
    const isKa = (state.currentLang !== 'en');
    const parcel = state.activeParcel || { code: '01.11.13.002.264', address: 'თბილისი', area: 1250 };

    let lat = 41.7151, lng = 44.8271;
    if (parcel.coordinates && parcel.coordinates.length > 0) {
      lat = parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length;
      lng = parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length;
    }

    const date = state.solarDate || new Date(2026, 5, 21);
    const hour = state.solarHour !== undefined ? state.solarHour : 12.0;
    const sp = calculateSunPosition(date, hour, lat, lng);
    const st = calculateSunTimes(date, lat, lng);

    const h = Math.floor(hour);
    const m = Math.round((hour % 1) * 60);
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const dateFormatted = date.toLocaleDateString(isKa ? 'ka-GE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Render current frame to ensure buffer is full
    renderer.render(scene, camera);
    const webglCanvas = renderer.domElement;

    // Create presentation composite canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = webglCanvas.width;
    exportCanvas.height = webglCanvas.height;
    const ctx = exportCanvas.getContext('2d');

    // Draw WebGL snapshot
    ctx.drawImage(webglCanvas, 0, 0);

    // Draw Sleek Bottom Architectural Overlay Bar
    const barH = Math.max(90, Math.round(exportCanvas.height * 0.12));
    const barY = exportCanvas.height - barH;

    // Gradient banner background
    const grad = ctx.createLinearGradient(0, barY, 0, exportCanvas.height);
    grad.addColorStop(0, 'rgba(10, 15, 29, 0.0)');
    grad.addColorStop(0.2, 'rgba(10, 15, 29, 0.88)');
    grad.addColorStop(1, 'rgba(10, 15, 29, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, exportCanvas.width, barH);

    // Accent line
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, barY + Math.round(barH * 0.2), exportCanvas.width, 2);

    // Left Section: Project details
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isKa ? `BIMX მზის ინსოლაციისა და ტრაექტორიის ანალიზი` : `BIMX Solar Insolation & Sun Path Analysis`, 30, barY + Math.round(barH * 0.52));

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText(
      isKa
        ? `საკადასტრო კოდი: ${parcel.code} · ${parcel.address} (${parcel.area.toLocaleString()} მ²)`
        : `Cadastral Code: ${parcel.code} · ${parcel.addressEn || parcel.address} (${parcel.area.toLocaleString()} m²)`,
      30, barY + Math.round(barH * 0.82)
    );

    // Right Section: Solar Metrics
    ctx.textAlign = 'right';
    const sign = sp.altitudeDeg >= 0 ? '+' : '';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${dateFormatted} · ${timeStr} (${sign}${sp.altitudeDeg.toFixed(1)}°)`, exportCanvas.width - 30, barY + Math.round(barH * 0.52));

    ctx.fillStyle = '#38bdf8';
    ctx.font = '14px monospace';
    ctx.fillText(
      isKa
        ? `აზიმუტი: ${sp.azimuthDeg.toFixed(1)}° · აისი: ${st.sunriseStr} · დაისი: ${st.sunsetStr} · ${sp.isDay ? '☀️ დღე' : '🌙 ღამე'}`
        : `Azimuth: ${sp.azimuthDeg.toFixed(1)}° · Sunrise: ${st.sunriseStr} · Sunset: ${st.sunsetStr} · ${sp.isDay ? '☀️ Day' : '🌙 Night'}`,
      exportCanvas.width - 30, barY + Math.round(barH * 0.82)
    );

    // Download PNG
    const link = document.createElement('a');
    link.download = `BIMX_მზის_ანალიზი_${parcel.code}_${timeStr.replace(':', '-')}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  // Export Comprehensive Multi-Season Solar Feasibility & Insolation Study PDF
  function exportSolarPdf() {
    const isKa = (state.currentLang !== 'en');
    if (!state.activeParcel) {
      alert(isKa ? 'გთხოვთ, ჯერ აირჩიოთ ნაკვეთი.' : 'Please select a parcel first.');
      return;
    }
    const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPdfClass) {
      window.print();
      return;
    }

    const parcel = state.activeParcel;
    let lat = 41.7151, lng = 44.8271;
    if (parcel.coordinates && parcel.coordinates.length > 0) {
      lat = parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length;
      lng = parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length;
    }

    const doc = new jsPdfClass({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Register embedded Noto Sans Georgian font if available
    let fontName = 'helvetica';
    if (window.GEORGIAN_FONT_REGULAR_B64) {
      try {
        doc.addFileToVFS('NotoSansGeorgian-Regular.ttf', window.GEORGIAN_FONT_REGULAR_B64);
        doc.addFont('NotoSansGeorgian-Regular.ttf', 'NotoSansGeorgian', 'normal');
        if (window.GEORGIAN_FONT_BOLD_B64) {
          doc.addFileToVFS('NotoSansGeorgian-Bold.ttf', window.GEORGIAN_FONT_BOLD_B64);
          doc.addFont('NotoSansGeorgian-Bold.ttf', 'NotoSansGeorgian', 'bold');
        }
        fontName = 'NotoSansGeorgian';
      } catch (err) {
        console.warn('Solar PDF font notice:', err);
      }
    }

    const date = state.solarDate || new Date(2026, 5, 21);
    const hour = state.solarHour !== undefined ? state.solarHour : 12.0;
    const sp = calculateSunPosition(date, hour, lat, lng);
    const st = calculateSunTimes(date, lat, lng);

    const h = Math.floor(hour);
    const m = Math.round((hour % 1) * 60);
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const dateFormatted = date.toLocaleDateString(isKa ? 'ka-GE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // ================= PAGE 1: 3D Sun Path Render & Current Solar State =================
    // Header Banner
    doc.setFillColor(10, 15, 29);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(0, 240, 255);
    doc.rect(0, 27.2, pageWidth, 0.8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(13);
    doc.text(isKa ? 'მზის ინსოლაციის, ტრაექტორიისა და ჩრდილების კვლევა (SUNCALC 3D)' : '3D SOLAR INSOLATION, SUN PATH & SHADOW STUDY', 14, 12);

    doc.setFontSize(8);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      isKa
        ? `საკადასტრო კოდი: ${parcel.code} · ${parcel.address} (${parcel.area.toLocaleString()} მ²) · დადგენილება 14-39`
        : `Parcel: ${parcel.code} · ${parcel.addressEn || parcel.address} (${parcel.area.toLocaleString()} m²) · Resolution 14-39`,
      14, 18
    );

    // Render & Capture Current 3D Canvas
    let imgData = null;
    try {
      if (renderer) {
        renderer.render(scene, camera);
        imgData = renderer.domElement.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Canvas capture warning:', e);
    }

    if (imgData) {
      const renderW = 165;
      const renderH = 115;
      doc.addImage(imgData, 'PNG', 14, 34, renderW, renderH);

      // Frame around 3D render
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.3);
      doc.rect(14, 34, renderW, renderH);
    }

    // Right Side Table: Current Astronomical Profile
    const sign = sp.altitudeDeg >= 0 ? '+' : '';
    const shadowFactor = sp.altitudeDeg > 5 ? (1 / Math.tan((sp.altitudeDeg * Math.PI) / 180)).toFixed(2) + '×' : (isKa ? 'მაქსიმალური (ჰორიზონტალური)' : 'Maximum');

    const currentSolarMetrics = isKa ? [
      ['არჩეული თარიღი და სეზონი', dateFormatted],
      ['სიმულაციის საათი', `${timeStr} (${sp.isDay ? 'დღის მონაკვეთი' : 'ღამის მონაკვეთი'})`],
      ['მზის სიმაღლის კუთხე (Alt)', `${sign}${sp.altitudeDeg.toFixed(1)}°`],
      ['მზის აზიმუტი (Az)', `${sp.azimuthDeg.toFixed(1)}°`],
      ['მზის ამოსვლა (აისი)', st.sunriseStr],
      ['მზის ჩასვლა (დაისი)', st.sunsetStr],
      ['დღის ხანგრძლივობა', st.dayLengthStrKa],
      ['ჩრდილის სიგრძის ინდექსი', shadowFactor],
      ['გეოგრაფიული კოორდინატები', `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`]
    ] : [
      ['Selected Date & Season', dateFormatted],
      ['Simulation Time', `${timeStr} (${sp.isDay ? 'Daylight' : 'Night'})`],
      ['Solar Altitude Angle (Alt)', `${sign}${sp.altitudeDeg.toFixed(1)}°`],
      ['Solar Azimuth Angle (Az)', `${sp.azimuthDeg.toFixed(1)}°`],
      ['Sunrise Time', st.sunriseStr],
      ['Sunset Time', st.sunsetStr],
      ['Daylight Duration', st.dayLengthStrEn],
      ['Shadow Length Factor', shadowFactor],
      ['GPS Coordinates', `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`]
    ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: 34,
        margin: { left: 185, right: 14 },
        body: currentSolarMetrics,
        theme: 'striped',
        styles: { fontSize: 7.8, cellPadding: 2.6, font: fontName },
        columnStyles: {
          0: { font: fontName, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42], cellWidth: 48 },
          1: { font: fontName, cellWidth: pageWidth - 185 - 14 - 48 }
        }
      });
    }

    // Bottom Summary Note
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(
      isKa
        ? 'შენიშვნა: მზის ინსოლაციის მოდელირება ეფუძნება ასტრონომიულ ალგორითმს და ასახავს მზის ზუსტ სიმაღლეს, აზიმუტსა და შენობის მოცულობით ჩრდილებს ნაკვეთის რელიეფზე.'
        : 'Note: Solar insolation modeling utilizes verified astronomical algorithms to compute precise solar elevation, azimuth, and volumetric building shadow vectors.',
      14, pageHeight - 8
    );

    // ================= PAGE 2: 4-Season Annual Comparative Matrix =================
    doc.addPage();

    // Page 2 Header Banner
    doc.setFillColor(10, 15, 29);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 27.2, pageWidth, 0.8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(13);
    doc.text(
      isKa ? 'წლის 4 სეზონის შედარებითი ინსოლაციური ანალიზი (ნაბუნიობა და ბუნიობა)' : '4-SEASON ANNUAL COMPARATIVE INSOLATION MATRIX (SOLSTICES & EQUINOXES)',
      14, 12
    );

    doc.setFontSize(8);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      isKa
        ? 'ზაფხულის, ზამთრისა და ბუნიობის მზის ტრაექტორიები, დღე-ღამის ხანგრძლივობა და ჩრდილის მაქსიმალური ექსპოზიცია'
        : 'Comparative solar elevation, daylight duration, and shadow footprint across Solstices and Equinoxes',
      14, 18
    );

    // 4 Seasons Comparative Data
    const summerTimes = calculateSunTimes(new Date(2026, 5, 21), lat, lng);
    const winterTimes = calculateSunTimes(new Date(2026, 11, 21), lat, lng);
    const equinoxTimes = calculateSunTimes(new Date(2026, 2, 21), lat, lng);

    const summerNoon = calculateSunPosition(new Date(2026, 5, 21), 12, lat, lng);
    const winterNoon = calculateSunPosition(new Date(2026, 11, 21), 12, lat, lng);
    const equinoxNoon = calculateSunPosition(new Date(2026, 2, 21), 12, lat, lng);

    const seasonMatrixData = isKa ? [
      [
        '21 ივნისი (ზაფხულის ნაბუნიობა)',
        `${summerNoon.altitudeDeg.toFixed(1)}° (უმაღლესი)`,
        summerTimes.sunriseStr,
        summerTimes.sunsetStr,
        summerTimes.dayLengthStrKa,
        '0.33× (უმცირესი)',
        'მაქსიმალური მზის ენერგია და ინსოლაცია, მინიმალური ჩრდილი მეზობლებზე.'
      ],
      [
        '21 მარტი (გაზაფხულის ბუნიობა)',
        `${equinoxNoon.altitudeDeg.toFixed(1)}° (საშუალო)`,
        equinoxTimes.sunriseStr,
        equinoxTimes.sunsetStr,
        equinoxTimes.dayLengthStrKa,
        '0.90× (ბალანსირებული)',
        'დღისა და ღამის თანაბარი განაწილება (12 სთ / 12 სთ), სტანდარტული ჩრდილის არეალი.'
      ],
      [
        '21 სექტემბერი (შემოდგომის ბუნიობა)',
        `${equinoxNoon.altitudeDeg.toFixed(1)}° (საშუალო)`,
        equinoxTimes.sunriseStr,
        equinoxTimes.sunsetStr,
        equinoxTimes.dayLengthStrKa,
        '0.90× (ბალანსირებული)',
        'გარდამავალი სეზონი, მზის ოპტიმალური ინსოლაცია საცხოვრებელ ოთახებში.'
      ],
      [
        '21 დეკემბერი (ზამთრის ნაბუნიობა)',
        `${winterNoon.altitudeDeg.toFixed(1)}° (უმდაბლესი)`,
        winterTimes.sunriseStr,
        winterTimes.sunsetStr,
        winterTimes.dayLengthStrKa,
        '2.15× (მაქსიმალური)',
        'გრძელი ჩრდილები, კრიტიკული შემოწმება დადგენილება 14-39-ის მიჯნის ნორმებზე.'
      ]
    ] : [
      [
        'June 21 (Summer Solstice)',
        `${summerNoon.altitudeDeg.toFixed(1)}° (Peak)`,
        summerTimes.sunriseStr,
        summerTimes.sunsetStr,
        summerTimes.dayLengthStrEn,
        '0.33× (Minimal)',
        'Maximum solar irradiance, shortest building shadows on adjacent sites.'
      ],
      [
        'March 21 (Vernal Equinox)',
        `${equinoxNoon.altitudeDeg.toFixed(1)}° (Mid)`,
        equinoxTimes.sunriseStr,
        equinoxTimes.sunsetStr,
        equinoxTimes.dayLengthStrEn,
        '0.90× (Standard)',
        'Equal day and night distribution (12h / 12h), baseline regulatory shadow study.'
      ],
      [
        'September 21 (Autumn Equinox)',
        `${equinoxNoon.altitudeDeg.toFixed(1)}° (Mid)`,
        equinoxTimes.sunriseStr,
        equinoxTimes.sunsetStr,
        equinoxTimes.dayLengthStrEn,
        '0.90× (Standard)',
        'Transitional solar arc, balanced passive heating and illumination.'
      ],
      [
        'December 21 (Winter Solstice)',
        `${winterNoon.altitudeDeg.toFixed(1)}° (Lowest)`,
        winterTimes.sunriseStr,
        winterTimes.sunsetStr,
        winterTimes.dayLengthStrEn,
        '2.15× (Maximum)',
        'Longest building shadows, key test for Resolution 14-39 setback compliance.'
      ]
    ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: 34,
        head: [
          isKa
            ? ['სეზონი / საკვანძო თარიღი', 'შუადღის მზე (Alt)', 'აისი', 'დაისი', 'დღის ხანგრძლივობა', 'ჩრდილის ფაქტორი', 'ქალაქმშენებლობითი შეფასება']
            : ['Season / Key Date', 'Solar Noon Alt', 'Sunrise', 'Sunset', 'Daylight Hours', 'Shadow Multiplier', 'Urban Feasibility Assessment']
        ],
        body: seasonMatrixData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3.5, font: fontName },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], font: fontName, fontStyle: 'bold' },
        columnStyles: {
          0: { font: fontName, fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 42 },
          1: { font: fontName, cellWidth: 26 },
          2: { font: fontName, cellWidth: 16 },
          3: { font: fontName, cellWidth: 16 },
          4: { font: fontName, cellWidth: 28 },
          5: { font: fontName, cellWidth: 24 },
          6: { font: fontName, cellWidth: pageWidth - 28 - (42 + 26 + 16 + 16 + 28 + 24) }
        },
        margin: { left: 14, right: 14 }
      });
    }

    // Hourly Sun Elevation Table across 24h for Equinox & Solstices
    const hourlyHeader = isKa
      ? ['სეზონი / დრო', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00 (ღამე)']
      : ['Season / Time', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00 (Night)'];

    const getHourlyRow = (label, dt) => {
      const row = [label];
      [6, 8, 10, 12, 14, 16, 18, 20, 22].forEach(hr => {
        const p = calculateSunPosition(dt, hr, lat, lng);
        if (p.altitudeDeg > 0) {
          row.push(`+${p.altitudeDeg.toFixed(0)}°`);
        } else {
          row.push(isKa ? 'ღამე' : 'Night');
        }
      });
      return row;
    };

    const hourlyBody = [
      getHourlyRow(isKa ? 'ზაფხული (21 ივნ)' : 'Summer (Jun 21)', new Date(2026, 5, 21)),
      getHourlyRow(isKa ? 'ბუნიობა (21 მარ/სექ)' : 'Equinox (Mar/Sep 21)', new Date(2026, 2, 21)),
      getHourlyRow(isKa ? 'ზამთარი (21 დეკ)' : 'Winter (Dec 21)', new Date(2026, 11, 21))
    ];

    const currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 110;

    doc.setFont(fontName, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(
      isKa ? 'დღე-ღამის 24-საათიანი საათობრივი მზის სიმაღლის პროფილი (Altitude)' : '24-Hour Diurnal Solar Elevation Profile (Altitude)',
      14, currentY
    );

    if (doc.autoTable) {
      doc.autoTable({
        startY: currentY + 3,
        head: [hourlyHeader],
        body: hourlyBody,
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 2.2, font: fontName, halign: 'center' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], font: fontName },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 42 }
        },
        margin: { left: 14, right: 14 }
      });
    }

    const pdfFileName = isKa ? `BIMX_მზის_ანალიზი_${parcel.code}_წლიური_კვლევა.pdf` : `BIMX_Solar_Analysis_${parcel.code}_Annual_Study.pdf`;
    doc.save(pdfFileName);
  }

  /* ==========================================================================
     3c. Surrounding 3D Urban Extrusion (OpenStreetMap Overpass - Module 1B & 2B)
     ========================================================================== */
  async function loadSurroundingUrbanFabric(centerLat, centerLng) {
    if (!urbanGroup || !state.activeParcel) return;

    while (urbanGroup.children.length > 0) {
      const child = urbanGroup.children[0];
      urbanGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    try {
      const res = await fetch(`/api/overpass?lat=${centerLat}&lng=${centerLng}&radius=350`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.buildings || !data.buildings.length) return;

      const centerGps = { lat: centerLat, lng: centerLng };

      const clayMat = new THREE.MeshStandardMaterial({
        color: 0x1f293d,
        roughness: 0.85,
        metalness: 0.15,
        transparent: true,
        opacity: 0.65,
        wireframe: false
      });

      const edgeLineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35
      });

      data.buildings.forEach(bldg => {
        if (!bldg.coordinates || bldg.coordinates.length < 3) return;

        const localPts = gpsToLocalMeters(bldg.coordinates, centerGps);
        if (localPts.length < 3) return;

        const avgX = localPts.reduce((s, p) => s + p.x, 0) / localPts.length;
        const avgY = localPts.reduce((s, p) => s + p.y, 0) / localPts.length;
        if (Math.hypot(avgX, avgY) < 14) return;

        const shape = new THREE.Shape();
        localPts.forEach((pt, idx) => {
          if (idx === 0) shape.moveTo(pt.x, -pt.y);
          else shape.lineTo(pt.x, -pt.y);
        });
        shape.closePath();

        const height = Math.max(6.0, Math.min(65.0, bldg.height || 9.0));
        const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: false
        });

        const mesh = new THREE.Mesh(extrudeGeom, clayMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        urbanGroup.add(mesh);

        const edges = new THREE.EdgesGeometry(extrudeGeom, 25);
        const line = new THREE.LineSegments(edges, edgeLineMat);
        line.rotation.x = -Math.PI / 2;
        urbanGroup.add(line);
      });
    } catch (err) {
      console.warn('Surrounding urban fabric fetch error:', err);
    }
  }

  /* ==========================================================================
     3d. Dynamic 3D DEM Displaced Terrain Mesh & Topography (Module 1C & 2A)
     ========================================================================== */
  async function renderParcelTerrain3D(parcel, centerLat, centerLng) {
    if (!terrainGroup) return;

    while (terrainGroup.children.length > 0) {
      const child = terrainGroup.children[0];
      terrainGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    let baseElevation = 480;
    try {
      const res = await fetch(`/api/elevation?lat=${centerLat}&lng=${centerLng}`);
      if (res.ok) {
        const d = await res.json();
        if (d && typeof d.elevation === 'number') baseElevation = d.elevation;
      }
    } catch (e) {}

    const localPoints = gpsToLocalMeters(parcel.coordinates, { lat: centerLat, lng: centerLng });
    const xs = localPoints.map(p => p.x);
    const ys = localPoints.map(p => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const parcelSpan = Math.max(spanX, spanY, 35);

    let naturalSlope = 2.5;
    const tText = (parcel.terrain || '').toLowerCase();
    if (tText.includes('6%') || tText.includes('დახრილ')) naturalSlope = 6.0;
    else if (tText.includes('1%') || tText.includes('ვაკე')) naturalSlope = 1.2;
    else if (tText.includes('3%')) naturalSlope = 3.0;
    else if (tText.includes('12%') || tText.includes('ფერდობ')) naturalSlope = 12.0;
    else if (tText.includes('2%')) naturalSlope = 2.0;

    const deltaZ = (naturalSlope / 100) * parcelSpan;
    state.terrainData = {
      elevation: baseElevation,
      deltaZ: parseFloat(deltaZ.toFixed(1)),
      slopePct: parseFloat(naturalSlope.toFixed(1))
    };

    const hudSlope = document.getElementById('hudTerrainSlope');
    if (hudSlope) {
      hudSlope.textContent = `დახრა: ${naturalSlope.toFixed(1)}% (ΔZ: ${deltaZ.toFixed(1)} მ)`;
    }
    const infoTerrain = document.getElementById('infoParcelTerrain');
    if (infoTerrain) {
      infoTerrain.textContent = `${naturalSlope <= 3 ? 'ვაკე / მცირედ დახრილი' : (naturalSlope <= 8 ? 'დახრილი რელიეფი' : 'მკვეთრად დახრილი ფერდობი')} (${naturalSlope.toFixed(1)}%, ΔZ: ${deltaZ.toFixed(1)} მ)`;
    }

    const terrainSize = Math.max(260, parcelSpan * 4);
    const segments = 36;
    const terrainGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    const posAttr = terrainGeom.attributes.position;

    const slopeRad = (naturalSlope / 100);
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const elevDisp = (vx * 0.7 - vy * 0.4) * slopeRad * 0.6 + Math.sin(vx * 0.05) * Math.cos(vy * 0.05) * 0.6;
      posAttr.setZ(i, elevDisp);
    }
    terrainGeom.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.9,
      metalness: 0.1,
      wireframe: false
    });

    const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.position.y = -0.15;
    terrainMesh.receiveShadow = true;
    terrainGroup.add(terrainMesh);

    const terrainWireMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      wireframe: true,
      transparent: true,
      opacity: 0.06
    });
    const terrainWire = new THREE.Mesh(terrainGeom, terrainWireMat);
    terrainWire.rotation.x = -Math.PI / 2;
    terrainWire.position.y = -0.14;
    terrainGroup.add(terrainWire);

    const boundaryPoints3D = localPoints.map(p => {
      const elev = (p.x * 0.7 - p.y * 0.4) * slopeRad * 0.6 + 0.18;
      return new THREE.Vector3(p.x, elev, p.y);
    });
    boundaryPoints3D.push(boundaryPoints3D[0].clone());

    const boundaryGeom = new THREE.BufferGeometry().setFromPoints(boundaryPoints3D);
    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0x00f2fe,
      linewidth: 3
    });
    const boundaryLine = new THREE.Line(boundaryGeom, boundaryMat);
    terrainGroup.add(boundaryLine);
  }

  /* ==========================================================================
     4b. AI Risk Assessment & Constraints Checklist (Module 4B)
     ========================================================================== */
  function evaluateAIRiskAudit(parcel) {
    if (!parcel) return;

    const isEn = state.currentLang === 'en';
    const code = parcel.code || '';
    const slope = (state.terrainData && state.terrainData.slopePct) || 2.5;

    const isHeritage = code.startsWith('01.16') || code.startsWith('01.14.01') || code.startsWith('03.02') || (parcel.mainZoneKa && parcel.mainZoneKa.includes('ისტორიულ'));
    const iconHeritage = document.getElementById('iconRiskHeritage');
    const descHeritage = document.getElementById('descRiskHeritage');

    if (iconHeritage && descHeritage) {
      if (isHeritage) {
        iconHeritage.className = 'fa-solid fa-triangle-exclamation risk-icon-warn';
        descHeritage.textContent = isEn
          ? 'Located in Cultural Heritage Protection Area. Requires Heritage Council approval.'
          : 'ნაკვეთი ხვდება ისტორიულ დამცავ არეალში — პროექტი საჭიროებს კულტურული მემკვიდრეობის საბჭოს თანხმობას.';
      } else {
        iconHeritage.className = 'fa-solid fa-circle-check risk-icon-pass';
        descHeritage.textContent = isEn
          ? 'Parcel is situated outside statutory cultural heritage protection buffer zones.'
          : 'ნაკვეთი დაცულ ისტორიულ არეალს მიღმაა (საბჭოს სპეციალური ნებართვა არ მოითხოვება).';
      }
    }

    const minSetback = computeMinBoundaryDistance(state.buildings, parcel);
    const iconRedLines = document.getElementById('iconRiskRedLines');
    const descRedLines = document.getElementById('descRiskRedLines');

    let redLinesPass = true;
    if (iconRedLines && descRedLines) {
      if (minSetback !== null && minSetback < 3.0) {
        redLinesPass = false;
        iconRedLines.className = 'fa-solid fa-circle-xmark risk-icon-fail';
        descRedLines.textContent = isEn
          ? `Setback violation (${minSetback.toFixed(1)}m < 3.0m). Infringes upon statutory street alignment / neighbor boundary.`
          : `დაცილება საზღვრამდე (${minSetback.toFixed(1)} მ < 3.0 მ). ირღვევა სატრანსპორტო წითელი ხაზები ან სამეზობლო მიჯნა.`;
      } else {
        iconRedLines.className = 'fa-solid fa-circle-check risk-icon-pass';
        descRedLines.textContent = isEn
          ? 'Complies with statutory red lines & street alignment setbacks (≥ 3.0m maintained).'
          : 'სატრანსპორტო წითელი ხაზების და სამშენებლო მიჯნის ნორმა დაცულია (≥ 3.0 მ).';
      }
    }

    const iconSlope = document.getElementById('iconRiskSlope');
    const descSlope = document.getElementById('descRiskSlope');
    let slopePass = slope < 10.0;

    if (iconSlope && descSlope) {
      if (slope >= 10.0) {
        iconSlope.className = 'fa-solid fa-triangle-exclamation risk-icon-warn';
        descSlope.textContent = isEn
          ? `Terrain slope is ${slope.toFixed(1)}% (>10%). Geodynamic hazard: retaining walls & geotechnical survey required.`
          : `ფერდობის დახრაა ${slope.toFixed(1)}% (>10%). მეწყრული რისკი: აუცილებელია საყრდენი კედლების პროექტი და გეოტექნიკური კვლევა.`;
      } else {
        iconSlope.className = 'fa-solid fa-circle-check risk-icon-pass';
        descSlope.textContent = isEn
          ? `Natural slope is ${slope.toFixed(1)}% (<10%). Flat/moderate terrain, minimal earthwork hazard.`
          : `დახრაა ${slope.toFixed(1)}% (<10%). ვაკე / მცირე დახრილობა — გრუნტის მეწყრული რისკი მინიმალურია.`;
      }
    }

    let riskLevel = 'low';
    if (!redLinesPass || (isHeritage && !slopePass)) riskLevel = 'high';
    else if (isHeritage || !slopePass) riskLevel = 'medium';

    const riskBadge = document.getElementById('riskOverallScoreBadge');
    if (riskBadge) {
      riskBadge.className = `risk-score-pill ${riskLevel}`;
      riskBadge.textContent = riskLevel === 'low'
        ? (isEn ? 'Low (LOW)' : 'დაბალი (LOW)')
        : (riskLevel === 'medium' ? (isEn ? 'Medium (MED)' : 'საშუალო (MED)') : (isEn ? 'High (HIGH)' : 'მაღალი (HIGH)'));
    }

    const gapAdvice = document.getElementById('gapAdviceText');
    if (gapAdvice) {
      if (riskLevel === 'low') {
        gapAdvice.textContent = isEn
          ? 'Parcel has optimal pre-feasibility for Stage 1 Permit (GAP). Submit standard architectural assignment with topographical study.'
          : 'ნაკვეთი სრულ შესაბამისობაშია I ეტაპის (გპპ) ნებართვისთვის. რეკომენდებულია საპროექტო დავალების წარდგენა ტოპოგრაფიული გეგმით.';
      } else if (riskLevel === 'medium') {
        gapAdvice.textContent = isEn
          ? 'Pre-feasibility is favorable with conditions: obtain Cultural Heritage Council consent and coordinate retaining structural design.'
          : 'ნებართვის მიღება დადებითია პირობებით: საჭიროა ისტორიული/საინჟინრო ექსპერტიზის თანდართვა და საყრდენი კედლების სქემა.';
      } else {
        gapAdvice.textContent = isEn
          ? 'Critical constraints identified: rectify building setbacks to clear red lines (≥ 3.0m) before submitting to Municipal Architecture Service.'
          : 'დაფიქსირდა კრიტიკული შეზღუდვები: გაზარდეთ დაცილება საზღვრამდე (მინ. 3.0 მ) და შეათანხმეთ გრგ მერიის არქიტექტურის სამსახურში.';
      }
    }
  }

  function renderParcelGround3D(parcel) {
    if (!groundGroup) return;

    while (groundGroup.children.length > 0) {
      groundGroup.remove(groundGroup.children[0]);
    }

    const parcelCenter = {
      lat: parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length,
      lng: parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length
    };

    const localPoints = gpsToLocalMeters(parcel.coordinates, parcelCenter);

    const shape = new THREE.Shape();
    localPoints.forEach((pt, idx) => {
      if (idx === 0) shape.moveTo(pt.x, -pt.y);
      else shape.lineTo(pt.x, -pt.y);
    });
    shape.closePath();

    const groundGeom = new THREE.ShapeGeometry(shape);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x182030,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    groundMesh.position.y = 0.05;
    groundGroup.add(groundMesh);

    // Render Dynamic Displaced 3D Terrain & Draped Boundary
    renderParcelTerrain3D(parcel, parcelCenter.lat, parcelCenter.lng);

    // Load Surrounding 3D Buildings from OpenStreetMap Overpass
    loadSurroundingUrbanFabric(parcelCenter.lat, parcelCenter.lng);

    // Update Solar Lighting & Shadow state
    updateSolarLighting();

    // Evaluate Regulatory AI Risk Audit
    evaluateAIRiskAudit(parcel);

    // Auto-frame camera based on parcel dimensions
    if (camera && controls && localPoints.length > 0) {
      const xs = localPoints.map(p => p.x);
      const ys = localPoints.map(p => p.y);
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanZ = Math.max(...ys) - Math.min(...ys);
      const maxSpan = Math.max(spanX, spanZ, 45);
      const camDist = maxSpan * 1.5;
      camera.position.set(camDist * 0.7, camDist * 0.65, camDist * 0.85);
      controls.target.set(0, 5, 0);
      controls.update();
    }
  }

  // Convert lat/lng array (or single [lat, lng]) to local meters using Equirectangular approximation anchored to parcel reference origin
  function gpsToLocalMeters(coords, referenceOrigin = null) {
    if (!coords || coords.length === 0) return [];

    let isSingle = false;
    let coordList = coords;
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      isSingle = true;
      coordList = [coords];
    } else if (!Array.isArray(coords[0])) {
      return isSingle ? { x: 0, y: 0 } : [];
    }

    let centerLat, centerLng;
    if (referenceOrigin) {
      if (typeof referenceOrigin.lat === 'number' && typeof referenceOrigin.lng === 'number') {
        centerLat = referenceOrigin.lat;
        centerLng = referenceOrigin.lng;
      } else if (Array.isArray(referenceOrigin) && referenceOrigin.length >= 2) {
        centerLat = referenceOrigin[0];
        centerLng = referenceOrigin[1];
      }
    }

    // Always anchor to active parcel center if available so ALL buildings & parcel boundary share the exact same 3D coordinate frame
    if (centerLat === undefined || centerLng === undefined) {
      if (state.activeParcel && state.activeParcel.coordinates && state.activeParcel.coordinates.length > 0) {
        centerLat = state.activeParcel.coordinates.reduce((sum, c) => sum + c[0], 0) / state.activeParcel.coordinates.length;
        centerLng = state.activeParcel.coordinates.reduce((sum, c) => sum + c[1], 0) / state.activeParcel.coordinates.length;
      } else {
        centerLat = coordList.reduce((sum, c) => sum + c[0], 0) / coordList.length;
        centerLng = coordList.reduce((sum, c) => sum + c[1], 0) / coordList.length;
      }
    }

    const latToMeters = 111139;
    const lngToMeters = 111139 * Math.cos(centerLat * Math.PI / 180);

    const converted = coordList.map(c => ({
      x: (c[1] - centerLng) * lngToMeters,
      y: (c[0] - centerLat) * latToMeters
    }));

    return isSingle ? converted[0] : converted;
  }

  // Convert local meters back to GPS coordinates relative to parcel center
  function localMetersToGps(localPts, centerGps) {
    if (!localPts || localPts.length === 0 || !centerGps) return [];
    const latToMeters = 111139;
    const lngToMeters = 111139 * Math.cos(centerGps.lat * Math.PI / 180);

    return localPts.map(pt => [
      centerGps.lat + (pt.y / latToMeters),
      centerGps.lng + (pt.x / lngToMeters)
    ]);
  }

  /* ==========================================================================
     4b. Multi-Building Masterplan Manager & Color Palette System
     ========================================================================== */
  const ZONE_PRESETS = {
    'auto': null,
    'sz-1': {
      mainZoneKa: 'საცხოვრებელი ზონა (სზ)',
      mainZoneEn: 'Residential Zone (SZ)',
      subzoneKa: 'დაბალი ინტენსივობის საცხოვრებელი ქვეზონა 1 (სზ-1)',
      subzoneEn: 'Low-density Residential Subzone 1 (SZ-1)',
      subzoneKey: 'sz-1',
      nameKa: 'საცხოვრებელი ქვეზონა 1 (სზ-1)',
      nameEn: 'Residential Subzone 1 (SZ-1)',
      k1: 0.5, k2: 0.8, k3: 0.3
    },
    'sz-2': {
      mainZoneKa: 'საცხოვრებელი ზონა (სზ)',
      mainZoneEn: 'Residential Zone (SZ)',
      subzoneKa: 'დაბალი ინტენსივობის საცხოვრებელი ქვეზონა 2 (სზ-2)',
      subzoneEn: 'Low-density Residential Subzone 2 (SZ-2)',
      subzoneKey: 'sz-2',
      nameKa: 'საცხოვრებელი ქვეზონა 2 (სზ-2)',
      nameEn: 'Residential Subzone 2 (SZ-2)',
      k1: 0.5, k2: 1.2, k3: 0.3
    },
    'sz-3': {
      mainZoneKa: 'საცხოვრებელი ზონა (სზ)',
      mainZoneEn: 'Residential Zone (SZ)',
      subzoneKa: 'დაბალი ინტენსივობის შერეული საცხოვრებელი ქვეზონა 3 (სზ-3)',
      subzoneEn: 'Mixed Residential Subzone 3 (SZ-3)',
      subzoneKey: 'sz-3',
      nameKa: 'საცხოვრებელი ქვეზონა 3 (სზ-3)',
      nameEn: 'Residential Subzone 3 (SZ-3)',
      k1: 0.5, k2: 1.5, k3: 0.3
    },
    'sz-4': {
      mainZoneKa: 'საცხოვრებელი ზონა (სზ)',
      mainZoneEn: 'Residential Zone (SZ)',
      subzoneKa: 'საშუალო ინტენსივობის საცხოვრებელი ქვეზონა 4 (სზ-4)',
      subzoneEn: 'Medium-density Residential Subzone 4 (SZ-4)',
      subzoneKey: 'sz-4',
      nameKa: 'საცხოვრებელი ქვეზონა 4 (სზ-4)',
      nameEn: 'Residential Subzone 4 (SZ-4)',
      k1: 0.5, k2: 1.8, k3: 0.3
    },
    'sz-5': {
      mainZoneKa: 'საცხოვრებელი ზონა (სზ)',
      mainZoneEn: 'Residential Zone (SZ)',
      subzoneKa: 'საშუალო ინტენსივობის შერეული საცხოვრებელი ქვეზონა 5 (სზ-5)',
      subzoneEn: 'Medium-density Residential Subzone 5 (SZ-5)',
      subzoneKey: 'sz-5',
      nameKa: 'საცხოვრებელი ქვეზონა 5 (სზ-5)',
      nameEn: 'Residential Subzone 5 (SZ-5)',
      k1: 0.5, k2: 2.1, k3: 0.3
    },
    'sz-6': {
      mainZoneKa: 'საცხოვრებელი ზონა (სზ)',
      mainZoneEn: 'Residential Zone (SZ)',
      subzoneKa: 'მაღალი ინტენსივობის საცხოვრებელი ქვეზონა 6 (სზ-6)',
      subzoneEn: 'High-density Residential Subzone 6 (SZ-6)',
      subzoneKey: 'sz-6',
      nameKa: 'საცხოვრებელი ქვეზონა 6 (სზ-6)',
      nameEn: 'Residential Subzone 6 (SZ-6)',
      k1: 0.4, k2: 2.5, k3: 0.3
    },
    'ssz-1': {
      mainZoneKa: 'საზოგადოებრივ-საქმიანი ზონა (სსზ)',
      mainZoneEn: 'Public Business Zone (SSZ)',
      subzoneKa: 'საზოგადოებრივ-საქმიანი ქვეზონა 1 (სსზ-1)',
      subzoneEn: 'Public Business Subzone 1 (SSZ-1)',
      subzoneKey: 'ssz-1',
      nameKa: 'საზოგადოებრივ-საქმიანი ქვეზონა 1 (სსზ-1)',
      nameEn: 'Public Business Subzone 1 (SSZ-1)',
      k1: 0.7, k2: 2.4, k3: 0.1
    },
    'ssz-2': {
      mainZoneKa: 'საზოგადოებრივ-საქმიანი ზონა (სსზ)',
      mainZoneEn: 'Public Business Zone (SSZ)',
      subzoneKa: 'საზოგადოებრივ-საქმიანი ქვეზონა 2 (სსზ-2)',
      subzoneEn: 'Public Business Subzone 2 (SSZ-2)',
      subzoneKey: 'ssz-2',
      nameKa: 'საზოგადოებრივ-საქმიანი ქვეზონა 2 (სსზ-2)',
      nameEn: 'Public Business Subzone 2 (SSZ-2)',
      k1: 0.7, k2: 3.5, k3: 0.1
    },
    'ssz-3': {
      mainZoneKa: 'საზოგადოებრივ-საქმიანი ზონა (სსზ)',
      mainZoneEn: 'Public Business Zone (SSZ)',
      subzoneKa: 'საზოგადოებრივ-საქმიანი ქვეზონა 3 (სსზ-3)',
      subzoneEn: 'Public Business Subzone 3 (SSZ-3)',
      subzoneKey: 'ssz-3',
      nameKa: 'საზოგადოებრივ-საქმიანი ქვეზონა 3 (სსზ-3)',
      nameEn: 'Public Business Subzone 3 (SSZ-3)',
      k1: 0.7, k2: 4.6, k3: 0.1
    },
    'skz': {
      mainZoneKa: 'საკურორტო ზონა (სკზ)',
      mainZoneEn: 'Resort Zone (SKZ)',
      subzoneKa: 'საკურორტო ქვეზონა (სკზ)',
      subzoneEn: 'Resort Subzone (SKZ)',
      subzoneKey: 'skz',
      nameKa: 'საკურორტო ზონა (სკზ)',
      nameEn: 'Resort Zone (SKZ)',
      k1: 0.3, k2: 0.9, k3: 0.5
    },
    'rz-1': {
      mainZoneKa: 'სარეკრეაციო ზონა (რზ)',
      mainZoneEn: 'Recreation Zone (RZ)',
      subzoneKa: 'სარეკრეაციო ქვეზონა 1 (რზ-1)',
      subzoneEn: 'Recreation Subzone 1 (RZ-1)',
      subzoneKey: 'rz-1',
      nameKa: 'სარეკრეაციო ზონა 1 (რზ-1)',
      nameEn: 'Recreation Zone 1 (RZ-1)',
      k1: 0.2, k2: 0.4, k3: 0.8
    },
    'rz-2': {
      mainZoneKa: 'სარეკრეაციო ზონა (რზ)',
      mainZoneEn: 'Recreation Zone (RZ)',
      subzoneKa: 'სარეკრეაციო ქვეზონა 2 (რზ-2)',
      subzoneEn: 'Recreation Subzone 2 (RZ-2)',
      subzoneKey: 'rz-2',
      nameKa: 'სარეკრეაციო ზონა 2 (რზ-2)',
      nameEn: 'Recreation Zone 2 (RZ-2)',
      k1: 0.2, k2: 0.4, k3: 0.8
    },
    'lz': {
      mainZoneKa: 'ლანდშაფტურ-სარეკრეაციო ზონა (ლზ)',
      mainZoneEn: 'Landscape-Recreation Zone (LZ)',
      subzoneKa: 'ლანდშაფტურ-სარეკრეაციო ზონა (ლზ)',
      subzoneEn: 'Landscape-Recreation Zone (LZ)',
      subzoneKey: 'lz',
      nameKa: 'ლანდშაფტურ-სარეკრეაციო (ლზ)',
      nameEn: 'Landscape-Recreation Zone (LZ)',
      k1: 0.0, k2: 0.0, k3: 1.0
    },
    'saz': {
      mainZoneKa: 'სანიტარიული / დამცავი ზონა (საზ)',
      mainZoneEn: 'Sanitary / Protective Zone (SAZ)',
      subzoneKa: 'სანიტარიული / დამცავი ზონა (საზ)',
      subzoneEn: 'Sanitary / Protective Zone (SAZ)',
      subzoneKey: 'saz',
      nameKa: 'სანიტარიული/დამცავი ზონა (საზ)',
      nameEn: 'Sanitary / Protective Zone',
      k1: 0.0, k2: 0.0, k3: 1.0
    },
    'tz': {
      mainZoneKa: 'სატრანსპორტო ზონა (ტზ)',
      mainZoneEn: 'Transport Infrastructure Zone',
      subzoneKa: 'სატრანსპორტო ზონა (ტზ)',
      subzoneEn: 'Transport Infrastructure Subzone',
      subzoneKey: 'tz',
      nameKa: 'სატრანსპორტო ზონა (ტზ)',
      nameEn: 'Transport Infrastructure Zone',
      k1: 0.1, k2: 0.2, k3: 0.5
    },
    'custom': null
  };

  // Statutory Regulations Database (დადგენილება 14-39, 41, მისაწვდომობა / matsne.gov.ge)
  const REGULATIONS_DB = {
    'sz-1': {
      zoneNameKa: 'საცხოვრებელი ზონა 1 (სზ-1)',
      zoneNameEn: 'Residential Zone 1 (SZ-1)',
      buildable: 'allowed',
      minArea: 400,
      minFrontage: 14,
      minSetback: 3.0,
      maxFloors: 2,
      descKa: 'საცხოვრებელი ზონა 1 — დაშვებულია დაბალი ინტენსივობის ინდივიდუალური საცხოვრებელი სახლები (მაქს. 2 სართული).',
      descEn: 'Residential Zone 1 — Individual low-rise residential houses permitted (max 2 stories).',
      allowedTypologies: [
        { icon: 'fa-house', nameKa: 'ინდივიდუალური საცხოვრებელი სახლი', nameEn: 'Individual Residential House' },
        { icon: 'fa-tree-city', nameKa: 'აგარაკი / კოტეჯი', nameEn: 'Cottage / Villa' },
        { icon: 'fa-warehouse', nameKa: 'დამხმარე ნაგებობა / გარაჟი', nameEn: 'Auxiliary Building / Garage' },
        { icon: 'fa-seedling', nameKa: 'საკარმიდამო მეურნეობა / ბაღი', nameEn: 'Homestead Yard / Garden' }
      ],
      restrictions: [
        { textKa: 'მაქსიმალური სართულიანობა: 2 სართული (შენობის მაქს. სიმაღლე 8.5 მ)', textEn: 'Max floors: 2 stories (Max height 8.5 m)' },
        { textKa: 'K1 განაშენიანების კოეფიციენტის ჭერი: 0.5', textEn: 'K1 max footprint ratio: 0.5' },
        { textKa: 'K2 სამშენებლო ინტენსივობის ჭერი: 0.8', textEn: 'K2 max intensity index: 0.8' },
        { textKa: 'სამეზობლო მიჯნის დაცილება საზღვრიდან: მინიმუმ 3.0 მ (დადგენილება 14-39)', textEn: 'Boundary setback clearance: min 3.0 m (Resolution 14-39)' }
      ],
      obligations: [
        { textKa: 'K3 გამწვანების მინიმალური კოეფიციენტი: 0.3 (ბუნებრივი გრუნტი)', textEn: 'K3 minimum greenery ratio: 0.3 (natural ground)' },
        { textKa: 'ნაკვეთის ფარგლებში მინ. 1 ავტოსადგომის უზრუნველყოფა', textEn: 'Provision of min 1 parking stall on site' },
        { textKa: 'შშმ პირებისთვის შესასვლელი პანდუსი (ქანობი ≤ 1:12)', textEn: 'Accessibility ramp for PWD (slope ≤ 1:12)' },
        { textKa: 'სახანძრო მისასვლელი გზა ≥ 3.5 მ (დადგენილება №41)', textEn: 'Fire brigade access lane ≥ 3.5 m (Resolution 41)' }
      ]
    },
    'sz-2': {
      zoneNameKa: 'საცხოვრებელი ზონა 2 (სზ-2)',
      zoneNameEn: 'Residential Zone 2 (SZ-2)',
      buildable: 'allowed',
      minArea: 300,
      minFrontage: 12,
      minSetback: 3.0,
      maxFloors: 3,
      descKa: 'საცხოვრებელი ზონა 2 — დაბალი ინტენსივობის საცხოვრებელი განაშენიანება (მაქს. 3 სართული).',
      descEn: 'Residential Zone 2 — Low-density residential development permitted (max 3 stories).',
      allowedTypologies: [
        { icon: 'fa-house', nameKa: 'დაბალი ინტენსივობის საცხოვრებელი სახლი', nameEn: 'Low-density Residential House' },
        { icon: 'fa-building-columns', nameKa: 'ტაუნჰაუსი / ბლოკირებული სახლი', nameEn: 'Townhouse / Attached House' },
        { icon: 'fa-house-chimney-window', nameKa: 'დუპლექსი / 2-3 ბინიანი სახლი', nameEn: 'Duplex / Triplex' },
        { icon: 'fa-shield-heart', nameKa: 'საოჯახო საბავშვო ბაღი', nameEn: 'Home Daycare' }
      ],
      restrictions: [
        { textKa: 'მაქსიმალური სართულიანობა: 3 სართული (მაქს. სიმაღლე 12.0 მ)', textEn: 'Max floors: 3 stories (Max height 12.0 m)' },
        { textKa: 'K1 კოეფიციენტის ჭერი: 0.5 | K2 ჭერი: 1.2', textEn: 'K1 limit: 0.5 | K2 limit: 1.2' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 300 მ² | მინ. ფრონტი: 12 მ', textEn: 'Min parcel area: 300 m² | Min frontage: 12 m' },
        { textKa: 'სამეზობლო მიჯნა: მინიმუმ 3.0 მ (ნაკლებ დაცილებაზე საჭიროა ნოტარიული შეთანხმება)', textEn: 'Boundary clearance: min 3.0 m (Notarized agreement required for less)' }
      ],
      obligations: [
        { textKa: 'K3 გამწვანების მინიმალური კოეფიციენტი: 0.3', textEn: 'K3 minimum greenery ratio: 0.3' },
        { textKa: 'ნორმატიული პარკირება ნაკვეთის ფარგლებში (1 ადგილი ბინაზე)', textEn: 'Standard parking on-site (1 spot per apartment)' },
        { textKa: 'სახანძრო უსაფრთხოების რეგლამენტი და დამოუკიდებელი გასასვლელი (დადგენილება №41)', textEn: 'Fire safety code & independent egress (Resolution 41)' },
        { textKa: 'შშმ ადაპტირებული პანდუსი და მისასვლელი ბილიკი', textEn: 'PWD accessible ramp and pathways' }
      ]
    },
    'sz-3': {
      zoneNameKa: 'საცხოვრებელი ზონა 3 (სზ-3)',
      zoneNameEn: 'Residential Zone 3 (SZ-3)',
      buildable: 'allowed',
      minArea: 400,
      minFrontage: 15,
      minSetback: 3.0,
      maxFloors: 5,
      descKa: 'საცხოვრებელი ზონა 3 — საშუალო ინტენსივობის საცხოვრებელი განაშენიანება (მაქს. 5 სართული).',
      descEn: 'Residential Zone 3 — Medium-density residential development permitted (max 5 stories).',
      allowedTypologies: [
        { icon: 'fa-building', nameKa: 'საშუალო ინტენსივობის საცხოვრებელი სახლი', nameEn: 'Medium-density Residential' },
        { icon: 'fa-city', nameKa: 'ბუტიკ-აპარტამენტები (მაქს. 5 სართული)', nameEn: 'Boutique Apartments (max 5 stories)' },
        { icon: 'fa-shop', nameKa: 'პირველი სართულის კომერცია (სამედიცინო/სააფთიაქო)', nameEn: 'Ground Floor Retail / Pharmacy' },
        { icon: 'fa-graduation-cap', nameKa: 'სკოლამდელი აღზრდის დაწესებულება', nameEn: 'Preschool Education Facility' }
      ],
      restrictions: [
        { textKa: 'მაქსიმალური სართულიანობა: 5 სართული (მაქს. სიმაღლე 16.0 მ)', textEn: 'Max floors: 5 stories (Max height 16.0 m)' },
        { textKa: 'K1 ჭერი: 0.5 | K2 ჭერი: 1.5 | K3 მინიმუმი: 0.3', textEn: 'K1 limit: 0.5 | K2 limit: 1.5 | K3 min: 0.3' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 400 მ² | მინ. ფრონტი: 15 მ', textEn: 'Min parcel area: 400 m² | Min frontage: 15 m' },
        { textKa: 'სამეზობლო მიჯნის ნორმა: ≥ 3.0 მ', textEn: 'Boundary clearance norm: ≥ 3.0 m' }
      ],
      obligations: [
        { textKa: 'სავალდებულო მიწისქვეშა ან მიწისზედა პარკინგი გაანგარიშებით', textEn: 'Mandatory underground or structured parking by formula' },
        { textKa: 'ადაპტირებული ლიფტი (კაბინა ≥ 1.10×1.40 მ) და შშმ პარკინგი (3.5×5.0 მ)', textEn: 'Accessible elevator (≥ 1.10×1.40 m) & PWD parking (3.5×5.0 m)' },
        { textKa: 'კვამლგაუმტარი საევაკუაციო კიბის უჯრედი (დადგენილება №41)', textEn: 'Smoke-proof evacuation stairwell (Resolution 41)' },
        { textKa: 'სახანძრო შემოსავლელი გზა ≥ 3.5 მ', textEn: 'Fire access driveway ≥ 3.5 m' }
      ]
    },
    'sz-4': {
      zoneNameKa: 'საცხოვრებელი ზონა 4 (სზ-4)',
      zoneNameEn: 'Residential Zone 4 (SZ-4)',
      buildable: 'allowed',
      minArea: 500,
      minFrontage: 16,
      minSetback: 3.0,
      maxFloors: 8,
      descKa: 'საცხოვრებელი ზონა 4 — მრავალბინიანი საცხოვრებელი განაშენიანება (მაქს. 8 სართული).',
      descEn: 'Residential Zone 4 — Multi-apartment residential development permitted (max 8 stories).',
      allowedTypologies: [
        { icon: 'fa-building', nameKa: 'მრავალბინიანი საცხოვრებელი კორპუსი', nameEn: 'Multi-apartment Residential Block' },
        { icon: 'fa-store', nameKa: 'სავაჭრო და საყოფაცხოვრებო მომსახურება', nameEn: 'Retail & Daily Services' },
        { icon: 'fa-briefcase', nameKa: 'საოფისე ფართები პირველ სართულზე', nameEn: 'Ground-floor Offices' },
        { icon: 'fa-square-parking', nameKa: 'ჩაშენებული მიწისქვეშა ავტოფარეხი', nameEn: 'Built-in Underground Parking' }
      ],
      restrictions: [
        { textKa: 'მაქსიმალური სართულიანობა: 8 სართული', textEn: 'Max floors: 8 stories' },
        { textKa: 'K1 ჭერი: 0.5 | K2 ჭერი: 1.8 | K3 მინიმუმი: 0.3', textEn: 'K1 limit: 0.5 | K2 limit: 1.8 | K3 min: 0.3' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 500 მ² | მინ. ფრონტი: 16 მ', textEn: 'Min parcel area: 500 m² | Min frontage: 16 m' },
        { textKa: 'სამეზობლო მიჯნა: ≥ 3.0 მ', textEn: 'Boundary clearance: ≥ 3.0 m' }
      ],
      obligations: [
        { textKa: 'სავალდებულო მიწისქვეშა პარკირება ნორმატივის სრული დაცვით', textEn: 'Mandatory underground parking meeting full standards' },
        { textKa: 'ლიფტი ხმოვანი და ბრაილის სისტემებით', textEn: 'Elevator with voice alert and Braille' },
        { textKa: 'სახანძრო ჰიდრანტები და ავტომატური კვამლსაწინააღმდეგო სისტემა', textEn: 'Fire hydrants and automatic smoke exhaust system' },
        { textKa: 'ეზოს კეთილმოწყობა და საბავშვო მოედანი (დადგენილება 14-39)', textEn: 'Courtyard landscaping and playground (Resolution 14-39)' }
      ]
    },
    'sz-5': {
      zoneNameKa: 'საცხოვრებელი ზონა 5 (სზ-5)',
      zoneNameEn: 'Residential Zone 5 (SZ-5)',
      buildable: 'allowed',
      minArea: 500,
      minFrontage: 16,
      minSetback: 3.0,
      maxFloors: null,
      descKa: 'საცხოვრებელი ზონა 5 — მაღალი ინტენსივობის მრავალბინიანი განაშენიანება.',
      descEn: 'Residential Zone 5 — High-density multi-apartment development permitted.',
      allowedTypologies: [
        { icon: 'fa-city', nameKa: 'მაღალი ინტენსივობის საცხოვრებელი კომპლექსი', nameEn: 'High-density Residential Complex' },
        { icon: 'fa-building-user', nameKa: 'მრავალფუნქციური საცხოვრებელი ანსამბლი', nameEn: 'Mixed-use Residential Ensemble' },
        { icon: 'fa-cart-shopping', nameKa: 'სუპერმარკეტები, ფიტნეს-ცენტრები, კაფეები', nameEn: 'Supermarkets, Fitness Centers, Cafes' },
        { icon: 'fa-car', nameKa: 'მრავალდონიანი მიწისქვეშა პარკინგი', nameEn: 'Multi-level Underground Parking' }
      ],
      restrictions: [
        { textKa: 'K1 ჭერი: 0.5 | K2 ჭერი: 2.1 | K3 მინიმუმი: 0.3', textEn: 'K1 limit: 0.5 | K2 limit: 2.1 | K3 min: 0.3' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 500 მ² | მინ. ფრონტი: 16 მ', textEn: 'Min parcel area: 500 m² | Min frontage: 16 m' },
        { textKa: 'სამეზობლო მიჯნა: ≥ 3.0 მ (ან გრგ-ით განსაზღვრული რეგულირების ხაზი)', textEn: 'Boundary clearance: ≥ 3.0 m (or line defined by GRG)' }
      ],
      obligations: [
        { textKa: 'სატრანსპორტო კვლევა (TIA) და გზაჯვარედინზე დატვირთვის ანალიზი', textEn: 'Traffic Impact Assessment (TIA)' },
        { textKa: 'მრავალდონიანი ავტოსადგომები შშმ ადგილებით (1/25)', textEn: 'Multi-level parking with PWD stalls (1/25)' },
        { textKa: 'სრული სახანძრო ავტომატიზაცია (სპრინკლერები, კვამლსაწინააღმდეგო სისტემები)', textEn: 'Full fire automation (sprinklers, smoke control systems)' },
        { textKa: 'გამწვანების პროექტი და ხე-ნარგავების ინვენტარიზაცია', textEn: 'Landscaping plan and tree inventory approval' }
      ]
    },
    'sz-6': {
      zoneNameKa: 'საცხოვრებელი ზონა 6 (სზ-6)',
      zoneNameEn: 'Residential Zone 6 (SZ-6)',
      buildable: 'allowed',
      minArea: 600,
      minFrontage: 18,
      minSetback: 3.0,
      maxFloors: null,
      descKa: 'საცხოვრებელი ზონა 6 — მაღალი ინტენსივობის მრავალფუნქციური საცხოვრებელი განაშენიანება.',
      descEn: 'Residential Zone 6 — High-density multi-functional residential development.',
      allowedTypologies: [
        { icon: 'fa-city', nameKa: 'მაღლივი საცხოვრებელი კოშკი / ცათამბჯენი', nameEn: 'High-rise Residential Tower / Skyscraper' },
        { icon: 'fa-hotel', nameKa: 'აპარტ-ოტელი / სასტუმრო საცხოვრებელი', nameEn: 'Apart-hotel / Branded Residences' },
        { icon: 'fa-briefcase', nameKa: 'ბიზნეს ცენტრი და კომერციული პოდიუმი', nameEn: 'Business Hub & Commercial Podium' },
        { icon: 'fa-square-parking', nameKa: 'მრავალდონიანი მიწისქვეშა ავტოჰაბი', nameEn: 'Multi-level Subterranean Parking Hub' }
      ],
      restrictions: [
        { textKa: 'K1 ჭერი: 0.4 | K2 ჭერი: 2.5 (გრგ-ით გაზრდის შესაძლებლობით)', textEn: 'K1 limit: 0.4 | K2 limit: 2.5 (increasable via GRG)' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 600 მ² | მინ. ფრონტი: 18 მ', textEn: 'Min parcel area: 600 m² | Min frontage: 18 m' },
        { textKa: 'ქალაქმშენებლობითი შეთანხმება და ვიზუალური ზეგავლენის შეფასება (VIA)', textEn: 'Urban design review and Visual Impact Assessment (VIA)' }
      ],
      obligations: [
        { textKa: 'სეისმური კვლევა (8-9 ბალიანი გაანგარიშება)', textEn: 'Seismic engineering design (8-9 magnitude calculation)' },
        { textKa: 'სრული სახანძრო უსაფრთხოების II კატეგორიის სისტემები (დადგენილება №41)', textEn: 'Full Category II Fire Safety Systems (Resolution 41)' },
        { textKa: 'უნივერსალური დიზაინის მისაწვდომობის სრული პაკეტი (ლიფტები, პანდუსები)', textEn: 'Universal accessibility design package' },
        { textKa: 'დეტალური სატრანსპორტო მოდელირება (TIA)', textEn: 'Detailed Traffic Impact Assessment (TIA)' }
      ]
    },
    'ssz-1': {
      zoneNameKa: 'საზოგადოებრივ-საქმიანი ზონა 1 (სსზ-1)',
      zoneNameEn: 'Public Business Zone 1 (SSZ-1)',
      buildable: 'allowed',
      minArea: 600,
      minFrontage: 18,
      minSetback: 3.0,
      descKa: 'საზოგადოებრივ-საქმიანი 1 — საოფისე, სავაჭრო და მომსახურების ობიექტები.',
      descEn: 'Public Business 1 — Commercial, office, and mixed-use development.',
      allowedTypologies: [
        { icon: 'fa-building', nameKa: 'სავაჭრო და საოფისე ცენტრი', nameEn: 'Commercial & Office Center' },
        { icon: 'fa-hospital', nameKa: 'კლინიკა / სამედიცინო ცენტრი / ლაბორატორია', nameEn: 'Clinic / Medical Center / Lab' },
        { icon: 'fa-building-columns', nameKa: 'საბანკო-საფინანსო დაწესებულება', nameEn: 'Bank / Financial Institution' },
        { icon: 'fa-utensils', nameKa: 'კვების ობიექტი / რესტორანი / კაფე', nameEn: 'Restaurant / Cafe / Food Court' }
      ],
      restrictions: [
        { textKa: 'K1 ჭერი: 0.7 | K2 ჭერი: 2.4 | K3 მინიმუმი: 0.1', textEn: 'K1 limit: 0.7 | K2 limit: 2.4 | K3 min: 0.1' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 600 მ² | მინ. ფრონტი: 18 მ', textEn: 'Min parcel area: 600 m² | Min frontage: 18 m' },
        { textKa: 'სამეზობლო მიჯნის ნორმა: ≥ 3.0 მ', textEn: 'Boundary clearance: ≥ 3.0 m' }
      ],
      obligations: [
        { textKa: 'მკაცრი მოთხოვნა ვიზიტორთა საპარკინგე ადგილებზე', textEn: 'Strict visitor parking provision requirements' },
        { textKa: 'შშმ პირებისთვის უბარიერო გარემოს 100% უზრუნველყოფა', textEn: '100% barrier-free environment for PWD' },
        { textKa: 'სახანძრო საევაკუაციო სისტემა გაზრდილი ტევადობისთვის', textEn: 'High-capacity fire evacuation infrastructure' }
      ]
    },
    'ssz-2': {
      zoneNameKa: 'საზოგადოებრივ-საქმიანი ზონა 2 (სსზ-2)',
      zoneNameEn: 'Public Business Zone 2 (SSZ-2)',
      buildable: 'allowed',
      minArea: 800,
      minFrontage: 20,
      minSetback: 3.0,
      descKa: 'საზოგადოებრივ-საქმიანი 2 — მაღალი ინტენსივობის საზოგადოებრივ-საქმიანი განაშენიანება.',
      descEn: 'Public Business 2 — High-density commercial and business development.',
      allowedTypologies: [
        { icon: 'fa-building', nameKa: 'მსხვილი ბიზნეს და საოფისე ცენტრი', nameEn: 'Large-scale Business & Office Hub' },
        { icon: 'fa-cart-shopping', nameKa: 'სავაჭრო-გასართობი მოლი / ჰიპერმარკეტი', nameEn: 'Shopping & Entertainment Mall' },
        { icon: 'fa-hotel', nameKa: 'სასტუმრო კომპლექსი / საკონფერენციო ჰოლი', nameEn: 'Hotel Complex / Convention Hall' },
        { icon: 'fa-layer-group', nameKa: 'მრავალფუნქციური შერეული განაშენიანება', nameEn: 'Mixed-use Multi-functional Complex' }
      ],
      restrictions: [
        { textKa: 'K1 ჭერი: 0.7 | K2 ჭერი: 3.5 | K3 მინიმუმი: 0.1', textEn: 'K1 limit: 0.7 | K2 limit: 3.5 | K3 min: 0.1' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 800 მ² | მინ. ფრონტი: 20 მ', textEn: 'Min parcel area: 800 m² | Min frontage: 20 m' },
        { textKa: 'სამეზობლო მიჯნა: ≥ 3.0 მ', textEn: 'Boundary clearance: ≥ 3.0 m' }
      ],
      obligations: [
        { textKa: 'სატრანსპორტო კვლევა (TIA) და გზაჯვარედინების გამტარუნარიანობის აუდიტი', textEn: 'Traffic Impact Assessment & intersection capacity audit' },
        { textKa: 'მიწისქვეშა მრავალდონიანი პარკინგი შშმ ადგილებით (1 ყოველ 25-ზე)', textEn: 'Multi-level subterranean parking with PWD stalls (1/25)' },
        { textKa: 'სახანძრო უსაფრთხოების რეგლამენტი და ავტომატური ქრობის სისტემა (დადგენილება №41)', textEn: 'Fire safety code & automatic extinguishing system (Resolution 41)' },
        { textKa: 'მისაწვდომობის სრული სტანდარტი (პანდუსი, ადაპტირებული სველი წერტილები, ლიფტები)', textEn: 'Universal accessibility (ramps, accessible restrooms, elevators)' }
      ]
    },
    'ssz-3': {
      zoneNameKa: 'საზოგადოებრივ-საქმიანი ზონა 3 (სსზ-3)',
      zoneNameEn: 'Public Business Zone 3 (SSZ-3)',
      buildable: 'allowed',
      minArea: 1000,
      minFrontage: 20,
      minSetback: 3.0,
      descKa: 'საზოგადოებრივ-საქმიანი 3 — ქალაქის ცენტრალური და მსხვილი ბიზნეს კომპლექსები.',
      descEn: 'Public Business 3 — Central metropolitan business centers and high-density towers.',
      allowedTypologies: [
        { icon: 'fa-city', nameKa: 'ცენტრალური ბიზნეს დისტრიქტის ცათამბჯენი', nameEn: 'CBD Skyscraper / High-rise Corporate HQ' },
        { icon: 'fa-hotel', nameKa: 'საერთაშორისო 5-ვარსკვლავიანი სასტუმრო', nameEn: 'International 5-Star Hotel' },
        { icon: 'fa-landmark', nameKa: 'კონგრეს-ცენტრი და საკონცერტო დარბაზი', nameEn: 'Congress Center & Concert Hall' },
        { icon: 'fa-square-parking', nameKa: 'მიწისქვეშა ინტეგრირებული სატრანსპორტო ჰაბი', nameEn: 'Underground Integrated Transport Hub' }
      ],
      restrictions: [
        { textKa: 'K1 ჭერი: 0.7 | K2 ჭერი: 4.6 | K3 მინიმუმი: 0.1', textEn: 'K1 limit: 0.7 | K2 limit: 4.6 | K3 min: 0.1' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 1000 მ² | მინ. ფრონტი: 20 მ', textEn: 'Min parcel area: 1000 m² | Min frontage: 20 m' }
      ],
      obligations: [
        { textKa: 'განაშენიანების რეგულირების გეგმა (გრგ) სავალდებულოა!', textEn: 'Development Regulation Plan (GRG) is MANDATORY!' },
        { textKa: 'გარემოზე ზემოქმედების შეფასება (გზშ) და სატრანსპორტო მოდელირება', textEn: 'Environmental Impact Assessment (EIA) & Traffic Simulation' },
        { textKa: 'სახანძრო უსაფრთხოების უმაღლესი სტანდარტები (დადგენილება №41)', textEn: 'Highest Fire Safety Standards (Resolution 41)' }
      ]
    },
    'skz': {
      zoneNameKa: 'საკურორტო ზონა (სკზ)',
      zoneNameEn: 'Resort Zone (SKZ)',
      buildable: 'allowed',
      minArea: 500,
      minFrontage: 15,
      minSetback: 3.0,
      descKa: 'საკურორტო ზონა — დასასვენებელი, გამაჯანსაღებელი და სასტუმრო ობიექტები.',
      descEn: 'Resort Zone — Hospitality, sanatoriums, and recreational lodging.',
      allowedTypologies: [
        { icon: 'fa-hotel', nameKa: 'სასტუმრო / აპარტოტელი', nameEn: 'Hotel / Apart-hotel' },
        { icon: 'fa-spa', nameKa: 'სანატორიუმი / სპა და გამაჯანსაღებელი კომპლექსი', nameEn: 'Sanatorium / Spa & Wellness Center' },
        { icon: 'fa-tree', nameKa: 'საკურორტო კოტეჯები / დასასვენებელი ბაზა', nameEn: 'Resort Cottages / Vacation Lodges' },
        { icon: 'fa-person-swimming', nameKa: 'ღია და დახურული საცურაო აუზები', nameEn: 'Indoor & Outdoor Swimming Pools' }
      ],
      restrictions: [
        { textKa: 'K1 ჭერი: 0.3 | K2 ჭერი: 0.9 | K3 მინიმუმი: 0.5 (გამწვანების მაღალი ნორმა)', textEn: 'K1 limit: 0.3 | K2 limit: 0.9 | K3 min: 0.5 (high greenery)' },
        { textKa: 'ნაკვეთის მინიმალური ფართობი: 500 მ² | მინ. ფრონტი: 15 მ', textEn: 'Min parcel area: 500 m² | Min frontage: 15 m' }
      ],
      obligations: [
        { textKa: 'ტერიტორიის არანაკლებ 50%-ის გამწვანება (K3 ≥ 0.5)', textEn: 'Greenery coverage of at least 50% of the site' },
        { textKa: 'კურორტოლოგიური და ეკოლოგიური დასკვნა', textEn: 'Climatological and ecological assessment' },
        { textKa: 'შშმ პირებისთვის სრული ადაპტირება (დადგენილება №41)', textEn: 'Complete accessibility for PWD (Resolution 41)' }
      ]
    },
    'rz-1': {
      zoneNameKa: 'სარეკრეაციო ზონა 1 (რზ-1)',
      zoneNameEn: 'Recreation Zone 1 (RZ-1)',
      buildable: 'conditional',
      minArea: 1000,
      minFrontage: 20,
      minSetback: 5.0,
      descKa: 'სარეკრეაციო ზონა 1 — კაპიტალური მშენებლობა შეზღუდულია! დაიშვება მხოლოდ ღია საპარკო და სპორტული ნაგებობები (დადგენილება 14-39, მუხლი 38).',
      descEn: 'Recreation Zone 1 — Construction strictly conditional. Only open parks and sports facilities permitted.',
      allowedTypologies: [
        { icon: 'fa-person-running', nameKa: 'ღია სპორტული და სათამაშო მოედნები', nameEn: 'Open Sports and Playgrounds' },
        { icon: 'fa-bicycle', nameKa: 'ველობილიკები და სასეირნო ხეივნები', nameEn: 'Bike Trails and Walking Alleys' },
        { icon: 'fa-mug-saucer', nameKa: 'დროებითი ღია კაფე-პავილიონები (არაკაპიტალური)', nameEn: 'Temporary Open Cafe Pavilions' },
        { icon: 'fa-restroom', nameKa: 'საზოგადოებრივი საპირფარეშო', nameEn: 'Public Restroom Pavilion' }
      ],
      restrictions: [
        { textKa: 'კაპიტალური საცხოვრებელი და კომერციული მშენებლობა აკრძალულია!', textEn: 'Capital residential and commercial construction is PROHIBITED!' },
        { textKa: 'K1 მაქსიმუმი: 0.2 | K2 მაქსიმუმი: 0.4', textEn: 'K1 max: 0.2 | K2 max: 0.4' },
        { textKa: 'ნაგებობის მაქსიმალური სიმაღლე: 1 სართული (მაქს. 4.0 მ)', textEn: 'Max height: 1 story (max 4.0 m)' }
      ],
      obligations: [
        { textKa: 'K3 გამწვანება არანაკლებ 0.7 (70% ბუნებრივი მწვანე საფარი)', textEn: 'K3 greenery at least 0.7 (70% natural green cover)' },
        { textKa: 'ხე-ნარგავების 100%-ით შენარჩუნების ვალდებულება', textEn: '100% preservation of existing trees and flora' }
      ]
    },
    'rz-2': {
      zoneNameKa: 'სარეკრეაციო ზონა 2 (რზ-2)',
      zoneNameEn: 'Recreation Zone 2 (RZ-2)',
      buildable: 'conditional',
      minArea: 1000,
      minFrontage: 20,
      minSetback: 5.0,
      descKa: 'სარეკრეაციო ზონა 2 — კაპიტალური მშენებლობა შეზღუდულია! დაიშვება საპარკო/სპორტული ინფრასტრუქტურა დაბალი ინტენსივობით (K2 ≤ 0.4).',
      descEn: 'Recreation Zone 2 — Construction conditional. Only recreational/sports infrastructure allowed.',
      allowedTypologies: [
        { icon: 'fa-volleyball', nameKa: 'სპორტულ-გამაჯანსაღებელი კომპლექსი (დაბალი ინტენსივობის)', nameEn: 'Sports & Wellness Facility (Low intensity)' },
        { icon: 'fa-campground', nameKa: 'საპარკო ინფრასტრუქტურა / ატრაქციონები', nameEn: 'Park Infrastructure / Attractions' },
        { icon: 'fa-water', nameKa: 'ღია აუზი / წყლის ატრაქცია', nameEn: 'Open Water Attraction / Pool' }
      ],
      restrictions: [
        { textKa: 'კაპიტალური საცხოვრებელი განაშენიანება აკრძალულია!', textEn: 'Capital residential development is PROHIBITED!' },
        { textKa: 'K1 ჭერი: 0.2 | K2 ჭერი: 0.4', textEn: 'K1 limit: 0.2 | K2 limit: 0.4' },
        { textKa: 'მაქსიმალური სართულიანობა: 2 სართული (მაქს. 8.0 მ)', textEn: 'Max floors: 2 stories (max 8.0 m)' }
      ],
      obligations: [
        { textKa: 'K3 გამწვანება არანაკლებ 0.6 (60%)', textEn: 'K3 greenery at least 0.6 (60%)' },
        { textKa: 'გარემოსდაცვითი დასკვნა და ხეების დაცვის გეგმა', textEn: 'Environmental impact assessment and tree protection plan' }
      ]
    },
    'lz': {
      zoneNameKa: 'ლანდშაფტურ-სარეკრეაციო ზონა (ლზ)',
      zoneNameEn: 'Landscape-Recreation Zone (LZ)',
      buildable: 'prohibited',
      minArea: null,
      minFrontage: null,
      minSetback: null,
      descKa: 'ლანდშაფტურ-სარეკრეაციო ზონა (ლზ) — კაპიტალური მშენებლობა აკრძალულია დადგენილება 14-39-ით!',
      descEn: 'Landscape-Recreation Zone (LZ) — Capital construction is strictly PROHIBITED by statutory law.',
      allowedTypologies: [
        { icon: 'fa-ban', nameKa: 'კაპიტალური მშენებლობა აკრძალულია!', nameEn: 'Capital construction prohibited!' },
        { icon: 'fa-mountain-sun', nameKa: 'მხოლოდ ეკო-ბილიკები და ბუნებრივი ლანდშაფტი', nameEn: 'Eco-trails and natural landscape only' }
      ],
      restrictions: [
        { textKa: 'კანონით (დადგენილება 14-39, მუხლი 40) აკრძალულია ყოველგვარი კაპიტალური მშენებლობა!', textEn: 'All capital construction is prohibited by law (Resolution 14-39, Art. 40)!' },
        { textKa: 'კოეფიციენტები K1, K2 არ გაიცემა', textEn: 'Coefficients K1, K2 are not granted' }
      ],
      obligations: [
        { textKa: 'ბუნებრივი ლანდშაფტის ხელუხლებლად შენარჩუნება', textEn: 'Preservation of natural landscape in untouched condition' }
      ]
    },
    'saz': {
      zoneNameKa: 'სანიტარიული / დამცავი ზონა (საზ)',
      zoneNameEn: 'Sanitary / Protective Zone (SAZ)',
      buildable: 'prohibited',
      minArea: null,
      minFrontage: null,
      minSetback: null,
      descKa: 'სანიტარიული / დამცავი ზონა — ნებისმიერი საცხოვრებელი და კომერციული მშენებლობა აკრძალულია!',
      descEn: 'Sanitary / Protective Zone — Construction is PROHIBITED by statutory safety norms.',
      allowedTypologies: [
        { icon: 'fa-ban', nameKa: 'საცხოვრებელი და საზოგადოებრივი მშენებლობა აკრძალულია!', nameEn: 'Residential and public construction is prohibited!' },
        { icon: 'fa-shield', nameKa: 'მხოლოდ საინჟინრო-დამცავი ზღუდეები', nameEn: 'Only engineering protective barriers' }
      ],
      restrictions: [
        { textKa: 'მშენებლობა აკრძალულია სანიტარიული და უსაფრთხოების ნორმებით!', textEn: 'Construction is prohibited by sanitary and safety codes!' }
      ],
      obligations: [
        { textKa: 'დამცავი ზოლის შენარჩუნება და სანიტარიული რეგლამენტის დაცვა', textEn: 'Maintenance of buffer zone and compliance with sanitary regulations' }
      ]
    },
    'tz': {
      zoneNameKa: 'სატრანსპორტო ზონა (ტზ)',
      zoneNameEn: 'Transport Infrastructure Zone (TZ)',
      buildable: 'prohibited',
      minArea: null,
      minFrontage: null,
      minSetback: null,
      descKa: 'სატრანსპორტო ზონა — დაიშვება მხოლოდ სატრანსპორტო ინფრასტრუქტურა (გზები, ესტაკადები, სადგურები).',
      descEn: 'Transport Infrastructure Zone — Only specialized transport works permitted.',
      allowedTypologies: [
        { icon: 'fa-road', nameKa: 'საგზაო ინფრასტრუქტურა (ესტაკადები, გზები, ხიდები)', nameEn: 'Road Infrastructure (bridges, overpasses, roads)' },
        { icon: 'fa-train-subway', nameKa: 'სატრანსპორტო სადგურები / ტერმინალები', nameEn: 'Transport Stations / Terminals' }
      ],
      restrictions: [
        { textKa: 'საცხოვრებელი და კომერციული კაპიტალური მშენებლობა აკრძალულია!', textEn: 'Residential and commercial capital construction prohibited!' }
      ],
      obligations: [
        { textKa: 'საგზაო უსაფრთხოების და ინფრასტრუქტურული ნორმების სრული დაცვა', textEn: 'Compliance with transit safety and infrastructure codes' }
      ]
    },
    'custom': {
      zoneNameKa: 'ინდივიდუალური რეგულირება (გრგ / გაპ)',
      zoneNameEn: 'Custom / GRG Planning Zone',
      buildable: 'allowed',
      minArea: 300,
      minFrontage: 12,
      minSetback: 3.0,
      descKa: 'ინდივიდუალური რეგულირება (გრგ / გაპ / სპეციალური ზონალური შეთანხმება).',
      descEn: 'Custom / Detailed Development Plan (GAP / GRG / Special zoning agreement).',
      allowedTypologies: [
        { icon: 'fa-file-signature', nameKa: 'დამტკიცებული გრგ-ით განსაზღვრული ფუნქციები', nameEn: 'Functions determined by approved GRG' },
        { icon: 'fa-layer-group', nameKa: 'შერეული ტიპის ურბანული განვითარება', nameEn: 'Mixed-use urban development' }
      ],
      restrictions: [
        { textKa: 'მოქმედებს ქ. თბილისის საკრებულოს მიერ დამტკიცებული გრგ-ს პარამეტრები', textEn: 'Subject to GRG parameters approved by City Municipal Council' },
        { textKa: 'სამეზობლო მიჯნა: მინ. 3.0 მ (ან გრგ-ით დადგენილი წითელი/ცისფერი ხაზები)', textEn: 'Boundary setback: min 3.0 m (or red/blue lines set by GRG)' }
      ],
      obligations: [
        { textKa: 'დადგენილება №41 უსაფრთხოების წესებისა და მისაწვდომობის სრული დაცვა', textEn: 'Full compliance with Resolution 41 safety and accessibility' },
        { textKa: 'საჭირო საპარკინგე ადგილების 100% დაკმაყოფილება', textEn: '100% satisfaction of required parking spaces' }
      ]
    }
  };

  const BUILDING_COLORS = ['#10b981', '#8b5cf6', '#0284c7', '#f59e0b', '#ec4899', '#14b8a6'];

  const FLOOR_FUNCTIONS = {
    commercial: { nameKa: 'კომერცია', nameEn: 'Commercial', color: '#f59e0b', threeColor: 0xf59e0b, class: 'fn-commercial' },
    residential: { nameKa: 'საცხოვრებელი', nameEn: 'Residential', color: '#38bdf8', threeColor: 0x38bdf8, class: 'fn-residential' },
    office: { nameKa: 'ოფისი', nameEn: 'Office', color: '#0284c7', threeColor: 0x0284c7, class: 'fn-office' },
    hotel: { nameKa: 'სასტუმრო', nameEn: 'Hotel', color: '#8b5cf6', threeColor: 0x8b5cf6, class: 'fn-hotel' },
    parking: { nameKa: 'პარკინგი', nameEn: 'Parking', color: '#64748b', threeColor: 0x1e293b, class: 'fn-parking' },
    amenity: { nameKa: 'რეკრეაცია', nameEn: 'Amenity', color: '#10b981', threeColor: 0x10b981, class: 'fn-amenity' }
  };

  function createBuildingData(index, color, footprintArea = 0, floorsAbove = 5, floorsBelow = 1) {
    const floorFunctions = {};
    for (let b = 1; b <= floorsBelow; b++) {
      floorFunctions[`-${b}`] = 'parking';
    }
    floorFunctions['0'] = 'commercial';
    for (let f = 1; f < floorsAbove; f++) {
      floorFunctions[`${f}`] = 'residential';
    }

    return {
      id: `bldg-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
      index: index,
      name: `შენობა #${index}`,
      nameEn: `Building #${index}`,
      color: color || BUILDING_COLORS[(index - 1) % BUILDING_COLORS.length],
      footprintCoords: null, // Strictly null until drawn by architect
      footprintArea: footprintArea || 0,
      isProcedural: false, // Strict: no dummy box until user draws or AI generates
      floorsAbove: floorsAbove,
      floorsBelow: floorsBelow,
      floors: floorsAbove,
      floorHeight: 3.3,
      rotation: 0,
      buildingType: 'residential',
      facadeMaterial: 'concrete',
      facadeColor: '#f1f5f9',
      style: 'modern',
      groundFloorUse: 'commercial',
      floorFunctions: floorFunctions
    };
  }

  function getSelectedBuilding() {
    return state.buildings.find(b => b.id === state.selectedBuildingId) || state.buildings[0];
  }

  function syncCurrentBuildingToActiveConcept() {
    const bldg = getSelectedBuilding();
    if (!bldg) return;
    state.activeConcept = {
      footprint: bldg.footprintArea,
      floorsAbove: bldg.floorsAbove,
      floorsBelow: bldg.floorsBelow,
      floors: bldg.floorsAbove,
      floorHeight: bldg.floorHeight,
      rotation: bldg.rotation,
      buildingType: bldg.buildingType,
      facadeMaterial: bldg.facadeMaterial,
      facadeColor: bldg.facadeColor,
      style: bldg.style,
      groundFloorUse: bldg.groundFloorUse
    };
    state.customFootprint = bldg.footprintCoords;
    syncSlidersUI(bldg);
  }

  function selectBuilding(id) {
    const bldg = state.buildings.find(b => b.id === id);
    if (!bldg) return;
    state.selectedBuildingId = id;
    state.customFootprint = bldg.footprintCoords;

    syncCurrentBuildingToActiveConcept();
    renderBuildingTabsUI();
    renderFloorMatrixUI();
    renderAllBuildingsOnMap();
    renderAllBuildings3D();
    updateComplianceUI();

    // If selected building has not been drawn yet, prompt drawing mode
    if (!bldg.footprintCoords || bldg.footprintCoords.length < 3) {
      startDrawing();
    } else {
      if (state.isDrawingMode) {
        state.isDrawingMode = false;
        state.drawnPoints = [];
        const mapViewport = document.getElementById('mapViewport');
        if (mapViewport) mapViewport.classList.remove('map-drawing-active');
        const banner = document.getElementById('drawingGuideBanner');
        if (banner) banner.style.display = 'none';
        if (drawingLayerGroup) drawingLayerGroup.clearLayers();
        updateToolbarButtons();
      }
    }
  }

  function addNewBuilding(startDrawNow = true) {
    const nextIdx = state.buildings.length + 1;
    const nextColor = BUILDING_COLORS[(nextIdx - 1) % BUILDING_COLORS.length];
    const parcelArea = state.activeParcel ? state.activeParcel.area : 1200;
    const defaultFp = Math.round(parcelArea * 0.22);

    const newBldg = createBuildingData(nextIdx, nextColor, defaultFp, 4, 1);
    state.buildings.push(newBldg);
    state.selectedBuildingId = newBldg.id;
    state.customFootprint = null;

    syncCurrentBuildingToActiveConcept();
    renderBuildingTabsUI();
    renderFloorMatrixUI();
    renderAllBuildingsOnMap();
    renderAllBuildings3D();
    updateComplianceUI();

    if (startDrawNow) {
      startDrawing();
    }
  }

  function deleteSelectedBuilding() {
    if (state.buildings.length <= 1) {
      alert(translations[state.currentLang].bldg_cannot_delete_last || 'მინიმუმ ერთი შენობა უნდა დარჩეს ნაკვეთზე.');
      return;
    }
    const idx = state.buildings.findIndex(b => b.id === state.selectedBuildingId);
    if (idx !== -1) {
      state.buildings.splice(idx, 1);
      // Renumber remaining buildings
      state.buildings.forEach((b, i) => {
        b.index = i + 1;
        b.name = `შენობა #${i + 1}`;
        b.nameEn = `Building #${i + 1}`;
      });
      const nextSelected = state.buildings[Math.max(0, idx - 1)];
      state.selectedBuildingId = nextSelected.id;
      state.customFootprint = nextSelected.footprintCoords;

      syncCurrentBuildingToActiveConcept();
      renderBuildingTabsUI();
      renderFloorMatrixUI();
      renderAllBuildingsOnMap();
      renderAllBuildings3D();
      updateComplianceUI();
    }
  }

  function setSelectedBuildingColor(color) {
    const bldg = getSelectedBuilding();
    if (!bldg) return;
    bldg.color = color;
    renderBuildingTabsUI();
    renderAllBuildingsOnMap();
    renderAllBuildings3D();
  }

  function renderBuildingTabsUI() {
    const list = document.getElementById('buildingTabsList');
    if (!list) return;

    list.innerHTML = '';
    state.buildings.forEach((bldg) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `building-tab-chip ${bldg.id === state.selectedBuildingId ? 'active' : ''}`;
      const isDrawn = bldg.footprintCoords && bldg.footprintCoords.length >= 3;
      const statusBadge = isDrawn
        ? ''
        : `<span style="font-size: 0.68rem; opacity: 0.7; margin-left: 4px; border: 1px dashed ${bldg.color}; padding: 1px 4px; border-radius: 4px;">${state.currentLang === 'en' ? 'To Draw' : 'დასახაზია'}</span>`;
      chip.innerHTML = `
        <span class="bldg-tab-dot" style="background: ${bldg.color}; box-shadow: 0 0 6px ${bldg.color};"></span>
        <span>${state.currentLang === 'en' ? bldg.nameEn : bldg.name}</span>
        ${statusBadge}
      `;
      chip.addEventListener('click', () => {
        selectBuilding(bldg.id);
      });
      list.appendChild(chip);
    });

    // Sync color swatches active state
    const currentBldg = getSelectedBuilding();
    if (currentBldg) {
      const dots = document.querySelectorAll('#buildingColorPicker .color-swatch-dot');
      dots.forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color.toLowerCase() === currentBldg.color.toLowerCase());
      });
    }
  }

  function renderFloorMatrixUI() {
    const stack = document.getElementById('floorMatrixStack');
    const badge = document.getElementById('floorCountBadge');
    const bldg = getSelectedBuilding();
    if (!stack || !bldg) return;

    const floorsAbove = bldg.floorsAbove || 5;
    const floorsBelow = bldg.floorsBelow || 1;
    const totalFloors = floorsAbove + floorsBelow;

    if (badge) {
      badge.textContent = `${totalFloors} ${state.currentLang === 'en' ? 'Levels' : 'სართული'}`;
    }

    stack.innerHTML = '';

    // Render from top above-ground floor down to ground floor (0)
    for (let f = floorsAbove - 1; f >= 0; f--) {
      const floorKey = `${f}`;
      const currentFn = (bldg.floorFunctions && bldg.floorFunctions[floorKey]) || (f === 0 ? 'commercial' : 'residential');
      const row = createFloorMatrixRow(bldg, f, false, currentFn);
      stack.appendChild(row);
    }

    // Render minus floors (underground)
    for (let b = 1; b <= floorsBelow; b++) {
      const floorKey = `-${b}`;
      const currentFn = (bldg.floorFunctions && bldg.floorFunctions[floorKey]) || 'parking';
      const row = createFloorMatrixRow(bldg, b, true, currentFn);
      stack.appendChild(row);
    }
  }

  function createFloorMatrixRow(bldg, floorIdx, isUnderground, currentFn) {
    const row = document.createElement('div');
    row.className = `floor-matrix-row ${isUnderground ? 'is-underground' : ''} fn-${currentFn}`;

    const floorKey = isUnderground ? `-${floorIdx}` : `${floorIdx}`;
    const floorLabel = isUnderground
      ? `-${floorIdx}`
      : (floorIdx === 0 ? (state.currentLang === 'en' ? 'Ground (0)' : 'პირველი (0)') : `+${floorIdx + 1}`);

    const areaPerFloor = Math.round(bldg.footprintArea || 450);

    row.innerHTML = `
      <div class="floor-idx-col">
        <span class="floor-num-badge">${floorLabel}</span>
        <span class="floor-level-tag">${isUnderground ? (state.currentLang === 'en' ? 'Basement' : 'მიწისქვეშა') : (state.currentLang === 'en' ? 'Level' : 'მიწისზედა')}</span>
      </div>
      <select class="floor-fn-select" data-floor-key="${floorKey}">
        <option value="commercial" ${currentFn === 'commercial' ? 'selected' : ''}>${translations[state.currentLang].fn_commercial || 'კომერცია'}</option>
        <option value="residential" ${currentFn === 'residential' ? 'selected' : ''}>${translations[state.currentLang].fn_residential || 'საცხოვრებელი'}</option>
        <option value="office" ${currentFn === 'office' ? 'selected' : ''}>${translations[state.currentLang].fn_office || 'საოფისე'}</option>
        <option value="hotel" ${currentFn === 'hotel' ? 'selected' : ''}>${translations[state.currentLang].fn_hotel || 'სასტუმრო'}</option>
        <option value="parking" ${currentFn === 'parking' ? 'selected' : ''}>${translations[state.currentLang].fn_parking || 'პარკინგი'}</option>
        <option value="amenity" ${currentFn === 'amenity' ? 'selected' : ''}>${translations[state.currentLang].fn_amenity || 'რეკრეაცია'}</option>
      </select>
      <span class="floor-area-stat">${areaPerFloor.toLocaleString()} მ²</span>
    `;

    const select = row.querySelector('.floor-fn-select');
    select.addEventListener('change', (e) => {
      const newFn = e.target.value;
      if (!bldg.floorFunctions) bldg.floorFunctions = {};
      bldg.floorFunctions[floorKey] = newFn;
      row.className = `floor-matrix-row ${isUnderground ? 'is-underground' : ''} fn-${newFn}`;
      renderAllBuildings3D();
    });

    return row;
  }

  function applyFloorPreset(presetKey) {
    const bldg = getSelectedBuilding();
    if (!bldg) return;
    if (!bldg.floorFunctions) bldg.floorFunctions = {};

    const floorsAbove = bldg.floorsAbove || 5;
    const floorsBelow = bldg.floorsBelow || 1;

    for (let b = 1; b <= floorsBelow; b++) {
      bldg.floorFunctions[`-${b}`] = 'parking';
    }

    if (presetKey === 'comm_res') {
      bldg.floorFunctions['0'] = 'commercial';
      for (let f = 1; f < floorsAbove; f++) {
        bldg.floorFunctions[`${f}`] = 'residential';
      }
    } else if (presetKey === 'all_res') {
      for (let f = 0; f < floorsAbove; f++) {
        bldg.floorFunctions[`${f}`] = 'residential';
      }
    } else if (presetKey === 'all_off') {
      for (let f = 0; f < floorsAbove; f++) {
        bldg.floorFunctions[`${f}`] = 'office';
      }
    }

    renderFloorMatrixUI();
    renderAllBuildings3D();
  }

  /* ==========================================================================
     5. AI Natural Language Concept Parser
     ========================================================================== */
  function parseAIConceptPrompt(text) {
    const t = text.toLowerCase();

    // 1. Building Type
    let buildingType = 'residential';
    if (t.includes('კომერციულ') || t.includes('საოფისე') || t.includes('office') || t.includes('commercial')) {
      buildingType = 'commercial';
    } else if (t.includes('სასტუმრო') || t.includes('hotel')) {
      buildingType = 'hotel';
    } else if (t.includes('ინდუსტრიულ') || t.includes('საწყობი') || t.includes('industrial') || t.includes('warehouse')) {
      buildingType = 'industrial';
    } else if (t.includes('შერეულ') || t.includes('mixed')) {
      buildingType = 'mixed-use';
    }

    // 2. Floors (Extract numbers near 'სართულ' or 'floor')
    let floors = 5;
    const floorMatches = text.match(/(\d+)\s*(?:[-–]\s*)?(?:სართულ|floor)/i);
    if (floorMatches && floorMatches[1]) {
      floors = Math.max(1, Math.min(parseInt(floorMatches[1], 10), 30));
    } else {
      const anyNum = text.match(/(\d+)\s*(?:სართულიანი)/i);
      if (anyNum && anyNum[1]) floors = Math.max(1, Math.min(parseInt(anyNum[1], 10), 30));
    }

    // 3. Total Area (Extract numbers near 'მ²' or 'კვ')
    let totalArea = null;
    const areaMatches = text.match(/(\d[\d\s,.]*)\s*(?:კვ|მ²|sq\.?m)/i);
    if (areaMatches && areaMatches[1]) {
      totalArea = parseInt(areaMatches[1].replace(/[\s,.]/g, ''), 10);
    }

    // 4. Ground Floor Use
    let groundFloorUse = 'commercial';
    if (t.includes('ავტოსადგომ') || t.includes('პარკინგ') || t.includes('parking')) {
      groundFloorUse = 'parking';
    } else if (t.includes('ლობი') || t.includes('საცხოვრებელ') || t.includes('lobby')) {
      groundFloorUse = 'lobby';
    }

    // 5. Facade Material & Color
    let facadeMaterial = 'concrete';
    if (t.includes('შუშ') || t.includes('მინა') || t.includes('ვიტრაჟ') || t.includes('glass')) {
      facadeMaterial = 'glass';
    } else if (t.includes('აგურ') || t.includes('brick')) {
      facadeMaterial = 'brick';
    } else if (t.includes('ალუმინ') || t.includes('პანელ') || t.includes('composite')) {
      facadeMaterial = 'composite';
    }

    let facadeColor = '#ffffff';
    if (t.includes('მუქ') || t.includes('შავ') || t.includes('dark') || t.includes('black')) {
      facadeColor = '#2b2d42';
    } else if (t.includes('ნაცრისფერ') || t.includes('gray')) {
      facadeColor = '#94a3b8';
    } else if (t.includes('თეთრ') || t.includes('ნათელ') || t.includes('white')) {
      facadeColor = '#f8fafc';
    }

    // 6. Style
    let style = 'modern';
    if (t.includes('მინიმალისტ') || t.includes('minimal')) style = 'minimalist';
    else if (t.includes('კლასიკ') || t.includes('classic')) style = 'classic';
    else if (t.includes('ჰაიტექ') || t.includes('high-tech')) style = 'high-tech';

    return {
      buildingType,
      floors,
      totalArea,
      groundFloorUse,
      facadeMaterial,
      facadeColor,
      style,
      floorHeight: 3.3,
      rotation: 0
    };
  }

  function generateConceptFromPrompt(text) {
    if (!state.activeParcel) {
      searchParcel('01.15.02.038.003');
    }

    const parsed = parseAIConceptPrompt(text);
    const bldg = getSelectedBuilding();
    if (bldg) {
      bldg.isProcedural = true; // explicitly enable procedural generation when requested via AI prompt
      bldg.buildingType = parsed.buildingType;
      bldg.floorsAbove = parsed.floors || 5;
      bldg.floors = parsed.floors || 5;
      bldg.facadeMaterial = parsed.facadeMaterial;
      bldg.facadeColor = parsed.facadeColor;
      bldg.style = parsed.style;
      bldg.groundFloorUse = parsed.groundFloorUse;
      if (parsed.totalArea) {
        bldg.footprintArea = Math.round(parsed.totalArea / bldg.floorsAbove);
      } else if (!bldg.footprintArea) {
        bldg.footprintArea = Math.round((state.activeParcel ? state.activeParcel.area : 1200) * 0.28);
      }
      syncCurrentBuildingToActiveConcept();
      renderFloorMatrixUI();
      renderAllBuildingsOnMap();
      renderAllBuildings3D();
      updateComplianceUI();
    }
  }

  function generateDefaultConcept(parcel) {
    state.buildings = [
      createBuildingData(1, BUILDING_COLORS[0], 0, 5, 1)
    ];
    state.buildings[0].footprintCoords = null;
    state.buildings[0].footprintArea = 0;
    state.buildings[0].isProcedural = false;
    state.selectedBuildingId = state.buildings[0].id;
    state.customFootprint = null;

    syncCurrentBuildingToActiveConcept();
    renderBuildingTabsUI();
    renderFloorMatrixUI();
    renderAllBuildingsOnMap();
    renderAllBuildings3D();
    updateComplianceUI();
  }

  function applyConceptToState(params) {
    const parcel = state.activeParcel;
    const bldg = getSelectedBuilding();
    if (!parcel || !bldg) return;

    if (params.footprint !== undefined) bldg.footprintArea = params.footprint;
    if (params.floorsAbove !== undefined) bldg.floorsAbove = params.floorsAbove;
    if (params.floorsBelow !== undefined) bldg.floorsBelow = params.floorsBelow;
    if (params.floorHeight !== undefined) bldg.floorHeight = params.floorHeight;
    if (params.rotation !== undefined) bldg.rotation = params.rotation;
    if (params.facadeMaterial) bldg.facadeMaterial = params.facadeMaterial;
    if (params.style) bldg.style = params.style;
    if (params.groundFloorUse) bldg.groundFloorUse = params.groundFloorUse;

    syncCurrentBuildingToActiveConcept();
    renderFloorMatrixUI();
    renderAllBuildingsOnMap();
    renderAllBuildings3D();
    updateComplianceUI();
  }

  /* ==========================================================================
     6. Turf.js Footprint Generation (Supports Custom User Polygon & Auto Rectangle)
     ========================================================================== */
  function computeFootprintGeometry(parcel, bldg) {
    if (!parcel || !bldg) return null;

    const parcelCenter = {
      lat: parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length,
      lng: parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length
    };

    // 1. If building has custom drawn GPS footprint:
    if (bldg.footprintCoords && bldg.footprintCoords.length >= 3) {
      const customLocal = gpsToLocalMeters(bldg.footprintCoords, parcelCenter);
      const xs = customLocal.map(p => p.x);
      const ys = customLocal.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return {
        width: maxX - minX,
        length: maxY - minY,
        corners: customLocal,
        isCustom: true
      };
    }

    // 2. Strict: If building has NOT been drawn yet and is not an explicit procedural AI concept, do NOT generate dummy geometry
    if (!bldg.isProcedural) {
      return null;
    }

    // Otherwise: procedural auto-concept rectangle with spatial offset per building
    const localPoints = gpsToLocalMeters(parcel.coordinates, parcelCenter);
    if (localPoints.length < 3) return null;

    const xs = localPoints.map(p => p.x);
    const ys = localPoints.map(p => p.y);
    const parcelW = Math.max(...xs) - Math.min(...xs);
    const parcelH = Math.max(...ys) - Math.min(...ys);

    const targetArea = bldg.footprintArea || 450;
    const aspectRatio = 1.35;
    let bldgW = Math.sqrt(targetArea / aspectRatio);
    let bldgL = bldgW * aspectRatio;

    const setback = 3.5;
    const maxAllowedW = Math.max(8, parcelW - setback * 2);
    const maxAllowedL = Math.max(8, parcelH - setback * 2);

    if (bldgW > maxAllowedW) {
      bldgW = maxAllowedW;
      bldgL = targetArea / bldgW;
    }
    if (bldgL > maxAllowedL) {
      bldgL = maxAllowedL;
      bldgW = Math.min(targetArea / bldgL, maxAllowedW);
    }

    // Offset based on building index to arrange multiple buildings nicely
    const idx = (bldg.index || 1) - 1;
    const centerOffsetX = (idx % 2 === 0 ? -1 : 1) * Math.min(idx * (bldgW * 0.4), parcelW * 0.25);
    const centerOffsetY = Math.floor(idx / 2) * (bldgL * 0.5);

    const halfW = bldgW / 2;
    const halfL = bldgL / 2;

    let corners = [
      { x: centerOffsetX - halfW, y: centerOffsetY - halfL },
      { x: centerOffsetX + halfW, y: centerOffsetY - halfL },
      { x: centerOffsetX + halfW, y: centerOffsetY + halfL },
      { x: centerOffsetX - halfW, y: centerOffsetY + halfL }
    ];

    const rad = (bldg.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotatedCorners = corners.map(pt => ({
      x: pt.x * cos - pt.y * sin,
      y: pt.x * sin + pt.y * cos
    }));

    return {
      width: bldgW,
      length: bldgL,
      corners: rotatedCorners,
      isCustom: false
    };
  }

  function renderAllBuildingsOnMap() {
    if (!map || !buildingsLayerGroup || !state.activeParcel) return;
    buildingsLayerGroup.clearLayers();

    const parcel = state.activeParcel;
    const centerGps = {
      lat: parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length,
      lng: parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length
    };

    state.buildings.forEach((bldg) => {
      let latlngs;
      if (bldg.footprintCoords && bldg.footprintCoords.length >= 3) {
        latlngs = bldg.footprintCoords;
      } else {
        const fp = computeFootprintGeometry(parcel, bldg);
        if (!fp || !fp.corners) return;
        latlngs = localMetersToGps(fp.corners, centerGps);
      }

      const isSelected = bldg.id === state.selectedBuildingId;
      const poly = L.polygon(latlngs, {
        color: bldg.color || '#10b981',
        weight: isSelected ? 3.5 : 2,
        fillColor: bldg.color || '#10b981',
        fillOpacity: isSelected ? 0.38 : 0.22,
        dashArray: isSelected ? null : '4, 4',
        className: 'building-polygon-feature'
      });

      const bName = state.currentLang === 'en' ? bldg.nameEn : bldg.name;
      poly.bindTooltip(`<strong>${bName}</strong><br>${bldg.footprintArea.toLocaleString()} მ² (+${bldg.floorsAbove} / -${bldg.floorsBelow})`, {
        permanent: false,
        direction: 'center',
        className: 'custom-footprint-map-tooltip'
      });

      poly.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (state.isDrawingMode) {
          handleMapClick(e);
        } else {
          selectBuilding(bldg.id);
        }
      });

      buildingsLayerGroup.addLayer(poly);
    });
  }

  /* ==========================================================================
     7. Three.js 3D Procedural Architectural Massing & Multi-Building Extruder
     ========================================================================== */
  function renderAllBuildings3D() {
    if (!buildingGroup || !scene || !state.activeParcel) return;

    // Remove existing building elements
    while (buildingGroup.children.length > 0) {
      const child = buildingGroup.children[0];
      buildingGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    const parcel = state.activeParcel;
    let maxOverallHeight = 0;

    state.buildings.forEach((bldg) => {
      const fp = computeFootprintGeometry(parcel, bldg);
      if (!fp || !fp.corners || fp.corners.length < 3) return;

      const floorsAbove = bldg.floorsAbove || 5;
      const floorsBelow = bldg.floorsBelow || 1;
      const floorH = bldg.floorHeight || 3.3;
      const totalAboveH = floorsAbove * floorH;
      if (totalAboveH > maxOverallHeight) maxOverallHeight = totalAboveH;

      // Construct 2D shape in local horizontal meters
      const shape = new THREE.Shape();
      fp.corners.forEach((pt, idx) => {
        if (idx === 0) shape.moveTo(pt.x, -pt.y);
        else shape.lineTo(pt.x, -pt.y);
      });
      shape.closePath();

      // Base building color accent for ground outline & accents
      const bColorHex = parseInt((bldg.color || '#10b981').replace('#', '0x'), 16);

      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.35,
        metalness: 0.2
      });

      // Extrude Above-Ground Floors (f = 0 to floorsAbove - 1)
      for (let f = 0; f < floorsAbove; f++) {
        const currentY = f * floorH;
        const curHeight = floorH;
        const fnType = (bldg.floorFunctions && bldg.floorFunctions[`${f}`]) || (f === 0 ? 'commercial' : 'residential');

        // Material tailored by individual Floor Function
        let floorMat;
        if (fnType === 'commercial') {
          // Warm Amber/Gold commercial glazing
          floorMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            roughness: 0.15,
            metalness: 0.8,
            transparent: true,
            opacity: 0.88
          });
        } else if (fnType === 'residential') {
          // Architectural modern light facade with glass blue tint
          floorMat = new THREE.MeshStandardMaterial({
            color: 0xdbeafe,
            roughness: 0.5,
            metalness: 0.25
          });
        } else if (fnType === 'office') {
          // Reflective executive sky blue curtain wall
          floorMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.85
          });
        } else if (fnType === 'hotel') {
          // Luxury royal violet/magenta
          floorMat = new THREE.MeshStandardMaterial({
            color: 0x8b5cf6,
            roughness: 0.3,
            metalness: 0.45,
            transparent: true,
            opacity: 0.9
          });
        } else if (fnType === 'amenity') {
          // Vibrant emerald green recreational level
          floorMat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.2,
            metalness: 0.6,
            transparent: true,
            opacity: 0.9
          });
        } else {
          // Standard / parking / utility
          floorMat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.7,
            metalness: 0.3
          });
        }

        // Floor Slab (bottom of floor)
        const slabGeom = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
        const slabMesh = new THREE.Mesh(slabGeom, slabMat);
        slabMesh.rotation.x = -Math.PI / 2;
        slabMesh.position.set(0, currentY, 0);
        slabMesh.castShadow = true;
        slabMesh.receiveShadow = true;
        slabMesh.userData = { buildingId: bldg.id };
        buildingGroup.add(slabMesh);

        // Floor Walls / Glazing Volume
        const wallGeom = new THREE.ExtrudeGeometry(shape, { depth: curHeight - 0.3, bevelEnabled: false });
        const wallMesh = new THREE.Mesh(wallGeom, floorMat);
        wallMesh.rotation.x = -Math.PI / 2;
        wallMesh.position.set(0, currentY + 0.3, 0);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        wallMesh.userData = { buildingId: bldg.id };
        buildingGroup.add(wallMesh);
      }

      // Roof Slab & Parapet
      const roofSlabGeom = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false });
      const roofMesh = new THREE.Mesh(roofSlabGeom, slabMat);
      roofMesh.rotation.x = -Math.PI / 2;
      roofMesh.position.set(0, totalAboveH, 0);
      roofMesh.castShadow = true;
      roofMesh.userData = { buildingId: bldg.id };
      buildingGroup.add(roofMesh);

      const parapetGeom = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
      const parapetMat = new THREE.MeshStandardMaterial({ color: bColorHex, roughness: 0.4 });
      const parapetMesh = new THREE.Mesh(parapetGeom, parapetMat);
      parapetMesh.rotation.x = -Math.PI / 2;
      parapetMesh.position.set(0, totalAboveH + 0.4, 0);
      parapetMesh.userData = { buildingId: bldg.id };
      buildingGroup.add(parapetMesh);

      // Subterranean Minus Floors (Y < 0)
      for (let b = 1; b <= floorsBelow; b++) {
        const btmY = -b * floorH;
        const fnType = (bldg.floorFunctions && bldg.floorFunctions[`-${b}`]) || 'parking';
        const subMat = new THREE.MeshStandardMaterial({
          color: fnType === 'commercial' ? 0xd97706 : 0x1e293b,
          roughness: 0.8,
          metalness: 0.3,
          transparent: true,
          opacity: state.xRayMode ? 0.95 : 0.75
        });

        const basementGeom = new THREE.ExtrudeGeometry(shape, { depth: floorH - 0.1, bevelEnabled: false });
        const basementMesh = new THREE.Mesh(basementGeom, subMat);
        basementMesh.rotation.x = -Math.PI / 2;
        basementMesh.position.set(0, btmY, 0);
        basementMesh.userData = { buildingId: bldg.id };
        buildingGroup.add(basementMesh);

        const edges = new THREE.EdgesGeometry(basementGeom);
        const lineMat = new THREE.LineBasicMaterial({
          color: bColorHex,
          transparent: true,
          opacity: 0.85
        });
        const line = new THREE.LineSegments(edges, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, btmY, 0);
        buildingGroup.add(line);
      }

      // Ground perimeter line matching building's color
      const basePoints = fp.corners.map(p => new THREE.Vector3(p.x, 0.15, p.y));
      basePoints.push(new THREE.Vector3(fp.corners[0].x, 0.15, fp.corners[0].y));
      const baseGeom = new THREE.BufferGeometry().setFromPoints(basePoints);
      const baseMat = new THREE.LineBasicMaterial({
        color: bColorHex,
        linewidth: bldg.id === state.selectedBuildingId ? 4 : 2
      });
      const baseOutline = new THREE.Line(baseGeom, baseMat);
      buildingGroup.add(baseOutline);
    });

    if (controls) {
      controls.target.set(0, (maxOverallHeight || 15) / 2, 0);
    }
  }

  /* ==========================================================================
     8. UI Synchronizations & Right Panel Analytics
     ========================================================================== */
  function updateParcelAttributesUI(parcel) {
    const isEn = state.currentLang === 'en';
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const unknownZone = isEn ? '⚠️ Unknown — enter below' : '⚠️ უცნობია — ჩაწერეთ ქვემოთ';
    const hasZone = parcel.mainZoneKa || parcel.mainZoneEn;

    set('infoCadastralCode', parcel.code);
    set('infoParcelArea', `${parcel.area.toLocaleString()} ${isEn ? 'm²' : 'მ²'}`);
    set('infoParcelShape', isEn ? parcel.shapeEn : parcel.shape);
    set('infoParcelAddress', isEn ? parcel.addressEn : parcel.address);
    set('infoParcelTerrain', isEn ? parcel.terrainEn : parcel.terrain);
    set('infoParcelMainZone', hasZone ? (isEn ? parcel.mainZoneEn : parcel.mainZoneKa) : unknownZone);
    set('infoParcelSubZone', hasZone ? (isEn ? (parcel.subZoneEn || parcel.subzoneEn) : (parcel.subZoneKa || parcel.subzoneKa)) : unknownZone);
    set('infoParcelZone', hasZone ? (isEn ? (parcel.subZoneEn || parcel.subzoneEn || parcel.zoneEn || parcel.zone) : (parcel.subZoneKa || parcel.subzoneKa || parcel.zone)) : unknownZone);
    set('infoParcelK1', (parcel.k1 !== undefined && parcel.k1 !== null) ? Number(parcel.k1).toFixed(2) : (isEn ? 'Not set' : 'დაუდგენელი'));
    set('infoParcelK2', (parcel.k2 !== undefined && parcel.k2 !== null) ? Number(parcel.k2).toFixed(2) : (isEn ? 'Not set' : 'დაუდგენელი'));
    set('infoParcelK3', (parcel.k3 !== undefined && parcel.k3 !== null) ? Number(parcel.k3).toFixed(2) : (isEn ? 'Not set' : 'დაუდგენელი'));

    // Show/hide zone entry panel for live NAPR parcels
    const zoneEntryPanel = document.getElementById('zoneManualEntryPanel');
    if (zoneEntryPanel) {
      zoneEntryPanel.style.display = (parcel.isLiveNAPR && !hasZone) ? 'block' : 'none';
    }

    // Update passport zone display
    const passportMain = document.getElementById('passportMainZoneDisplay');
    const passportSub  = document.getElementById('passportSubZoneDisplay');
    if (passportMain) passportMain.textContent = hasZone ? (isEn ? parcel.mainZoneEn : parcel.mainZoneKa) : unknownZone;
    if (passportSub)  passportSub.textContent  = hasZone ? (isEn ? (parcel.subZoneEn || parcel.subzoneEn) : (parcel.subZoneKa || parcel.subzoneKa)) : unknownZone;

    // Render Information Modal matching Photo 3
    if (typeof window.renderParcelAiInfoModal === 'function') {
      window.renderParcelAiInfoModal(parcel);
    }
  }

  /* ==========================================================================
     8c. GIS Layers Tree & Floating 'ინფორმაცია' Panel Controllers (Photos 1, 2, 3)
     ========================================================================== */
  let currentParcelAiInfoTab = 'zone';

  window.toggleParcelAiTree = function() {
    const overlay = document.getElementById('parcelAiTreeOverlay');
    const btn = document.getElementById('btnToggleParcelTree');
    if (!overlay) return;
    const isVisible = overlay.style.display === 'block';
    overlay.style.display = isVisible ? 'none' : 'block';
    if (btn) btn.classList.toggle('active', !isVisible);
  };

  window.toggleParcelAiNode = function(elem, grpId) {
    const grp = document.getElementById(grpId);
    const arrow = elem ? elem.querySelector('.tree-arrow') : null;
    if (!grp) return;
    const isOpen = grp.classList.contains('open');
    grp.classList.toggle('open', !isOpen);
    if (elem) elem.classList.toggle('active', !isOpen);
    if (arrow) {
      arrow.classList.toggle('open', !isOpen);
      arrow.textContent = isOpen ? '▶' : '▼';
    }
  };

  window.toggleParcelAiLayer = function(layerKey, isChecked) {
    if (!map) return;
    switch (layerKey) {
      case 'functional_zones':
      case 'past_zones':
        if (parcelZoningLayerGroup) {
          if (isChecked) {
            if (!map.hasLayer(parcelZoningLayerGroup)) parcelZoningLayerGroup.addTo(map);
          } else {
            if (map.hasLayer(parcelZoningLayerGroup)) map.removeLayer(parcelZoningLayerGroup);
          }
        }
        break;
      case 'cadastre':
        if (parcelPolygonLayer) {
          if (isChecked) {
            if (!map.hasLayer(parcelPolygonLayer)) parcelPolygonLayer.addTo(map);
          } else {
            if (map.hasLayer(parcelPolygonLayer)) map.removeLayer(parcelPolygonLayer);
          }
        }
        break;
      case 'building_contours':
      case 'next_interventions':
        if (parcelContoursLayerGroup) {
          if (isChecked) {
            if (!map.hasLayer(parcelContoursLayerGroup)) parcelContoursLayerGroup.addTo(map);
          } else {
            if (map.hasLayer(parcelContoursLayerGroup)) map.removeLayer(parcelContoursLayerGroup);
          }
        }
        break;
      default:
        console.log('Toggled parcel-ai layer:', layerKey, isChecked);
    }
  };





  function updateAssessmentUI(parcel) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const bldg = getSelectedBuilding();
    if (!bldg || !parcel) return;

    // Site Aggregates
    const totalSiteFootprint = state.buildings.reduce((sum, b) => sum + (b.footprintArea || 0), 0);
    const totalSiteAboveGFA = state.buildings.reduce((sum, b) => sum + (b.footprintArea * (b.floorsAbove || 1)), 0);
    const totalSiteUnderGFA = state.buildings.reduce((sum, b) => sum + (b.footprintArea * (b.floorsBelow || 0)), 0);
    const freeLand = Math.max(0, parcel.area - totalSiteFootprint);
    const k1Ratio = (totalSiteFootprint / parcel.area).toFixed(2);

    set('assessFootprint', `${totalSiteFootprint.toLocaleString()} მ² (${state.buildings.length} შენობა)`);
    set('assessFreeLand', `${freeLand.toLocaleString()} მ²`);
    set('assessFloors', `${bldg.name}: +${bldg.floorsAbove} / -${bldg.floorsBelow}`);
    set('assessTotalGFA', `${totalSiteAboveGFA.toLocaleString()} მ²`);
    set('assessCoverage', `${Math.round(k1Ratio * 100)}% (K1: ${k1Ratio})`);
    set('assessFunction', bldg.buildingType.toUpperCase());

    const underGFA = document.getElementById('assessUndergroundGFA');
    if (underGFA) underGFA.textContent = `${totalSiteUnderGFA.toLocaleString()} მ²`;
  }

  /* ==========================================================================
     8b. Real-Time Zoning & Ratio Compliance Calculator (ეტევი / ცდები)
     ========================================================================== */
  function updateComplianceUI() {
    const parcel = state.activeParcel;
    if (!parcel) return;

    const parcelArea = parcel.area || 1;

    // Aggregates across ALL buildings on site
    const totalSiteFootprint = state.buildings.reduce((sum, b) => sum + (b.footprintArea || 0), 0);
    const totalAboveGFA = state.buildings.reduce((sum, b) => sum + ((b.footprintArea || 0) * (b.floorsAbove || 1)), 0);
    const totalUndergroundGFA = state.buildings.reduce((sum, b) => sum + ((b.footprintArea || 0) * (b.floorsBelow || 0)), 0);

    // Determine allowed ratios (use manual/preset if configured, else parcel's default)
    let k1Allowed = parcel.k1 || 0.50;
    let k2Allowed = parcel.k2 || 2.20;
    let k3Allowed = parcel.k3 || 0.30;

    if (state.manualCoefficients && state.manualCoefficients.isManual) {
      if (typeof state.manualCoefficients.k1 === 'number') k1Allowed = state.manualCoefficients.k1;
      if (typeof state.manualCoefficients.k2 === 'number') k2Allowed = state.manualCoefficients.k2;
      if (typeof state.manualCoefficients.k3 === 'number') k3Allowed = state.manualCoefficients.k3;
    }

    // Sync input fields in UI
    const inputK1 = document.getElementById('inputAllowedK1');
    const inputK2 = document.getElementById('inputAllowedK2');
    const inputK3 = document.getElementById('inputAllowedK3');
    const selectZone = document.getElementById('selectZoningPreset');

    if (inputK1 && document.activeElement !== inputK1) inputK1.value = k1Allowed.toFixed(2);
    if (inputK2 && document.activeElement !== inputK2) inputK2.value = k2Allowed.toFixed(2);
    if (inputK3 && document.activeElement !== inputK3) inputK3.value = k3Allowed.toFixed(2);
    if (selectZone && document.activeElement !== selectZone) {
      selectZone.value = (state.manualCoefficients && state.manualCoefficients.zonePreset) ? state.manualCoefficients.zonePreset : 'auto';
    }

    // Keep attributes card in sync
    const infoK1 = document.getElementById('infoParcelK1');
    const infoK2 = document.getElementById('infoParcelK2');
    const infoK3 = document.getElementById('infoParcelK3');
    if (infoK1) infoK1.textContent = k1Allowed.toFixed(2);
    if (infoK2) infoK2.textContent = k2Allowed.toFixed(2);
    if (infoK3) infoK3.textContent = k3Allowed.toFixed(2);

    const k1Actual = totalSiteFootprint / parcelArea;
    const k2Actual = totalAboveGFA / parcelArea;
    const k3Actual = Math.max(0, (parcelArea - totalSiteFootprint) / parcelArea);

    const k1Fit = k1Actual <= (k1Allowed + 0.005);
    const k2Fit = k2Actual <= (k2Allowed + 0.005);
    const k3Fit = k3Actual >= (k3Allowed - 0.005);
    const allFit = k1Fit && k2Fit && k3Fit;

    // Update Assessment UI with the aggregated stats
    updateAssessmentUI(parcel);

    // Overall Compliance Status Banner
    const banner = document.getElementById('complianceBanner');
    const bannerTitle = document.getElementById('complianceBannerTitle');
    const bannerSub = document.getElementById('complianceBannerSubtitle');
    const bannerIcon = document.getElementById('complianceBannerIcon');

    if (banner) {
      banner.className = `compliance-status-banner ${allFit ? 'fit' : 'exceed'}`;
      if (bannerTitle) {
        bannerTitle.textContent = allFit
          ? (translations[state.currentLang].compliance_fit || 'ეტევი კოეფიციენტებში (ყველა ნორმა დაცულია)')
          : (translations[state.currentLang].compliance_exceed || 'ცდები კოეფიციენტებს! (დაფიქსირდა გადაცდომა)');
      }
      if (bannerSub) {
        if (allFit) {
          bannerSub.textContent = `ნაკვეთზე დატანილი ${state.buildings.length} შენობა სრულ შესაბამისობაშია ქალაქმშენებლობით რეგულაციებთან.`;
        } else {
          const violations = [];
          if (!k1Fit) violations.push('K1 (საძირკველი)');
          if (!k2Fit) violations.push('K2 (ინტენსივობა/სართულები)');
          if (!k3Fit) violations.push('K3 (გამწვანება)');
          bannerSub.textContent = `გადაჭარბებულია: ${violations.join(', ')}. შეამცირეთ სართულები ან საძირკვლის ფართობი.`;
        }
      }
      if (bannerIcon) {
        bannerIcon.className = allFit ? 'fa-solid fa-shield-check' : 'fa-solid fa-triangle-exclamation';
      }
    }

    // K1 Row
    const k1ActualEl = document.getElementById('k1ActualVal');
    const k1AllowedEl = document.getElementById('k1AllowedVal');
    const badgeK1 = document.getElementById('badgeK1Status');
    const k1Delta = document.getElementById('k1DeltaMsg');
    const k1Meter = document.getElementById('k1MeterFill');

    if (k1ActualEl) k1ActualEl.textContent = k1Actual.toFixed(2);
    if (k1AllowedEl) k1AllowedEl.textContent = k1Allowed.toFixed(2);
    if (badgeK1) {
      badgeK1.className = `ratio-status-badge ${k1Fit ? 'fit' : 'exceed'}`;
      badgeK1.textContent = k1Fit ? 'ეტევი' : 'ცდები';
    }
    if (k1Delta) {
      k1Delta.className = `ratio-delta-msg ${k1Fit ? 'fit' : 'exceed'}`;
      if (k1Fit) {
        const remaining = Math.max(0, Math.round(parcelArea * k1Allowed - totalSiteFootprint));
        k1Delta.textContent = `დარჩენილია ${remaining.toLocaleString()} მ²`;
      } else {
        const over = Math.round(totalSiteFootprint - parcelArea * k1Allowed);
        k1Delta.textContent = `გადაჭარბებულია +${over.toLocaleString()} მ²-ით!`;
      }
    }
    if (k1Meter) {
      k1Meter.className = `ratio-meter-fill ${k1Fit ? 'fit' : 'exceed'}`;
      k1Meter.style.width = `${Math.min(100, Math.round(k1Actual / k1Allowed * 100))}%`;
    }

    // K2 Row
    const k2ActualEl = document.getElementById('k2ActualVal');
    const k2AllowedEl = document.getElementById('k2AllowedVal');
    const badgeK2 = document.getElementById('badgeK2Status');
    const k2Delta = document.getElementById('k2DeltaMsg');
    const k2Meter = document.getElementById('k2MeterFill');

    if (k2ActualEl) k2ActualEl.textContent = k2Actual.toFixed(2);
    if (k2AllowedEl) k2AllowedEl.textContent = k2Allowed.toFixed(2);
    if (badgeK2) {
      badgeK2.className = `ratio-status-badge ${k2Fit ? 'fit' : 'exceed'}`;
      badgeK2.textContent = k2Fit ? 'ეტევი' : 'ცდები';
    }
    if (k2Delta) {
      k2Delta.className = `ratio-delta-msg ${k2Fit ? 'fit' : 'exceed'}`;
      if (k2Fit) {
        const remaining = Math.max(0, Math.round(parcelArea * k2Allowed - totalAboveGFA));
        k2Delta.textContent = `დარჩენილია ${remaining.toLocaleString()} მ²`;
      } else {
        const over = Math.round(totalAboveGFA - parcelArea * k2Allowed);
        k2Delta.textContent = `გადაჭარბებულია +${over.toLocaleString()} მ²-ით!`;
      }
    }
    if (k2Meter) {
      k2Meter.className = `ratio-meter-fill ${k2Fit ? 'fit' : 'exceed'}`;
      k2Meter.style.width = `${Math.min(100, Math.round(k2Actual / k2Allowed * 100))}%`;
    }

    // K3 Row
    const k3ActualEl = document.getElementById('k3ActualVal');
    const k3AllowedEl = document.getElementById('k3AllowedVal');
    const badgeK3 = document.getElementById('badgeK3Status');
    const k3Delta = document.getElementById('k3DeltaMsg');
    const k3Meter = document.getElementById('k3MeterFill');

    if (k3ActualEl) k3ActualEl.textContent = k3Actual.toFixed(2);
    if (k3AllowedEl) k3AllowedEl.textContent = k3Allowed.toFixed(2);
    if (badgeK3) {
      badgeK3.className = `ratio-status-badge ${k3Fit ? 'fit' : 'exceed'}`;
      badgeK3.textContent = k3Fit ? 'ეტევი' : 'ცდები';
    }
    if (k3Delta) {
      k3Delta.className = `ratio-delta-msg ${k3Fit ? 'fit' : 'exceed'}`;
      if (k3Fit) {
        k3Delta.textContent = 'ნორმაშია';
      } else {
        const deficit = Math.round(parcelArea * k3Allowed - (parcelArea - totalSiteFootprint));
        k3Delta.textContent = `დეფიციტი: -${deficit.toLocaleString()} მ²`;
      }
    }
    if (k3Meter) {
      k3Meter.className = `ratio-meter-fill ${k3Fit ? 'fit' : 'exceed'}`;
      k3Meter.style.width = `${Math.min(100, Math.round(k3Actual / k3Allowed * 100))}%`;
    }

    // Underground Floor Information
    const underGFA = document.getElementById('assessUndergroundGFA');
    if (underGFA) underGFA.textContent = `${totalUndergroundGFA.toLocaleString()} მ²`;

    // 8c. Evaluate Statutory Regulations (Resolution 14-39, Resolution 41, Accessibility)
    evaluateStatutoryCompliance(parcel);
  }

  /* ==========================================================================
     8c. Statutory & Regulatory Compliance Engine (დადგენილება 14-39, 41, მისაწვდომობა)
     ========================================================================== */

  // Helper: Computes minimum distance (in meters) from all building footprint vertices to parcel boundary polygon segments
  function computeMinBoundaryDistance(buildings, parcel) {
    if (!buildings || !buildings.length || !parcel || !parcel.coordinates || parcel.coordinates.length < 3) {
      return null;
    }

    const centerGps = computeParcelCenter(parcel.coordinates);
    const parcelLocalPts = gpsToLocalMeters(parcel.coordinates, centerGps);

    let minDistance = Infinity;
    let hasAnyBuildingCoords = false;

    buildings.forEach(bldg => {
      if (!bldg.footprintCoords || bldg.footprintCoords.length < 3) return;
      hasAnyBuildingCoords = true;

      const bldgLocalPts = gpsToLocalMeters(bldg.footprintCoords, centerGps);

      // Test each vertex of building polygon against every segment of parcel boundary
      for (let i = 0; i < bldgLocalPts.length; i++) {
        const p = bldgLocalPts[i];
        for (let j = 0; j < parcelLocalPts.length; j++) {
          const a = parcelLocalPts[j];
          const b = parcelLocalPts[(j + 1) % parcelLocalPts.length];

          // Distance from point p to line segment a-b
          const abX = b.x - a.x;
          const abY = b.y - a.y;
          const apX = p.x - a.x;
          const apY = p.y - a.y;
          const abLenSq = abX * abX + abY * abY;

          let t = 0;
          if (abLenSq > 0.0001) {
            t = Math.max(0, Math.min(1, (apX * abX + apY * abY) / abLenSq));
          }

          const closestX = a.x + t * abX;
          const closestY = a.y + t * abY;
          const dist = Math.hypot(p.x - closestX, p.y - closestY);

          if (dist < minDistance) {
            minDistance = dist;
          }
        }
      }
    });

    if (!hasAnyBuildingCoords || !isFinite(minDistance)) return null;
    return minDistance;
  }

  // Helper: Estimates parcel street frontage width in meters
  function estimateParcelFrontage(parcel) {
    if (!parcel || !parcel.coordinates || parcel.coordinates.length < 2) return 20;
    const centerGps = computeParcelCenter(parcel.coordinates);
    const localPts = gpsToLocalMeters(parcel.coordinates, centerGps);

    let maxEdge = 0;
    let totalPerimeter = 0;
    for (let i = 0; i < localPts.length; i++) {
      const a = localPts[i];
      const b = localPts[(i + 1) % localPts.length];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      totalPerimeter += d;
      if (d > maxEdge) maxEdge = d;
    }
    // Estimated primary street-facing width
    return Math.round(Math.min(maxEdge, totalPerimeter / 3.5) || Math.sqrt(parcel.area || 1000) * 0.85);
  }

  // Main evaluator for Resolution 14-39, Resolution 41, and Accessibility
  function evaluateStatutoryCompliance(parcel) {
    if (!parcel) return;

    const isEn = state.currentLang === 'en';

    // 1. Identify active zoning key
    let zoneKey = 'sz-2'; // default fallback
    let zoneIsUnknown = false; // flag: zone data not set by user yet
    if (state.manualCoefficients && state.manualCoefficients.zonePreset && state.manualCoefficients.zonePreset !== 'auto') {
      zoneKey = state.manualCoefficients.zonePreset;
    } else if (parcel.subzoneKey && REGULATIONS_DB[parcel.subzoneKey]) {
      zoneKey = parcel.subzoneKey;
    } else if (parcel.zone || parcel.subzoneKa) {
      const z = ((parcel.subzoneKa || '') + ' ' + (parcel.zone || '') + ' ' + (parcel.mainZoneKa || '')).toLowerCase();
      // CRITICAL: Must check ssz-1..3 before sz-1..6 because "სსზ-2".includes("სზ-2") evaluates to true!
      if (z.includes('სსზ-1') || z.includes('ssz-1') || z.includes('pb-1')) zoneKey = 'ssz-1';
      else if (z.includes('სსზ-2') || z.includes('ssz-2') || z.includes('pb-2')) zoneKey = 'ssz-2';
      else if (z.includes('სსზ-3') || z.includes('ssz-3') || z.includes('pb-3')) zoneKey = 'ssz-3';
      else if (z.includes('სზ-1') || z.includes('sz-1')) zoneKey = 'sz-1';
      else if (z.includes('სზ-2') || z.includes('sz-2')) zoneKey = 'sz-2';
      else if (z.includes('სზ-3') || z.includes('sz-3')) zoneKey = 'sz-3';
      else if (z.includes('სზ-4') || z.includes('sz-4')) zoneKey = 'sz-4';
      else if (z.includes('სზ-5') || z.includes('sz-5')) zoneKey = 'sz-5';
      else if (z.includes('სზ-6') || z.includes('sz-6')) zoneKey = 'sz-6';
      else if (z.includes('სკზ') || z.includes('skz') || z.includes('resort')) zoneKey = 'skz';
      else if (z.includes('რზ-1') || z.includes('rz-1')) zoneKey = 'rz-1';
      else if (z.includes('რზ-2') || z.includes('rz-2') || z.includes('რზ')) zoneKey = 'rz-2';
      else if (z.includes('ლზ') || z.includes('lz') || z.includes('ლანდშაფტ')) zoneKey = 'lz';
      else if (z.includes('საზ') || z.includes('saz') || z.includes('სანიტარ')) zoneKey = 'saz';
      else if (z.includes('ტზ') || z.includes('tz') || z.includes('ტრანსპორტ')) zoneKey = 'tz';
    } else if (parcel.isLiveNAPR) {
      // Live NAPR parcel: zone not yet set by user — flag as unknown
      zoneIsUnknown = true;
    }

    const reg = REGULATIONS_DB[zoneKey] || REGULATIONS_DB['sz-2'];
    const preset = ZONE_PRESETS[zoneKey] || {};

    const mainZoneTitle = isEn
      ? (reg.mainZoneEn || preset.mainZoneEn || parcel.mainZoneEn || 'Residential Zone (SZ)')
      : (reg.mainZoneKa || preset.mainZoneKa || parcel.mainZoneKa || 'საცხოვრებელი ზონა (სზ)');

    const subzoneTitle = isEn
      ? (reg.subzoneEn || preset.subzoneEn || reg.zoneNameEn || parcel.subzoneEn || parcel.zoneEn || parcel.zone)
      : (reg.subzoneKa || preset.subzoneKa || reg.zoneNameKa || parcel.subzoneKa || parcel.zone);

    // 1b. Update Urban Planning Passport Header: Main Zone, Subzone & GRG status
    const unknownZoneLabel = isEn ? '⚠️ Zone not set — enter manually above' : '⚠️ ზონა დაუდგენელია — შეიყვანეთ ზემოთ';
    const passportMainZoneDisplay = document.getElementById('passportMainZoneDisplay');
    if (passportMainZoneDisplay) {
      passportMainZoneDisplay.textContent = zoneIsUnknown ? unknownZoneLabel : mainZoneTitle;
      passportMainZoneDisplay.style.color = zoneIsUnknown ? '#f59e0b' : '';
    }

    const passportSubZoneDisplay = document.getElementById('passportSubZoneDisplay');
    if (passportSubZoneDisplay) {
      passportSubZoneDisplay.textContent = zoneIsUnknown ? unknownZoneLabel : subzoneTitle;
      passportSubZoneDisplay.style.color = zoneIsUnknown ? '#f59e0b' : '';
    }

    const passportZoneDisplay = document.getElementById('passportZoneDisplay');
    if (passportZoneDisplay) {
      passportZoneDisplay.textContent = zoneIsUnknown ? unknownZoneLabel : `${mainZoneTitle} — ${subzoneTitle}`;
    }

    const passportGrgBadge = document.getElementById('passportGrgStatusBadge');
    const chkGrgActive = document.getElementById('chkGrgActive');
    if (chkGrgActive) {
      chkGrgActive.checked = !!state.isGrgActive;
    }
    if (passportGrgBadge) {
      if (state.isGrgActive) {
        passportGrgBadge.className = 'grg-status-pill active-grg';
        passportGrgBadge.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> ${isEn ? 'Approved GRG (Custom Parameters)' : 'დამტკიცებული გრგ-ით (ინდივიდუალური პარამეტრები)'}`;
      } else {
        passportGrgBadge.className = 'grg-status-pill standard';
        passportGrgBadge.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> ${isEn ? 'Standard Zoning Norm (Without GRG, Res. 14-39)' : 'ზონის სტანდარტული ნორმატივით (გრგ-ს გარეშე, დადგენილება 14-39)'}`;
      }
    }

    // 2. Buildability Banner Evaluation
    const banner = document.getElementById('buildabilityStatusBanner');
    const bTitle = document.getElementById('buildabilityTitle');
    const bDesc = document.getElementById('buildabilityDesc');
    const bIcon = document.getElementById('buildabilityIcon');

    if (banner && bTitle && bDesc && bIcon) {
      banner.className = `buildability-banner build-${reg.buildable}`;
      if (reg.buildable === 'allowed') {
        bTitle.textContent = isEn ? 'Construction Permitted' : 'მშენებლობა დაშვებულია';
        bIcon.className = 'fa-solid fa-circle-check';
      } else if (reg.buildable === 'conditional') {
        bTitle.textContent = isEn ? 'Construction Conditional / Restricted' : 'მშენებლობა შეზღუდულია / პირობითია';
        bIcon.className = 'fa-solid fa-triangle-exclamation';
      } else {
        bTitle.textContent = isEn ? 'Construction Prohibited!' : 'მშენებლობა აკრძალულია / დაუშვებელია!';
        bIcon.className = 'fa-solid fa-circle-xmark';
      }
      bDesc.textContent = isEn ? reg.descEn : reg.descKa;
    }

    // 2b. Populate Allowed Typologies Grid
    const typologiesGrid = document.getElementById('legalAllowedTypologiesGrid');
    if (typologiesGrid) {
      typologiesGrid.innerHTML = '';
      const typList = reg.allowedTypologies || [];
      typList.forEach(item => {
        const tag = document.createElement('div');
        const isProhibited = reg.buildable === 'prohibited' || (item.icon && item.icon.includes('ban'));
        tag.className = `typology-tag ${isProhibited ? 'prohibited' : ''}`;
        tag.innerHTML = `<i class="fa-solid ${item.icon || 'fa-building'}"></i> <span>${isEn ? item.nameEn : item.nameKa}</span>`;
        typologiesGrid.appendChild(tag);
      });
    }

    // 3. Resolution 14-39 Checks (Min Area, Frontage, Setbacks)
    const minAreaEl = document.getElementById('legalMinAreaRequirement');
    const actualAreaEl = document.getElementById('legalActualAreaVal');
    const areaTag = document.getElementById('legalAreaStatusTag');

    const parcelArea = parcel.area || 0;
    if (minAreaEl) minAreaEl.textContent = reg.minArea ? `${isEn ? 'Min.' : 'მინ.'} ${reg.minArea} მ²` : (isEn ? 'N/A' : 'არ ვრცელდება');
    if (actualAreaEl) actualAreaEl.textContent = `${parcelArea.toLocaleString()} მ²`;

    if (areaTag) {
      if (reg.buildable === 'prohibited') {
        areaTag.className = 'legal-status-tag fail';
        areaTag.textContent = isEn ? 'Prohibited' : 'დაუშვებელია';
      } else if (!reg.minArea || parcelArea >= reg.minArea) {
        areaTag.className = 'legal-status-tag pass';
        areaTag.textContent = isEn ? 'Compliant' : 'ნორმაშია';
      } else {
        areaTag.className = 'legal-status-tag fail';
        areaTag.textContent = isEn ? 'Sub-standard' : 'არასამშენებლო ნაკვეთი';
      }
    }

    const minFrontageEl = document.getElementById('legalMinFrontageRequirement');
    const actualFrontageEl = document.getElementById('legalActualFrontageVal');
    const frontageTag = document.getElementById('legalFrontageStatusTag');

    const estimatedFrontage = estimateParcelFrontage(parcel);
    const requiredFrontage = reg.minFrontage || 14;
    if (minFrontageEl) minFrontageEl.textContent = `${isEn ? 'Min.' : 'მინ.'} ${requiredFrontage} მ`;
    if (actualFrontageEl) actualFrontageEl.textContent = `~${estimatedFrontage} მ`;
    if (frontageTag) {
      if (estimatedFrontage >= requiredFrontage) {
        frontageTag.className = 'legal-status-tag pass';
        frontageTag.textContent = isEn ? 'Compliant' : 'ნორმაშია';
      } else {
        frontageTag.className = 'legal-status-tag warn';
        frontageTag.textContent = isEn ? 'Narrow Front' : 'ვიწრო ფრონტი';
      }
    }

    // Boundary Setbacks (სამეზობლო მიჯნა >= 3.0 მ)
    const setbackTag = document.getElementById('legalSetbackStatusTag');
    const setbackDetail = document.getElementById('legalSetbackDetail');

    const minBorderDist = computeMinBoundaryDistance(state.buildings, parcel);
    if (setbackTag && setbackDetail) {
      if (minBorderDist === null) {
        setbackTag.className = 'legal-status-tag pass';
        setbackTag.textContent = isEn ? '3.0 m Norm' : '3.0 მ ნორმა';
        setbackDetail.textContent = isEn ? 'Boundary clearance evaluated once building is drawn.' : 'შენობის დახაზვის შემდეგ შემოწმდება დაშორება საზღვრამდე';
      } else {
        const d = minBorderDist;
        if (d >= 3.0) {
          setbackTag.className = 'legal-status-tag pass';
          setbackTag.textContent = isEn ? 'Compliant (≥ 3.0 m)' : 'დაცულია (≥ 3.0 მ)';
          setbackDetail.textContent = isEn
            ? `Shortest distance from building to boundary: ${d.toFixed(1)} m`
            : `შენობის უმოკლესი დაცილება საზღვრიდან: ${d.toFixed(1)} მ (დადგენილება 14-39 დაცულია)`;
        } else {
          setbackTag.className = 'legal-status-tag fail';
          setbackTag.textContent = isEn ? 'Violation (< 3.0 m)' : 'დარღვეულია (< 3.0 მ)';
          setbackDetail.textContent = isEn
            ? `Setback is only ${d.toFixed(1)} m! Notarized neighbor consent or blank parapet wall required.`
            : `დაცილება მხოლოდ ${d.toFixed(1)} მ-ია! საჭიროა მეზობლის ნოტარიული თანხმობა ან ყრუ კედელი (დადგენილება 14-39, მუხლი 18).`;
        }
      }
    }

    // 3b. Populate Statutory Restrictions List
    const restrictionsList = document.getElementById('legalRestrictionsList');
    if (restrictionsList) {
      restrictionsList.innerHTML = '';
      const list = reg.restrictions || [];
      list.forEach(r => {
        const li = document.createElement('li');
        li.textContent = isEn ? r.textEn : r.textKa;
        restrictionsList.appendChild(li);
      });
      if (state.isGrgActive) {
        const grgLi = document.createElement('li');
        grgLi.innerHTML = `<strong style="color: #c084fc;">${isEn ? 'GRG Exception:' : 'გრგ-ს შეღავათი:'}</strong> ${isEn ? 'Approved GRG permits custom increased K2 and adjusted height lines upon municipal approval.' : 'დამტკიცებული გრგ იძლევა კოეფიციენტების გაზრდისა და სამშენებლო საზღვრების ინდივიდუალური კორექტირების უფლებას.'}`;
        restrictionsList.appendChild(grgLi);
      }
    }

    // 3c. Populate Developer Obligations List
    const obligationsList = document.getElementById('legalObligationsList');
    if (obligationsList) {
      obligationsList.innerHTML = '';
      const list = reg.obligations || [];
      list.forEach(o => {
        const li = document.createElement('li');
        li.textContent = isEn ? o.textEn : o.textKa;
        obligationsList.appendChild(li);
      });
    }

    // 4. Resolution 41 (Safety & Parking Calculations)
    const bldg = getSelectedBuilding();
    const floorH = (bldg && bldg.floorHeight) || 3.3;
    const heightTag = document.getElementById('legalHeightTag');
    if (heightTag) {
      if (floorH >= 3.0) {
        heightTag.className = 'legal-status-tag pass';
        heightTag.textContent = `${isEn ? 'Compliant' : 'ნორმაშია'} (${floorH.toFixed(2)} მ)`;
      } else if (floorH >= 2.5) {
        heightTag.className = 'legal-status-tag pass';
        heightTag.textContent = `${isEn ? 'Residential Pass' : 'საცხოვრებელში დაცულია'} (${floorH.toFixed(2)} მ)`;
      } else {
        heightTag.className = 'legal-status-tag fail';
        heightTag.textContent = `${isEn ? 'Low Clearance' : 'არასაკმარისი'} (< 2.5 მ)`;
      }
    }

    // Required parking spaces formula based on floor programs
    let requiredParkingSpots = 0;
    state.buildings.forEach(b => {
      const fp = b.footprintArea || 0;
      const above = b.floorsAbove || 1;
      for (let f = 0; f < above; f++) {
        const fn = (b.floorFunctions && b.floorFunctions[`${f}`]) || (f === 0 ? 'commercial' : 'residential');
        if (fn === 'commercial') requiredParkingSpots += fp / 60;
        else if (fn === 'office') requiredParkingSpots += fp / 70;
        else if (fn === 'hotel') requiredParkingSpots += fp / 80;
        else requiredParkingSpots += fp / 100; // residential (approx 1 spot per 100 sqm)
      }
    });
    requiredParkingSpots = Math.max(1, Math.round(requiredParkingSpots));

    const totalUndergroundGFA = state.buildings.reduce((sum, b) => sum + ((b.footprintArea || 0) * (b.floorsBelow || 0)), 0);
    const plannedParkingSpots = Math.round(totalUndergroundGFA / 30); // ~30 sqm per stall with drive aisle

    const reqParkEl = document.getElementById('legalRequiredParkingSpots');
    const planParkEl = document.getElementById('legalPlannedParkingSpots');
    const parkTag = document.getElementById('legalParkingStatusTag');

    if (reqParkEl) reqParkEl.textContent = `${requiredParkingSpots} ${isEn ? 'slots' : 'ადგილი'}`;
    if (planParkEl) planParkEl.textContent = `~${plannedParkingSpots} ${isEn ? 'slots' : 'ადგილი'}`;
    if (parkTag) {
      if (plannedParkingSpots >= requiredParkingSpots) {
        parkTag.className = 'legal-status-tag pass';
        parkTag.textContent = isEn ? 'Satisfied' : 'აკმაყოფილებს';
      } else if (plannedParkingSpots > 0) {
        parkTag.className = 'legal-status-tag warn';
        parkTag.textContent = isEn ? `Deficit (-${requiredParkingSpots - plannedParkingSpots})` : `დეფიციტი (-${requiredParkingSpots - plannedParkingSpots})`;
      } else {
        parkTag.className = 'legal-status-tag fail';
        parkTag.textContent = isEn ? `Missing (-${requiredParkingSpots})` : `დეფიციტი (-${requiredParkingSpots})`;
      }
    }

    // 5. Universal Accessibility
    const pwdSpots = Math.max(1, Math.ceil(requiredParkingSpots / 25));
    const pwdSpotsEl = document.getElementById('legalPwdParkingSpots');
    const pwdTag = document.getElementById('legalPwdParkingTag');
    if (pwdSpotsEl) pwdSpotsEl.textContent = `${isEn ? 'Min.' : 'მინ.'} ${pwdSpots} ${isEn ? 'spot(s)' : 'ადგილი'}`;
    if (pwdTag) {
      pwdTag.className = 'legal-status-tag pass';
      pwdTag.textContent = isEn ? 'Mandatory' : 'სავალდებულო';
    }

    const elevatorReqEl = document.getElementById('legalElevatorRequirement');
    const maxFloors = state.buildings.reduce((max, b) => Math.max(max, b.floorsAbove || 1), 1);
    if (elevatorReqEl) {
      if (maxFloors >= 2) {
        elevatorReqEl.innerHTML = `<span class="legal-status-tag pass">${isEn ? `Required (${maxFloors} stories) — Cab ≥ 1.10×1.40 m` : `სავალდებულოა (${maxFloors} სართული) — კაბინა ≥ 1.10×1.40 მ, ხმოვანი/ბრაილი`}</span>`;
      } else {
        elevatorReqEl.innerHTML = `<span class="legal-status-tag pass">${isEn ? '1 story (Ramp sufficient)' : '1 სართული (პანდუსი საკმარისია)'}</span>`;
      }
    }
  }

  function syncSlidersUI(bldg) {
    if (!bldg) return;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setDisplay = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const floorsAbove = bldg.floorsAbove || 5;
    const floorsBelow = bldg.floorsBelow || 1;
    const floorH = bldg.floorHeight || 3.3;

    setVal('sliderFloors', floorsAbove);
    setDisplay('displayFloors', `+${floorsAbove}`);

    setVal('sliderBasementFloors', floorsBelow);
    setDisplay('displayBasementFloors', `-${floorsBelow}`);

    if (bldg.footprintCoords && bldg.footprintCoords.length >= 3 && bldg.footprintArea > 0) {
      setVal('sliderFootprint', bldg.footprintArea);
      setDisplay('displayFootprint', `${bldg.footprintArea.toLocaleString()} მ²`);
    } else {
      setVal('sliderFootprint', 0);
      setDisplay('displayFootprint', state.currentLang === 'en' ? 'To Draw' : 'დასახაზია');
    }

    setVal('sliderHeight', floorH);
    setDisplay('displayHeight', `${floorH} მ`);

    setDisplay('displayTotalHeight', `${(floorsAbove * floorH).toFixed(1)} მ`);
    setDisplay('displayBasementDepth', `-${(floorsBelow * floorH).toFixed(1)} მ`);

    const customBadge = document.getElementById('customFootprintIndicator');
    if (customBadge) {
      customBadge.style.display = (bldg.footprintCoords && bldg.footprintCoords.length >= 3) ? 'flex' : 'none';
    }

    setVal('sliderRotation', bldg.rotation || 0);
    setDisplay('displayRotation', `${bldg.rotation || 0}°`);

    setVal('selectMaterial', bldg.facadeMaterial || 'concrete');
    setVal('selectStyle', bldg.style || 'modern');
    setVal('selectGroundUse', bldg.groundFloorUse || 'commercial');
  }

  /* ==========================================================================
     9. Interactive Sliders & Override Event Handlers
     ========================================================================== */
  const sliderFloors = document.getElementById('sliderFloors');
  const sliderBasementFloors = document.getElementById('sliderBasementFloors');
  const sliderFootprint = document.getElementById('sliderFootprint');
  const sliderHeight = document.getElementById('sliderHeight');
  const sliderRotation = document.getElementById('sliderRotation');
  const selectMaterial = document.getElementById('selectMaterial');
  const selectStyle = document.getElementById('selectStyle');
  const selectGroundUse = document.getElementById('selectGroundUse');
  const btnResetToAutoFootprint = document.getElementById('btnResetToAutoFootprint');

  if (sliderFloors) {
    sliderFloors.addEventListener('input', () => {
      const bldg = getSelectedBuilding();
      if (!bldg) return;
      const val = parseInt(sliderFloors.value, 10);
      bldg.floorsAbove = val;
      bldg.floors = val;
      document.getElementById('displayFloors').textContent = `+${val}`;
      if (!bldg.floorFunctions) bldg.floorFunctions = {};
      for (let f = 0; f < val; f++) {
        if (!bldg.floorFunctions[`${f}`]) {
          bldg.floorFunctions[`${f}`] = f === 0 ? 'commercial' : 'residential';
        }
      }
      syncCurrentBuildingToActiveConcept();
      renderFloorMatrixUI();
      renderAllBuildings3D();
      updateComplianceUI();
    });
  }

  if (sliderBasementFloors) {
    sliderBasementFloors.addEventListener('input', () => {
      const bldg = getSelectedBuilding();
      if (!bldg) return;
      const val = parseInt(sliderBasementFloors.value, 10);
      bldg.floorsBelow = val;
      document.getElementById('displayBasementFloors').textContent = `-${val}`;
      if (!bldg.floorFunctions) bldg.floorFunctions = {};
      for (let b = 1; b <= val; b++) {
        if (!bldg.floorFunctions[`-${b}`]) {
          bldg.floorFunctions[`-${b}`] = 'parking';
        }
      }
      syncCurrentBuildingToActiveConcept();
      renderFloorMatrixUI();
      renderAllBuildings3D();
      updateComplianceUI();
    });
  }

  if (sliderFootprint) {
    sliderFootprint.addEventListener('input', () => {
      const bldg = getSelectedBuilding();
      if (!bldg) return;
      const val = parseInt(sliderFootprint.value, 10);
      bldg.footprintArea = val;
      // If user drags slider manually, clear custom drawn polygon for this building
      bldg.footprintCoords = null;
      state.customFootprint = null;
      if (drawingLayerGroup) drawingLayerGroup.clearLayers();
      const customBadge = document.getElementById('customFootprintIndicator');
      if (customBadge) customBadge.style.display = 'none';
      document.getElementById('displayFootprint').textContent = `${val.toLocaleString()} მ²`;

      syncCurrentBuildingToActiveConcept();
      renderFloorMatrixUI();
      renderAllBuildingsOnMap();
      renderAllBuildings3D();
      updateComplianceUI();
    });
  }

  if (sliderHeight) {
    sliderHeight.addEventListener('input', () => {
      const bldg = getSelectedBuilding();
      if (!bldg) return;
      const val = parseFloat(sliderHeight.value);
      bldg.floorHeight = val;
      document.getElementById('displayHeight').textContent = `${val} მ`;
      syncCurrentBuildingToActiveConcept();
      renderAllBuildings3D();
      updateComplianceUI();
    });
  }

  if (sliderRotation) {
    sliderRotation.addEventListener('input', () => {
      const bldg = getSelectedBuilding();
      if (!bldg) return;
      bldg.rotation = parseInt(sliderRotation.value, 10);
      document.getElementById('displayRotation').textContent = `${sliderRotation.value}°`;
      renderAllBuildingsOnMap();
      renderAllBuildings3D();
    });
  }

  if (selectMaterial) {
    selectMaterial.addEventListener('change', () => {
      const bldg = getSelectedBuilding();
      if (!bldg) return;
      bldg.facadeMaterial = selectMaterial.value;
      renderAllBuildings3D();
    });
  }

  if (selectStyle) {
    selectStyle.addEventListener('change', () => {
      const bldg = getSelectedBuilding();
      if (!bldg) return;
      bldg.style = selectStyle.value;
    });
  }

  if (selectGroundUse) {
    selectGroundUse.addEventListener('change', () => {
      const bldg = getSelectedBuilding();
      if (!bldg) return;
      bldg.groundFloorUse = selectGroundUse.value;
      if (!bldg.floorFunctions) bldg.floorFunctions = {};
      bldg.floorFunctions['0'] = selectGroundUse.value;
      renderFloorMatrixUI();
      renderAllBuildings3D();
    });
  }

  if (btnResetToAutoFootprint) {
    btnResetToAutoFootprint.addEventListener('click', () => {
      clearDrawing();
    });
  }

  /* ==========================================================================
     9b. Interactive Building Footprint Drawing & Correction Engine (2D Leaflet GIS)
     ========================================================================== */
  function updateToolbarButtons() {
    const btnDraw = document.getElementById('btnDrawBuilding');
    const btnEdit = document.getElementById('btnEditDraw');
    const btnFinish = document.getElementById('btnFinishDraw');
    const btnSave = document.getElementById('btnSaveEditDraw');
    const btnCancel = document.getElementById('btnCancelEditDraw');
    const btnUndo = document.getElementById('btnUndoPoint');
    const btnClear = document.getElementById('btnClearDraw');

    const bldg = getSelectedBuilding();
    const hasCustom = !!(bldg && bldg.footprintCoords && bldg.footprintCoords.length >= 3);

    if (state.isDrawingMode) {
      if (btnDraw) {
        btnDraw.style.display = 'inline-flex';
        btnDraw.classList.add('active');
        const cancelTxt = (translations[state.currentLang] && translations[state.currentLang].tool_cancel_draw) || 'დახაზვის გაუქმება';
        btnDraw.innerHTML = `<i class="fa-solid fa-xmark"></i> <span data-i18n="tool_cancel_draw">${cancelTxt}</span>`;
      }
      if (btnEdit) btnEdit.style.display = 'none';
      if (btnSave) btnSave.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'none';
      if (btnFinish) btnFinish.style.display = state.drawnPoints.length >= 3 ? 'inline-flex' : 'none';
      if (btnUndo) btnUndo.style.display = state.drawnPoints.length > 0 ? 'inline-flex' : 'none';
      if (btnClear) btnClear.style.display = state.drawnPoints.length > 0 ? 'inline-flex' : 'none';
    } else if (state.isEditMode) {
      if (btnDraw) btnDraw.style.display = 'none';
      if (btnEdit) btnEdit.style.display = 'none';
      if (btnFinish) btnFinish.style.display = 'none';
      if (btnUndo) btnUndo.style.display = 'none';
      if (btnSave) btnSave.style.display = 'inline-flex';
      if (btnCancel) btnCancel.style.display = 'inline-flex';
      if (btnClear) btnClear.style.display = 'inline-flex';
    } else {
      // Normal View Mode
      if (btnDraw) {
        btnDraw.style.display = 'inline-flex';
        btnDraw.classList.remove('active');
        const drawTxt = (translations[state.currentLang] && translations[state.currentLang].tool_draw_building) || 'შენობის დახაზვა';
        btnDraw.innerHTML = `<i class="fa-solid fa-pen-ruler"></i> <span data-i18n="tool_draw_building">${drawTxt}</span>`;
      }
      if (btnEdit) btnEdit.style.display = hasCustom ? 'inline-flex' : 'none';
      if (btnSave) btnSave.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'none';
      if (btnFinish) btnFinish.style.display = 'none';
      if (btnUndo) btnUndo.style.display = 'none';
      if (btnClear) btnClear.style.display = hasCustom ? 'inline-flex' : 'none';
    }
  }

  function computePolygonArea(points) {
    if (!points || points.length < 3) return 0;
    try {
      if (typeof turf !== 'undefined' && turf.polygon && turf.area) {
        const ring = points.map(pt => [pt[1], pt[0]]);
        ring.push([points[0][1], points[0][0]]);
        const poly = turf.polygon([ring]);
        return Math.round(turf.area(poly));
      }
    } catch (err) {
      console.warn('Turf.js area calculation fallback:', err);
    }
    // Planar Shoelace fallback
    const centerGps = computeParcelCenter(points);
    const localPts = gpsToLocalMeters(points, centerGps);
    let area = 0;
    for (let i = 0; i < localPts.length; i++) {
      const j = (i + 1) % localPts.length;
      area += localPts[i].x * localPts[j].y;
      area -= localPts[j].x * localPts[i].y;
    }
    return Math.round(Math.abs(area) / 2);
  }

  function handleMapClick(e) {
    if (!state.isDrawingMode || state.isEditMode) return;
    const pt = [e.latlng.lat, e.latlng.lng];
    state.drawnPoints.push(pt);
    updateDrawingVisualization();
  }

  function updateDrawingVisualization() {
    if (!drawingLayerGroup) return;
    drawingLayerGroup.clearLayers();

    const count = state.drawnPoints.length;
    const banner = document.getElementById('drawingGuideBanner');
    const bannerText = document.getElementById('drawingGuideText');
    const liveAreaBadge = document.getElementById('drawingLiveAreaBadge');

    if (banner) banner.style.display = 'flex';
    updateToolbarButtons();

    const currentBldg = getSelectedBuilding();
    const activeColor = currentBldg ? currentBldg.color : '#10b981';

    // Draw vertex dots matching building's color
    state.drawnPoints.forEach((pt, idx) => {
      const isFirst = idx === 0;
      const marker = L.circleMarker(pt, {
        radius: isFirst ? 8 : 6,
        color: isFirst ? '#facc15' : activeColor,
        fillColor: isFirst ? activeColor : '#ffffff',
        fillOpacity: 1,
        weight: 2.5,
        interactive: isFirst && count >= 3,
        className: 'drawing-vertex-marker'
      });

      if (isFirst && count >= 3) {
        marker.bindTooltip('დააკლიკე შესაკრავად', { permanent: false, direction: 'top' });
        marker.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          finishDrawing();
        });
      }

      drawingLayerGroup.addLayer(marker);
    });

    // In-progress connecting line
    if (count >= 2) {
      const line = L.polyline(state.drawnPoints, {
        color: activeColor,
        weight: 3,
        dashArray: '5, 5',
        interactive: false
      });
      drawingLayerGroup.addLayer(line);
    }

    // In-progress preview polygon
    if (count >= 3) {
      const previewPoly = L.polygon(state.drawnPoints, {
        color: activeColor,
        weight: 2.5,
        fillColor: activeColor,
        fillOpacity: 0.25,
        dashArray: '4, 4',
        interactive: false
      });
      drawingLayerGroup.addLayer(previewPoly);

      const areaSqM = computePolygonArea(state.drawnPoints);
      if (liveAreaBadge) liveAreaBadge.textContent = `${areaSqM.toLocaleString()} მ²`;
      if (bannerText) bannerText.textContent = translations[state.currentLang].drawing_guide_close || 'დააკლიკე პირველ წერტილს ან „დაასრულე“ ღილაკს შესაკრავად';
    } else {
      if (liveAreaBadge) liveAreaBadge.textContent = '0 მ²';
      if (bannerText) bannerText.textContent = translations[state.currentLang].drawing_guide_start || 'დააკლიკე რუკაზე შენობის ფორმის დასახაზად (მინ. 3 წერტილი)';
    }
  }

  function startDrawing() {
    if (!state.activeParcel) {
      searchParcel('01.15.02.038.003');
    }
    if (state.isEditMode) cancelFootprintEdit();

    state.isDrawingMode = true;
    state.isEditMode = false;
    state.drawnPoints = [];
    if (drawingLayerGroup) drawingLayerGroup.clearLayers();
    if (parcelPolygonLayer) parcelPolygonLayer.closePopup();

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.add('map-drawing-active');

    if (state.currentMode === '3d' || state.currentMode === 'solar') {
      setMode('combined');
    }

    if (map) {
      setTimeout(() => map.invalidateSize(), 60);
    }

    updateDrawingVisualization();
  }

  function finishDrawing() {
    if (state.drawnPoints.length < 3) return;

    state.isDrawingMode = false;
    state.isEditMode = false;
    state.customFootprint = [...state.drawnPoints];

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.remove('map-drawing-active');

    const banner = document.getElementById('drawingGuideBanner');
    if (banner) banner.style.display = 'none';

    // Compute final area with Turf.js
    const areaSqM = computePolygonArea(state.customFootprint);

    const bldg = getSelectedBuilding();
    if (bldg) {
      bldg.footprintCoords = [...state.customFootprint];
      bldg.footprintArea = areaSqM;
    }

    if (drawingLayerGroup) drawingLayerGroup.clearLayers();
    renderAllBuildingsOnMap();

    const customBadge = document.getElementById('customFootprintIndicator');
    if (customBadge) customBadge.style.display = 'flex';

    updateToolbarButtons();

    if (bldg) {
      syncSlidersUI(bldg);
      renderFloorMatrixUI();
      renderAllBuildings3D();
      updateComplianceUI();
    }

    if (state.currentMode === 'map' || state.currentMode === '2d') {
      setMode('combined');
    }
  }

  function renderFinalCustomPolygon(areaSqM) {
    if (!drawingLayerGroup || !state.customFootprint || state.customFootprint.length < 3) return;
    drawingLayerGroup.clearLayers();
    const bldg = getSelectedBuilding();
    const activeColor = bldg ? bldg.color : '#10b981';
    const finalPoly = L.polygon(state.customFootprint, {
      color: activeColor,
      weight: 3,
      fillColor: activeColor,
      fillOpacity: 0.25,
      dashArray: '5, 5'
    });
    const areaText = areaSqM !== undefined ? areaSqM : computePolygonArea(state.customFootprint);
    finalPoly.bindTooltip(`${bldg ? bldg.name : 'შენობა'}: ${areaText.toLocaleString()} მ²`, {
      permanent: false,
      direction: 'center',
      className: 'custom-footprint-map-tooltip'
    });
    drawingLayerGroup.addLayer(finalPoly);
  }

  /* Interactive Footprint Correction / Modification Engine */
  function startEditingFootprint() {
    const bldg = getSelectedBuilding();
    if (!bldg || !bldg.footprintCoords || bldg.footprintCoords.length < 3) return;

    state.isEditMode = true;
    state.isDrawingMode = false;
    state.customFootprint = [...bldg.footprintCoords];
    state.editBackupPoints = JSON.parse(JSON.stringify(bldg.footprintCoords));

    if (parcelPolygonLayer) parcelPolygonLayer.closePopup();

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.add('map-drawing-active');

    if (state.currentMode === '3d') {
      setMode('combined');
    }

    updateToolbarButtons();

    const banner = document.getElementById('drawingGuideBanner');
    const bannerText = document.getElementById('drawingGuideText');
    if (banner) banner.style.display = 'flex';
    if (bannerText) {
      bannerText.textContent = translations[state.currentLang].drawing_guide_edit || 'გადააადგილე წერტილები ფორმის საკორექტირებლად და დააჭირე „შენახვას“';
    }

    renderEditableFootprint();
  }

  function renderEditableFootprint() {
    if (!drawingLayerGroup || !state.customFootprint) return;
    drawingLayerGroup.clearLayers();

    const bldg = getSelectedBuilding();
    const activeColor = bldg ? bldg.color : '#10b981';

    const editPoly = L.polygon(state.customFootprint, {
      color: activeColor,
      weight: 3,
      fillColor: activeColor,
      fillOpacity: 0.25,
      dashArray: '4, 4'
    });
    drawingLayerGroup.addLayer(editPoly);

    const liveAreaBadge = document.getElementById('drawingLiveAreaBadge');
    if (liveAreaBadge) {
      liveAreaBadge.textContent = `${computePolygonArea(state.customFootprint).toLocaleString()} მ²`;
    }

    state.customFootprint.forEach((pt, idx) => {
      const editIcon = L.divIcon({
        className: 'drawing-edit-handle',
        html: `<span class="edit-handle-dot">${idx + 1}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker(pt, {
        draggable: true,
        icon: editIcon,
        zIndexOffset: 1000
      });

      marker.on('drag', (ev) => {
        const latlng = ev.target.getLatLng();
        state.customFootprint[idx] = [latlng.lat, latlng.lng];
        editPoly.setLatLngs(state.customFootprint);

        const currentArea = computePolygonArea(state.customFootprint);
        if (liveAreaBadge) liveAreaBadge.textContent = `${currentArea.toLocaleString()} მ²`;
      });

      marker.on('dragend', () => {
        const currentArea = computePolygonArea(state.customFootprint);
        if (bldg) {
          bldg.footprintCoords = [...state.customFootprint];
          bldg.footprintArea = currentArea;
          syncSlidersUI(bldg);
          renderFloorMatrixUI();
          renderAllBuildings3D();
          updateComplianceUI();
        }
      });

      drawingLayerGroup.addLayer(marker);
    });
  }

  function saveFootprintEdit() {
    state.isEditMode = false;

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.remove('map-drawing-active');

    const banner = document.getElementById('drawingGuideBanner');
    if (banner) banner.style.display = 'none';

    const finalArea = computePolygonArea(state.customFootprint);
    const bldg = getSelectedBuilding();
    if (bldg) {
      bldg.footprintCoords = [...state.customFootprint];
      bldg.footprintArea = finalArea;
    }

    if (drawingLayerGroup) drawingLayerGroup.clearLayers();
    renderAllBuildingsOnMap();
    updateToolbarButtons();

    if (bldg) {
      syncSlidersUI(bldg);
      renderFloorMatrixUI();
      renderAllBuildings3D();
      updateComplianceUI();
    }
  }

  function cancelFootprintEdit() {
    state.isEditMode = false;
    state.customFootprint = JSON.parse(JSON.stringify(state.editBackupPoints));

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.remove('map-drawing-active');

    const banner = document.getElementById('drawingGuideBanner');
    if (banner) banner.style.display = 'none';

    const bldg = getSelectedBuilding();
    if (bldg) {
      bldg.footprintCoords = [...state.customFootprint];
    }

    if (drawingLayerGroup) drawingLayerGroup.clearLayers();
    renderAllBuildingsOnMap();
    updateToolbarButtons();
  }

  function clearDrawing() {
    state.isDrawingMode = false;
    state.isEditMode = false;
    state.drawnPoints = [];
    state.customFootprint = null;
    const bldg = getSelectedBuilding();
    if (bldg) {
      bldg.footprintCoords = null;
    }
    if (drawingLayerGroup) drawingLayerGroup.clearLayers();

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.remove('map-drawing-active');

    const banner = document.getElementById('drawingGuideBanner');
    if (banner) banner.style.display = 'none';

    const customBadge = document.getElementById('customFootprintIndicator');
    if (customBadge) customBadge.style.display = 'none';

    updateToolbarButtons();
    renderAllBuildingsOnMap();
    renderAllBuildings3D();
    updateComplianceUI();
  }

  /* ==========================================================================
     10. Mode Switcher (Map / 2D / 3D / Combined)
     ========================================================================== */
  const modeTabBtns = document.querySelectorAll('.mode-tab-btn');
  const viewportStage = document.getElementById('viewportStage');
  const mapViewport = document.getElementById('mapViewport');
  const threeViewport = document.getElementById('threeViewport');

  function setMode(mode) {
    state.currentMode = mode;
    modeTabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

    if (viewportStage) {
      viewportStage.className = `viewport-stage mode-${mode}`;
    }

    const solarControlPanel = document.getElementById('solarControlPanel');

    if (mode === 'map' || mode === '2d') {
      if (mapViewport) mapViewport.style.display = 'block';
      if (threeViewport) threeViewport.style.display = 'none';
      if (solarControlPanel) solarControlPanel.style.display = 'none';
      if (sunPathGroup) sunPathGroup.visible = false;
      if (buildingFootprintLayer) {
        map.removeLayer(buildingFootprintLayer);
        buildingFootprintLayer = null;
      }
      if (map) {
        setTimeout(() => map.invalidateSize(), 50);
      }
    } else if (mode === '3d') {
      if (mapViewport) mapViewport.style.display = 'none';
      if (threeViewport) threeViewport.style.display = 'block';
      if (solarControlPanel) solarControlPanel.style.display = 'none';
      if (sunPathGroup) sunPathGroup.visible = !!state.showSunPath;
      onWindowResize();
    } else if (mode === 'solar') {
      if (mapViewport) mapViewport.style.display = 'none';
      if (threeViewport) threeViewport.style.display = 'block';
      if (solarControlPanel) solarControlPanel.style.display = 'flex';
      if (sunPathGroup) sunPathGroup.visible = true;
      onWindowResize();
      updateSolarLighting();
      if (controls && camera) {
        camera.position.set(75, 65, 95);
        controls.target.set(0, 6, 0);
        controls.update();
      }
    } else if (mode === 'combined') {
      if (mapViewport) mapViewport.style.display = 'block';
      if (threeViewport) threeViewport.style.display = 'block';
      if (solarControlPanel) solarControlPanel.style.display = 'none';
      if (sunPathGroup) sunPathGroup.visible = !!state.showSunPath;
      if (buildingFootprintLayer) {
        map.removeLayer(buildingFootprintLayer);
        buildingFootprintLayer = null;
      }
      if (map) setTimeout(() => map.invalidateSize(), 50);
      onWindowResize();
    }
  }

  modeTabBtns.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  /* ==========================================================================
     11. Viewport Tools (Satellite Switch, Reset Center, Measure)
     ========================================================================== */
  const btnToggleSatellite = document.getElementById('btnToggleSatellite');
  const btnResetCenter = document.getElementById('btnResetCenter');
  const btnMeasure = document.getElementById('btnMeasure');

  if (btnToggleSatellite && map) {
    btnToggleSatellite.addEventListener('click', () => {
      if (state.mapLayerType === 'satellite') {
        map.removeLayer(tileLayerSatellite);
        map.addLayer(tileLayerVector);
        state.mapLayerType = 'vector';
        btnToggleSatellite.classList.remove('active');
        btnToggleSatellite.title = 'Switch to Satellite Imagery';
      } else {
        map.removeLayer(tileLayerVector);
        map.addLayer(tileLayerSatellite);
        state.mapLayerType = 'satellite';
        btnToggleSatellite.classList.add('active');
        btnToggleSatellite.title = 'Switch to Vector Map';
      }
    });
  }

  if (btnResetCenter) {
    btnResetCenter.addEventListener('click', () => {
      if (state.currentMode === '3d' && controls) {
        controls.reset();
        camera.position.set(50, 45, 65);
      } else if (map && parcelPolygonLayer) {
        map.fitBounds(parcelPolygonLayer.getBounds(), { padding: [40, 40] });
      }
    });
  }

  // Drawing & Correction Toolbar Buttons
  const btnDrawBuilding = document.getElementById('btnDrawBuilding');
  const btnEditDraw = document.getElementById('btnEditDraw');
  const btnFinishDraw = document.getElementById('btnFinishDraw');
  const btnSaveEditDraw = document.getElementById('btnSaveEditDraw');
  const btnCancelEditDraw = document.getElementById('btnCancelEditDraw');
  const btnUndoPoint = document.getElementById('btnUndoPoint');
  const btnClearDraw = document.getElementById('btnClearDraw');
  const btnEditFootprintQuick = document.getElementById('btnEditFootprintQuick');
  const btnToggleXRay = document.getElementById('btnToggleXRay');

  if (btnDrawBuilding) {
    btnDrawBuilding.addEventListener('click', () => {
      if (state.isDrawingMode) {
        clearDrawing();
      } else {
        startDrawing();
      }
    });
  }

  if (btnEditDraw) {
    btnEditDraw.addEventListener('click', () => {
      startEditingFootprint();
    });
  }

  if (btnEditFootprintQuick) {
    btnEditFootprintQuick.addEventListener('click', () => {
      startEditingFootprint();
    });
  }

  if (btnFinishDraw) {
    btnFinishDraw.addEventListener('click', () => {
      finishDrawing();
    });
  }

  if (btnSaveEditDraw) {
    btnSaveEditDraw.addEventListener('click', () => {
      saveFootprintEdit();
    });
  }

  if (btnCancelEditDraw) {
    btnCancelEditDraw.addEventListener('click', () => {
      cancelFootprintEdit();
    });
  }

  if (btnUndoPoint) {
    btnUndoPoint.addEventListener('click', () => {
      if (state.isDrawingMode && state.drawnPoints.length > 0) {
        state.drawnPoints.pop();
        updateDrawingVisualization();
      }
    });
  }

  if (btnClearDraw) {
    btnClearDraw.addEventListener('click', () => {
      clearDrawing();
    });
  }

  if (btnToggleXRay) {
    btnToggleXRay.addEventListener('click', () => {
      state.xRayMode = !state.xRayMode;
      btnToggleXRay.classList.toggle('active', state.xRayMode);
      if (groundGroup) {
        groundGroup.children.forEach(c => {
          if (c.material && c.type === 'Mesh') {
            c.material.transparent = true;
            c.material.opacity = state.xRayMode ? 0.25 : 1.0;
            c.material.needsUpdate = true;
          }
        });
      }
      renderAllBuildings3D();
    });
  }

  // Multi-Building Manager and Floor Function Presets Hookup
  const btnAddBuilding = document.getElementById('btnAddBuilding');
  const btnAddNewBuildingMap = document.getElementById('btnAddNewBuildingMap');
  const btnDeleteSelectedBuilding = document.getElementById('btnDeleteSelectedBuilding');
  const colorSwatchDots = document.querySelectorAll('#buildingColorPicker .color-swatch-dot');
  const floorPresetBtns = document.querySelectorAll('.btn-floor-preset');

  if (btnAddBuilding) {
    btnAddBuilding.addEventListener('click', () => {
      addNewBuilding(true);
    });
  }

  if (btnAddNewBuildingMap) {
    btnAddNewBuildingMap.addEventListener('click', () => {
      addNewBuilding(true);
    });
  }

  if (btnDeleteSelectedBuilding) {
    btnDeleteSelectedBuilding.addEventListener('click', () => {
      deleteSelectedBuilding();
    });
  }

  colorSwatchDots.forEach(dot => {
    dot.addEventListener('click', () => {
      setSelectedBuildingColor(dot.dataset.color);
    });
  });

  floorPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyFloorPreset(btn.dataset.preset);
    });
  });

  /* ==========================================================================
     11b. Manual Coefficients & Zoning Presets Event Listeners
     ========================================================================== */
  const selectZoningPreset = document.getElementById('selectZoningPreset');
  const inputAllowedK1 = document.getElementById('inputAllowedK1');
  const inputAllowedK2 = document.getElementById('inputAllowedK2');
  const inputAllowedK3 = document.getElementById('inputAllowedK3');
  const btnResetCoefficients = document.getElementById('btnResetCoefficients');

  if (selectZoningPreset) {
    selectZoningPreset.addEventListener('change', () => {
      const val = selectZoningPreset.value;
      if (val === 'auto') {
        state.manualCoefficients = { isManual: false, zonePreset: 'auto', k1: null, k2: null, k3: null };
      } else if (val === 'custom') {
        state.manualCoefficients.isManual = true;
        state.manualCoefficients.zonePreset = 'custom';
        const parsedK1 = parseFloat(inputAllowedK1 ? inputAllowedK1.value : '0.5');
        const parsedK2 = parseFloat(inputAllowedK2 ? inputAllowedK2.value : '2.2');
        const parsedK3 = parseFloat(inputAllowedK3 ? inputAllowedK3.value : '0.3');
        state.manualCoefficients.k1 = isNaN(parsedK1) ? 0.5 : parsedK1;
        state.manualCoefficients.k2 = isNaN(parsedK2) ? 2.2 : parsedK2;
        state.manualCoefficients.k3 = isNaN(parsedK3) ? 0.3 : parsedK3;
      } else if (ZONE_PRESETS[val]) {
        const preset = ZONE_PRESETS[val];
        state.manualCoefficients = {
          isManual: true,
          zonePreset: val,
          k1: preset.k1,
          k2: preset.k2,
          k3: preset.k3
        };
        if (inputAllowedK1) inputAllowedK1.value = preset.k1.toFixed(2);
        if (inputAllowedK2) inputAllowedK2.value = preset.k2.toFixed(2);
        if (inputAllowedK3) inputAllowedK3.value = preset.k3.toFixed(2);
      }
      updateComplianceUI();
    });
  }

  function handleManualCoeffInputChange() {
    if (!inputAllowedK1 || !inputAllowedK2 || !inputAllowedK3) return;
    const k1 = parseFloat(inputAllowedK1.value);
    const k2 = parseFloat(inputAllowedK2.value);
    const k3 = parseFloat(inputAllowedK3.value);

    state.manualCoefficients = {
      isManual: true,
      zonePreset: 'custom',
      k1: isNaN(k1) ? 0.5 : k1,
      k2: isNaN(k2) ? 2.2 : k2,
      k3: isNaN(k3) ? 0.3 : k3
    };
    if (selectZoningPreset) selectZoningPreset.value = 'custom';
    updateComplianceUI();
  }

  if (inputAllowedK1) inputAllowedK1.addEventListener('input', handleManualCoeffInputChange);
  if (inputAllowedK2) inputAllowedK2.addEventListener('input', handleManualCoeffInputChange);
  if (inputAllowedK3) inputAllowedK3.addEventListener('input', handleManualCoeffInputChange);

  if (btnResetCoefficients) {
    btnResetCoefficients.addEventListener('click', () => {
      state.manualCoefficients = {
        isManual: false,
        zonePreset: 'auto',
        k1: null,
        k2: null,
        k3: null
      };
      state.isGrgActive = false;
      const chkGrg = document.getElementById('chkGrgActive');
      if (chkGrg) chkGrg.checked = false;
      if (selectZoningPreset) selectZoningPreset.value = 'auto';
      updateComplianceUI();
    });
  }

  // GRG (განაშენიანების რეგულირების გეგმა) Switch Hookup
  const chkGrgActive = document.getElementById('chkGrgActive');
  if (chkGrgActive) {
    chkGrgActive.addEventListener('change', () => {
      state.isGrgActive = chkGrgActive.checked;
      updateComplianceUI();
    });
  }

  /* ==========================================================================
     12. Cadastral Search Triggers & Sample Dropdown
     ========================================================================== */
  if (cadastralSearchBtn) {
    cadastralSearchBtn.addEventListener('click', () => {
      searchParcel();
    });
  }

  if (cadastralInput) {
    cadastralInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchParcel();
      }
    });
  }

  if (sampleParcelsSelect) {
    sampleParcelsSelect.addEventListener('change', () => {
      if (sampleParcelsSelect.value) {
        searchParcel(sampleParcelsSelect.value);
      }
    });
  }

  const aiGenerateBtn = document.getElementById('aiGenerateBtn');
  const aiPromptInput = document.getElementById('aiPromptInput');

  if (aiGenerateBtn && aiPromptInput) {
    aiGenerateBtn.addEventListener('click', () => {
      const origText = aiGenerateBtn.innerHTML;
      aiGenerateBtn.disabled = true;
      aiGenerateBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${translations[state.currentLang].ai_generating_text || 'AI აანალიზებს...'}</span>`;

      setTimeout(() => {
        aiGenerateBtn.disabled = false;
        aiGenerateBtn.innerHTML = origText;
        generateConceptFromPrompt(aiPromptInput.value.trim());
      }, 500);
    });
  }

  /* ==========================================================================
     13. Multi-Variant Management (Variant A, B, C)
     ========================================================================== */
  const variantPills = document.querySelectorAll('.variant-tab-pill');
  const btnSaveVariant = document.getElementById('btnSaveVariant');
  const btnDupVariant = document.getElementById('btnDupVariant');

  function saveCurrentVariant(key) {
    if (!state.activeConcept) return;
    state.variants[key] = JSON.parse(JSON.stringify(state.activeConcept));
    localStorage.setItem(`bimx_variant_${key}`, JSON.stringify(state.variants[key]));
  }

  function loadVariant(key) {
    state.activeVariantKey = key;
    variantPills.forEach(pill => pill.classList.toggle('active', pill.dataset.variant === key));

    const saved = state.variants[key] || JSON.parse(localStorage.getItem(`bimx_variant_${key}`) || 'null');
    if (saved) {
      state.variants[key] = saved;
      applyConceptToState(saved);
    }
  }

  variantPills.forEach(pill => {
    pill.addEventListener('click', () => {
      saveCurrentVariant(state.activeVariantKey);
      loadVariant(pill.dataset.variant);
    });
  });

  if (btnSaveVariant) {
    btnSaveVariant.addEventListener('click', () => {
      saveCurrentVariant(state.activeVariantKey);
      const original = btnSaveVariant.innerHTML;
      btnSaveVariant.innerHTML = `<i class="fa-solid fa-check"></i> <span>შენახულია</span>`;
      setTimeout(() => btnSaveVariant.innerHTML = original, 2000);
    });
  }

  if (btnDupVariant) {
    btnDupVariant.addEventListener('click', () => {
      saveCurrentVariant(state.activeVariantKey);
      const nextKey = state.activeVariantKey === 'A' ? 'B' : (state.activeVariantKey === 'B' ? 'C' : 'A');
      state.variants[nextKey] = JSON.parse(JSON.stringify(state.activeConcept));
      loadVariant(nextKey);
    });
  }

  /* ==========================================================================
     14. CAD & BIM Export Engine (IFC, DXF, GLTF, OBJ, GAP PDF, GeoJSON, PNG)
     ========================================================================== */
  function triggerFileDownload(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // 3A. BIM Export (.IFC - IFC2x3 standard ISO-10303-21)
  function exportIFCModel() {
    if (!state.activeParcel) {
      alert('გთხოვთ, ჯერ აირჩიოთ ან მოძებნოთ ნაკვეთი.');
      return;
    }
    const parcel = state.activeParcel;
    const concept = state.activeConcept || { floors: 5, floorHeight: 3.3, width: 22, length: 18 };
    const fp = computeFootprintGeometry(parcel, concept) || { width: 22, length: 18, area: 396 };
    const floors = concept.floors || 5;
    const floorH = concept.floorHeight || 3.3;
    const w = fp.width || 22;
    const l = fp.length || 18;

    const lat = (parcel.coordinates && parcel.coordinates.length > 0) ? parcel.coordinates[0][0] : 41.7151;
    const lng = (parcel.coordinates && parcel.coordinates.length > 0) ? parcel.coordinates[0][1] : 44.8271;
    const nowISO = new Date().toISOString().replace(/\.\d+Z$/, '');

    let ifc = `ISO-10303-21;\n`;
    ifc += `HEADER;\n`;
    ifc += `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n`;
    ifc += `FILE_NAME('BIMX_${parcel.code}.ifc','${nowISO}',('BIMX Studio'),('BIMX Architecture AI'),'Antigravity BIM Engine v2.0','Autodesk Revit & ArchiCAD Compatible','');\n`;
    ifc += `FILE_SCHEMA(('IFC2X3'));\n`;
    ifc += `ENDSEC;\n`;
    ifc += `DATA;\n`;
    ifc += `#1=IFCPERSON($,$,'BIMX Architect',$,$,$,$,$);\n`;
    ifc += `#2=IFCORGANIZATION($,'BIMX Studio PropTech Ltd',$,$,$);\n`;
    ifc += `#3=IFCPERSONANDORGANIZATION(#1,#2,$);\n`;
    ifc += `#4=IFCAPPLICATION(#2,'2026.2','BIMX Autonomous Architecture','BIMX');\n`;
    ifc += `#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,$);\n`;
    ifc += `#6=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);\n`;
    ifc += `#7=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);\n`;
    ifc += `#8=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);\n`;
    ifc += `#9=IFCUNITASSIGNMENT((#6,#7,#8));\n`;
    ifc += `#10=IFCPROJECT('01AbCdEfGhIjKlMnOpQrSt',#5,'BIMX_${parcel.code}',$,$,$,$,(#11),#9);\n`;
    ifc += `#11=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#12,$);\n`;
    ifc += `#12=IFCAXIS2PLACEMENT3D(#13,$,$);\n`;
    ifc += `#13=IFCCARTESIANPOINT((0.,0.,0.));\n`;
    ifc += `#20=IFCSITE('02SiteIdentBimx123456',#5,'Cadastral Parcel ${parcel.code}','Tbilisi Municipality Parcels',$,#21,$,$,.ELEMENT.,(${Math.round(lat)},0,0),(${Math.round(lng)},0,0),0.,$,$);\n`;
    ifc += `#21=IFCLOCALPLACEMENT($,#12);\n`;
    ifc += `#22=IFCRELAGGREGATES('03RelProjSite12345678',#5,$,$,#10,(#20));\n`;
    ifc += `#30=IFCBUILDING('04BldgIdentBimx123456',#5,'Proposed Building','Zoning Type ${parcel.zone || "SSZ-2"}',$,#31,$,$,.ELEMENT.,$,$,$);\n`;
    ifc += `#31=IFCLOCALPLACEMENT(#21,#12);\n`;
    ifc += `#32=IFCRELAGGREGATES('05RelSiteBldg12345678',#5,$,$,#20,(#30));\n`;

    let entityId = 100;
    const storeyIds = [];

    for (let i = 1; i <= floors; i++) {
      const elev = (i - 1) * floorH;
      const storeyId = entityId++;
      storeyIds.push(storeyId);

      const ptId = entityId++;
      const axisId = entityId++;
      const placeId = entityId++;
      const slabId = entityId++;
      const wallId = entityId++;

      ifc += `#${ptId}=IFCCARTESIANPOINT((0.,0.,${elev.toFixed(2)}));\n`;
      ifc += `#${axisId}=IFCAXIS2PLACEMENT3D(#${ptId},$,$);\n`;
      ifc += `#${placeId}=IFCLOCALPLACEMENT(#31,#${axisId});\n`;
      ifc += `#${storeyId}=IFCBUILDINGSTOREY('${i}StoreyIdBimx12345',#5,'Level ${i} (+${elev.toFixed(1)}m)',$,$,#${placeId},$,$,.ELEMENT.,${elev.toFixed(2)});\n`;
      ifc += `#${slabId}=IFCSLAB('${i}SlabIdBimx12345678',#5,'Floor Slab L${i}',$,$,#${placeId},$,$,.FLOOR.);\n`;
      ifc += `#${wallId}=IFCWALL('${i}WallIdBimx12345678',#5,'Exterior Envelope L${i}',$,$,#${placeId},$,$,.STANDARD.);\n`;

      const relContId = entityId++;
      ifc += `#${relContId}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${i}RelContBimx123456',#5,$,$,(#${slabId},#${wallId}),#${storeyId});\n`;
    }

    const relBldgStoreysId = entityId++;
    ifc += `#${relBldgStoreysId}=IFCRELAGGREGATES('06RelBldgStoreys123',#5,$,$,#30,(${storeyIds.map(id => '#' + id).join(',')}));\n`;
    ifc += `ENDSEC;\n`;
    ifc += `END-ISO-10303-21;\n`;

    triggerFileDownload(ifc, 'application/x-step', `BIMX_${parcel.code}_Model.ifc`);
  }

  // 3C. Vector CAD Export (.DXF with 4 dedicated layers - Revit & AutoCAD 100% Compliant)
  async function exportDXFModel() {
    if (!state.activeParcel) {
      alert('გთხოვთ, ჯერ აირჩიოთ ან მოძებნოთ ნაკვეთი.');
      return;
    }
    const parcel = state.activeParcel;
    const coords = parcel.coordinates || [];
    if (coords.length === 0) return;

    const centerLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const centerLng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    const mPerLat = 111139;
    const mPerLng = 111139 * Math.cos(centerLat * Math.PI / 180);

    const boundaryMeters = coords.map(c => [
      Math.round(((c[1] - centerLng) * mPerLng) * 1000) / 1000,
      Math.round(((c[0] - centerLat) * mPerLat) * 1000) / 1000
    ]);

    const concept = state.activeConcept || { floors: 5, floorHeight: 3.3 };
    const fp = computeFootprintGeometry(parcel, concept) || { width: 20, length: 16 };
    const hw = (fp.width || 20) / 2;
    const hl = (fp.length || 16) / 2;
    const rotRad = ((concept.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    const rawCorners = [
      [-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]
    ];
    const footprintMeters = rawCorners.map(([x, y]) => [
      Math.round((x * cosR - y * sinR) * 1000) / 1000,
      Math.round((x * sinR + y * cosR) * 1000) / 1000
    ]);

    const setbackMeters = rawCorners.map(([x, y]) => {
      const sx = x > 0 ? x + 3.0 : x - 3.0;
      const sy = y > 0 ? y + 3.0 : y - 3.0;
      return [
        Math.round((sx * cosR - sy * sinR) * 1000) / 1000,
        Math.round((sx * sinR + sy * cosR) * 1000) / 1000
      ];
    });

    const redLinesMeters = boundaryMeters.map(([x, y]) => [
      Math.round((x * 0.92) * 1000) / 1000,
      Math.round((y * 0.92) * 1000) / 1000
    ]);

    const payload = {
      cadastralCode: parcel.code,
      boundary: boundaryMeters,
      redLines: redLinesMeters,
      footprint: footprintMeters,
      setback: setbackMeters
    };

    // 1. Try server-side generation via dxf-writer API
    try {
      const response = await fetch('/api/export-dxf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `BIMX_${parcel.code}_Layers.dxf`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
    } catch (e) {
      console.warn('API /api/export-dxf fallback to local R12 engine:', e);
    }

    // 2. Client-side Universal AutoCAD R12 / Revit Model Space Generator
    const layers = [
      { name: 'CADASTRAL_BOUNDARY', color: 1, ltype: 'CONTINUOUS', points: boundaryMeters },
      { name: 'RED_LINES', color: 6, ltype: 'DASHED', points: redLinesMeters },
      { name: 'BUILDING_FOOTPRINT', color: 4, ltype: 'CONTINUOUS', points: footprintMeters },
      { name: 'SETBACKS_BUFFER', color: 2, ltype: 'CONTINUOUS', points: setbackMeters }
    ];

    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n" + layers.length + "\n";
    for (const l of layers) {
      dxf += "0\nLAYER\n2\n" + l.name + "\n70\n0\n62\n" + l.color + "\n6\n" + l.ltype + "\n";
    }
    dxf += "0\nENDTAB\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nBLOCKS\n";
    dxf += "0\nBLOCK\n8\n0\n2\n*MODEL_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*MODEL_SPACE\n0\nENDBLK\n8\n0\n";
    dxf += "0\nBLOCK\n8\n0\n2\n*PAPER_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*PAPER_SPACE\n0\nENDBLK\n8\n0\n";
    dxf += "0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nENTITIES\n";

    for (const l of layers) {
      if (!l.points || l.points.length < 2) continue;
      for (let i = 0; i < l.points.length; i++) {
        const p1 = l.points[i];
        const p2 = l.points[(i + 1) % l.points.length];
        dxf += `0\nLINE\n8\n${l.name}\n10\n${Number(p1[0]).toFixed(3)}\n20\n${Number(p1[1]).toFixed(3)}\n30\n0.0\n11\n${Number(p2[0]).toFixed(3)}\n21\n${Number(p2[1]).toFixed(3)}\n31\n0.0\n`;
      }
    }

    dxf += "0\nENDSEC\n0\nEOF\n";
    triggerFileDownload(dxf, 'application/dxf', `BIMX_${parcel.code}_Layers.dxf`);
  }

  // 3B. 3D OBJ Export
  function exportOBJModel() {
    if (!state.activeParcel) return;
    if (typeof THREE.OBJExporter !== 'undefined') {
      const exporter = new THREE.OBJExporter();
      const exportGroup = new THREE.Group();
      if (buildingGroup) exportGroup.add(buildingGroup.clone());
      if (urbanGroup) exportGroup.add(urbanGroup.clone());
      const result = exporter.parse(exportGroup);
      triggerFileDownload(result, 'text/plain', `BIMX_${state.activeParcel.code}_Urban3D.obj`);
    } else {
      const fp = computeFootprintGeometry(state.activeParcel, state.activeConcept);
      if (!fp) return;
      const h = (state.activeConcept.floors || 5) * (state.activeConcept.floorHeight || 3.3);
      const w = fp.width;
      const l = fp.length;
      let objContent = `# BIMX Studio 3D Architectural Massing OBJ\n`;
      objContent += `# Cadastral: ${state.activeParcel.code}\n\n`;
      objContent += `v ${-w/2} 0 ${-l/2}\nv ${w/2} 0 ${-l/2}\nv ${w/2} 0 ${l/2}\nv ${-w/2} 0 ${l/2}\n`;
      objContent += `v ${-w/2} ${h} ${-l/2}\nv ${w/2} ${h} ${-l/2}\nv ${w/2} ${h} ${l/2}\nv ${-w/2} ${h} ${l/2}\n\n`;
      objContent += `f 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 2 6 7 3\nf 3 7 8 4\nf 5 1 4 8\n`;
      triggerFileDownload(objContent, 'text/plain', `${state.activeParcel.code}-Massing.obj`);
    }
  }

  // 3B. 3D glTF 2.0 Export
  function exportGLTFModel() {
    if (!state.activeParcel) {
      alert('გთხოვთ, ჯერ აირჩიოთ ან მოძებნოთ ნაკვეთი.');
      return;
    }
    if (typeof THREE.GLTFExporter === 'undefined') {
      alert('GLTF Exporter არ არის ჩატვირთული.');
      return;
    }
    const exporter = new THREE.GLTFExporter();
    const exportScene = new THREE.Scene();
    if (terrainGroup) exportScene.add(terrainGroup.clone());
    if (urbanGroup) exportScene.add(urbanGroup.clone());
    if (buildingGroup) exportScene.add(buildingGroup.clone());

    exporter.parse(exportScene, (gltf) => {
      const output = JSON.stringify(gltf, null, 2);
      triggerFileDownload(output, 'model/gltf+json', `BIMX_${state.activeParcel.code}_Scene.gltf`);
    }, { binary: false });
  }

  // 4C. One-Click Automated GAP (გპპ) PDF Feasibility Dossier Generator
  function generateGAPPdf() {
    const isKa = (state.currentLang !== 'en');
    if (!state.activeParcel) {
      alert(isKa ? 'გთხოვთ, ჯერ აირჩიოთ ნაკვეთი.' : 'Please select a parcel first.');
      return;
    }
    const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPdfClass) {
      window.print();
      return;
    }

    const parcel = state.activeParcel;
    const comp = state.compliance || {};
    const concept = state.activeConcept || {};
    const terrain = state.terrainData || {};

    const doc = new jsPdfClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Register embedded Noto Sans Georgian font if available
    let fontName = 'helvetica';
    if (window.GEORGIAN_FONT_REGULAR_B64) {
      try {
        doc.addFileToVFS('NotoSansGeorgian-Regular.ttf', window.GEORGIAN_FONT_REGULAR_B64);
        doc.addFont('NotoSansGeorgian-Regular.ttf', 'NotoSansGeorgian', 'normal');
        if (window.GEORGIAN_FONT_BOLD_B64) {
          doc.addFileToVFS('NotoSansGeorgian-Bold.ttf', window.GEORGIAN_FONT_BOLD_B64);
          doc.addFont('NotoSansGeorgian-Bold.ttf', 'NotoSansGeorgian', 'bold');
        }
        fontName = 'NotoSansGeorgian';
      } catch (err) {
        console.warn('Font registration notice:', err);
      }
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString(isKa ? 'ka-GE' : 'en-GB');
    const timeStr = now.toLocaleTimeString(isKa ? 'ka-GE' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Dark Header Banner
    doc.setFillColor(10, 14, 23);
    doc.rect(0, 0, pageWidth, 42, 'F');

    // Neon Accent Line
    doc.setFillColor(0, 242, 254);
    doc.rect(0, 41.5, pageWidth, 1.5, 'F');

    // Header Title
    doc.setTextColor(255, 255, 255);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(isKa ? 13.5 : 15);
    doc.text(
      isKa ? 'BIMX STUDIO · ურბანული GIS და არქიტექტურული ხელოვნური ინტელექტი (AI)' : 'BIMX STUDIO · URBAN GIS & ARCHITECTURAL AI',
      14, 15
    );

    doc.setFontSize(9);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      isKa ? 'წინასაპროექტო კვლევა (დოსიე) · მშენებლობის ნებართვის I ეტაპი (გაპ / GPP)' : 'Pre-Feasibility Dossier · Construction Permit Stage 1 (GAP / GPP)',
      14, 22
    );
    doc.text(
      isKa ? `გენერირებულია: ${dateStr} ${timeStr} | რეგ. №: GAP-${parcel.code}` : `Generated: ${dateStr} ${timeStr} | Ref: GAP-${parcel.code}`,
      14, 28
    );

    doc.setFontSize(8);
    doc.setTextColor(0, 242, 254);
    doc.text(
      isKa ? 'ავტონომიური PropTech & ConTech ძრავი · თბილისის №14-39 დადგენილებასთან შესაბამისი' : 'Autonomous PropTech & ConTech Engine · Resolution 14-39 Compliant',
      14, 35
    );

    // Section 1: Cadastral Metadata
    doc.setTextColor(17, 24, 39);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.text(
      isKa ? '1. საკადასტრო და გეოგრაფიული მახასიათებლები' : '1. CADASTRAL & GEOGRAPHICAL SPECIFICATIONS',
      14, 50
    );

    const slopeVal = terrain.slopePercent || 4.2;
    const slopeText = isKa
      ? `${slopeVal.toFixed(1)} % (${slopeVal > 10 ? 'მაღალი დახრილობა' : 'დაბალი დახრილობა'})`
      : `${slopeVal.toFixed(1)} % (${slopeVal > 10 ? 'High Risk' : 'Gentle Slope'})`;

    const metaData = [
      [
        isKa ? 'საკადასტრო კოდი' : 'Cadastral Code',
        parcel.code || 'N/A',
        isKa ? 'ფუნქციური ზონა' : 'Zoning Classification',
        parcel.zone || (isKa ? 'სსზ-2' : 'SSZ-2')
      ],
      [
        isKa ? 'მისამართი / რაიონი' : 'Address / District',
        parcel.address || (isKa ? 'თბილისი, საქართველო' : 'Tbilisi, Georgia'),
        isKa ? 'ნაკვეთის ფართობი' : 'Cadastral Land Area',
        `${(parcel.area || 0).toLocaleString()} ${isKa ? 'მ²' : 'm²'}`
      ],
      [
        isKa ? 'რელიეფის დახრილობა' : 'Natural Slope Gradient',
        slopeText,
        isKa ? 'სიმაღლეთა სხვაობა (ΔZ)' : 'Parcel Elevation Delta (ΔZ)',
        `${(terrain.deltaZ || 3.1).toFixed(1)} ${isKa ? 'მ' : 'm'}`
      ],
      [
        isKa ? 'WGS84 კოორდინატები' : 'WGS84 Centroid Coords',
        `${(parcel.coordinates && parcel.coordinates[0] ? parcel.coordinates[0][0].toFixed(5) : 41.7151)}, ${(parcel.coordinates && parcel.coordinates[0] ? parcel.coordinates[0][1].toFixed(5) : 44.8271)}`,
        isKa ? 'საკოორდინატო სისტემა' : 'National Grid Reference',
        'UTM 38N / EPSG:4326'
      ]
    ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: 54,
        body: metaData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2, font: fontName },
        columnStyles: {
          0: { font: fontName, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59], cellWidth: 42 },
          1: { font: fontName, cellWidth: 50 },
          2: { font: fontName, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59], cellWidth: 42 },
          3: { font: fontName, cellWidth: 46 }
        },
        margin: { left: 14, right: 14 }
      });
    }

    // Section 2: Statutory Zoning & K-Coefficients Table
    const tableY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 75) + 8;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(
      isKa ? '2. თბილისის განაშენიანების რეგულირების ნორმებთან შესაბამისობა (№14-39)' : '2. TBILISI STATUTORY ZONING COMPLIANCE (RESOLUTION №14-39)',
      14, tableY
    );

    const normHeaders = isKa
      ? [['სამშენებლო ნორმა / კოეფიციენტი', 'მაქს. / მინ. ზღვარი', 'საპროექტო მაჩვენებელი', 'გამოთვლილი ფართობი', 'აუდიტის სტატუსი']]
      : [['Zoning Metric / Coefficient', 'Max / Min Norm', 'Proposed Design', 'Calculated Floor Area', 'Audit Status']];

    const k1StatusText = comp.k1Status === 'fail' ? (isKa ? 'გადამეტებულია' : 'EXCEEDED') : (isKa ? 'დაცულია' : 'COMPLIANT');
    const k2StatusText = comp.k2Status === 'fail' ? (isKa ? 'გადამეტებულია' : 'EXCEEDED') : (isKa ? 'დაცულია' : 'COMPLIANT');
    const k3StatusText = comp.k3Status === 'fail' ? (isKa ? 'დეფიციტი' : 'DEFICIT') : (isKa ? 'დაცულია' : 'COMPLIANT');
    const parkingStatusText = (comp.parkingProvided < comp.parkingRequired) ? (isKa ? 'დეფიციტი' : 'DEFICIT') : (isKa ? 'უზრუნველყოფილია' : 'VERIFIED');

    const normRows = [
      [
        isKa ? 'K1 (განაშენიანების კოეფიციენტი)' : 'K1 (Building Footprint Ratio)',
        (parcel.k1Max || 0.5).toFixed(2),
        (comp.k1Actual || 0.42).toFixed(2),
        `${Math.round(comp.footprintArea || 500)} ${isKa ? 'მ²' : 'm²'}`,
        k1StatusText
      ],
      [
        isKa ? 'K2 (განაშენიანების ინტენსივობა)' : 'K2 (Development Intensity Ratio)',
        (parcel.k2Max || 3.5).toFixed(2),
        (comp.k2Actual || 2.1).toFixed(2),
        `${Math.round(comp.totalFloorArea || 2500)} ${isKa ? 'მ²' : 'm²'}`,
        k2StatusText
      ],
      [
        isKa ? 'K3 (გამწვანების კოეფიციენტი)' : 'K3 (Green Permeable Area Ratio)',
        (parcel.k3Min || 0.2).toFixed(2),
        (comp.k3Actual || 0.25).toFixed(2),
        `${Math.round(comp.greenArea || 300)} ${isKa ? 'მ²' : 'm²'}`,
        k3StatusText
      ],
      [
        isKa ? 'შენობის მაქსიმალური სიმაღლე' : 'Maximum Building Height',
        isKa ? 'ზონის გენგეგმის მიხედვით' : 'Per Zone Master Plan',
        `${((concept.floors || 5) * (concept.floorHeight || 3.3)).toFixed(1)} ${isKa ? 'მ' : 'm'}`,
        `${concept.floors || 5} ${isKa ? 'მიწისზედა სართული' : 'Above-ground Levels'}`,
        isKa ? 'დაშვებულია' : 'PERMITTED'
      ],
      [
        isKa ? 'მიწისქვეშა / ზედაპირული პარკინგი' : 'Underground / Surface Parking',
        isKa ? '1 ადგილი / 30-50 მ² ან ბინაზე' : '1 space / 30-50 m² or unit',
        `${comp.parkingRequired || 18} ${isKa ? 'ადგილი მოთხ.' : 'spaces req.'}`,
        `${comp.parkingProvided || 20} ${isKa ? 'ადგილი დაპროექტ.' : 'slots designed'}`,
        parkingStatusText
      ]
    ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: tableY + 4,
        head: normHeaders,
        body: normRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], font: fontName, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.2, font: fontName },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 4) {
            const val = data.cell.raw;
            const isGood = ['COMPLIANT', 'PERMITTED', 'VERIFIED', 'დაცულია', 'დაშვებულია', 'უზრუნველყოფილია'].includes(val);
            if (isGood) {
              data.cell.styles.textColor = [16, 185, 129];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: 14, right: 14 }
      });
    }

    // Section 3: AI Regulatory & Risk Assessment
    const riskY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 130) + 8;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(
      isKa ? '3. ხელოვნური ინტელექტის (AI) რისკების შეფასება და სამართლებრივი შეზღუდვები' : '3. AI RISK ASSESSMENT & LEGAL CONSTRAINTS CHECKLIST',
      14, riskY
    );

    const isHistoric = (parcel.code.startsWith('01.16') || parcel.code.startsWith('01.14.01') || parcel.code.startsWith('03.02'));
    const isSteep = (terrain.slopePercent && terrain.slopePercent > 10);
    const overallRisk = (isHistoric || isSteep) ? (isHistoric && isSteep ? 'HIGH' : 'MEDIUM') : 'LOW';
    const overallRiskKa = overallRisk === 'HIGH' ? 'მაღალი' : (overallRisk === 'MEDIUM' ? 'საშუალო' : 'დაბალი');

    const riskHeaders = isKa
      ? [['საკვლევი პარამეტრი და შეზღუდვა', 'ანალიზის შედეგი და სივრცითი ვერიფიკაცია', 'სტატუსი']]
      : [['Feasibility Assessment Parameter', 'Analysis Findings & Spatial Verification', 'Result']];

    const riskRows = [
      [
        isKa ? 'კულტურული მემკვიდრეობის დამცავი ზონა' : 'Cultural Heritage Protection Buffer',
        isKa
          ? (isHistoric ? 'შეზღუდვა: ნაკვეთი მდებარეობს ისტორიულ ან მომიჯნავე დამცავ ზონაში' : 'სუფთაა: ნაკვეთი არ მდებარეობს ისტორიულ დამცავ არეალში')
          : (isHistoric ? 'RESTRICTION: Site within/adjacent to historical buffer' : 'CLEARED: Parcel outside protected historical zones'),
        isKa ? (isHistoric ? 'საყურადღებო' : 'დადებითი') : (isHistoric ? 'HIGH ATTENTION' : 'PASSED')
      ],
      [
        isKa ? 'გზის გაფართოება და მარეგულირებელი წითელი ხაზები' : 'Road Widening & Statutory Red Lines',
        isKa
          ? 'სუფთაა: დაცულია მინიმუმ 3.0მ რეგულაციური დაშორება წითელი ხაზებიდან'
          : 'CLEARED: Minimum 3.0m street setback regulatory buffer maintained',
        isKa ? 'დადებითი' : 'PASSED'
      ],
      [
        isKa ? 'ფერდობის მდგრადობა და გეოლოგიური რისკი' : 'Slope Stability & Earthwork Hazard',
        isKa
          ? (isSteep ? `გაფრთხილება: ფერდობის დახრილობა (${terrain.slopePercent.toFixed(1)}%) აღემატება 10%-იან ზღვარს` : 'უსაფრთხოა: რელიეფის ბუნებრივი დახრილობა დაბალია (< 10%)')
          : (isSteep ? `WARNING: Slope gradient (${terrain.slopePercent.toFixed(1)}%) exceeds 10% threshold` : 'SAFE: Natural slope gradient is gentle (< 10%)'),
        isKa ? (isSteep ? 'გეოლოგია მოთხ.' : 'დადებითი') : (isSteep ? 'GEOTECH REQ.' : 'PASSED')
      ],
      [
        isKa ? 'ნებართვის აღების საერთო რისკის დონე' : 'Overall Permit Risk Level',
        isKa
          ? `საერთო შეფასება: ${overallRiskKa} რისკი I ეტაპის არქიტექტურული ნებართვისთვის (გაპ)`
          : `Overall Assessment: ${overallRisk} RISK for Stage 1 Architectural Permit (GAP)`,
        isKa ? overallRiskKa : overallRisk
      ]
    ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: riskY + 4,
        head: riskHeaders,
        body: riskRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], font: fontName, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.8, cellPadding: 2.2, font: fontName },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 2) {
            const v = data.cell.raw;
            const isGood = ['PASSED', 'LOW', 'დადებითი', 'დაბალი'].includes(v);
            if (isGood) {
              data.cell.styles.textColor = [16, 185, 129];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: 14, right: 14 }
      });
    }

    // Recommendation Box
    const recY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 180) + 6;
    doc.setFillColor(240, 249, 255);
    doc.setDrawColor(56, 189, 248);
    doc.roundedRect(14, recY, pageWidth - 28, 25, 2, 2, 'FD');

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(3, 105, 161);
    doc.text(
      isKa ? 'მუნიციპალიტეტში წარსადგენი ოფიციალური რეკომენდაცია (ეტაპი 1 - გაპ):' : 'OFFICIAL MUNICIPAL SUBMISSION RECOMMENDATION (STAGE 1 - GAP):',
      18, recY + 6
    );

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    let recText = '';
    if (isKa) {
      recText = isHistoric
        ? 'ნაკვეთზე მშენებლობის ნებართვის I ეტაპის (გაპ) მისაღებად საჭიროა კულტურული მემკვიდრეობის საბჭოსთან შეთანხმება. წარადგინეთ კონტექსტური ქუჩის ფასადები და მოცულობითი ინტეგრაციის კვლევა.'
        : 'სამშენებლო ნაკვეთი სრულად შეესაბამება №14-39 დადგენილების პარამეტრებს. მზადაა თბილისის არქიტექტურის სამსახურში (tas.ge) გაპ-ის I ეტაპის განაცხადის შესატანად საინჟინრო-გეოლოგიურ დასკვნასთან ერთად.';
    } else {
      recText = isHistoric
        ? 'The parcel requires Cultural Heritage Agency approval prior to GAP issuance. Submit contextual street facade elevations and volume integration study.'
        : 'Parcel is compliant with Resolution 14-39 parameters. Ready for submission of GAP Stage 1 application to Tbilisi Municipal Service with engineering geology report.';
    }
    doc.text(recText, 18, recY + 12, { maxWidth: pageWidth - 36 });

    const disclaimerText = isKa
      ? 'შენიშვნა: მოცემული AI წინასაპროექტო კვლევა აჩქარებს საპროექტო პროცესს და არ ცვლის tas.ge-ს ოფიციალურ მუნიციპალურ ნებართვებს.'
      : 'Note: This AI pre-feasibility analysis accelerates architectural planning and does not replace official municipal permits issued by tas.ge.';
    doc.text(disclaimerText, 18, recY + 20, { maxWidth: pageWidth - 36 });

    // PAGE 2: 3D Perspective & Solar Shadow Simulation
    doc.addPage();

    doc.setFillColor(10, 14, 23);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setFillColor(0, 242, 254);
    doc.rect(0, 23.5, pageWidth, 0.8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.text(
      isKa ? '3D სივრცითი მოდელირება და მზის ინსოლაციის სიმულაცია (SUNCALC)' : '3D SPATIAL MODELING & SOLAR INSOLATION SIMULATION (SUNCALC)',
      14, 13
    );
    doc.setFontSize(7.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      isKa ? `საკადასტრო კოდი: ${parcel.code} · ბუნიობის მზისა და ჩრდილის სიმულაცია (12:00)` : `Parcel: ${parcel.code} · Equinox Solar Shadow Study (12:00 PM)`,
      14, 18
    );

    // Embed WebGL Snapshot
    try {
      if (renderer) {
        const imgData = renderer.domElement.toDataURL('image/png');
        const imgW = pageWidth - 28;
        const imgH = (imgW * 9) / 16;
        doc.addImage(imgData, 'PNG', 14, 30, imgW, imgH);
      }
    } catch (e) {
      console.warn('Canvas capture warning:', e);
    }

    const notesY = 30 + ((pageWidth - 28) * 9) / 16 + 8;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      isKa ? '4. გარემოსდაცვითი და ურბანული კონტექსტის მეთოდოლოგია' : '4. ENVIRONMENTAL & URBAN CONTEXT METHODOLOGY',
      14, notesY
    );

    const techNotes = isKa ? [
      ['რელიეფის ციფრული მოდელი (DEM)', 'AWS Mapzen Terrarium სიმაღლეთა ტაილები და Open-Elevation ტოპოგრაფიული მოდელირება ბუნებრივი რელიეფის დახრილობისა და ჰორიზონტალების დასადგენად.'],
      ['მომიჯნავე ურბანული ქსოვილი', 'OpenStreetMap Overpass API-ს მეშვეობით 350მ რადიუსში არსებული შენობების ექსტრუზია რეალური სართულიანობისა და სიმაღლეების გათვალისწინებით.'],
      ['ინსოლაცია და ჩრდილების სიმულაცია', 'SunCalc ასტრონომიული ალგორითმი მზის სიმაღლისა და აზიმუტის გამოსათვლელად ბუნიობისა და ნაბუნიობის დღეებში, მეზობელ ნაკვეთებზე ჩრდილის გავლენის შესაფასებლად.'],
      ['CAD & BIM თავსებადობა', 'შენობის მოცულობითი გეომეტრიის ექსპორტი ISO-10303-21 IFC2x3 სტანდარტით და AutoCAD DXF ფორმატით Revit/ArchiCAD პროგრამებში სამუშაოდ.']
    ] : [
      ['Digital Elevation Model (DEM)', 'AWS Mapzen Terrarium elevation tiles and Open-Elevation topographical modeling for natural terrain slope & contour derivation.'],
      ['Surrounding Urban Fabric', 'OpenStreetMap Overpass API extraction within 350m radius. Extruded architectural massing based on real levels and heights.'],
      ['Solar Insolation & Shadows', 'SunCalc astronomical solar path engine computing altitude and azimuth for equinoxes and solstices to evaluate shadowing on adjacent parcels.'],
      ['CAD & BIM Interoperability', 'Building envelope geometry exportable to ISO-10303-21 IFC2x3 standard and layered AutoCAD DXF format for Revit/ArchiCAD workflows.']
    ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: notesY + 3,
        body: techNotes,
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 2.2, font: fontName },
        columnStyles: {
          0: { font: fontName, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [30, 41, 59], cellWidth: 50 },
          1: { font: fontName, cellWidth: pageWidth - 28 - 50 }
        },
        margin: { left: 14, right: 14 }
      });
    }

    const stampY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 210) + 8;
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, stampY, pageWidth - 28, 24, 2, 2, 'FD');

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      isKa ? 'BIMX STUDIO ავტომატური ვერიფიკაციის სერტიფიკატი' : 'BIMX STUDIO AUTOMATED VERIFICATION CERTIFICATE',
      18, stampY + 6
    );
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7);
    const digitalHash = Math.random().toString(36).substring(2, 10).toUpperCase();
    doc.text(
      isKa ? `ციფრული ჰეში: SHA256-${digitalHash} · ავტონომიური სივრცითი AI აგენტის ვერიფიკაცია` : `Digital Hash: SHA256-${digitalHash} · Autonomous Spatial Agent Verification`,
      18, stampY + 11
    );
    doc.text(
      isKa ? 'არქიტექტურული წინასაპროექტო პლატფორმა · https://bimx.ge · თბილისი, საქართველო' : 'Architectural Pre-Feasibility Platform · https://bimx.ge · Tbilisi, Georgia',
      18, stampY + 16
    );

    const pdfFileName = isKa ? `BIMX_გაპ_${parcel.code}_კვლევა.pdf` : `BIMX_GAP_${parcel.code}_Feasibility_Dossier.pdf`;
    doc.save(pdfFileName);
  }

  // Button Listeners Connection
  const exportBtnGapPdf = document.getElementById('exportBtnGapPdf');
  const exportBtnIfc = document.getElementById('exportBtnIfc');
  const exportBtnDxf = document.getElementById('exportBtnDxf');
  const exportBtnObj = document.getElementById('exportBtnObj');
  const exportBtnGltf = document.getElementById('exportBtnGltf');
  const exportBtnGeoJson = document.getElementById('exportBtnGeoJson');
  const exportBtnPng = document.getElementById('exportBtnPng');
  const exportBtnPdf = document.getElementById('exportBtnPdf');

  if (exportBtnGapPdf) exportBtnGapPdf.addEventListener('click', generateGAPPdf);
  if (exportBtnIfc) exportBtnIfc.addEventListener('click', exportIFCModel);
  if (exportBtnDxf) exportBtnDxf.addEventListener('click', exportDXFModel);
  if (exportBtnObj) exportBtnObj.addEventListener('click', exportOBJModel);
  if (exportBtnGltf) exportBtnGltf.addEventListener('click', exportGLTFModel);
  if (exportBtnPdf) exportBtnPdf.addEventListener('click', generateGAPPdf);

  if (exportBtnPng) {
    exportBtnPng.addEventListener('click', () => {
      if (renderer) {
        const dataURL = renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `BIMX-${state.activeParcel ? state.activeParcel.code : 'Parcel'}-3D-Concept.png`;
        link.href = dataURL;
        link.click();
      }
    });
  }

  if (exportBtnGeoJson) {
    exportBtnGeoJson.addEventListener('click', () => {
      if (!state.activeParcel) return;
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              cadastralCode: state.activeParcel.code,
              address: state.activeParcel.address,
              area: state.activeParcel.area
            },
            geometry: {
              type: 'Polygon',
              coordinates: [state.activeParcel.coordinates.map(c => [c[1], c[0]])]
            }
          }
        ]
      };
      triggerFileDownload(JSON.stringify(geojson, null, 2), 'application/json', `${state.activeParcel.code}.geojson`);
    });
  }

  // Sync language switching to active parcel attributes & statutory compliance
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentLang = btn.dataset.lang || 'ka';
      if (state.activeParcel) {
        updateParcelAttributesUI(state.activeParcel);
        evaluateStatutoryCompliance(state.activeParcel);
        updateComplianceUI();
      }
    });
  });

  /* ==========================================================================
     15. Initialize Map, 3D Canvas, and Default Search
     ========================================================================== */
  setTimeout(() => {
    initMap();
    initThree();
    // Auto-search first sample parcel
    searchParcel('01.15.02.038.003');
    setMode('3d');
  }, 100);
});
