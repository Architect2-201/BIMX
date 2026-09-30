/**
 * tsinare.js — BIMX Architectural 2D Masterplan & CAD Studio Engine (წინარე)
 * --------------------------------------------------------------------------
 * Features:
 * - High-precision screen-independent CAD rendering (no overlapping text or giant handles)
 * - 5 Distinct Architectural Presentation Styles (Classic White, Royal Blueprint, Presentation Landscape, Satellite, Dark OLED)
 * - True Working Architectural Scale (M 1:100, 1:200, 1:500, 1:1000, 1:2000) & Dynamic Graphic Scale Bar
 * - Parcel Subdivision (ნაკვეთის დაყოფა) & Merge (გაერთიანება)
 * - Parametric Building Resizing (Width/Length) & Free Rotation (0°-360°)
 * - Preset Building Typologies (Rectangular, L-Shape, U-Shape Courtyard, Tower)
 * - Tree & Landscaping Placer (ხეები/გამწვანება) with Dynamic K-3 Greenery Contribution
 * - Architectural Dimension Strings with 45° CAD Ticks and Pill Badges
 * - Interactive Sun Insolation & Real-Time Shadow Projection
 * - Comprehensive Layer Visibility Controls (შრეების მართვა)
 * - Official Dossier PDF Export with Georgian Unicode Font & AutoCAD DXF Export
 */

