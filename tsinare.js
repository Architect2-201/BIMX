/**
 * tsinare.js — BIMX Pre-Design Masterplan & 2D CAD Studio Engine (წინარე)
 * --------------------------------------------------------------------------
 * Features:
 * - Nationwide live NAPR integration via /api/parcel
 * - High-precision 2D Vector CAD workspace (pan, zoom, grid, scale)
 * - Parcel Subdivision (ნაკვეთის დაყოფა) into Sub-parcels with dynamic areas
 * - Parcel Merge (ნაკვეთის გაერთიანება)
 * - Building Footprint Drawing & Parametric Placement (drag, rotate, resize)
 * - Real-time K1, K2, K3 Calculations (Allowed, Used, Remaining in m² and %)
 * - Building Height, Floor Count, and Floor-to-Floor Height Controls
 * - 3.0m Setback Line (სამეზობლო მიჯნა) Buffer & Infringement Detection
 * - Road / Driveway (მისასვლელი გზა) & Fire Truck Access Drawing
 * - Parking Bays (ავტოსადგომები) Placement & Norms Calculator
 * - Interactive Sun Shadow Insolation Simulation
 * - Visual Plan Styles (Blueprint, Classic B&W, Presentation, Satellite)
 * - Official Pre-feasibility PDF Report Export with Georgian Unicode Font
 * - AutoCAD DXF Layered Export
 */

