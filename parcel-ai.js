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
    drawnPoints: [], // [[lat, lng], ...]
    customFootprint: null, // [[lat, lng], ...] or null
    xRayMode: false
  };

  // Authentic Cadastral Registry across Georgia (Real GPS coordinates and geometries)
  const CADASTRAL_DATABASE = {
    '01.15.02.038.003': {
      code: '01.15.02.038.003',
      address: 'თბილისი, საბურთალო, პეკინის გამზ. #28',
      addressEn: 'Tbilisi, Saburtalo, 28 Pekini Ave.',
      area: 1250,
      shape: 'მრავალკუთხა (არარეგულარული)',
      shapeEn: 'Polygonal (Irregular)',
      terrain: 'ვაკე / მცირედ დახრილი (2%)',
      terrainEn: 'Flat / Slight slope (2%)',
      zone: 'საზოგადოებრივ-საქმიანი ზონა 2 (სზ-2)',
      zoneEn: 'Public Business Zone 2 (SZ-2)',
      k1: 0.5,
      k2: 3.5,
      k3: 0.2,
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
      zone: 'საცხოვრებელი ზონა 6 (სზ-6)',
      zoneEn: 'Residential Zone 6 (SZ-6)',
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
      zone: 'საცხოვრებელი ზონა 5 (სზ-5)',
      zoneEn: 'Residential Zone 5 (SZ-5)',
      k1: 0.5,
      k2: 2.2,
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
     3. Three.js 3D WebGL Massing Canvas Setup
     ========================================================================== */
  let scene, camera, renderer, controls;
  let buildingGroup, groundGroup;

  function initThree() {
    const container = document.getElementById('threeViewport');
    if (!container || typeof THREE === 'undefined') return;

    // Clear existing
    container.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(state.currentTheme === 'dark' ? 0x07090e : 0xf1f5f9);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    camera.position.set(50, 45, 65);

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
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
      controls.minDistance = 10;
      controls.maxDistance = 350;
      controls.target.set(0, 8, 0);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(60, 100, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 250;
    const d = 50;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x00f0ff, 0.25);
    fillLight.position.set(-50, 30, -50);
    scene.add(fillLight);

    // Ground Grid Helper
    const gridHelper = new THREE.GridHelper(150, 30, 0x00f0ff, 0x334155);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    buildingGroup = new THREE.Group();
    groundGroup = new THREE.Group();
    scene.add(groundGroup);
    scene.add(buildingGroup);

    // Animation Loop
    function animate() {
      requestAnimationFrame(animate);
      if (controls) controls.update();
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

  // Regex format supporting dot and dash separators, 2-3 digit sections
  const CADASTRAL_CODE_REGEX = /^\d{2}[.\-]\d{2}[.\-]\d{2}[.\-]\d{2,3}[.\-]\d{2,3}$/;

  function normalizeCode(raw) {
    return (raw || '').trim().replace(/\s+/g, '');
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
            parcelData = {
              code: proxyData.cadastralCode,
              address: proxyData.address || "მისამართი დაზუსტებული არ არის",
              addressEn: proxyData.address || "Address not specified",
              area: proxyData.areaSqm || 1200,
              shape: "ოფიციალური კონტური (NAPR)",
              shapeEn: "Official Boundary (NAPR)",
              terrain: "რელიეფის დასაზუსტებლად საჭიროა ტოპოგრაფია",
              terrainEn: "Topographic survey required",
              zone: "საცხოვრებელი ზონა (სზ-2)",
              zoneEn: "Residential Zone (RZ-2)",
              k1: 0.5,
              k2: 2.1,
              k3: 0.3,
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

      // Reset any active custom drawing for new parcel
      state.customFootprint = null;
      state.drawnPoints = [];
      state.isDrawingMode = false;
      if (drawingLayerGroup) drawingLayerGroup.clearLayers();
      const customBadge = document.getElementById('customFootprintIndicator');
      if (customBadge) customBadge.style.display = 'none';
      const btnDraw = document.getElementById('btnDrawBuilding');
      if (btnDraw) btnDraw.classList.remove('active');
      const btnFinish = document.getElementById('btnFinishDraw');
      if (btnFinish) btnFinish.style.display = 'none';
      const btnClear = document.getElementById('btnClearDraw');
      if (btnClear) btnClear.style.display = 'none';
      const banner = document.getElementById('drawingGuideBanner');
      if (banner) banner.style.display = 'none';

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

    // Fit map bounds to parcel
    map.fitBounds(parcelPolygonLayer.getBounds(), { padding: [40, 40], maxZoom: 18 });

    // Update HUD Badge
    const hudCadastral = document.getElementById('hudCadastral');
    if (hudCadastral) hudCadastral.textContent = parcel.code;
    const hudArea = document.getElementById('hudArea');
    if (hudArea) hudArea.textContent = `${parcel.area.toLocaleString()} მ²`;
  }

  function renderParcelGround3D(parcel) {
    if (!groundGroup) return;

    // Clear existing ground
    while (groundGroup.children.length > 0) {
      groundGroup.remove(groundGroup.children[0]);
    }

    // Convert GPS coordinates to local meters centered at (0, 0)
    const localPoints = gpsToLocalMeters(parcel.coordinates);

    // Create 3D Shape
    const shape = new THREE.Shape();
    localPoints.forEach((pt, idx) => {
      if (idx === 0) shape.moveTo(pt.x, -pt.y);
      else shape.lineTo(pt.x, -pt.y);
    });
    shape.closePath();

    // Ground Plate
    const groundGeom = new THREE.ShapeGeometry(shape);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x182030,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = Math.PI / 2;
    groundMesh.receiveShadow = true;
    groundMesh.position.y = 0.05;
    groundGroup.add(groundMesh);

    // Plot Boundary Line
    const points3D = localPoints.map(p => new THREE.Vector3(p.x, 0.1, p.y));
    points3D.push(new THREE.Vector3(localPoints[0].x, 0.1, localPoints[0].y));
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points3D);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
    const lineMesh = new THREE.Line(lineGeom, lineMat);
    groundGroup.add(lineMesh);
  }

  // Convert lat/lng array to local meters using Equirectangular approximation
  function gpsToLocalMeters(coords) {
    if (!coords || coords.length === 0) return [];
    const centerLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const centerLng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

    const latToMeters = 111139;
    const lngToMeters = 111139 * Math.cos(centerLat * Math.PI / 180);

    return coords.map(c => ({
      x: (c[1] - centerLng) * lngToMeters,
      y: (c[0] - centerLat) * latToMeters
    }));
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
      // Auto-pick first parcel if none selected
      searchParcel('01.15.02.038.003');
    }

    const parsed = parseAIConceptPrompt(text);
    applyConceptToState(parsed);
  }

  function generateDefaultConcept(parcel) {
    const defaultParams = {
      buildingType: 'residential',
      floorsAbove: 5,
      floorsBelow: 1,
      floors: 5,
      totalArea: Math.round(parcel.area * 1.8),
      groundFloorUse: 'commercial',
      facadeMaterial: 'concrete',
      facadeColor: '#f1f5f9',
      style: 'modern',
      floorHeight: 3.3,
      rotation: 0
    };
    applyConceptToState(defaultParams);
  }

  function applyConceptToState(params) {
    const parcel = state.activeParcel;
    if (!parcel) return;

    // Determine footprint area: custom drawn footprint takes priority!
    let footprint;
    if (state.customFootprint && state.customFootprint.length >= 3) {
      const ring = state.customFootprint.map(pt => [pt[1], pt[0]]);
      ring.push([state.customFootprint[0][1], state.customFootprint[0][0]]);
      const poly = turf.polygon([ring]);
      footprint = Math.round(turf.area(poly));
    } else {
      footprint = params.footprint || (params.totalArea ? Math.round(params.totalArea / (params.floorsAbove || params.floors || 5)) : Math.round(parcel.area * 0.38));
      const maxFootprint = Math.round(parcel.area * 0.85);
      if (footprint > maxFootprint) footprint = maxFootprint;
    }

    const floorsAbove = params.floorsAbove !== undefined ? params.floorsAbove : (params.floors || 5);
    const floorsBelow = params.floorsBelow !== undefined ? params.floorsBelow : 1;
    const floorH = params.floorHeight || 3.3;

    params.footprint = footprint;
    params.floorsAbove = floorsAbove;
    params.floorsBelow = floorsBelow;
    params.floors = floorsAbove;
    params.floorHeight = floorH;
    params.totalArea = footprint * floorsAbove;
    params.freeLand = Math.max(0, parcel.area - footprint);
    params.k1Ratio = (footprint / parcel.area).toFixed(2);
    params.k2Ratio = (params.totalArea / parcel.area).toFixed(2);

    state.activeConcept = params;

    // Sync input sliders & readouts
    syncSlidersUI(params);

    // Generate 3D Building Massing on Three.js WebGL (using extruded polygon)
    renderBuilding3D(parcel, params);

    // Update Right Panel AI Assessment & Real-Time Zoning Compliance (ეტევი / ცდები)
    updateAssessmentUI(parcel, params);
    updateComplianceUI(parcel, params);
  }

  /* ==========================================================================
     6. Turf.js Footprint Generation (Supports Custom User Polygon & Auto Rectangle)
     ========================================================================== */
  function computeFootprintGeometry(parcel, concept) {
    // 1. If user drew a custom footprint on the map:
    if (state.customFootprint && state.customFootprint.length >= 3) {
      const customLocal = gpsToLocalMeters(state.customFootprint);
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

    // 2. Otherwise: procedural auto-concept rectangle
    const localPoints = gpsToLocalMeters(parcel.coordinates);
    if (localPoints.length < 3) return null;

    const xs = localPoints.map(p => p.x);
    const ys = localPoints.map(p => p.y);
    const parcelW = Math.max(...xs) - Math.min(...xs);
    const parcelH = Math.max(...ys) - Math.min(...ys);

    const targetArea = concept.footprint;
    const aspectRatio = 1.35;
    let bldgW = Math.sqrt(targetArea / aspectRatio);
    let bldgL = bldgW * aspectRatio;

    const setback = 4.0;
    const maxAllowedW = Math.max(10, parcelW - setback * 2);
    const maxAllowedL = Math.max(10, parcelH - setback * 2);

    if (bldgW > maxAllowedW) {
      bldgW = maxAllowedW;
      bldgL = targetArea / bldgW;
    }
    if (bldgL > maxAllowedL) {
      bldgL = maxAllowedL;
      bldgW = Math.min(targetArea / bldgL, maxAllowedW);
    }

    const halfW = bldgW / 2;
    const halfL = bldgL / 2;

    let corners = [
      { x: -halfW, y: -halfL },
      { x: halfW, y: -halfL },
      { x: halfW, y: halfL },
      { x: -halfW, y: halfL }
    ];

    const rad = (concept.rotation || 0) * Math.PI / 180;
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

  function renderFootprintOnMap(parcel, concept) {
    if (!map) return;
    if (buildingFootprintLayer) {
      map.removeLayer(buildingFootprintLayer);
      buildingFootprintLayer = null;
    }
    // Strict requirement: Do not display orange tile on cadastral parcel map
  }

  /* ==========================================================================
     7. Three.js 3D Procedural Architectural Massing & Custom Polygon Extruder
     ========================================================================== */
  function renderBuilding3D(parcel, concept) {
    if (!buildingGroup || !scene) return;

    // Remove existing building elements
    while (buildingGroup.children.length > 0) {
      buildingGroup.remove(buildingGroup.children[0]);
    }

    const fp = computeFootprintGeometry(parcel, concept);
    if (!fp || !fp.corners || fp.corners.length < 3) return;

    const floorsAbove = concept.floorsAbove !== undefined ? concept.floorsAbove : (concept.floors || 5);
    const floorsBelow = concept.floorsBelow !== undefined ? concept.floorsBelow : 1;
    const floorH = concept.floorHeight || 3.3;
    const totalAboveH = floorsAbove * floorH;

    // Construct 2D shape in local horizontal meters
    const shape = new THREE.Shape();
    fp.corners.forEach((pt, idx) => {
      if (idx === 0) shape.moveTo(pt.x, -pt.y);
      else shape.lineTo(pt.x, -pt.y);
    });
    shape.closePath();

    // Material Selection
    let wallColor = new THREE.Color(concept.facadeColor || 0xf1f5f9);
    let roughness = 0.6;
    let metalness = 0.1;

    if (concept.facadeMaterial === 'glass') {
      wallColor = new THREE.Color(0x38bdf8);
      roughness = 0.1;
      metalness = 0.85;
    } else if (concept.facadeMaterial === 'brick') {
      wallColor = new THREE.Color(0xb91c1c);
      roughness = 0.9;
    } else if (concept.facadeMaterial === 'composite') {
      wallColor = new THREE.Color(0x334155);
      metalness = 0.5;
    }

    const slabMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: roughness,
      metalness: metalness
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.75
    });

    const subterraneanMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.3,
      transparent: true,
      opacity: state.xRayMode ? 0.95 : 0.75
    });

    const subterraneanEdgeMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.85
    });

    // 1. Extrude Above-Ground Floors (Y >= 0)
    for (let f = 0; f < floorsAbove; f++) {
      const isGround = f === 0;
      const currentY = f * floorH;
      const curHeight = isGround ? floorH * 1.15 : floorH;

      // Floor Slab
      const slabGeom = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
      const slabMesh = new THREE.Mesh(slabGeom, slabMat);
      slabMesh.rotation.x = -Math.PI / 2;
      slabMesh.position.set(0, currentY, 0);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      buildingGroup.add(slabMesh);

      // Floor Core / Glazing Walls
      const curMat = (isGround && concept.groundFloorUse === 'commercial') ? glassMat : wallMat;
      const wallGeom = new THREE.ExtrudeGeometry(shape, { depth: curHeight - 0.35, bevelEnabled: false });
      const wallMesh = new THREE.Mesh(wallGeom, curMat);
      wallMesh.rotation.x = -Math.PI / 2;
      wallMesh.position.set(0, currentY + 0.35, 0);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      buildingGroup.add(wallMesh);
    }

    // Roof Slab & Parapet
    const roofSlabGeom = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: false });
    const roofMesh = new THREE.Mesh(roofSlabGeom, slabMat);
    roofMesh.rotation.x = -Math.PI / 2;
    roofMesh.position.set(0, totalAboveH, 0);
    roofMesh.castShadow = true;
    buildingGroup.add(roofMesh);

    const parapetGeom = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false });
    const parapetMesh = new THREE.Mesh(parapetGeom, wallMat);
    parapetMesh.rotation.x = -Math.PI / 2;
    parapetMesh.position.set(0, totalAboveH + 0.45, 0);
    buildingGroup.add(parapetMesh);

    // 2. Extrude Minus Floors / Subterranean Levels (Y < 0)
    for (let b = 1; b <= floorsBelow; b++) {
      const btmY = -b * floorH;
      const basementGeom = new THREE.ExtrudeGeometry(shape, { depth: floorH - 0.12, bevelEnabled: false });
      const basementMesh = new THREE.Mesh(basementGeom, subterraneanMat);
      basementMesh.rotation.x = -Math.PI / 2;
      basementMesh.position.set(0, btmY, 0);
      buildingGroup.add(basementMesh);

      const edges = new THREE.EdgesGeometry(basementGeom);
      const line = new THREE.LineSegments(edges, subterraneanEdgeMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, btmY, 0);
      buildingGroup.add(line);
    }

    // 3. Ground-level perimeter outline for custom drawn footprint (Emerald Green)
    if (fp.isCustom && fp.corners && fp.corners.length >= 3) {
      const basePoints = fp.corners.map(p => new THREE.Vector3(p.x, 0.15, p.y));
      basePoints.push(new THREE.Vector3(fp.corners[0].x, 0.15, fp.corners[0].y));
      const baseGeom = new THREE.BufferGeometry().setFromPoints(basePoints);
      const baseMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
      const baseOutline = new THREE.Line(baseGeom, baseMat);
      buildingGroup.add(baseOutline);
    }

    // Adjust camera target to center of mass
    if (controls) {
      controls.target.set(0, totalAboveH / 2, 0);
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

    set('infoCadastralCode', parcel.code);
    set('infoParcelArea', `${parcel.area.toLocaleString()} m²`);
    set('infoParcelShape', isEn ? parcel.shapeEn : parcel.shape);
    set('infoParcelAddress', isEn ? parcel.addressEn : parcel.address);
    set('infoParcelTerrain', isEn ? parcel.terrainEn : parcel.terrain);
    set('infoParcelZone', isEn ? parcel.zoneEn : parcel.zone);
    set('infoParcelK1', parcel.k1.toFixed(2));
    set('infoParcelK2', parcel.k2.toFixed(2));
    set('infoParcelK3', parcel.k3.toFixed(2));
  }

  function updateAssessmentUI(parcel, concept) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const floorsAbove = concept.floorsAbove || concept.floors || 5;
    set('assessFootprint', `${concept.footprint.toLocaleString()} მ²`);
    set('assessFreeLand', `${concept.freeLand.toLocaleString()} მ²`);
    set('assessFloors', `+${floorsAbove}`);
    set('assessTotalGFA', `${concept.totalArea.toLocaleString()} მ²`);
    set('assessCoverage', `${Math.round(concept.k1Ratio * 100)}% (K1: ${concept.k1Ratio})`);
    set('assessFunction', concept.buildingType.toUpperCase());
  }

  /* ==========================================================================
     8b. Real-Time Zoning & Ratio Compliance Calculator (ეტევი / ცდები)
     ========================================================================== */
  function updateComplianceUI(parcel, concept) {
    if (!parcel || !concept) return;

    const footprint = concept.footprint || 0;
    const parcelArea = parcel.area || 1;
    const floorsAbove = concept.floorsAbove !== undefined ? concept.floorsAbove : (concept.floors || 5);
    const floorsBelow = concept.floorsBelow !== undefined ? concept.floorsBelow : 1;

    const totalAboveGFA = footprint * floorsAbove;
    const totalUndergroundGFA = footprint * floorsBelow;

    const k1Allowed = parcel.k1 || 0.50;
    const k2Allowed = parcel.k2 || 2.20;
    const k3Allowed = parcel.k3 || 0.30;

    const k1Actual = footprint / parcelArea;
    const k2Actual = totalAboveGFA / parcelArea;
    const k3Actual = (parcelArea - footprint) / parcelArea;

    const k1Fit = k1Actual <= (k1Allowed + 0.005);
    const k2Fit = k2Actual <= (k2Allowed + 0.005);
    const k3Fit = k3Actual >= (k3Allowed - 0.005);
    const allFit = k1Fit && k2Fit && k3Fit;

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
          bannerSub.textContent = 'მოცემული მოცულობა და სართულიანობა სრულ შესაბამისობაშია ქალაქმშენებლობით რეგულაციებთან.';
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
        const remaining = Math.max(0, Math.round(parcelArea * k1Allowed - footprint));
        k1Delta.textContent = `დარჩენილია ${remaining.toLocaleString()} მ²`;
      } else {
        const over = Math.round(footprint - parcelArea * k1Allowed);
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
        const deficit = Math.round(parcelArea * k3Allowed - (parcelArea - footprint));
        k3Delta.textContent = `დეფიციტი: -${deficit.toLocaleString()} მ²`;
      }
    }
    if (k3Meter) {
      k3Meter.className = `ratio-meter-fill ${k3Fit ? 'fit' : 'exceed'}`;
      k3Meter.style.width = `${Math.min(100, Math.round(k3Actual / k3Allowed * 100))}%`;
    }

    // Underground Floor Information
    const underGFA = document.getElementById('assessUndergroundGFA');
    if (underGFA) underGFA.textContent = `${totalUndergroundGFA.toLocaleString()} მ² (${floorsBelow} მინუს სართული)`;
  }

  function syncSlidersUI(concept) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setDisplay = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const floorsAbove = concept.floorsAbove !== undefined ? concept.floorsAbove : (concept.floors || 5);
    const floorsBelow = concept.floorsBelow !== undefined ? concept.floorsBelow : 1;
    const floorH = concept.floorHeight || 3.3;

    setVal('sliderFloors', floorsAbove);
    setDisplay('displayFloors', `+${floorsAbove}`);

    setVal('sliderBasementFloors', floorsBelow);
    setDisplay('displayBasementFloors', `-${floorsBelow}`);

    setVal('sliderFootprint', concept.footprint);
    setDisplay('displayFootprint', `${concept.footprint.toLocaleString()} მ²`);

    setVal('sliderHeight', floorH);
    setDisplay('displayHeight', `${floorH} მ`);

    setDisplay('displayTotalHeight', `${(floorsAbove * floorH).toFixed(1)} მ`);
    setDisplay('displayBasementDepth', `-${(floorsBelow * floorH).toFixed(1)} მ`);

    const customBadge = document.getElementById('customFootprintIndicator');
    if (customBadge) {
      customBadge.style.display = (state.customFootprint && state.customFootprint.length >= 3) ? 'flex' : 'none';
    }

    setVal('sliderRotation', concept.rotation || 0);
    setDisplay('displayRotation', `${concept.rotation || 0}°`);

    setVal('selectMaterial', concept.facadeMaterial);
    setVal('selectStyle', concept.style);
    setVal('selectGroundUse', concept.groundFloorUse);
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
      if (!state.activeConcept) return;
      const val = parseInt(sliderFloors.value, 10);
      state.activeConcept.floorsAbove = val;
      state.activeConcept.floors = val;
      document.getElementById('displayFloors').textContent = `+${val}`;
      applyConceptToState(state.activeConcept);
    });
  }

  if (sliderBasementFloors) {
    sliderBasementFloors.addEventListener('input', () => {
      if (!state.activeConcept) return;
      const val = parseInt(sliderBasementFloors.value, 10);
      state.activeConcept.floorsBelow = val;
      document.getElementById('displayBasementFloors').textContent = `-${val}`;
      applyConceptToState(state.activeConcept);
    });
  }

  if (sliderFootprint) {
    sliderFootprint.addEventListener('input', () => {
      if (!state.activeConcept) return;
      const val = parseInt(sliderFootprint.value, 10);
      state.activeConcept.footprint = val;
      // If user drags slider manually, clear custom drawn footprint to allow parametric resize
      state.customFootprint = null;
      if (drawingLayerGroup) drawingLayerGroup.clearLayers();
      const customBadge = document.getElementById('customFootprintIndicator');
      if (customBadge) customBadge.style.display = 'none';
      document.getElementById('displayFootprint').textContent = `${val.toLocaleString()} მ²`;
      applyConceptToState(state.activeConcept);
    });
  }

  if (sliderHeight) {
    sliderHeight.addEventListener('input', () => {
      if (!state.activeConcept) return;
      const val = parseFloat(sliderHeight.value);
      state.activeConcept.floorHeight = val;
      document.getElementById('displayHeight').textContent = `${val} მ`;
      applyConceptToState(state.activeConcept);
    });
  }

  if (sliderRotation) {
    sliderRotation.addEventListener('input', () => {
      if (!state.activeConcept) return;
      state.activeConcept.rotation = parseInt(sliderRotation.value, 10);
      document.getElementById('displayRotation').textContent = `${sliderRotation.value}°`;
      applyConceptToState(state.activeConcept);
    });
  }

  if (selectMaterial) {
    selectMaterial.addEventListener('change', () => {
      if (!state.activeConcept) return;
      state.activeConcept.facadeMaterial = selectMaterial.value;
      applyConceptToState(state.activeConcept);
    });
  }

  if (selectStyle) {
    selectStyle.addEventListener('change', () => {
      if (!state.activeConcept) return;
      state.activeConcept.style = selectStyle.value;
      applyConceptToState(state.activeConcept);
    });
  }

  if (selectGroundUse) {
    selectGroundUse.addEventListener('change', () => {
      if (!state.activeConcept) return;
      state.activeConcept.groundFloorUse = selectGroundUse.value;
      applyConceptToState(state.activeConcept);
    });
  }

  if (btnResetToAutoFootprint) {
    btnResetToAutoFootprint.addEventListener('click', () => {
      clearDrawing();
    });
  }

  /* ==========================================================================
     9b. Interactive Building Footprint Drawing Engine (2D Leaflet GIS)
     ========================================================================== */
  function handleMapClick(e) {
    if (!state.isDrawingMode) return;
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
    const btnFinish = document.getElementById('btnFinishDraw');
    const btnClear = document.getElementById('btnClearDraw');

    if (banner) banner.style.display = 'flex';
    if (btnClear) btnClear.style.display = count > 0 ? 'inline-flex' : 'none';

    // Draw vertex dots in vibrant Emerald Green (#10b981) / Gold anchor
    state.drawnPoints.forEach((pt, idx) => {
      const isFirst = idx === 0;
      const marker = L.circleMarker(pt, {
        radius: isFirst ? 8 : 6,
        color: isFirst ? '#facc15' : '#10b981',
        fillColor: isFirst ? '#10b981' : '#ffffff',
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

    // In-progress connecting line in Emerald Green
    if (count >= 2) {
      const line = L.polyline(state.drawnPoints, {
        color: '#10b981',
        weight: 3,
        dashArray: '5, 5',
        interactive: false
      });
      drawingLayerGroup.addLayer(line);
    }

    // In-progress preview polygon in Emerald Green
    if (count >= 3) {
      const previewPoly = L.polygon(state.drawnPoints, {
        color: '#10b981',
        weight: 2.5,
        fillColor: '#10b981',
        fillOpacity: 0.22,
        dashArray: '4, 4',
        interactive: false
      });
      drawingLayerGroup.addLayer(previewPoly);

      // Compute live area with Turf.js
      const ring = state.drawnPoints.map(pt => [pt[1], pt[0]]);
      ring.push([state.drawnPoints[0][1], state.drawnPoints[0][0]]);
      const poly = turf.polygon([ring]);
      const areaSqM = Math.round(turf.area(poly));

      if (liveAreaBadge) liveAreaBadge.textContent = `${areaSqM.toLocaleString()} მ²`;
      if (bannerText) bannerText.textContent = translations[state.currentLang].drawing_guide_close || 'დააკლიკე პირველ წერტილს ან „დაასრულე“ ღილაკს შესაკრავად';
      if (btnFinish) btnFinish.style.display = 'inline-flex';
    } else {
      if (liveAreaBadge) liveAreaBadge.textContent = '0 მ²';
      if (bannerText) bannerText.textContent = translations[state.currentLang].drawing_guide_start || 'დააკლიკე რუკაზე შენობის ფორმის დასახაზად (მინ. 3 წერტილი)';
      if (btnFinish) btnFinish.style.display = 'none';
    }
  }

  function startDrawing() {
    if (!state.activeParcel) {
      searchParcel('01.15.02.038.003');
    }
    state.isDrawingMode = true;
    state.drawnPoints = [];
    if (drawingLayerGroup) drawingLayerGroup.clearLayers();
    if (parcelPolygonLayer) parcelPolygonLayer.closePopup();

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.add('map-drawing-active');

    const btnDraw = document.getElementById('btnDrawBuilding');
    if (btnDraw) btnDraw.classList.add('active');

    const btnFinish = document.getElementById('btnFinishDraw');
    if (btnFinish) btnFinish.style.display = 'none';

    const btnClear = document.getElementById('btnClearDraw');
    if (btnClear) btnClear.style.display = 'inline-flex';

    if (state.currentMode === '3d') {
      setMode('combined');
    }

    updateDrawingVisualization();
  }

  function finishDrawing() {
    if (state.drawnPoints.length < 3) return;

    state.isDrawingMode = false;
    state.customFootprint = [...state.drawnPoints];

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.remove('map-drawing-active');

    const btnDraw = document.getElementById('btnDrawBuilding');
    if (btnDraw) btnDraw.classList.remove('active');

    const btnFinish = document.getElementById('btnFinishDraw');
    if (btnFinish) btnFinish.style.display = 'none';

    const banner = document.getElementById('drawingGuideBanner');
    if (banner) banner.style.display = 'none';

    // Compute final area with Turf.js
    const ring = state.customFootprint.map(pt => [pt[1], pt[0]]);
    ring.push([state.customFootprint[0][1], state.customFootprint[0][0]]);
    const poly = turf.polygon([ring]);
    const areaSqM = Math.round(turf.area(poly));

    // Render finalized clean footprint polygon on map in distinct Emerald Green (#10b981)
    if (drawingLayerGroup) {
      drawingLayerGroup.clearLayers();
      const finalPoly = L.polygon(state.customFootprint, {
        color: '#10b981',
        weight: 3,
        fillColor: '#10b981',
        fillOpacity: 0.25,
        dashArray: '5, 5'
      });
      finalPoly.bindTooltip(`დახაზული შენობის კონტური: ${areaSqM.toLocaleString()} მ²`, {
        permanent: false,
        direction: 'center',
        className: 'custom-footprint-map-tooltip'
      });
      drawingLayerGroup.addLayer(finalPoly);
    }

    const customBadge = document.getElementById('customFootprintIndicator');
    if (customBadge) customBadge.style.display = 'flex';

    if (state.activeConcept) {
      state.activeConcept.footprint = areaSqM;
      applyConceptToState(state.activeConcept);
    }

    if (state.currentMode === 'map' || state.currentMode === '2d') {
      setMode('combined');
    }
  }

  function clearDrawing() {
    state.isDrawingMode = false;
    state.drawnPoints = [];
    state.customFootprint = null;
    if (drawingLayerGroup) drawingLayerGroup.clearLayers();

    const mapViewport = document.getElementById('mapViewport');
    if (mapViewport) mapViewport.classList.remove('map-drawing-active');

    const btnDraw = document.getElementById('btnDrawBuilding');
    if (btnDraw) btnDraw.classList.remove('active');

    const btnFinish = document.getElementById('btnFinishDraw');
    if (btnFinish) btnFinish.style.display = 'none';

    const btnClear = document.getElementById('btnClearDraw');
    if (btnClear) btnClear.style.display = 'none';

    const banner = document.getElementById('drawingGuideBanner');
    if (banner) banner.style.display = 'none';

    const customBadge = document.getElementById('customFootprintIndicator');
    if (customBadge) customBadge.style.display = 'none';

    if (state.activeParcel) {
      generateDefaultConcept(state.activeParcel);
    }
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

    if (mode === 'map' || mode === '2d') {
      if (mapViewport) mapViewport.style.display = 'block';
      if (threeViewport) threeViewport.style.display = 'none';
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
      onWindowResize();
    } else if (mode === 'combined') {
      if (mapViewport) mapViewport.style.display = 'block';
      if (threeViewport) threeViewport.style.display = 'block';
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

  // Drawing Toolbar Buttons
  const btnDrawBuilding = document.getElementById('btnDrawBuilding');
  const btnFinishDraw = document.getElementById('btnFinishDraw');
  const btnClearDraw = document.getElementById('btnClearDraw');
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

  if (btnFinishDraw) {
    btnFinishDraw.addEventListener('click', () => {
      finishDrawing();
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
      if (state.activeParcel && state.activeConcept) {
        renderBuilding3D(state.activeParcel, state.activeConcept);
      }
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
     14. Export Tools (PDF, PNG, GeoJSON, OBJ)
     ========================================================================== */
  const exportBtnPdf = document.getElementById('exportBtnPdf');
  const exportBtnPng = document.getElementById('exportBtnPng');
  const exportBtnGeoJson = document.getElementById('exportBtnGeoJson');
  const exportBtnObj = document.getElementById('exportBtnObj');

  if (exportBtnPdf) {
    exportBtnPdf.addEventListener('click', () => {
      window.print();
    });
  }

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
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${state.activeParcel.code}.geojson`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  if (exportBtnObj) {
    exportBtnObj.addEventListener('click', () => {
      if (!state.activeConcept) return;
      const fp = computeFootprintGeometry(state.activeParcel, state.activeConcept);
      if (!fp) return;

      const h = (state.activeConcept.floors || 5) * (state.activeConcept.floorHeight || 3.3);
      const w = fp.width;
      const l = fp.length;

      // Simple OBJ format string
      let objContent = `# BIMX Studio 3D Architectural Massing OBJ Export\n`;
      objContent += `# Cadastral: ${state.activeParcel.code}\n`;
      objContent += `# Floors: ${state.activeConcept.floors}, Height: ${h}m\n\n`;
      objContent += `v ${-w/2} 0 ${-l/2}\n`;
      objContent += `v ${w/2} 0 ${-l/2}\n`;
      objContent += `v ${w/2} 0 ${l/2}\n`;
      objContent += `v ${-w/2} 0 ${l/2}\n`;
      objContent += `v ${-w/2} ${h} ${-l/2}\n`;
      objContent += `v ${w/2} ${h} ${-l/2}\n`;
      objContent += `v ${w/2} ${h} ${l/2}\n`;
      objContent += `v ${-w/2} ${h} ${l/2}\n\n`;
      objContent += `f 1 2 3 4\n`;
      objContent += `f 5 8 7 6\n`;
      objContent += `f 1 5 6 2\n`;
      objContent += `f 2 6 7 3\n`;
      objContent += `f 3 7 8 4\n`;
      objContent += `f 5 1 4 8\n`;

      const blob = new Blob([objContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${state.activeParcel.code}-Massing.obj`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

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