(function () {
  'use strict';

  // Screen DPI Constant: 96 DPI -> 1 meter = 3779.528 pixels
  const METERS_TO_PIXELS_REAL = 96 / 0.0254; // ~3779.528

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
    subParcels: [], // [{ id, name, polygon: [[x,y]...], areaSqm, color }]
    footprints: [], // [{ id, name, width, length, rotation, floors, floorHeight, totalHeight, functionType, center: [x,y], vertices: [[x,y]...], areaSqm }]
    selectedFootprintId: null,
    trees: [], // [{ id, x, y, radius }]
    roads: [], // [{ id, points: [[x,y]...], width: 6 }]
    parkingBays: [], // [{ id, center: [x,y], width: 2.5, length: 5 }]
    setbackDistance: 3.0,
    
    // Layer Visibility
    layers: {
      boundary: true,
      setback: true,
      dimensions: true,
      footprints: true,
      shadows: true,
      trees: true,
      roads: true,
      nodes: false // default false to prevent clutter!
    },

    // CAD Canvas Viewport Transform
    panX: 0,
    panY: 0,
    zoomScale: 1.0, // pixels per meter
    isPanning: false,
    panStart: { x: 0, y: 0 },
    
    // Tools & Modes
    activeTool: 'pan', // 'pan', 'split', 'draw_footprint', 'tree', 'draw_road', 'ruler'
    activeStyle: 'blueprint', // 'blueprint', 'classic', 'presentation', 'satellite', 'dark'
    sunAzimuth: 135, // degrees
    
    // Interactive Transformations
    drawPoints: [],
    splitLine: [],
    rulerPoints: [],
    isDraggingFootprint: false,
    isRotatingFootprint: false,
    draggedFootprintId: null,
    dragStartPos: { x: 0, y: 0 },
    dragStartCenter: [0, 0],
    rotateStartAngle: 0,
    footprintInitialRot: 0
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
    els.treesLayer = document.getElementById('treesLayer');
    els.shadowsLayer = document.getElementById('shadowsLayer');
    els.footprintsLayer = document.getElementById('footprintsLayer');
    els.dimensionsLayer = document.getElementById('dimensionsLayer');
    els.nodesLayer = document.getElementById('nodesLayer');
    els.interactionLayer = document.getElementById('interactionLayer');

    // HUD & Hints
    els.lblToolStatusHint = document.getElementById('lblToolStatusHint');
    els.lblMouseCoords = document.getElementById('lblMouseCoords');
    els.lblGraphicScaleUnit = document.getElementById('lblGraphicScaleUnit');
    els.lblCurrentScaleRatio = document.getElementById('lblCurrentScaleRatio');
    els.cadScaleBarGraphic = document.getElementById('cadScaleBarGraphic');
    els.sliderSunAzimuth = document.getElementById('sliderSunAzimuth');
    els.lblSunAzimuthVal = document.getElementById('lblSunAzimuthVal');
    els.selCadScale = document.getElementById('selCadScale');

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
    els.lblPlantedTreesCount = document.getElementById('lblPlantedTreesCount');

    // Active Building Controls
    els.lblSelectedBuildingName = document.getElementById('lblSelectedBuildingName');
    els.sliderBuildingWidth = document.getElementById('sliderBuildingWidth');
    els.lblBuildingWidthVal = document.getElementById('lblBuildingWidthVal');
    els.sliderBuildingLength = document.getElementById('sliderBuildingLength');
    els.lblBuildingLengthVal = document.getElementById('lblBuildingLengthVal');
    els.sliderBuildingRotation = document.getElementById('sliderBuildingRotation');
    els.lblBuildingRotationVal = document.getElementById('lblBuildingRotationVal');
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

        // Reset elements & create default footprint & sample landscaping
        state.subParcels = [];
        state.trees = [];
        generateDefaultFootprint();
        generateDefaultLandscaping();

        updateCadastralSidebarUI();
        updateZoningCoefficientsUI();
        cadZoomReset();
        renderCadWorld();

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

  window.loadCadastralSample = function (code) {
    if (els.cadastralInput) els.cadastralInput.value = code;
    triggerCadastralSearch(code);
  };

  // Convert WGS-84 [lat, lng] to Metric Cartesian (Meters) centered on centroid
  function convertGeoToMetric(coordsLatLng) {
    if (!coordsLatLng || coordsLatLng.length < 3) return;
    const avgLat = coordsLatLng.reduce((sum, c) => sum + c[0], 0) / coordsLatLng.length;
    const avgLng = coordsLatLng.reduce((sum, c) => sum + c[1], 0) / coordsLatLng.length;
    state.centroidLatLng = [avgLat, avgLng];

    const metersPerDegLat = 111132.954;
    const metersPerDegLng = 111132.954 * Math.cos((avgLat * Math.PI) / 180);

    state.boundaryMeters = coordsLatLng.map(c => {
      const x = (c[1] - avgLng) * metersPerDegLng;
      const y = -(c[0] - avgLat) * metersPerDegLat; // Inverted Y for SVG CAD (North is Up)
      return [x, y];
    });
  }

  // --- Generate Default Building Footprint upon parcel load ---
  function generateDefaultFootprint() {
    state.footprints = [];
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) return;

    const xs = state.boundaryMeters.map(p => p[0]);
    const ys = state.boundaryMeters.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX;
    const spanY = maxY - minY;

    const w = Math.min(24, Math.max(12, Math.round(spanX * 0.38)));
    const h = Math.min(18, Math.max(10, Math.round(spanY * 0.38)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const fp = createFootprintObject('შენობა 1 (ბლოკი A)', 'rect', w, h, 0, cx, cy, 4, 3.0, 'residential');
    state.footprints.push(fp);
    state.selectedFootprintId = fp.id;
  }

  // Generate Sample Trees around building
  function generateDefaultLandscaping() {
    state.trees = [];
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) return;

    const xs = state.boundaryMeters.map(p => p[0]);
    const ys = state.boundaryMeters.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    // Place 4 decorative landscaping trees near corners inside setback
    const offsets = [
      [minX + 6, minY + 6],
      [maxX - 6, minY + 6],
      [minX + 6, maxY - 6],
      [maxX - 6, maxY - 6]
    ];
    offsets.forEach((pt, i) => {
      state.trees.push({
        id: 'tree_' + i + '_' + Date.now(),
        x: pt[0],
        y: pt[1],
        radius: 2.8 + (i % 2) * 0.6
      });
    });
  }

  // Factory for Footprints
  function createFootprintObject(name, shape, w, h, rot, cx, cy, floors, floorHeight, funcType) {
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    let localVerts = [];
    if (shape === 'l_shape') {
      const halfW = w / 2, halfH = h / 2;
      const cutW = halfW * 0.5, cutH = halfH * 0.5;
      localVerts = [
        [-halfW, -halfH],
        [halfW, -halfH],
        [halfW, cutH],
        [cutW, cutH],
        [cutW, halfH],
        [-halfW, halfH]
      ];
    } else if (shape === 'u_shape') {
      const halfW = w / 2, halfH = h / 2;
      const t = w * 0.28;
      localVerts = [
        [-halfW, -halfH],
        [halfW, -halfH],
        [halfW, halfH],
        [halfW - t, halfH],
        [halfW - t, -halfH + t],
        [-halfW + t, -halfH + t],
        [-halfW + t, halfH],
        [-halfW, halfH]
      ];
    } else {
      // standard rectangle or tower
      const halfW = w / 2, halfH = h / 2;
      localVerts = [
        [-halfW, -halfH],
        [halfW, -halfH],
        [halfW, halfH],
        [-halfW, halfH]
      ];
    }

    const worldVerts = localVerts.map(pt => [
      cx + pt[0] * cos - pt[1] * sin,
      cy + pt[0] * sin + pt[1] * cos
    ]);

    const area = calculatePolygonArea(worldVerts);
    const flrs = floors || 4;
    const flrH = floorHeight || 3.0;

    return {
      id: 'bld_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name,
      shape: shape || 'rect',
      width: Math.round(w),
      length: Math.round(h),
      rotation: Math.round(rot),
      center: [cx, cy],
      vertices: worldVerts,
      floors: flrs,
      floorHeight: flrH,
      totalHeight: Math.round((flrs * flrH + 0.8) * 10) / 10,
      functionType: funcType || 'residential',
      areaSqm: Math.round(area)
    };
  }

  // --- Add a new preset building footprint ---
  window.addPresetFootprint = function (shapeType) {
    const nextNum = state.footprints.length + 1;
    const offset = (nextNum - 1) * 7;
    let w = 15, h = 12;
    if (shapeType === 'tower') { w = 20; h = 20; }
    else if (shapeType === 'l_shape') { w = 18; h = 16; }
    else if (shapeType === 'u_shape') { w = 22; h = 18; }

    const fp = createFootprintObject(`შენობა ${nextNum}`, shapeType || 'rect', w, h, 0, offset, offset, 4, 3.0, 'residential');
    state.footprints.push(fp);
    state.selectedFootprintId = fp.id;
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  // --- Clear all footprints (ცარიელი ნაკვეთი) ---
  window.clearAllFootprints = function () {
    if (confirm('გსურთ ყველა შენობის ლაქის და ხის წაშლა?')) {
      state.footprints = [];
      state.trees = [];
      state.parkingBays = [];
      state.roads = [];
      state.selectedFootprintId = null;
      updateSelectedBuildingUI();
      updateZoningCoefficientsUI();
      renderCadWorld();
    }
  };

  // --- Setback Line Buffer (სამეზობლო მიჯნა 3.0მ) ---
  function computeSetbackPolygon(polygon, offsetDist) {
    if (!polygon || polygon.length < 3) return [];
    const n = polygon.length;
    const inset = [];
    for (let i = 0; i < n; i++) {
      const prev = polygon[(i - 1 + n) % n];
      const curr = polygon[i];
      const next = polygon[(i + 1) % n];

      let v1x = curr[0] - prev[0];
      let v1y = curr[1] - prev[1];
      const l1 = Math.hypot(v1x, v1y) || 1;
      v1x /= l1; v1y /= l1;

      let v2x = next[0] - curr[0];
      let v2y = next[1] - curr[1];
      const l2 = Math.hypot(v2x, v2y) || 1;
      v2x /= l2; v2y /= l2;

      const n1x = -v1y; const n1y = v1x;
      const n2x = -v2y; const n2y = v2x;

      const bisectorX = n1x + n2x;
      const bisectorY = n1y + n2y;
      const blen = Math.hypot(bisectorX, bisectorY) || 1;

      const px = curr[0] + (bisectorX / blen) * offsetDist;
      const py = curr[1] + (bisectorY / blen) * offsetDist;
      inset.push([px, py]);
    }
    return inset;
  }

  // --- Parcel Subdivision Algorithm (ნაკვეთის დაყოფა) ---
  function splitParcelByLine(p1, p2) {
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) return;

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
        { id: 'sub_1', name: 'ნაკვეთი A', polygon: polyA, areaSqm: Math.round(areaA), color: 'rgba(56, 189, 248, 0.12)' },
        { id: 'sub_2', name: 'ნაკვეთი B', polygon: polyB, areaSqm: Math.round(areaB), color: 'rgba(245, 158, 11, 0.12)' }
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
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) return;
    const ys = state.boundaryMeters.map(p => p[1]);
    const maxY = Math.max(...ys);

    state.parkingBays = [
      { id: 'p1', center: [-6, maxY - 3], width: 2.5, length: 5 },
      { id: 'p2', center: [-3.5, maxY - 3], width: 2.5, length: 5 },
      { id: 'p3', center: [-1, maxY - 3], width: 2.5, length: 5 },
      { id: 'p4', center: [1.5, maxY - 3], width: 2.5, length: 5 },
      { id: 'p5', center: [4, maxY - 3], width: 2.5, length: 5 }
    ];
    renderCadWorld();
    updateToolStatus('განთავსდა 5 საპარკინგე ადგილი (2.5მ × 5.0მ)');
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

    // K3 Required green area & Planted trees contribution
    const k3Required = Math.round(parcelArea * k3);
    const treesCanopyArea = Math.round(state.trees.reduce((sum, t) => sum + Math.PI * (t.radius || 2.5) * (t.radius || 2.5), 0));

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
    if (els.lblPlantedTreesCount) els.lblPlantedTreesCount.innerText = `${state.trees.length} ხე (~${treesCanopyArea} მ²)`;

    updateSelectedBuildingUI();
  }

  // --- Active Building UI updates ---
  function updateSelectedBuildingUI() {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId) || state.footprints[0];
    if (els.lblFootprintsCount) els.lblFootprintsCount.innerText = state.footprints.length;

    if (fp) {
      if (els.lblSelectedBuildingName) els.lblSelectedBuildingName.innerText = fp.name;
      if (els.sliderBuildingWidth) els.sliderBuildingWidth.value = fp.width;
      if (els.lblBuildingWidthVal) els.lblBuildingWidthVal.innerText = `${fp.width.toFixed(1)} მ`;
      if (els.sliderBuildingLength) els.sliderBuildingLength.value = fp.length;
      if (els.lblBuildingLengthVal) els.lblBuildingLengthVal.innerText = `${fp.length.toFixed(1)} მ`;
      if (els.sliderBuildingRotation) els.sliderBuildingRotation.value = fp.rotation;
      if (els.lblBuildingRotationVal) els.lblBuildingRotationVal.innerText = `${fp.rotation}°`;
      if (els.sliderFloors) els.sliderFloors.value = fp.floors;
      if (els.lblFloorsCountVal) els.lblFloorsCountVal.innerText = fp.floors;
      if (els.lblFloorHeightVal) els.lblFloorHeightVal.innerText = fp.floorHeight.toFixed(1) + ' მ';
      if (els.lblTotalHeightVal) els.lblTotalHeightVal.innerText = fp.totalHeight.toFixed(1);
      if (els.selBuildingFunction) els.selBuildingFunction.value = fp.functionType || 'residential';
    }

    if (els.lstBuildingsContainer) {
      els.lstBuildingsContainer.innerHTML = state.footprints.map(f => `
        <div onclick="selectFootprint('${f.id}')" class="p-2 rounded border cursor-pointer transition flex items-center justify-between ${f.id === state.selectedFootprintId ? 'bg-sky-500/15 border-sky-400 text-white' : 'bg-[#0e1628] border-white/5 text-slate-300 hover:bg-[#142038]'}">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
            <div>
              <div class="font-bold text-[11px]">${f.name}</div>
              <div class="text-[10px] text-slate-400 font-mono">${f.width}×${f.length}მ | ${f.floors} სართ. | ${f.areaSqm} მ²</div>
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

  // Parametric Resizing (W & L)
  window.updateBuildingDimensions = function (wVal, lVal) {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return;

    if (wVal !== null) fp.width = parseFloat(wVal) || fp.width;
    if (lVal !== null) fp.length = parseFloat(lVal) || fp.length;

    const newFp = createFootprintObject(fp.name, fp.shape, fp.width, fp.length, fp.rotation, fp.center[0], fp.center[1], fp.floors, fp.floorHeight, fp.functionType);
    fp.vertices = newFp.vertices;
    fp.areaSqm = newFp.areaSqm;

    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  // Rotation Control
  window.setBuildingRotation = function (deg) {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return;

    fp.rotation = parseInt(deg, 10) % 360;
    if (fp.rotation < 0) fp.rotation += 360;

    const newFp = createFootprintObject(fp.name, fp.shape, fp.width, fp.length, fp.rotation, fp.center[0], fp.center[1], fp.floors, fp.floorHeight, fp.functionType);
    fp.vertices = newFp.vertices;

    updateSelectedBuildingUI();
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
          <td class="p-1 font-bold text-sky-400">#${i + 1}</td>
          <td class="p-1">${c[0].toFixed(6)}</td>
          <td class="p-1">${c[1].toFixed(6)}</td>
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

  // --- 5 Visual Plan Styles Selector ---
  window.setDrawingStyle = function (styleName) {
    state.activeStyle = styleName;
    const wrapper = els.cadCanvasWrapper;
    if (wrapper) {
      wrapper.className = `flex-1 relative overflow-hidden style-${styleName}`;
    }

    document.querySelectorAll('.style-choice-btn').forEach(btn => {
      btn.className = 'style-choice-btn px-2 py-1 rounded text-[11px] font-semibold text-slate-300 hover:text-white transition';
    });

    const activeBtn = document.getElementById(`styleBtn${styleName.charAt(0).toUpperCase() + styleName.slice(1)}`);
    if (activeBtn) {
      activeBtn.className = 'style-choice-btn active px-2 py-1 rounded text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 transition';
    }

    renderCadWorld();
  };

  // --- Layer Visibility Toggle ---
  window.toggleLayer = function (layerName, isChecked) {
    state.layers[layerName] = isChecked;
    renderCadWorld();
  };

  // --- REAL ARCHITECTURAL SCALE CONTROLS ---
  window.changeCadScale = function (scaleStr) {
    if (!scaleStr) return;
    const ratio = parseInt(scaleStr.replace('1:', '').replace('M', '').trim(), 10) || 500;
    
    // Convert architectural scale to pixels per meter (assuming 96 DPI screen)
    state.zoomScale = METERS_TO_PIXELS_REAL / ratio;

    // Recenter canvas on centroid
    if (state.boundaryMeters && state.boundaryMeters.length >= 3) {
      const xs = state.boundaryMeters.map(p => p[0]);
      const ys = state.boundaryMeters.map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const rect = els.cadSvgContainer.getBoundingClientRect();
      state.panX = rect.width / 2 - cx * state.zoomScale;
      state.panY = rect.height / 2 - cy * state.zoomScale;
    }

    applyTransform();
    updateToolStatus(`არჩეულია მასშტაბი M 1:${ratio}`);
  };

  // Update Dynamic Graphic Scale Bar on Zoom
  function updateGraphicScaleBar() {
    if (!els.lblGraphicScaleUnit || !els.lblCurrentScaleRatio) return;

    // Calculate approximate architectural scale ratio
    const currentRatio = Math.round(METERS_TO_PIXELS_REAL / Math.max(0.001, state.zoomScale));
    els.lblCurrentScaleRatio.innerText = `M 1:${currentRatio}`;

    // Update dropdown if close to standard
    if (els.selCadScale) {
      const standards = [100, 200, 500, 1000, 2000];
      const closest = standards.reduce((prev, curr) => Math.abs(curr - currentRatio) < Math.abs(prev - currentRatio) ? curr : prev);
      if (Math.abs(closest - currentRatio) / closest < 0.15) {
        els.selCadScale.value = `1:${closest}`;
      }
    }

    // Determine scale bar total metric length (e.g. 5m, 10m, 20m, 50m, 100m)
    // Target 100-140 pixels total bar width
    const targetPx = 110;
    const rawMeters = targetPx / Math.max(0.001, state.zoomScale);
    
    // Round to clean architectural number
    let cleanMeters = 20;
    if (rawMeters < 3) cleanMeters = 2;
    else if (rawMeters < 8) cleanMeters = 5;
    else if (rawMeters < 16) cleanMeters = 10;
    else if (rawMeters < 35) cleanMeters = 20;
    else if (rawMeters < 75) cleanMeters = 50;
    else if (rawMeters < 150) cleanMeters = 100;
    else cleanMeters = 200;

    els.lblGraphicScaleUnit.innerText = `${cleanMeters} მ`;

    const totalBarWidthPx = cleanMeters * state.zoomScale;
    const segWidthPx = Math.max(12, Math.round(totalBarWidthPx / 4));

    for (let i = 1; i <= 4; i++) {
      const seg = document.getElementById(`scaleSegment${i}`);
      if (seg) {
        seg.style.width = `${segWidthPx}px`;
      }
    }
  }

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
      'tree': 'toolBtnTree',
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
      'tree': 'გამწვანება: დააკლიკეთ ნაკვეთის ნებისმიერ ზონაში ხის დასარგავად',
      'draw_road': 'გზის დახაზვა: დააკლიკეთ გზის ტრაექტორიის მოსანიშნად',
      'ruler': 'საზომი: დააკლიკეთ ორ წერტილზე მანძილის გასაზომად'
    };
    updateToolStatus(hintMap[toolName] || '');
    renderInteractionLayer();
  };

  function updateToolStatus(text) {
    if (els.lblToolStatusHint) els.lblToolStatusHint.innerText = text;
  }

  // --- Interactive CAD Canvas Mouse Handlers ---
  function initCadCanvas() {
    const container = els.cadSvgContainer;
    if (!container) return;

    // Pan & Zoom via Wheel
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      state.panX = mouseX - (mouseX - state.panX) * zoomFactor;
      state.panY = mouseY - (mouseY - state.panY) * zoomFactor;
      state.zoomScale *= zoomFactor;

      applyTransform();
    }, { passive: false });

    // Mouse Down
    container.addEventListener('mousedown', (e) => {
      const worldPos = screenToWorld(e.clientX, e.clientY);

      // Pan Tool or Middle Mouse Button or Space
      if (state.activeTool === 'pan' || e.button === 1 || e.spaceKey) {
        // Check if clicking on Footprint Rotate Handle
        const rotTarget = checkRotationHandleHit(worldPos);
        if (rotTarget) {
          state.isRotatingFootprint = true;
          state.draggedFootprintId = rotTarget.id;
          state.rotateStartAngle = Math.atan2(worldPos[1] - rotTarget.center[1], worldPos[0] - rotTarget.center[0]);
          state.footprintInitialRot = rotTarget.rotation || 0;
          return;
        }

        // Check if clicking inside a Footprint to drag
        const hitFp = checkFootprintHit(worldPos);
        if (hitFp) {
          state.isDraggingFootprint = true;
          state.draggedFootprintId = hitFp.id;
          state.selectedFootprintId = hitFp.id;
          state.dragStartPos = { x: worldPos[0], y: worldPos[1] };
          state.dragStartCenter = [hitFp.center[0], hitFp.center[1]];
          updateSelectedBuildingUI();
          renderCadWorld();
          return;
        }

        // Otherwise canvas pan
        state.isPanning = true;
        state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
        return;
      }

      // Parcel Splitting Tool
      if (state.activeTool === 'split') {
        state.splitLine.push(worldPos);
        if (state.splitLine.length === 2) {
          splitParcelByLine(state.splitLine[0], state.splitLine[1]);
          state.splitLine = [];
        }
        renderInteractionLayer();
        return;
      }

      // Tree Planting Tool
      if (state.activeTool === 'tree') {
        state.trees.push({
          id: 'tree_' + Date.now(),
          x: worldPos[0],
          y: worldPos[1],
          radius: 2.5 + Math.random() * 1.2
        });
        updateZoningCoefficientsUI();
        renderCadWorld();
        return;
      }

      // Draw Footprint Tool
      if (state.activeTool === 'draw_footprint') {
        state.drawPoints.push(worldPos);
        renderInteractionLayer();
        return;
      }

      // Ruler Tool
      if (state.activeTool === 'ruler') {
        if (state.rulerPoints.length >= 2) state.rulerPoints = [];
        state.rulerPoints.push(worldPos);
        renderInteractionLayer();
        return;
      }
    });

    // Double Click to finish freehand footprint
    container.addEventListener('dblclick', () => {
      if (state.activeTool === 'draw_footprint' && state.drawPoints.length >= 3) {
        finishDrawnFootprint();
      }
    });

    // Mouse Move
    window.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const worldPos = screenToWorld(e.clientX, e.clientY);

      if (els.lblMouseCoords) {
        els.lblMouseCoords.innerText = `X: ${worldPos[0].toFixed(1)}მ | Y: ${(-worldPos[1]).toFixed(1)}მ`;
      }

      // Panning Canvas
      if (state.isPanning) {
        state.panX = e.clientX - state.panStart.x;
        state.panY = e.clientY - state.panStart.y;
        applyTransform();
        return;
      }

      // Rotating Footprint
      if (state.isRotatingFootprint && state.draggedFootprintId) {
        const fp = state.footprints.find(f => f.id === state.draggedFootprintId);
        if (fp) {
          const currentAngle = Math.atan2(worldPos[1] - fp.center[1], worldPos[0] - fp.center[0]);
          const angleDeltaDeg = ((currentAngle - state.rotateStartAngle) * 180) / Math.PI;
          let newRot = Math.round(state.footprintInitialRot + angleDeltaDeg);
          newRot = ((newRot % 360) + 360) % 360;
          setBuildingRotation(newRot);
        }
        return;
      }

      // Dragging Footprint
      if (state.isDraggingFootprint && state.draggedFootprintId) {
        const fp = state.footprints.find(f => f.id === state.draggedFootprintId);
        if (fp) {
          const dx = worldPos[0] - state.dragStartPos.x;
          const dy = worldPos[1] - state.dragStartPos.y;
          const newCx = state.dragStartCenter[0] + dx;
          const newCy = state.dragStartCenter[1] + dy;

          const newFp = createFootprintObject(fp.name, fp.shape, fp.width, fp.length, fp.rotation, newCx, newCy, fp.floors, fp.floorHeight, fp.functionType);
          fp.center = [newCx, newCy];
          fp.vertices = newFp.vertices;

          renderCadWorld();
        }
        return;
      }
    });

    // Mouse Up
    window.addEventListener('mouseup', () => {
      state.isPanning = false;
      state.isDraggingFootprint = false;
      state.isRotatingFootprint = false;
    });
  }

  function screenToWorld(clientX, clientY) {
    const rect = els.cadSvgContainer.getBoundingClientRect();
    const x = (clientX - rect.left - state.panX) / state.zoomScale;
    const y = (clientY - rect.top - state.panY) / state.zoomScale;
    return [x, y];
  }

  function applyTransform() {
    if (els.worldGroup) {
      els.worldGroup.setAttribute('transform', `translate(${state.panX}, ${state.panY}) scale(${state.zoomScale})`);
    }
    updateGraphicScaleBar();
    renderCadWorld(); // re-render to update crisp screen-relative sizes!
  }

  function checkFootprintHit(worldPos) {
    const pxToM = 1 / Math.max(0.001, state.zoomScale);
    const hitTolerance = 6 * pxToM;

    for (let i = state.footprints.length - 1; i >= 0; i--) {
      const fp = state.footprints[i];
      // Check center handle
      const dCenter = Math.hypot(worldPos[0] - fp.center[0], worldPos[1] - fp.center[1]);
      if (dCenter < 8 * pxToM) return fp;

      // Check inside polygon
      if (pointInPolygon(worldPos, fp.vertices, hitTolerance)) return fp;
    }
    return null;
  }

  function checkRotationHandleHit(worldPos) {
    const pxToM = 1 / Math.max(0.001, state.zoomScale);
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return null;

    // Rotation handle is positioned along rotation vector above center
    const stemDist = (fp.length / 2) + (16 * pxToM);
    const rad = ((fp.rotation - 90) * Math.PI) / 180;
    const handleX = fp.center[0] + Math.cos(rad) * stemDist;
    const handleY = fp.center[1] + Math.sin(rad) * stemDist;

    const d = Math.hypot(worldPos[0] - handleX, worldPos[1] - handleY);
    if (d < 8 * pxToM) return fp;
    return null;
  }

  function pointInPolygon(pt, poly, tolerance) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function finishDrawnFootprint() {
    if (state.drawPoints.length < 3) return;
    const area = calculatePolygonArea(state.drawPoints);
    const cx = state.drawPoints.reduce((s, p) => s + p[0], 0) / state.drawPoints.length;
    const cy = state.drawPoints.reduce((s, p) => s + p[1], 0) / state.drawPoints.length;

    const nextNum = state.footprints.length + 1;
    const fp = {
      id: 'bld_' + Date.now(),
      name: `შენობა ${nextNum}`,
      shape: 'freeform',
      width: Math.round(Math.sqrt(area)),
      length: Math.round(Math.sqrt(area)),
      rotation: 0,
      center: [cx, cy],
      vertices: [...state.drawPoints],
      floors: 4,
      floorHeight: 3.0,
      totalHeight: 12.8,
      functionType: 'residential',
      areaSqm: Math.round(area)
    };

    state.footprints.push(fp);
    state.selectedFootprintId = fp.id;
    state.drawPoints = [];
    setCadActiveTool('pan');
    updateZoningCoefficientsUI();
    renderCadWorld();
  }

  // =========================================================================
  // --- ARCHITECTURAL RENDER PIPELINE WITH SCREEN-SCALED GRAPHICS ---
  // =========================================================================
  function renderCadWorld() {
    const pxToM = 1 / Math.max(0.001, state.zoomScale);

    renderCadastralBoundary(pxToM);
    renderSetbackBuffer(pxToM);
    renderSubParcels(pxToM);
    renderRoads(pxToM);
    renderParking(pxToM);
    renderShadows();
    renderTrees(pxToM);
    renderFootprints(pxToM);
    renderDimensions(pxToM);
    renderNodes(pxToM);
    renderInteractionLayer(pxToM);
  }

  // 1. Cadastral Boundary Layer
  function renderCadastralBoundary(pxToM) {
    if (!els.cadastralBoundaryLayer) return;
    if (!state.layers.boundary || !state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.cadastralBoundaryLayer.innerHTML = '';
      return;
    }

    const pointsStr = state.boundaryMeters.map(p => `${p[0]},${p[1]}`).join(' ');
    const strokeW = Math.max(0.3, 2.2 * pxToM);

    els.cadastralBoundaryLayer.innerHTML = `
      <polygon points="${pointsStr}" fill="var(--parcel-fill)" stroke="var(--parcel-stroke)" stroke-width="${strokeW}" stroke-linejoin="round" />
    `;
  }

  // 2. Setback Buffer Layer (3.0m)
  function renderSetbackBuffer(pxToM) {
    if (!els.setbackBoundaryLayer) return;
    if (!state.layers.setback || !state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.setbackBoundaryLayer.innerHTML = '';
      return;
    }

    const setbackPoly = computeSetbackPolygon(state.boundaryMeters, state.setbackDistance);
    if (setbackPoly.length < 3) {
      els.setbackBoundaryLayer.innerHTML = '';
      return;
    }
    const pts = setbackPoly.map(p => `${p[0]},${p[1]}`).join(' ');
    const strokeW = Math.max(0.2, 1.2 * pxToM);
    const dash = `${4 * pxToM}, ${3 * pxToM}`;

    els.setbackBoundaryLayer.innerHTML = `
      <polygon points="${pts}" fill="none" stroke="var(--setback-stroke)" stroke-width="${strokeW}" stroke-dasharray="${dash}" opacity="0.9" />
    `;
  }

  // 3. Sub-parcels (when split)
  function renderSubParcels(pxToM) {
    if (!els.subParcelsLayer) return;
    if (state.subParcels.length === 0) {
      els.subParcelsLayer.innerHTML = '';
      return;
    }

    els.subParcelsLayer.innerHTML = state.subParcels.map(sp => {
      const pts = sp.polygon.map(p => `${p[0]},${p[1]}`).join(' ');
      const cx = sp.polygon.reduce((s, p) => s + p[0], 0) / sp.polygon.length;
      const cy = sp.polygon.reduce((s, p) => s + p[1], 0) / sp.polygon.length;

      const badgeW = 75 * pxToM;
      const badgeH = 26 * pxToM;

      return `
        <polygon points="${pts}" fill="${sp.color}" stroke="#38bdf8" stroke-width="${1.2 * pxToM}" stroke-dasharray="${3 * pxToM}, ${2 * pxToM}"/>
        <rect x="${cx - badgeW / 2}" y="${cy - badgeH / 2}" width="${badgeW}" height="${badgeH}" rx="${4 * pxToM}" fill="rgba(10,16,28,0.85)" stroke="#38bdf8" stroke-width="${0.8 * pxToM}"/>
        <text x="${cx}" y="${cy - 2 * pxToM}" text-anchor="middle" fill="#ffffff" font-size="${10 * pxToM}" font-weight="bold" font-family="Inter, sans-serif">${sp.name}</text>
        <text x="${cx}" y="${cy + 8 * pxToM}" text-anchor="middle" fill="#38bdf8" font-size="${9 * pxToM}" font-family="'JetBrains Mono', monospace">${sp.areaSqm} მ²</text>
      `;
    }).join('');
  }

  // 4. Driveways & Roads
  function renderRoads(pxToM) {
    if (!els.roadsLayer) return;
    if (!state.layers.roads || !state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.roadsLayer.innerHTML = '';
      return;
    }

    // Place entrance road connecting smoothly at the bottom-most boundary edge
    const ys = state.boundaryMeters.map(p => p[1]);
    const maxY = Math.max(...ys);

    const roadW = 28;
    const roadH = 6;
    const rx = -roadW / 2;
    const ry = maxY + 1;

    els.roadsLayer.innerHTML = `
      <g>
        <rect x="${rx}" y="${ry}" width="${roadW}" height="${roadH}" fill="var(--road-fill)" stroke="#475569" stroke-width="${0.8 * pxToM}" rx="${1 * pxToM}"/>
        <line x1="${rx}" y1="${ry + roadH / 2}" x2="${rx + roadW}" y2="${ry + roadH / 2}" stroke="#facc15" stroke-width="${0.6 * pxToM}" stroke-dasharray="${3 * pxToM}, ${3 * pxToM}"/>
        <text x="0" y="${ry + roadH / 2 + 1.2 * pxToM}" text-anchor="middle" fill="#94a3b8" font-size="${8 * pxToM}" font-family="Inter, sans-serif" font-weight="600">მისასვლელი გზა (6.0მ)</text>
      </g>
    `;
  }

  // 5. Parking Bays
  function renderParking(pxToM) {
    if (!els.parkingLayer) return;
    if (!state.layers.roads || state.parkingBays.length === 0) {
      els.parkingLayer.innerHTML = '';
      return;
    }

    els.parkingLayer.innerHTML = state.parkingBays.map(p => `
      <g>
        <rect x="${p.center[0] - p.width / 2}" y="${p.center[1] - p.length / 2}" width="${p.width}" height="${p.length}" fill="var(--parking-fill)" opacity="0.75" stroke="#ffffff" stroke-width="${0.5 * pxToM}" rx="${0.5 * pxToM}"/>
        <text x="${p.center[0]}" y="${p.center[1] + 2.5 * pxToM}" text-anchor="middle" fill="#ffffff" font-size="${8 * pxToM}" font-weight="bold">P</text>
      </g>
    `).join('');
  }

  // 6. 2D Shadow Projection
  function renderShadows() {
    if (!els.shadowsLayer) return;
    if (!state.layers.shadows) {
      els.shadowsLayer.innerHTML = '';
      return;
    }

    const rad = (state.sunAzimuth * Math.PI) / 180;
    const shadowDistRatio = 0.55;

    els.shadowsLayer.innerHTML = state.footprints.map(f => {
      const sLen = (f.totalHeight || 12) * shadowDistRatio;
      const sx = Math.cos(rad) * sLen;
      const sy = Math.sin(rad) * sLen;

      const shadowPoly = f.vertices.map(v => `${v[0] + sx},${v[1] + sy}`).join(' ');
      return `<polygon points="${shadowPoly}" fill="rgba(0,0,0,0.35)" filter="blur(1px)" />`;
    }).join('');
  }

  // 7. Trees & Landscaping (+ ხეები)
  function renderTrees(pxToM) {
    if (!els.treesLayer) return;
    if (!state.layers.trees || state.trees.length === 0) {
      els.treesLayer.innerHTML = '';
      return;
    }

    els.treesLayer.innerHTML = state.trees.map(t => {
      const r = t.radius || 2.8;
      const branchR = r * 0.7;
      return `
        <g class="cursor-pointer">
          <!-- Ambient shadow -->
          <circle cx="${t.x + 0.6}" cy="${t.y + 0.6}" r="${r}" fill="rgba(0,0,0,0.22)"/>
          <!-- Outer Foliage -->
          <circle cx="${t.x}" cy="${t.y}" r="${r}" fill="var(--tree-fill)" opacity="0.85" stroke="#15803d" stroke-width="${0.6 * pxToM}"/>
          <!-- Inner Decorative Crown -->
          <circle cx="${t.x}" cy="${t.y}" r="${branchR}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="${0.5 * pxToM}" stroke-dasharray="${1.5 * pxToM}, ${1.5 * pxToM}"/>
          <!-- Trunk -->
          <circle cx="${t.x}" cy="${t.y}" r="${0.6 * pxToM}" fill="#78350f"/>
        </g>
      `;
    }).join('');
  }

  // 8. Building Footprints Layer (With Sleek Screen-Scaled Architectural Badges & Transform Handles)
  function renderFootprints(pxToM) {
    if (!els.footprintsLayer) return;
    if (!state.layers.footprints) {
      els.footprintsLayer.innerHTML = '';
      return;
    }

    const hatchId = state.activeStyle === 'classic' ? 'hatchBuildingClassic' : 'hatchBuildingBlueprint';

    els.footprintsLayer.innerHTML = state.footprints.map(f => {
      const pts = f.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
      const isSelected = f.id === state.selectedFootprintId;

      // Badge Dimensions in Screen Pixels
      const badgeW = 95 * pxToM;
      const badgeH = 26 * pxToM;
      const cornerR = 4 * pxToM;
      const strokeW = isSelected ? Math.max(0.4, 2.0 * pxToM) : Math.max(0.3, 1.2 * pxToM);

      // Rotation Handle Setup (only for selected building)
      let rotationHandleSvg = '';
      if (isSelected) {
        const stemDist = (f.length / 2) + (16 * pxToM);
        const rad = ((f.rotation - 90) * Math.PI) / 180;
        const hx = f.center[0] + Math.cos(rad) * stemDist;
        const hy = f.center[1] + Math.sin(rad) * stemDist;

        rotationHandleSvg = `
          <!-- Rotation Stem & Knob -->
          <line x1="${f.center[0]}" y1="${f.center[1]}" x2="${hx}" y2="${hy}" stroke="#f59e0b" stroke-width="${1 * pxToM}" stroke-dasharray="${2 * pxToM}, ${2 * pxToM}" />
          <circle cx="${hx}" cy="${hy}" r="${4.5 * pxToM}" fill="#f59e0b" stroke="#ffffff" stroke-width="${1 * pxToM}" class="cursor-grab" title="დაატრიალეთ შენობა" />
        `;
      }

      return `
        <g class="cursor-pointer" onclick="selectFootprint('${f.id}')">
          <!-- Footprint Base Polygon -->
          <polygon points="${pts}" fill="var(--footprint-fill)" stroke="${isSelected ? '#00f0ff' : 'var(--footprint-stroke)'}" stroke-width="${strokeW}" />
          <!-- Architectural Diagonal Hatching -->
          <polygon points="${pts}" fill="url(#${hatchId})" opacity="0.65" pointer-events="none" />

          ${rotationHandleSvg}

          <!-- Center Drag Handle Knob -->
          <circle cx="${f.center[0]}" cy="${f.center[1]}" r="${4.5 * pxToM}" fill="${isSelected ? '#00f0ff' : '#ffffff'}" stroke="#0a101d" stroke-width="${1 * pxToM}" />

          <!-- High-Contrast Sleek Floating Callout Badge -->
          <rect x="${f.center[0] - badgeW / 2}" y="${f.center[1] - badgeH / 2}" width="${badgeW}" height="${badgeH}" rx="${cornerR}" fill="rgba(8,13,26,0.92)" stroke="${isSelected ? '#00f0ff' : '#334155'}" stroke-width="${0.8 * pxToM}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" pointer-events="none" />
          <text x="${f.center[0]}" y="${f.center[1] - 2 * pxToM}" text-anchor="middle" fill="#ffffff" font-size="${9 * pxToM}" font-weight="bold" font-family="Inter, sans-serif" pointer-events="none">${f.name}</text>
          <text x="${f.center[0]}" y="${f.center[1] + 8 * pxToM}" text-anchor="middle" fill="${isSelected ? '#38bdf8' : '#94a3b8'}" font-size="${8 * pxToM}" font-family="'JetBrains Mono', monospace" font-weight="600" pointer-events="none">${f.areaSqm} მ² · ${f.floors}ს (H:${f.totalHeight}მ)</text>
        </g>
      `;
    }).join('');
  }

  // 9. Architectural Dimension Strings (With 45° CAD Ticks and Non-Overlapping Pills)
  function renderDimensions(pxToM) {
    if (!els.dimensionsLayer) return;
    if (!state.layers.dimensions || !state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.dimensionsLayer.innerHTML = '';
      return;
    }

    let dimSvg = '';
    const poly = state.boundaryMeters;
    const n = poly.length;

    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);

      // Skip microscopic edges to prevent text overlapping
      if (dist < 2.5) continue;

      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;

      // Normal offset
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const nx = -dy / dist;
      const ny = dx / dist;

      const offsetDist = 5.5 * pxToM;
      const tx = midX + nx * offsetDist;
      const ty = midY + ny * offsetDist;

      const textStr = `${dist.toFixed(1)}მ`;
      const pillW = (textStr.length * 6 + 6) * pxToM;
      const pillH = 14 * pxToM;

      dimSvg += `
        <g>
          <!-- Dimension Badge Pill -->
          <rect x="${tx - pillW / 2}" y="${ty - pillH / 2}" width="${pillW}" height="${pillH}" rx="${2.5 * pxToM}" fill="var(--canvas-bg)" stroke="var(--grid-major)" stroke-width="${0.6 * pxToM}" opacity="0.95" />
          <text x="${tx}" y="${ty + 3.5 * pxToM}" text-anchor="middle" fill="var(--text-color)" font-size="${8.5 * pxToM}" font-family="'JetBrains Mono', monospace" font-weight="bold">${textStr}</text>
        </g>
      `;
    }
    els.dimensionsLayer.innerHTML = dimSvg;
  }

  // 10. Node Numbers Layer (Optional Toggle to prevent clutter)
  function renderNodes(pxToM) {
    if (!els.nodesLayer) return;
    if (!state.layers.nodes || !state.boundaryMeters) {
      els.nodesLayer.innerHTML = '';
      return;
    }

    const r = 3.5 * pxToM;
    els.nodesLayer.innerHTML = state.boundaryMeters.map((p, idx) => `
      <g>
        <circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="#00f0ff" stroke="#080d1a" stroke-width="${0.8 * pxToM}"/>
        <text x="${p[0] + 4 * pxToM}" y="${p[1] - 4 * pxToM}" fill="var(--text-color)" font-size="${8 * pxToM}" font-family="'JetBrains Mono', monospace" font-weight="bold">#${idx + 1}</text>
      </g>
    `).join('');
  }

  // 11. Temporary Interaction Layer
  function renderInteractionLayer(pxToM) {
    if (!els.interactionLayer) return;
    const p2m = pxToM || (1 / Math.max(0.001, state.zoomScale));

    if (state.activeTool === 'split' && state.splitLine.length === 1) {
      els.interactionLayer.innerHTML = `
        <circle cx="${state.splitLine[0][0]}" cy="${state.splitLine[0][1]}" r="${4 * p2m}" fill="#f59e0b" stroke="#ffffff" stroke-width="${1 * p2m}" />
      `;
    } else if (state.activeTool === 'draw_footprint' && state.drawPoints.length > 0) {
      const pts = state.drawPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      els.interactionLayer.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="#00f0ff" stroke-width="${1.5 * p2m}" stroke-dasharray="${3 * p2m}, ${2 * p2m}" />
        ${state.drawPoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3 * p2m}" fill="#00f0ff"/>`).join('')}
      `;
    } else if (state.activeTool === 'ruler' && state.rulerPoints.length === 2) {
      const p1 = state.rulerPoints[0];
      const p2 = state.rulerPoints[1];
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      els.interactionLayer.innerHTML = `
        <line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#f59e0b" stroke-width="${1.2 * p2m}" stroke-dasharray="${3 * p2m}, ${2 * p2m}" />
        <circle cx="${p1[0]}" cy="${p1[1]}" r="${3.5 * p2m}" fill="#f59e0b"/>
        <circle cx="${p2[0]}" cy="${p2[1]}" r="${3.5 * p2m}" fill="#f59e0b"/>
        <text x="${(p1[0] + p2[0]) / 2}" y="${(p1[1] + p2[1]) / 2 - 4 * p2m}" text-anchor="middle" fill="#f59e0b" font-size="${10 * p2m}" font-weight="bold">${dist.toFixed(2)} მ</text>
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

    const scaleX = (rect.width * 0.72) / boundW;
    const scaleY = (rect.height * 0.72) / boundH;
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

  // --- Official PDF Dossier Report Export ---
  window.exportTsinarePdfReport = function () {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('PDF ბიბლიოთეკა იტვირთება, გთხოვთ სცადოთ 1 წამში.');
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
    doc.text(`საკადასტრო კოდი: ${state.cadastralCode} | მასშტაბი: M 1:500 | სტილი: ${state.activeStyle.toUpperCase()} | თარიღი: ${dateStr}`, 18, 19);

    // Architectural Title Stamp (შტამპი)
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
    doc.text(`მესაკუთრე: ${state.owners.join(', ')}`, stampX + 5, stampY + 26);
    doc.text(`ფურცელი: 1 / 1  |  სტადია: წინარე საპროექტო (Pre-Design)`, stampX + 5, stampY + 32);
    doc.text(`საკადასტრო კოდი: ${state.cadastralCode}`, stampX + 5, stampY + 38);

    // Technical-Economic Indicators Table (ტემ-ი)
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
      ['დარგული ხეები (გამწვანება)', '—', `${state.trees.length} ხე`, 'დაცულია'],
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
        styles: { fontSize: 8, cellPadding: 2.2, font: fontName },
        margin: { left: 18, right: pageWidth - 145 }
      });
    }

    // Export Vector Drawing snapshot to PDF
    const svgEl = document.getElementById('cadSvgStage');
    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const DOMURL = window.URL || window.webkitURL || window;
      const url = DOMURL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = 1800;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = state.activeStyle === 'classic' ? '#fbfcfd' : (state.activeStyle === 'presentation' ? '#f2f8f4' : '#071329');
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
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n6\n";
    dxf += "0\nLAYER\n2\nCADASTRAL_BOUNDARY\n70\n0\n62\n1\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nSETBACK_BUFFER\n70\n0\n62\n6\n6\nDASHED\n";
    dxf += "0\nLAYER\n2\nBUILDING_FOOTPRINTS\n70\n0\n62\n4\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nSUBDIVISION_PARCELS\n70\n0\n62\n3\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nTREES_GREENERY\n70\n0\n62\n2\n6\nCONTINUOUS\n";
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

    // Trees as Circles
    state.trees.forEach(t => {
      dxf += `0\nCIRCLE\n8\nTREES_GREENERY\n10\n${t.x.toFixed(3)}\n20\n${t.y.toFixed(3)}\n30\n0.0\n40\n${(t.radius || 2.5).toFixed(3)}\n`;
    });

    dxf += "0\nENDSEC\n0\nEOF\n";

    const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BIMX_Tsinare_${state.cadastralCode}.dxf`;
    a.click();
  };

  function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.target && ['input', 'select', 'textarea'].includes(e.target.tagName.toLowerCase())) return;
      if (e.key === ' ' || e.key === 'p') setCadActiveTool('pan');
      if (e.key === 's') setCadActiveTool('split');
      if (e.key === 'b') setCadActiveTool('draw_footprint');
      if (e.key === 't') setCadActiveTool('tree');
      if (e.key === 'r') setCadActiveTool('ruler');
      if (e.key === 'Escape') setCadActiveTool('pan');
    });
  }

})();