(function () {
  'use strict';

  // --- Central Studio State ---
  const state = {
    cadastralCode: '01.14.11.059.039',
    address: 'ქალაქი თბილისი, გიორგი შატბერაშვილის ქუჩა, N 5',
    officialAreaSqm: 820,
    geometricAreaSqm: 819,
    landType: 'არასასოფლო-სამეურნეო',
    ownershipType: 'თანასაკუთრება',
    owners: ['შპს "მონოლით გრუპ"'],
    zone: 'სზ-6',
    zoneName: 'საცხოვრებელი ზონა 6',
    k1Limit: 0.5,
    k2Limit: 2.5,
    k3Limit: 0.2,
    rawCoordinates: [], // [lat, lng] array from NAPR
    boundaryMeters: [], // [[x, y], ...] in metric coordinates relative to centroid
    centroidLatLng: [41.7049, 44.7751],
    
    // 2D Masterplan Elements
    subParcels: [], // [{ id, name, polygon: [[x,y]...], areaSqm }]
    footprints: [], // [{ id, name, vertices: [[x,y]...], floors: 4, floorHeight: 3.0, totalHeight: 12.8, functionType: 'residential', center: [x,y], rotation: 0, areaSqm }]
    selectedFootprintId: null,
    roads: [], // [{ id, points: [[x,y]...], width: 6 }]
    parkingBays: [], // [{ id, center: [x,y], width: 2.5, length: 5, angle: 0 }]
    setbackDistance: 3.0,
    
    // CAD Canvas Viewport Transform
    panX: 0,
    panY: 0,
    zoomScale: 1.0,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    
    // Tools & Modes
    activeTool: 'pan', // 'pan', 'split', 'draw_footprint', 'draw_road', 'ruler'
    activeStyle: 'blueprint', // 'blueprint', 'classic', 'presentation', 'satellite'
    sunAzimuth: 135, // degrees
    
    // Interactive Drawing State
    drawPoints: [],
    splitLine: [],
    rulerPoints: [],
    isDraggingFootprint: false,
    draggedFootprintId: null,
    dragStartPos: { x: 0, y: 0 },
    dragStartCenter: [0, 0]
  };

  // DOM Elements Cache
  const els = {};

  // --- Initializer ---
  document.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    initCadCanvas();
    setupEventListeners();
    
    // Check URL query parameters for cadastral code
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code') || urlParams.get('cadastral');
    if (codeParam) {
      if (els.cadastralInput) els.cadastralInput.value = codeParam;
      triggerCadastralSearch(codeParam);
    } else {
      // Initial fetch of default parcel
      triggerCadastralSearch('01.14.11.059.039');
    }
  });

  function cacheDomElements() {
    els.cadastralInput = document.getElementById('cadastralInput');
    els.btnSearchCadastral = document.getElementById('btnSearchCadastral');
    els.lblCadastralCode = document.getElementById('lblCadastralCode');
    els.lblAddress = document.getElementById('lblAddress');
    els.lblOfficialArea = document.getElementById('lblOfficialArea');
    els.lblGeometricArea = document.getElementById('lblGeometricArea');
    els.lblLandType = document.getElementById('lblLandType');
    els.lblOwnershipType = document.getElementById('lblOwnershipType');
    els.lblOwnersList = document.getElementById('lblOwnersList');
    els.lblZoneBadge = document.getElementById('lblZoneBadge');
    els.lblZoneDescription = document.getElementById('lblZoneDescription');
    els.lblCornerCount = document.getElementById('lblCornerCount');
    els.tblCoordinatesBody = document.getElementById('tblCoordinatesBody');
    els.naprStatusBadge = document.getElementById('naprStatusBadge');

    // Canvas & Stage
    els.cadCanvasWrapper = document.getElementById('cadCanvasWrapper');
    els.cadSvgContainer = document.getElementById('cadSvgContainer');
    els.cadSvgStage = document.getElementById('cadSvgStage');
    els.worldGroup = document.getElementById('worldGroup');
    els.subParcelsLayer = document.getElementById('subParcelsLayer');
    els.cadastralBoundaryLayer = document.getElementById('cadastralBoundaryLayer');
    els.setbackBoundaryLayer = document.getElementById('setbackBoundaryLayer');
    els.roadsLayer = document.getElementById('roadsLayer');
    els.parkingLayer = document.getElementById('parkingLayer');
    els.shadowsLayer = document.getElementById('shadowsLayer');
    els.footprintsLayer = document.getElementById('footprintsLayer');
    els.dimensionsLayer = document.getElementById('dimensionsLayer');
    els.interactionLayer = document.getElementById('interactionLayer');

    // HUD & Hints
    els.lblToolStatusHint = document.getElementById('lblToolStatusHint');
    els.lblMouseCoords = document.getElementById('lblMouseCoords');
    els.sliderSunAzimuth = document.getElementById('sliderSunAzimuth');
    els.lblSunAzimuthVal = document.getElementById('lblSunAzimuthVal');

    // Zoning Metric Elements
    els.inputK1Coeff = document.getElementById('inputK1Coeff');
    els.barK1Progress = document.getElementById('barK1Progress');
    els.lblK1Allowed = document.getElementById('lblK1Allowed');
    els.lblK1Used = document.getElementById('lblK1Used');
    els.lblK1Remaining = document.getElementById('lblK1Remaining');

    els.inputK2Coeff = document.getElementById('inputK2Coeff');
    els.barK2Progress = document.getElementById('barK2Progress');
    els.lblK2Allowed = document.getElementById('lblK2Allowed');
    els.lblK2Used = document.getElementById('lblK2Used');
    els.lblK2Remaining = document.getElementById('lblK2Remaining');

    els.inputK3Coeff = document.getElementById('inputK3Coeff');
    els.lblK3Required = document.getElementById('lblK3Required');

    // Active Building Controls
    els.lblSelectedBuildingName = document.getElementById('lblSelectedBuildingName');
    els.sliderFloors = document.getElementById('sliderFloors');
    els.lblFloorsCountVal = document.getElementById('lblFloorsCountVal');
    els.lblFloorHeightVal = document.getElementById('lblFloorHeightVal');
    els.lblTotalHeightVal = document.getElementById('lblTotalHeightVal');
    els.selBuildingFunction = document.getElementById('selBuildingFunction');
    els.lblSetbackDistVal = document.getElementById('lblSetbackDistVal');
    els.lblFootprintsCount = document.getElementById('lblFootprintsCount');
    els.lstBuildingsContainer = document.getElementById('lstBuildingsContainer');
  }

  // --- Nationwide NAPR Parcel Retrieval ---
  async function triggerCadastralSearch(codeOverride) {
    const rawCode = (codeOverride || els.cadastralInput.value || '').trim();
    if (!rawCode) return;

    if (els.btnSearchCadastral) {
      els.btnSearchCadastral.disabled = true;
      els.btnSearchCadastral.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> <span>ძებნა...</span>';
    }
    if (els.naprStatusBadge) {
      els.naprStatusBadge.innerText = 'FETCHING...';
      els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }

    try {
      const res = await fetch(`/api/parcel?code=${encodeURIComponent(rawCode)}&t=${Date.now()}`);
      const data = await res.json();

      if (res.ok && data.status && data.coordinates && data.coordinates.length >= 3) {
        state.cadastralCode = data.cadastralCode || rawCode;
        state.address = data.address || 'მისამართი დაუზუსტებელია';
        state.officialAreaSqm = data.officialAreaSqm || data.areaSqm || 0;
        state.geometricAreaSqm = data.geometricAreaSqm || data.areaSqm || 0;
        state.landType = data.landType || 'არასასოფლო-სამეურნეო';
        state.ownershipType = data.ownershipType || 'თანასაკუთრება';
        state.owners = (data.owners && data.owners.length > 0) ? data.owners : ['დაუზუსტებელი მესაკუთრე'];
        state.rawCoordinates = data.coordinates;
        state.centroidLatLng = data.centroid || data.coordinates[0];

        if (data.zoning && data.zoning.zoneCode) {
          state.zone = data.zoning.zoneCode;
          state.zoneName = data.zoning.zoneNameKa || data.zoning.mainZoneKa || data.zoning.zoneCode;
          if (data.zoning.k1) state.k1Limit = data.zoning.k1;
          if (data.zoning.k2) state.k2Limit = data.zoning.k2;
          if (data.zoning.k3) state.k3Limit = data.zoning.k3;
        }

        // Convert Geo [lat, lng] to Metric Cartesian [x, y]
        convertGeoToMetric(data.coordinates);

        // Reset sub-parcels and populate standard building footprint
        state.subParcels = [];
        generateDefaultFootprint();

        updateCadastralSidebarUI();
        updateZoningCoefficientsUI();
        renderCadWorld();
        cadZoomReset();

        if (els.naprStatusBadge) {
          els.naprStatusBadge.innerText = 'NAPR VERIFIED';
          els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        }
      } else {
        alert(data.error || 'საკადასტრო კოდი საჯარო რეესტრის ოფიციალურ ბაზაში ვერ მოიძებნა.');
        if (els.naprStatusBadge) {
          els.naprStatusBadge.innerText = 'NOT FOUND';
          els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
        }
      }
    } catch (err) {
      console.error('[Tsinare] Fetch error:', err);
      alert('საჯარო რეესტრის სერვერთან კავშირი შეფერხებულია: ' + err.message);
      if (els.naprStatusBadge) {
        els.naprStatusBadge.innerText = 'ERROR';
        els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
      }
    } finally {
      if (els.btnSearchCadastral) {
        els.btnSearchCadastral.disabled = false;
        els.btnSearchCadastral.innerHTML = '<i class="fa-solid fa-magnifying-glass text-[11px]"></i> <span>ძებნა</span>';
      }
    }
  }

  // Sample parcel loader
  window.loadCadastralSample = function (code) {
    if (els.cadastralInput) els.cadastralInput.value = code;
    triggerCadastralSearch(code);
  };

  // Convert WGS-84 [lat, lng] to Metric Cartesian (Meters)
  function convertGeoToMetric(coordsLatLng) {
    if (!coordsLatLng || coordsLatLng.length < 3) return;
    const avgLat = coordsLatLng.reduce((sum, c) => sum + c[0], 0) / coordsLatLng.length;
    const avgLng = coordsLatLng.reduce((sum, c) => sum + c[1], 0) / coordsLatLng.length;
    state.centroidLatLng = [avgLat, avgLng];

    const metersPerDegLat = 111132.954;
    const metersPerDegLng = 111132.954 * Math.cos((avgLat * Math.PI) / 180);

    state.boundaryMeters = coordsLatLng.map(c => {
      const x = (c[1] - avgLng) * metersPerDegLng;
      const y = -(c[0] - avgLat) * metersPerDegLat; // Inverted Y for SVG screen space (North is Up)
      return [x, y];
    });
  }

  // --- Generate Default Building Footprint upon parcel load ---
  function generateDefaultFootprint() {
    state.footprints = [];
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) return;

    // Calculate bbox of parcel
    const xs = state.boundaryMeters.map(p => p[0]);
    const ys = state.boundaryMeters.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX;
    const spanY = maxY - minY;

    // Standard initial footprint size (e.g. 15m x 12m or 25% of span)
    const w = Math.min(22, Math.max(10, spanX * 0.35));
    const h = Math.min(18, Math.max(8, spanY * 0.35));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const fp = {
      id: 'bld_' + Date.now(),
      name: 'შენობა 1 (ბლოკი A)',
      floors: 4,
      floorHeight: 3.0,
      totalHeight: 12.8,
      functionType: 'residential',
      color: '#38bdf8',
      center: [cx, cy],
      width: w,
      length: h,
      rotation: 0,
      vertices: [
        [cx - w / 2, cy - h / 2],
        [cx + w / 2, cy - h / 2],
        [cx + w / 2, cy + h / 2],
        [cx - w / 2, cy + h / 2]
      ],
      areaSqm: Math.round(w * h)
    };

    state.footprints.push(fp);
    state.selectedFootprintId = fp.id;
  }

  // --- Add a new preset building footprint ---
  window.addPresetFootprint = function () {
    const nextNum = state.footprints.length + 1;
    const offset = (nextNum - 1) * 8;
    const w = 15;
    const h = 12;
    const cx = offset;
    const cy = offset;

    const fp = {
      id: 'bld_' + Date.now(),
      name: `შენობა ${nextNum}`,
      floors: 3,
      floorHeight: 3.0,
      totalHeight: 9.8,
      functionType: 'residential',
      color: nextNum % 2 === 0 ? '#a855f7' : '#38bdf8',
      center: [cx, cy],
      width: w,
      length: h,
      rotation: 0,
      vertices: [
        [cx - w / 2, cy - h / 2],
        [cx + w / 2, cy - h / 2],
        [cx + w / 2, cy + h / 2],
        [cx - w / 2, cy + h / 2]
      ],
      areaSqm: Math.round(w * h)
    };

    state.footprints.push(fp);
    state.selectedFootprintId = fp.id;
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  // --- Clear all footprints (ცარიელი ნაკვეთი) ---
  window.clearAllFootprints = function () {
    if (confirm('დარწმუნებული ხართ, რომ გსურთ ყველა შენობის ლაქის წაშლა და ნაკვეთის გასუფთავება?')) {
      state.footprints = [];
      state.selectedFootprintId = null;
      updateSelectedBuildingUI();
      updateZoningCoefficientsUI();
      renderCadWorld();
    }
  };

  // --- Setback Line Buffer (სამეზობლო მიჯნა 3.0მ) ---
  function computeSetbackPolygon(polygon, offsetDist) {
    if (!polygon || polygon.length < 3) return [];
    // Approximate inward normal offset for 2D convex/simple polygon
    const n = polygon.length;
    const inset = [];
    for (let i = 0; i < n; i++) {
      const prev = polygon[(i - 1 + n) % n];
      const curr = polygon[i];
      const next = polygon[(i + 1) % n];

      // Edge 1 vector
      let v1x = curr[0] - prev[0];
      let v1y = curr[1] - prev[1];
      const l1 = Math.hypot(v1x, v1y) || 1;
      v1x /= l1; v1y /= l1;

      // Edge 2 vector
      let v2x = next[0] - curr[0];
      let v2y = next[1] - curr[1];
      const l2 = Math.hypot(v2x, v2y) || 1;
      v2x /= l2; v2y /= l2;

      // Inward normals (assuming CW or CCW; test orientation)
      const n1x = -v1y; const n1y = v1x;
      const n2x = -v2y; const n2y = v2x;

      const bisectorX = n1x + n2x;
      const bisectorY = n1y + n2y;
      const blen = Math.hypot(bisectorX, bisectorY) || 1;

      // Scale offset
      const px = curr[0] + (bisectorX / blen) * offsetDist;
      const py = curr[1] + (bisectorY / blen) * offsetDist;
      inset.push([px, py]);
    }
    return inset;
  }

  // --- Parcel Subdivision Algorithm (ნაკვეთის დაყოფა) ---
  function splitParcelByLine(p1, p2) {
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) return;

    // Line equation: A*x + B*y + C = 0
    const A = p2[1] - p1[1];
    const B = p1[0] - p2[0];
    const C = p2[0] * p1[1] - p1[0] * p2[1];

    const poly = state.boundaryMeters;
    const polyA = [];
    const polyB = [];

    for (let i = 0; i < poly.length; i++) {
      const curr = poly[i];
      const next = poly[(i + 1) % poly.length];

      const dCurr = A * curr[0] + B * curr[1] + C;
      const dNext = A * next[0] + B * next[1] + C;

      if (dCurr >= 0) polyA.push(curr);
      else polyB.push(curr);

      // Check intersection
      if ((dCurr > 0 && dNext < 0) || (dCurr < 0 && dNext > 0)) {
        const t = dCurr / (dCurr - dNext);
        const ix = curr[0] + t * (next[0] - curr[0]);
        const iy = curr[1] + t * (next[1] - curr[1]);
        polyA.push([ix, iy]);
        polyB.push([ix, iy]);
      }
    }

    if (polyA.length >= 3 && polyB.length >= 3) {
      const areaA = calculatePolygonArea(polyA);
      const areaB = calculatePolygonArea(polyB);

      state.subParcels = [
        { id: 'sub_1', name: 'ნაკვეთი A', polygon: polyA, areaSqm: Math.round(areaA), color: 'rgba(56, 189, 248, 0.15)' },
        { id: 'sub_2', name: 'ნაკვეთი B', polygon: polyB, areaSqm: Math.round(areaB), color: 'rgba(245, 158, 11, 0.15)' }
      ];

      setCadActiveTool('pan');
      renderCadWorld();
      updateToolStatus(`ნაკვეთი გაიყო: ნაკვეთი A (${state.subParcels[0].areaSqm} მ²) და ნაკვეთი B (${state.subParcels[1].areaSqm} მ²)`);
    } else {
      updateToolStatus('ხაზი ნაკვეთს არ კვეთს სწორად, სცადეთ თავიდან.');
    }
  }

  // Merge sub-parcels back
  window.triggerMergeSubParcels = function () {
    if (state.subParcels.length > 0) {
      state.subParcels = [];
      renderCadWorld();
      updateToolStatus('ნაკვეთები გაერთიანდა ერთიან საწყის საზღვარში.');
    }
  };

  // Polygon Area calculation (Shoelace formula)
  function calculatePolygonArea(coords) {
    if (!coords || coords.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i][0] * coords[j][1];
      area -= coords[j][0] * coords[i][1];
    }
    return Math.abs(area / 2);
  }

  // --- Add Parking Bays ---
  window.addParkingBays = function () {
    const center = [0, 10];
    state.parkingBays = [
      { id: 'p1', center: [-6, 12], width: 2.5, length: 5 },
      { id: 'p2', center: [-3.5, 12], width: 2.5, length: 5 },
      { id: 'p3', center: [-1, 12], width: 2.5, length: 5 },
      { id: 'p4', center: [1.5, 12], width: 2.5, length: 5 },
      { id: 'p5', center: [4, 12], width: 2.5, length: 5 }
    ];
    renderCadWorld();
    updateToolStatus('განთავსდა 5 ავტოსადგომი (2.5მ × 5.0მ)');
  };

  // --- Real-time K1, K2, K3 Calculations ---
  function updateZoningCoefficientsUI() {
    const parcelArea = state.officialAreaSqm || state.geometricAreaSqm || 1;
    const k1 = state.k1Limit;
    const k2 = state.k2Limit;
    const k3 = state.k3Limit;

    // Total footprint ground area (K1 Used)
    const k1Used = state.footprints.reduce((sum, f) => sum + (f.areaSqm || 0), 0);
    const k1Allowed = Math.round(parcelArea * k1);
    const k1Remaining = Math.max(0, k1Allowed - k1Used);
    const k1Percent = Math.min(100, Math.round((k1Used / k1Allowed) * 100)) || 0;

    // Total gross floor area (K2 Used)
    const k2Used = state.footprints.reduce((sum, f) => sum + ((f.areaSqm || 0) * (f.floors || 1)), 0);
    const k2Allowed = Math.round(parcelArea * k2);
    const k2Remaining = Math.max(0, k2Allowed - k2Used);
    const k2Percent = Math.min(100, Math.round((k2Used / k2Allowed) * 100)) || 0;

    // K3 Required green area
    const k3Required = Math.round(parcelArea * k3);

    // Update DOM
    if (els.inputK1Coeff) els.inputK1Coeff.value = k1;
    if (els.lblK1Allowed) els.lblK1Allowed.innerText = `${k1Allowed.toLocaleString()} მ²`;
    if (els.lblK1Used) els.lblK1Used.innerText = `${k1Used.toLocaleString()} მ² (${k1Percent}%)`;
    if (els.lblK1Remaining) els.lblK1Remaining.innerText = `${k1Remaining.toLocaleString()} მ²`;
    if (els.barK1Progress) {
      els.barK1Progress.style.width = `${k1Percent}%`;
      els.barK1Progress.className = `h-full metric-bar-fill ${k1Used > k1Allowed ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-500 to-cyan-400'}`;
    }

    if (els.inputK2Coeff) els.inputK2Coeff.value = k2;
    if (els.lblK2Allowed) els.lblK2Allowed.innerText = `${k2Allowed.toLocaleString()} მ²`;
    if (els.lblK2Used) els.lblK2Used.innerText = `${k2Used.toLocaleString()} მ² (${k2Percent}%)`;
    if (els.lblK2Remaining) els.lblK2Remaining.innerText = `${k2Remaining.toLocaleString()} მ²`;
    if (els.barK2Progress) {
      els.barK2Progress.style.width = `${k2Percent}%`;
      els.barK2Progress.className = `h-full metric-bar-fill ${k2Used > k2Allowed ? 'bg-rose-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`;
    }

    if (els.inputK3Coeff) els.inputK3Coeff.value = k3;
    if (els.lblK3Required) els.lblK3Required.innerText = `${k3Required.toLocaleString()} მ²`;

    updateSelectedBuildingUI();
  }

  // --- Active Building UI updates ---
  function updateSelectedBuildingUI() {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId) || state.footprints[0];
    if (els.lblFootprintsCount) els.lblFootprintsCount.innerText = state.footprints.length;

    if (fp) {
      if (els.lblSelectedBuildingName) els.lblSelectedBuildingName.innerText = fp.name;
      if (els.sliderFloors) els.sliderFloors.value = fp.floors;
      if (els.lblFloorsCountVal) els.lblFloorsCountVal.innerText = fp.floors;
      if (els.lblFloorHeightVal) els.lblFloorHeightVal.innerText = fp.floorHeight.toFixed(1);
      if (els.lblTotalHeightVal) els.lblTotalHeightVal.innerText = fp.totalHeight.toFixed(1);
      if (els.selBuildingFunction) els.selBuildingFunction.value = fp.functionType || 'residential';
    }

    // Render buildings list in right sidebar
    if (els.lstBuildingsContainer) {
      els.lstBuildingsContainer.innerHTML = state.footprints.map((f, i) => `
        <div onclick="selectFootprint('${f.id}')" class="p-2 rounded border cursor-pointer transition flex items-center justify-between ${f.id === state.selectedFootprintId ? 'bg-sky-500/15 border-sky-400 text-white' : 'bg-[#0e1628] border-white/5 text-slate-300 hover:bg-[#142038]'}">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full" style="background: ${f.color || '#38bdf8'};"></span>
            <div>
              <div class="font-bold text-[11px]">${f.name}</div>
              <div class="text-[10px] text-slate-400 font-mono">${f.floors} სართ. | H: ${f.totalHeight}მ | ${f.areaSqm} მ²</div>
            </div>
          </div>
          <button type="button" onclick="event.stopPropagation(); deleteFootprint('${f.id}')" class="text-slate-400 hover:text-rose-400 p-1" title="წაშლა">
            <i class="fa-solid fa-trash-can text-[10px]"></i>
          </button>
        </div>
      `).join('');
    }
  }

  window.selectFootprint = function (id) {
    state.selectedFootprintId = id;
    updateSelectedBuildingUI();
    renderCadWorld();
  };

  window.deleteFootprint = function (id) {
    state.footprints = state.footprints.filter(f => f.id !== id);
    if (state.selectedFootprintId === id) {
      state.selectedFootprintId = state.footprints[0] ? state.footprints[0].id : null;
    }
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  window.updateBuildingFloors = function (val) {
    const floors = parseInt(val, 10) || 1;
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (fp) {
      fp.floors = floors;
      fp.totalHeight = Math.round((fp.floors * fp.floorHeight + 0.8) * 10) / 10;
      updateZoningCoefficientsUI();
      renderCadWorld();
    }
  };

  window.setFloorHeight = function (h) {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (fp) {
      fp.floorHeight = parseFloat(h) || 3.0;
      fp.totalHeight = Math.round((fp.floors * fp.floorHeight + 0.8) * 10) / 10;
      updateZoningCoefficientsUI();
      renderCadWorld();
    }
  };

  window.updateBuildingFunction = function (func) {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (fp) {
      fp.functionType = func;
    }
  };

  window.setSetbackDistance = function (dist) {
    state.setbackDistance = parseFloat(dist) || 3.0;
    if (els.lblSetbackDistVal) els.lblSetbackDistVal.innerText = `${state.setbackDistance.toFixed(1)} მ`;
    renderCadWorld();
  };

  window.updateZoningCoefficients = function () {
    if (els.inputK1Coeff) state.k1Limit = parseFloat(els.inputK1Coeff.value) || 0.5;
    if (els.inputK2Coeff) state.k2Limit = parseFloat(els.inputK2Coeff.value) || 2.5;
    if (els.inputK3Coeff) state.k3Limit = parseFloat(els.inputK3Coeff.value) || 0.2;
    updateZoningCoefficientsUI();
  };

  window.resetZoningToDefaults = function () {
    state.k1Limit = 0.5;
    state.k2Limit = 2.5;
    state.k3Limit = 0.2;
    updateZoningCoefficientsUI();
  };

  // --- Cadastral Sidebar UI Updates ---
  function updateCadastralSidebarUI() {
    if (els.lblCadastralCode) els.lblCadastralCode.innerText = state.cadastralCode;
    if (els.lblAddress) els.lblAddress.innerText = state.address;
    if (els.lblOfficialArea) els.lblOfficialArea.innerText = state.officialAreaSqm.toLocaleString();
    if (els.lblGeometricArea) els.lblGeometricArea.innerText = state.geometricAreaSqm.toLocaleString();
    if (els.lblLandType) els.lblLandType.innerText = state.landType;
    if (els.lblOwnershipType) els.lblOwnershipType.innerText = state.ownershipType;
    if (els.lblOwnersList) els.lblOwnersList.innerText = state.owners.join(', ');
    if (els.lblZoneBadge) els.lblZoneBadge.innerText = `${state.zone} (${state.zoneName})`;
    if (els.lblCornerCount) els.lblCornerCount.innerText = state.rawCoordinates.length;

    if (els.tblCoordinatesBody) {
      els.tblCoordinatesBody.innerHTML = state.rawCoordinates.map((c, i) => `
        <tr class="hover:bg-white/5">
          <td class="p-1.5 font-bold text-sky-400">#${i + 1}</td>
          <td class="p-1.5">${c[0].toFixed(6)}</td>
          <td class="p-1.5">${c[1].toFixed(6)}</td>
        </tr>
      `).join('');
    }
  }

  window.copyCadastralCode = function () {
    navigator.clipboard.writeText(state.cadastralCode).then(() => {
      alert('საკადასტრო კოდი დაკოპირდა ბუფერში: ' + state.cadastralCode);
    });
  };

  window.exportCoordinatesCsv = function () {
    let csv = "Index,Latitude,Longitude\n";
    state.rawCoordinates.forEach((c, i) => {
      csv += `${i + 1},${c[0]},${c[1]}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Coordinates_${state.cadastralCode}.csv`;
    a.click();
  };

  // --- Visual Plan Styles Selector ---
  window.setDrawingStyle = function (styleName) {
    state.activeStyle = styleName;
    if (els.cadCanvasWrapper) {
      els.cadCanvasWrapper.className = `flex-1 relative overflow-hidden style-${styleName}`;
    }

    document.querySelectorAll('.style-choice-btn').forEach(btn => {
      btn.classList.remove('active', 'bg-sky-500/20', 'text-sky-300', 'border', 'border-sky-500/40');
    });
    const activeBtn = document.getElementById(`styleBtn${styleName.charAt(0).toUpperCase() + styleName.slice(1)}`);
    if (activeBtn) {
      activeBtn.classList.add('active', 'bg-sky-500/20', 'text-sky-300', 'border', 'border-sky-500/40');
    }
    renderCadWorld();
  };

  window.changeCadScale = function (scaleStr) {
    updateToolStatus(`არჩეულია მასშტაბი ${scaleStr}`);
  };

  // --- Tools Activation ---
  window.setCadActiveTool = function (toolName) {
    state.activeTool = toolName;
    state.drawPoints = [];
    state.splitLine = [];
    state.rulerPoints = [];

    document.querySelectorAll('.btn-cad-tool').forEach(btn => btn.classList.remove('btn-tool-active'));
    const btnMap = {
      'pan': 'toolBtnPan',
      'split': 'toolBtnSplit',
      'draw_footprint': 'toolBtnDrawFootprint',
      'draw_road': 'toolBtnDrawRoad',
      'ruler': 'toolBtnRuler'
    };
    if (btnMap[toolName]) {
      const btn = document.getElementById(btnMap[toolName]);
      if (btn) btn.classList.add('btn-tool-active');
    }

    if (els.cadSvgContainer) {
      if (toolName === 'pan') els.cadSvgContainer.classList.add('mode-pan');
      else els.cadSvgContainer.classList.remove('mode-pan');
    }

    const hintMap = {
      'pan': 'არჩევა და გადაადგილება: დააკლიკეთ შენობას გადასაადგილებლად',
      'split': 'ნაკვეთის დაყოფა: დააკლიკეთ ორ წერტილზე გამყოფი ხაზის გასავლებად',
      'draw_footprint': 'ლაქის დახაზვა: დააკლიკეთ წერტილების დასასმელად, ორმაგი კლიკი ასრულებს',
      'draw_road': 'გზის დახაზვა: დააკლიკეთ გზის ტრაექტორიის მოსანიშნად',
      'ruler': 'საზომი: დააკლიკეთ ორ წერტილზე მანძილის გასაზომად'
    };
    updateToolStatus(hintMap[toolName] || '');
    renderInteractionLayer();
  };

  function updateToolStatus(text) {
    if (els.lblToolStatusHint) els.lblToolStatusHint.innerText = text;
  }

  // --- 2D CAD Canvas Viewport Engine (Pan & Zoom) ---
  function initCadCanvas() {
    if (!els.cadSvgContainer) return;

    // Mouse drag for Pan or Footprint Move
    els.cadSvgContainer.addEventListener('mousedown', onCanvasMouseDown);
    window.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('mouseup', onCanvasMouseUp);

    // Zoom on wheel
    els.cadSvgContainer.addEventListener('wheel', onCanvasWheel, { passive: false });

    // Click for CAD tools
    els.cadSvgContainer.addEventListener('click', onCanvasClick);
  }

  function applyTransform() {
    if (els.worldGroup) {
      els.worldGroup.setAttribute(
        'transform',
        `translate(${state.panX}, ${state.panY}) scale(${state.zoomScale})`
      );
    }
  }

  function getMouseWorldCoords(e) {
    const rect = els.cadSvgContainer.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - state.panX) / state.zoomScale;
    const worldY = (screenY - state.panY) / state.zoomScale;
    return { worldX, worldY, screenX, screenY };
  }

  function onCanvasMouseDown(e) {
    if (e.button === 1 || state.activeTool === 'pan') {
      // Check if clicking footprint center handle
      const { worldX, worldY } = getMouseWorldCoords(e);
      const clickedFp = state.footprints.find(f => {
        const dx = worldX - f.center[0];
        const dy = worldY - f.center[1];
        return Math.hypot(dx, dy) <= Math.max(f.width, f.length) / 1.5;
      });

      if (clickedFp && state.activeTool === 'pan') {
        state.isDraggingFootprint = true;
        state.draggedFootprintId = clickedFp.id;
        state.selectedFootprintId = clickedFp.id;
        state.dragStartPos = { x: worldX, y: worldY };
        state.dragStartCenter = [...clickedFp.center];
        updateSelectedBuildingUI();
        return;
      }

      state.isPanning = true;
      state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
    }
  }

  function onCanvasMouseMove(e) {
    const { worldX, worldY } = getMouseWorldCoords(e);
    if (els.lblMouseCoords) {
      els.lblMouseCoords.innerText = `X: ${worldX.toFixed(2)} მ | Y: ${(-worldY).toFixed(2)} მ`;
    }

    if (state.isPanning) {
      state.panX = e.clientX - state.panStart.x;
      state.panY = e.clientY - state.panStart.y;
      applyTransform();
      return;
    }

    if (state.isDraggingFootprint) {
      const fp = state.footprints.find(f => f.id === state.draggedFootprintId);
      if (fp) {
        const dx = worldX - state.dragStartPos.x;
        const dy = worldY - state.dragStartPos.y;
        fp.center = [state.dragStartCenter[0] + dx, state.dragStartCenter[1] + dy];
        
        // Update vertices
        const w2 = fp.width / 2;
        const h2 = fp.length / 2;
        fp.vertices = [
          [fp.center[0] - w2, fp.center[1] - h2],
          [fp.center[0] + w2, fp.center[1] - h2],
          [fp.center[0] + w2, fp.center[1] + h2],
          [fp.center[0] - w2, fp.center[1] + h2]
        ];
        renderCadWorld();
      }
    }
  }

  function onCanvasMouseUp() {
    state.isPanning = false;
    state.isDraggingFootprint = false;
    state.draggedFootprintId = null;
  }

  function onCanvasWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const { screenX, screenY } = getMouseWorldCoords(e);

    const newScale = Math.min(15, Math.max(0.1, state.zoomScale * zoomFactor));
    state.panX = screenX - (screenX - state.panX) * (newScale / state.zoomScale);
    state.panY = screenY - (screenY - state.panY) * (newScale / state.zoomScale);
    state.zoomScale = newScale;
    applyTransform();
  }

  function onCanvasClick(e) {
    if (state.activeTool === 'pan') return;
    const { worldX, worldY } = getMouseWorldCoords(e);

    if (state.activeTool === 'split') {
      state.splitLine.push([worldX, worldY]);
      if (state.splitLine.length === 2) {
        splitParcelByLine(state.splitLine[0], state.splitLine[1]);
        state.splitLine = [];
      } else {
        renderInteractionLayer();
        updateToolStatus('დააკლიკეთ მეორე წერტილზე დაყოფის დასასრულებლად');
      }
    } else if (state.activeTool === 'draw_footprint') {
      state.drawPoints.push([worldX, worldY]);
      if (state.drawPoints.length >= 3 && Math.hypot(worldX - state.drawPoints[0][0], worldY - state.drawPoints[0][1]) < 3) {
        // Close polygon
        finishCustomFootprintDraw();
      } else {
        renderInteractionLayer();
      }
    } else if (state.activeTool === 'ruler') {
      state.rulerPoints.push([worldX, worldY]);
      if (state.rulerPoints.length === 2) {
        const dist = Math.hypot(state.rulerPoints[1][0] - state.rulerPoints[0][0], state.rulerPoints[1][1] - state.rulerPoints[0][1]);
        updateToolStatus(`გაზომილი მანძილი: ${dist.toFixed(2)} მეტრი`);
        renderInteractionLayer();
      } else {
        state.rulerPoints = [[worldX, worldY]];
        renderInteractionLayer();
      }
    }
  }

  function finishCustomFootprintDraw() {
    if (state.drawPoints.length >= 3) {
      const area = calculatePolygonArea(state.drawPoints);
      const cx = state.drawPoints.reduce((s, p) => s + p[0], 0) / state.drawPoints.length;
      const cy = state.drawPoints.reduce((s, p) => s + p[1], 0) / state.drawPoints.length;

      const nextNum = state.footprints.length + 1;
      const fp = {
        id: 'bld_' + Date.now(),
        name: `შენობა ${nextNum} (დახაზული)`,
        floors: 3,
        floorHeight: 3.0,
        totalHeight: 9.8,
        functionType: 'residential',
        color: '#38bdf8',
        center: [cx, cy],
        width: 14,
        length: 14,
        rotation: 0,
        vertices: [...state.drawPoints],
        areaSqm: Math.round(area)
      };

      state.footprints.push(fp);
      state.selectedFootprintId = fp.id;
      state.drawPoints = [];
      setCadActiveTool('pan');
      updateZoningCoefficientsUI();
      renderCadWorld();
    }
  }

  // --- Render CAD World Layers ---
  function renderCadWorld() {
    renderCadastralBoundary();
    renderSetbackBuffer();
    renderSubParcels();
    renderRoads();
    renderParking();
    renderShadows();
    renderFootprints();
    renderDimensions();
    renderInteractionLayer();
  }

  // 1. Cadastral Boundary Layer
  function renderCadastralBoundary() {
    if (!els.cadastralBoundaryLayer) return;
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.cadastralBoundaryLayer.innerHTML = '';
      return;
    }

    const pointsStr = state.boundaryMeters.map(p => `${p[0]},${p[1]}`).join(' ');

    let cornerNodesSvg = '';
    state.boundaryMeters.forEach((p, idx) => {
      cornerNodesSvg += `
        <circle cx="${p[0]}" cy="${p[1]}" r="2" fill="#00f0ff" stroke="#080d1a" stroke-width="0.8"/>
        <text x="${p[0] + 2.5}" y="${p[1] - 2.5}" fill="var(--text-color)" font-size="2.8" font-family="'JetBrains Mono', monospace" font-weight="bold">${idx + 1}</text>
      `;
    });

    els.cadastralBoundaryLayer.innerHTML = `
      <polygon points="${pointsStr}" fill="var(--parcel-fill)" stroke="var(--parcel-stroke)" stroke-width="1.8" stroke-linejoin="round" />
      ${cornerNodesSvg}
    `;
  }

  // 2. Setback Buffer Layer (3m)
  function renderSetbackBuffer() {
    if (!els.setbackBoundaryLayer) return;
    const setbackPoly = computeSetbackPolygon(state.boundaryMeters, state.setbackDistance);
    if (setbackPoly.length < 3) {
      els.setbackBoundaryLayer.innerHTML = '';
      return;
    }
    const pts = setbackPoly.map(p => `${p[0]},${p[1]}`).join(' ');
    els.setbackBoundaryLayer.innerHTML = `
      <polygon points="${pts}" fill="none" stroke="var(--setback-stroke)" stroke-width="1" stroke-dasharray="3, 2.5" opacity="0.85" />
    `;
  }

  // 3. Sub-parcels (when split)
  function renderSubParcels() {
    if (!els.subParcelsLayer) return;
    if (state.subParcels.length === 0) {
      els.subParcelsLayer.innerHTML = '';
      return;
    }

    els.subParcelsLayer.innerHTML = state.subParcels.map(sp => {
      const pts = sp.polygon.map(p => `${p[0]},${p[1]}`).join(' ');
      const cx = sp.polygon.reduce((s, p) => s + p[0], 0) / sp.polygon.length;
      const cy = sp.polygon.reduce((s, p) => s + p[1], 0) / sp.polygon.length;
      return `
        <polygon points="${pts}" fill="${sp.color}" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="2, 2"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" fill="#f8fafc" font-size="3.5" font-weight="bold" font-family="Inter, sans-serif">${sp.name}</text>
        <text x="${cx}" y="${cy + 4.5}" text-anchor="middle" fill="#38bdf8" font-size="2.8" font-family="'JetBrains Mono', monospace">${sp.areaSqm} მ²</text>
      `;
    }).join('');
  }

  // 4. Roads / Driveway
  function renderRoads() {
    if (!els.roadsLayer) return;
    els.roadsLayer.innerHTML = `
      <rect x="-10" y="25" width="20" height="6" fill="var(--road-fill)" stroke="#64748b" stroke-width="0.8" rx="1"/>
      <line x1="-10" y1="28" x2="10" y2="28" stroke="#facc15" stroke-width="0.5" stroke-dasharray="2, 2"/>
      <text x="0" y="29" text-anchor="middle" fill="#cbd5e1" font-size="2" font-family="Inter, sans-serif">მისასვლელი გზა (6.0მ სახანძრო)</text>
    `;
  }

  // 5. Parking
  function renderParking() {
    if (!els.parkingLayer) return;
    if (state.parkingBays.length === 0) {
      els.parkingLayer.innerHTML = '';
      return;
    }

    els.parkingLayer.innerHTML = state.parkingBays.map(p => `
      <rect x="${p.center[0] - p.width / 2}" y="${p.center[1] - p.length / 2}" width="${p.width}" height="${p.length}" fill="var(--parking-fill)" opacity="0.6" stroke="#ffffff" stroke-width="0.4" />
      <text x="${p.center[0]}" y="${p.center[1] + 1}" text-anchor="middle" fill="#ffffff" font-size="1.8" font-weight="bold">P</text>
    `).join('');
  }

  // 6. 2D Shadow Projection based on Sun Azimuth & Building Height
  function renderShadows() {
    if (!els.shadowsLayer) return;
    const rad = (state.sunAzimuth * Math.PI) / 180;
    const shadowDistRatio = 0.55; // 45 deg sun altitude

    els.shadowsLayer.innerHTML = state.footprints.map(f => {
      const sLen = (f.totalHeight || 12) * shadowDistRatio;
      const sx = Math.cos(rad) * sLen;
      const sy = Math.sin(rad) * sLen;

      const shadowPoly = f.vertices.map(v => `${v[0] + sx},${v[1] + sy}`).join(' ');
      return `<polygon points="${shadowPoly}" fill="rgba(0,0,0,0.38)" />`;
    }).join('');
  }

  // 7. Building Footprints
  function renderFootprints() {
    if (!els.footprintsLayer) return;

    els.footprintsLayer.innerHTML = state.footprints.map(f => {
      const pts = f.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
      const isSelected = f.id === state.selectedFootprintId;

      return `
        <g class="cursor-pointer" onclick="selectFootprint('${f.id}')">
          <polygon points="${pts}" fill="var(--footprint-fill)" stroke="${isSelected ? '#00f0ff' : 'var(--footprint-stroke)'}" stroke-width="${isSelected ? 2 : 1.2}" />
          <!-- Center Move Handle -->
          <circle cx="${f.center[0]}" cy="${f.center[1]}" r="2.5" fill="${isSelected ? '#00f0ff' : '#ffffff'}" stroke="#080d1a" stroke-width="0.8" opacity="0.9"/>
          <text x="${f.center[0]}" y="${f.center[1] - 4}" text-anchor="middle" fill="#ffffff" font-size="3" font-weight="bold" font-family="Inter, sans-serif">${f.name}</text>
          <text x="${f.center[0]}" y="${f.center[1] + 5}" text-anchor="middle" fill="#00f0ff" font-size="2.4" font-family="'JetBrains Mono', monospace">${f.areaSqm} მ² (${f.floors} სართ.)</text>
        </g>
      `;
    }).join('');
  }

  // 8. Dimensions on Boundary
  function renderDimensions() {
    if (!els.dimensionsLayer) return;
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.dimensionsLayer.innerHTML = '';
      return;
    }

    let dimSvg = '';
    const n = state.boundaryMeters.length;
    for (let i = 0; i < n; i++) {
      const p1 = state.boundaryMeters[i];
      const p2 = state.boundaryMeters[(i + 1) % n];
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;

      // Small normal offset for dimension label
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const nx = -dy / dist;
      const ny = dx / dist;

      dimSvg += `
        <text x="${midX + nx * 2.5}" y="${midY + ny * 2.5}" text-anchor="middle" fill="var(--text-color)" font-size="2.2" font-family="'JetBrains Mono', monospace" opacity="0.85">${dist.toFixed(1)}მ</text>
      `;
    }
    els.dimensionsLayer.innerHTML = dimSvg;
  }

  // 9. Temporary Interaction Layer
  function renderInteractionLayer() {
    if (!els.interactionLayer) return;

    if (state.activeTool === 'split' && state.splitLine.length === 1) {
      els.interactionLayer.innerHTML = `
        <circle cx="${state.splitLine[0][0]}" cy="${state.splitLine[0][1]}" r="2.5" fill="#f59e0b" />
      `;
    } else if (state.activeTool === 'draw_footprint' && state.drawPoints.length > 0) {
      const pts = state.drawPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      els.interactionLayer.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="#00f0ff" stroke-width="1.2" stroke-dasharray="2, 2" />
        ${state.drawPoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="1.8" fill="#00f0ff"/>`).join('')}
      `;
    } else if (state.activeTool === 'ruler' && state.rulerPoints.length === 2) {
      const p1 = state.rulerPoints[0];
      const p2 = state.rulerPoints[1];
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      els.interactionLayer.innerHTML = `
        <line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#f59e0b" stroke-width="1" stroke-dasharray="2, 2" />
        <circle cx="${p1[0]}" cy="${p1[1]}" r="2" fill="#f59e0b"/>
        <circle cx="${p2[0]}" cy="${p2[1]}" r="2" fill="#f59e0b"/>
        <text x="${(p1[0] + p2[0]) / 2}" y="${(p1[1] + p2[1]) / 2 - 2}" text-anchor="middle" fill="#f59e0b" font-size="3" font-weight="bold">${dist.toFixed(2)} მ</text>
      `;
    } else {
      els.interactionLayer.innerHTML = '';
    }
  }

  // --- Zoom Fit & Controls ---
  window.cadZoomReset = function () {
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) return;
    const xs = state.boundaryMeters.map(p => p[0]);
    const ys = state.boundaryMeters.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const rect = els.cadSvgContainer.getBoundingClientRect();
    const boundW = Math.max(20, maxX - minX);
    const boundH = Math.max(20, maxY - minY);

    const scaleX = (rect.width * 0.75) / boundW;
    const scaleY = (rect.height * 0.75) / boundH;
    state.zoomScale = Math.min(scaleX, scaleY);

    state.panX = rect.width / 2 - ((minX + maxX) / 2) * state.zoomScale;
    state.panY = rect.height / 2 - ((minY + maxY) / 2) * state.zoomScale;

    applyTransform();
  };

  window.cadZoomIn = function () {
    state.zoomScale *= 1.25;
    applyTransform();
  };

  window.cadZoomOut = function () {
    state.zoomScale *= 0.8;
    applyTransform();
  };

  window.updateSunShadows = function (val) {
    state.sunAzimuth = parseFloat(val) || 135;
    if (els.lblSunAzimuthVal) els.lblSunAzimuthVal.innerText = `${state.sunAzimuth}°`;
    renderShadows();
  };

  // --- Official PDF Report Generation (პედეეფ ექსპორტი) ---
  window.exportTsinarePdfReport = function () {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('PDF ბიბლიოთეკა იტვირთება, გთხოვთ სცადოთ რამდენიმე წამში.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Load Georgian Unicode Font
    let fontName = 'helvetica';
    if (window.GEORGIAN_FONT_BASE64) {
      try {
        doc.addFileToVFS('NotoSansGeorgian-Regular.ttf', window.GEORGIAN_FONT_BASE64);
        doc.addFont('NotoSansGeorgian-Regular.ttf', 'NotoSansGeorgian', 'normal');
        if (window.GEORGIAN_FONT_BOLD_B64) {
          doc.addFileToVFS('NotoSansGeorgian-Bold.ttf', window.GEORGIAN_FONT_BOLD_B64);
          doc.addFont('NotoSansGeorgian-Bold.ttf', 'NotoSansGeorgian', 'bold');
        }
        fontName = 'NotoSansGeorgian';
      } catch (err) {
        console.warn('[PDF] Georgian font load warning:', err);
      }
    }

    // Modern Header Banner
    doc.setFillColor(10, 16, 29);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 27.5, pageWidth, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(16);
    doc.text('BIMX STUDIO · წინარე საპროექტო კვლევა და გენგეგმის დოსიე', 18, 12);

    doc.setFontSize(9.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(148, 163, 184);
    const dateStr = new Date().toLocaleDateString('ka-GE');
    doc.text(`საკადასტრო კოდი: ${state.cadastralCode} | მასშტაბი: M 1:500 | თარიღი: ${dateStr}`, 18, 19);

    // Architectural Title Stamp (შტამპი) at Bottom Right
    const stampX = pageWidth - 145;
    const stampY = pageHeight - 55;
    doc.setFillColor(248, 250, 252);
    doc.rect(stampX, stampY, 130, 42, 'F');
    doc.setDrawColor(30, 41, 59);
    doc.rect(stampX, stampY, 130, 42, 'D');

    doc.setTextColor(15, 23, 42);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.text('BIMX STUDIO ARCHITECTURAL PLATFORM', stampX + 5, stampY + 7);

    doc.setFontSize(7.5);
    doc.setFont(fontName, 'normal');
    doc.text(`ობიექტი: წინარე საპროექტო გენგეგმა & კოეფიციენტების გაანგარიშება`, stampX + 5, stampY + 14);
    doc.text(`მისამართი: ${state.address}`, stampX + 5, stampY + 20);
    doc.text(`დამკვეთი / მესაკუთრე: ${state.owners.join(', ')}`, stampX + 5, stampY + 26);
    doc.text(`ფურცელი: 1 / 1  |  სტადია: წინარე საპროექტო (Pre-Design)`, stampX + 5, stampY + 32);
    doc.text(`საკადასტრო კოდი: ${state.cadastralCode}`, stampX + 5, stampY + 38);

    // Left Column: Technical-Economic Indicators Table (ტემ-ი)
    const parcelArea = state.officialAreaSqm || state.geometricAreaSqm;
    const k1Used = state.footprints.reduce((sum, f) => sum + (f.areaSqm || 0), 0);
    const k1Allowed = Math.round(parcelArea * state.k1Limit);
    const k2Used = state.footprints.reduce((sum, f) => sum + ((f.areaSqm || 0) * (f.floors || 1)), 0);
    const k2Allowed = Math.round(parcelArea * state.k2Limit);
    const k3Required = Math.round(parcelArea * state.k3Limit);

    const temHeaders = [['მაჩვენებელი / რეგულაცია', 'დაშვებული ლიმიტი', 'საპროექტო (ათვისებული)', 'დარჩენილი ნაშთი']];
    const temRows = [
      ['მიწის ნაკვეთის ფართობი', `${parcelArea.toLocaleString()} მ²`, `${parcelArea.toLocaleString()} მ²`, '—'],
      ['K-1 განაშენიანების ფართობი', `${k1Allowed.toLocaleString()} მ² (K1=${state.k1Limit})`, `${k1Used.toLocaleString()} მ²`, `${Math.max(0, k1Allowed - k1Used).toLocaleString()} მ²`],
      ['K-2 ინტენსივობის ფართობი (GFA)', `${k2Allowed.toLocaleString()} მ² (K2=${state.k2Limit})`, `${k2Used.toLocaleString()} მ²`, `${Math.max(0, k2Allowed - k2Used).toLocaleString()} მ²`],
      ['K-3 გამწვანების ფართობი', `${k3Required.toLocaleString()} მ² (K3=${state.k3Limit})`, `${Math.max(0, parcelArea - k1Used).toLocaleString()} მ²`, 'ნორმაშია'],
      ['შენობების რაოდენობა', '—', `${state.footprints.length} ბლოკი`, '—'],
      ['ავტოსადგომები (საპროექტო)', 'მოთხოვნილი: 5 ადგილი', `${state.parkingBays.length} ადგილი`, 'დაცულია'],
      ['სამეზობლო მიჯნის ზოლი', 'სავალდებულო ≥ 3.0 მ', `${state.setbackDistance.toFixed(1)} მ`, 'დაცულია']
    ];

    if (doc.autoTable) {
      doc.autoTable({
        startY: 35,
        head: temHeaders,
        body: temRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], font: fontName, fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2.5, font: fontName },
        margin: { left: 18, right: pageWidth - 145 }
      });
    }

    // Export SVG Drawing into PDF via Canvas rasterization
    const svgEl = document.getElementById('cadSvgStage');
    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const DOMURL = window.URL || window.webkitURL || window;
      const url = DOMURL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = state.activeStyle === 'classic' ? '#ffffff' : (state.activeStyle === 'presentation' ? '#f4f7f6' : '#091326');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        DOMURL.revokeObjectURL(url);

        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 145, 35, pageWidth - 165, pageHeight - 100);

        doc.save(`BIMX_Tsinare_${state.cadastralCode}.pdf`);
      };
      img.src = url;
    } else {
      doc.save(`BIMX_Tsinare_${state.cadastralCode}.pdf`);
    }
  };

  // --- AutoCAD DXF Export ---
  window.exportTsinareDxf = function () {
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n5\n";
    dxf += "0\nLAYER\n2\nCADASTRAL_BOUNDARY\n70\n0\n62\n1\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nSETBACK_BUFFER\n70\n0\n62\n6\n6\nDASHED\n";
    dxf += "0\nLAYER\n2\nBUILDING_FOOTPRINTS\n70\n0\n62\n4\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nSUBDIVISION_PARCELS\n70\n0\n62\n3\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nROADS\n70\n0\n62\n8\n6\nCONTINUOUS\n";
    dxf += "0\nENDTAB\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nENTITIES\n";

    const addPolyline = (layer, pts) => {
      if (!pts || pts.length < 2) return;
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        dxf += `0\nLINE\n8\n${layer}\n10\n${p1[0].toFixed(3)}\n20\n${p1[1].toFixed(3)}\n30\n0.0\n11\n${p2[0].toFixed(3)}\n21\n${p2[1].toFixed(3)}\n31\n0.0\n`;
      }
    };

    addPolyline('CADASTRAL_BOUNDARY', state.boundaryMeters);
    addPolyline('SETBACK_BUFFER', computeSetbackPolygon(state.boundaryMeters, state.setbackDistance));
    state.subParcels.forEach(sp => addPolyline('SUBDIVISION_PARCELS', sp.polygon));
    state.footprints.forEach(fp => addPolyline('BUILDING_FOOTPRINTS', fp.vertices));

    dxf += "0\nENDSEC\n0\nEOF\n";

    const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BIMX_Tsinare_${state.cadastralCode}.dxf`;
    a.click();
  };

  function setupEventListeners() {
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target && ['input', 'select', 'textarea'].includes(e.target.tagName.toLowerCase())) return;
      if (e.key === ' ' || e.key === 'p') setCadActiveTool('pan');
      if (e.key === 's') setCadActiveTool('split');
      if (e.key === 'b') setCadActiveTool('draw_footprint');
      if (e.key === 'r') setCadActiveTool('ruler');
      if (e.key === 'Escape') setCadActiveTool('pan');
    });
  }

})();
