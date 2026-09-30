/**
 * tsinare.js — BIMX Architectural 2D Masterplan & CAD Studio Engine (წინარე)
 * --------------------------------------------------------------------------
 * Features:
 * - Direct Cadastral Search with live NAPR API Integration across Georgia
 * - Complete Object Deletion (Eraser Tool, Keyboard Delete/Backspace, Trash Buttons)
 * - Undo/Redo System (Ctrl+Z and Undo Button)
 * - 8 Architectural Visual Styles (Classic White, Royal Blueprint, Presentation, Satellite, Dark OLED, Vintage Sepia, Greyscale Mono, Resort Aqua)
 * - True Working Architectural Scale (M 1:100, 1:200, 1:500, 1:1000, 1:2000) & Dynamic Graphic Scale Bar
 * - Parametric Building Resizing (Width/Length), Free Rotation (0°-360°), and Rename
 * - Preset Building Typologies (Rectangular, L-Shape, U-Shape Courtyard, Tower)
 * - Landscaping & Greenery Tool (+ ხეები) with Dynamic K-3 Area Calculations
 * - Water Features & Swimming Pools (+ აუზი / წყალი)
 * - Wooden Terraces & Patios (+ ტერასა)
 * - Paved Pedestrian Walkways (+ ბილიკი)
 * - Road & Driveway with Fire Truck Access (6.0m)
 * - Parking Bays Placement & Norms
 * - Layer Visibility Controls (შრეების მართვა)
 * - Sun Insolation & Real-Time Shadow Projection
 * - Export to Official PDF Dossier, AutoCAD DXF, and High-Res PNG Image
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
    footprints: [], // [{ id, name, shape, width, length, rotation, floors, floorHeight, totalHeight, functionType, center: [x,y], vertices: [[x,y]...], areaSqm, isViolatingSetback }]
    selectedFootprintId: null,
    trees: [], // [{ id, x, y, radius, treeType }]
    waterBodies: [], // [{ id, x, y, width: 10, length: 5 }]
    terraces: [], // [{ id, x, y, width: 12, length: 6 }]
    walkways: [], // [{ id, points: [[x,y]...], width: 1.8 }]
    roads: [], // [{ id, points: [[x,y]...], width: 6.0 }]
    bikePaths: [], // [{ id, points: [[x,y]...], width: 2.0 }]
    hedges: [], // [{ id, points: [[x,y]...], width: 1.0 }]
    fountains: [], // [{ id, x, y, radius: 2.5 }]
    parkingBays: [], // [{ id, center: [x,y], width: 2.5, length: 5.0, rotation: 0 }]
    setbackDistance: 3.0,
    
    // Quick / Stamp parameters
    stampWidth: 15,
    stampLength: 12,
    stampFloors: 4,
    stampShape: 'rect',
    stampFn: 'residential',
    stampName: 'შენობა',
    activeRoadWidth: 6.0,
    activeWalkwayWidth: 1.8,
    activeTreeRadius: 2.5,
    
    // Layer Visibility
    layers: {
      boundary: true,
      setback: true,
      dimensions: true,
      footprints: true,
      shadows: true,
      trees: true,
      water: true,
      terraces: true,
      roads: true,
      parking: true,
      nodes: false
    },

    // CAD Canvas Viewport Transform
    panX: 0,
    panY: 0,
    zoomScale: 1.0, // pixels per meter
    isPanning: false,
    panStart: { x: 0, y: 0 },
    
    // Tools & Modes
    activeTool: 'pan', // 'pan', 'stamp_footprint', 'delete', 'split', 'draw_footprint', 'tree', 'pine_tree', 'hedge', 'water', 'fountain', 'terrace', 'walkway', 'bike_path', 'draw_road', 'parking', 'ruler'
    activeStyle: 'blueprint', // 24 styles
    sunAzimuth: 135, // degrees
    
    // Interactive Transformations
    drawPoints: [],
    splitLine: [],
    rulerPoints: [],
    currentWalkwayPoints: [],
    currentRoadPoints: [],
    currentBikePathPoints: [],
    currentHedgePoints: [],
    mouseWorldPos: null,
    isDraggingFootprint: false,
    isRotatingFootprint: false,
    isDrawingRect: false,
    drawRectStart: null,
    drawRectCurrent: null,
    draggedFootprintId: null,
    dragStartPos: { x: 0, y: 0 },
    dragStartCenter: [0, 0],
    rotateStartAngle: 0,
    footprintInitialRot: 0,

    // Undo Stack
    undoStack: []
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
    els.cadastralSearchForm = document.getElementById('cadastralSearchForm');
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
    els.walkwaysLayer = document.getElementById('walkwaysLayer');
    els.bikePathsLayer = document.getElementById('bikePathsLayer');
    els.hedgesLayer = document.getElementById('hedgesLayer');
    els.parkingLayer = document.getElementById('parkingLayer');
    els.waterLayer = document.getElementById('waterLayer');
    els.fountainsLayer = document.getElementById('fountainsLayer');
    els.terracesLayer = document.getElementById('terracesLayer');
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
    els.lblActiveStyleName = document.getElementById('lblActiveStyleName');

    // Zoning Metric Elements
    els.inputK1Coeff = document.getElementById('inputK1Coeff');
    els.barK1Progress = document.getElementById('barK1Progress');
    els.lblK1Allowed = document.getElementById('lblK1Allowed');
    els.lblK1Used = document.getElementById('lblK1Used');
    els.lblK1Remaining = document.getElementById('lblK1Remaining');
    els.lblK1Alert = document.getElementById('lblK1Alert');

    els.inputK2Coeff = document.getElementById('inputK2Coeff');
    els.barK2Progress = document.getElementById('barK2Progress');
    els.lblK2Allowed = document.getElementById('lblK2Allowed');
    els.lblK2Used = document.getElementById('lblK2Used');
    els.lblK2Remaining = document.getElementById('lblK2Remaining');
    els.lblK2Alert = document.getElementById('lblK2Alert');

    els.inputK3Coeff = document.getElementById('inputK3Coeff');
    els.barK3Progress = document.getElementById('barK3Progress');
    els.lblK3Required = document.getElementById('lblK3Required');
    els.lblK3Actual = document.getElementById('lblK3Actual');
    els.lblK3Balance = document.getElementById('lblK3Balance');
    els.lblHardscapeTotal = document.getElementById('lblHardscapeTotal');
    els.lblOpenGround = document.getElementById('lblOpenGround');
    els.lblPlantedTreesCount = document.getElementById('lblPlantedTreesCount');
    els.lblK3Alert = document.getElementById('lblK3Alert');

    // Active Building Controls
    els.txtBuildingName = document.getElementById('txtBuildingName');
    els.sliderBuildingWidth = document.getElementById('sliderBuildingWidth');
    els.lblBuildingWidthVal = document.getElementById('lblBuildingWidthVal');
    els.inputNumBuildingWidth = document.getElementById('inputNumBuildingWidth');
    els.sliderBuildingLength = document.getElementById('sliderBuildingLength');
    els.lblBuildingLengthVal = document.getElementById('lblBuildingLengthVal');
    els.inputNumBuildingLength = document.getElementById('inputNumBuildingLength');
    els.inputNumBuildingArea = document.getElementById('inputNumBuildingArea');
    els.sliderBuildingRotation = document.getElementById('sliderBuildingRotation');
    els.lblBuildingRotationVal = document.getElementById('lblBuildingRotationVal');
    els.inputNumBuildingRotation = document.getElementById('inputNumBuildingRotation');
    els.sliderFloors = document.getElementById('sliderFloors');
    els.lblFloorsCountVal = document.getElementById('lblFloorsCountVal');
    els.inputNumBuildingFloors = document.getElementById('inputNumBuildingFloors');
    els.lblFloorHeightVal = document.getElementById('lblFloorHeightVal');
    els.inputNumFloorHeight = document.getElementById('inputNumFloorHeight');
    els.lblTotalHeightVal = document.getElementById('lblTotalHeightVal');
    els.selBuildingFunction = document.getElementById('selBuildingFunction');
    els.lblSetbackDistVal = document.getElementById('lblSetbackDistVal');
    els.lblFootprintsCount = document.getElementById('lblFootprintsCount');
    els.lstBuildingsContainer = document.getElementById('lstBuildingsContainer');

    // CAD Dock: Quick parameters (Row 2)
    els.quickBldW = document.getElementById('quickBldW');
    els.quickBldL = document.getElementById('quickBldL');
    els.quickBldFloors = document.getElementById('quickBldFloors');
    els.quickRoadW = document.getElementById('quickRoadW');
    els.quickWalkW = document.getElementById('quickWalkW');
    els.quickSetbackNum = document.getElementById('quickSetbackNum');
    els.quickTreeDiam = document.getElementById('quickTreeDiam');

    // Sidebar: Site & Infrastructure parameters
    els.inputSiteSetbackDist = document.getElementById('inputSiteSetbackDist');
    els.inputSiteRoadWidth = document.getElementById('inputSiteRoadWidth');
    els.inputSiteWalkWidth = document.getElementById('inputSiteWalkWidth');
    els.inputSiteTreeDiam = document.getElementById('inputSiteTreeDiam');
    els.inputSitePoolW = document.getElementById('inputSitePoolW');
    els.inputSitePoolL = document.getElementById('inputSitePoolL');
    els.inputSiteTerraceW = document.getElementById('inputSiteTerraceW');
    els.inputSiteTerraceL = document.getElementById('inputSiteTerraceL');

    // Bind form submit event
    if (els.cadastralSearchForm) {
      els.cadastralSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        triggerCadastralSearch();
      });
    }
  }

  // --- Snapshot for Undo ---
  function saveUndoSnapshot() {
    state.undoStack.push({
      footprints: JSON.parse(JSON.stringify(state.footprints)),
      trees: JSON.parse(JSON.stringify(state.trees)),
      waterBodies: JSON.parse(JSON.stringify(state.waterBodies)),
      terraces: JSON.parse(JSON.stringify(state.terraces)),
      walkways: JSON.parse(JSON.stringify(state.walkways || [])),
      roads: JSON.parse(JSON.stringify(state.roads || [])),
      bikePaths: JSON.parse(JSON.stringify(state.bikePaths || [])),
      hedges: JSON.parse(JSON.stringify(state.hedges || [])),
      fountains: JSON.parse(JSON.stringify(state.fountains || [])),
      parkingBays: JSON.parse(JSON.stringify(state.parkingBays)),
      subParcels: JSON.parse(JSON.stringify(state.subParcels)),
      setbackDistance: state.setbackDistance
    });
    if (state.undoStack.length > 30) state.undoStack.shift();
  }

  window.undoLastAction = function () {
    if (state.undoStack.length > 0) {
      const snap = state.undoStack.pop();
      state.footprints = snap.footprints || [];
      state.trees = snap.trees || [];
      state.waterBodies = snap.waterBodies || [];
      state.terraces = snap.terraces || [];
      state.walkways = snap.walkways || [];
      state.roads = snap.roads || [];
      state.bikePaths = snap.bikePaths || [];
      state.hedges = snap.hedges || [];
      state.fountains = snap.fountains || [];
      state.parkingBays = snap.parkingBays || [];
      state.subParcels = snap.subParcels || [];
      if (snap.setbackDistance) state.setbackDistance = snap.setbackDistance;

      if (!state.footprints.some(f => f.id === state.selectedFootprintId)) {
        state.selectedFootprintId = state.footprints[0] ? state.footprints[0].id : null;
      }
      updateSelectedBuildingUI();
      updateZoningCoefficientsUI();
      renderCadWorld();
      updateToolStatus('ბოლო მოქმედება გაუქმდა (Undo).');
    }
  };

  // --- Nationwide NAPR Parcel Retrieval ---
  async function triggerCadastralSearch(codeOverride) {
    const rawCode = (codeOverride || (els.cadastralInput ? els.cadastralInput.value : '') || '').trim();
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
        state.waterBodies = [];
        state.terraces = [];
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

  // EXPOSE GLOBALLY FOR INLINE FORM & BUTTONS
  window.triggerCadastralSearch = triggerCadastralSearch;

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
      const y = -(c[0] - avgLat) * metersPerDegLat;
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
    saveUndoSnapshot();
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

  // --- DELETE CURRENT SELECTED OBJECT ---
  window.deleteSelectedObject = function () {
    if (!state.selectedFootprintId) return;
    saveUndoSnapshot();
    state.footprints = state.footprints.filter(f => f.id !== state.selectedFootprintId);
    state.selectedFootprintId = state.footprints[0] ? state.footprints[0].id : null;
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('შენობა წაიშალა.');
  };

  // --- Clear all footprints (ცარიელი ნაკვეთი) ---
  window.clearAllFootprints = function () {
    if (confirm('გსურთ ყველა შენობის ლაქის, ხის და ობიექტის წაშლა?')) {
      saveUndoSnapshot();
      state.footprints = [];
      state.trees = [];
      state.waterBodies = [];
      state.terraces = [];
      state.parkingBays = [];
      state.subParcels = [];
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
    saveUndoSnapshot();

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
      saveUndoSnapshot();
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
    saveUndoSnapshot();
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

  // --- Real-time K1, K2, K3 Calculations (ყველა ჩარევა აისახება კოეფიციენტებზე) ---
  function updateZoningCoefficientsUI() {
    const parcelArea = state.officialAreaSqm || state.geometricAreaSqm || 1;
    const k1 = state.k1Limit;
    const k2 = state.k2Limit;
    const k3 = state.k3Limit;

    // 1. K-1 (განაშენიანების ფართობი - შენობების ლაქები)
    const k1Used = Math.round(state.footprints.reduce((sum, f) => sum + (f.areaSqm || 0), 0));
    const k1Allowed = Math.round(parcelArea * k1);
    const k1Diff = k1Allowed - k1Used;
    const k1Remaining = Math.max(0, k1Diff);
    const k1Percent = k1Allowed > 0 ? Math.min(100, Math.round((k1Used / k1Allowed) * 100)) : 0;
    const k1Over = k1Used > k1Allowed;

    // 2. K-2 (განაშენიანების ინტენსივობა - საერთო ფართობი GFA)
    const k2Used = Math.round(state.footprints.reduce((sum, f) => sum + ((f.areaSqm || 0) * (f.floors || 1)), 0));
    const k2Allowed = Math.round(parcelArea * k2);
    const k2Diff = k2Allowed - k2Used;
    const k2Remaining = Math.max(0, k2Diff);
    const k2Percent = k2Allowed > 0 ? Math.min(100, Math.round((k2Used / k2Allowed) * 100)) : 0;
    const k2Over = k2Used > k2Allowed;

    // 3. K-3 (გამწვანება და ღია ეზო - მყარი საფარის გამოკლება)
    const roadsArea = (state.roads || []).reduce((sum, r) => {
      if (!r.points || r.points.length < 2) return sum;
      let len = 0;
      for (let i = 0; i < r.points.length - 1; i++) len += Math.hypot(r.points[i+1][0] - r.points[i][0], r.points[i+1][1] - r.points[i][1]);
      return sum + len * (r.width || 6.0);
    }, 0);

    const walkwaysArea = (state.walkways || []).reduce((sum, w) => {
      if (!w.points || w.points.length < 2) return sum;
      let len = 0;
      for (let i = 0; i < w.points.length - 1; i++) len += Math.hypot(w.points[i+1][0] - w.points[i][0], w.points[i+1][1] - w.points[i][1]);
      return sum + len * (w.width || 1.8);
    }, 0);

    const bikePathsArea = (state.bikePaths || []).reduce((sum, b) => {
      if (!b.points || b.points.length < 2) return sum;
      let len = 0;
      for (let i = 0; i < b.points.length - 1; i++) len += Math.hypot(b.points[i+1][0] - b.points[i][0], b.points[i+1][1] - b.points[i][1]);
      return sum + len * (b.width || 2.0);
    }, 0);

    const parkingArea = (state.parkingBays || []).length * 12.5; // 2.5×5.0მ = 12.5 მ²
    const terracesArea = (state.terraces || []).reduce((sum, t) => sum + (t.width || 12) * (t.length || 6), 0);
    const waterArea = (state.waterBodies || []).reduce((sum, w) => sum + (w.width || 10) * (w.length || 5), 0);
    const fountainsArea = (state.fountains || []).reduce((sum, f) => sum + Math.PI * (f.radius || 2.5) * (f.radius || 2.5), 0);

    const totalHardscape = Math.round(k1Used + roadsArea + walkwaysArea + bikePathsArea + parkingArea + terracesArea + waterArea + fountainsArea);
    const openGround = Math.max(0, Math.round(parcelArea - totalHardscape));

    const treesCanopyArea = Math.round(state.trees.reduce((sum, t) => sum + Math.PI * (t.radius || 2.5) * (t.radius || 2.5), 0));
    const hedgesArea = Math.round((state.hedges || []).reduce((sum, h) => {
      if (!h.points || h.points.length < 2) return sum;
      let len = 0;
      for (let i = 0; i < h.points.length - 1; i++) len += Math.hypot(h.points[i+1][0] - h.points[i][0], h.points[i+1][1] - h.points[i][1]);
      return sum + len * (h.width || 1.0);
    }, 0));

    const k3Required = Math.round(parcelArea * k3);
    const k3Actual = Math.round(openGround + Math.min(openGround * 0.35, treesCanopyArea * 0.4 + hedgesArea));
    const k3Balance = k3Actual - k3Required;
    const k3Percent = k3Required > 0 ? Math.min(100, Math.round((k3Actual / k3Required) * 100)) : 100;
    const k3Deficit = k3Balance < 0;

    // --- Update K-1 DOM ---
    if (els.inputK1Coeff) els.inputK1Coeff.value = k1;
    if (els.lblK1Allowed) els.lblK1Allowed.innerText = `${k1Allowed.toLocaleString()} მ²`;
    if (els.lblK1Used) els.lblK1Used.innerText = `${k1Used.toLocaleString()} მ² (${k1Percent}%)`;
    if (els.lblK1Remaining) {
      els.lblK1Remaining.innerText = k1Over ? `+${(k1Used - k1Allowed).toLocaleString()} მ²` : `${k1Remaining.toLocaleString()} მ²`;
      els.lblK1Remaining.className = `text-xs font-bold ${k1Over ? 'text-rose-400' : 'text-emerald-300'}`;
    }
    if (els.barK1Progress) {
      els.barK1Progress.style.width = `${Math.min(100, k1Percent)}%`;
      els.barK1Progress.className = `h-full metric-bar-fill ${k1Over ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-500 to-cyan-400'}`;
    }
    if (els.lblK1Alert) {
      if (k1Over) {
        els.lblK1Alert.classList.remove('hidden');
        els.lblK1Alert.innerText = `⚠️ K-1 გადაჭარბებულია: +${(k1Used - k1Allowed).toLocaleString()} მ²`;
      } else {
        els.lblK1Alert.classList.add('hidden');
      }
    }

    // --- Update K-2 DOM ---
    if (els.inputK2Coeff) els.inputK2Coeff.value = k2;
    if (els.lblK2Allowed) els.lblK2Allowed.innerText = `${k2Allowed.toLocaleString()} მ²`;
    if (els.lblK2Used) els.lblK2Used.innerText = `${k2Used.toLocaleString()} მ² (${k2Percent}%)`;
    if (els.lblK2Remaining) {
      els.lblK2Remaining.innerText = k2Over ? `+${(k2Used - k2Allowed).toLocaleString()} მ²` : `${k2Remaining.toLocaleString()} მ²`;
      els.lblK2Remaining.className = `text-xs font-bold ${k2Over ? 'text-rose-400' : 'text-emerald-300'}`;
    }
    if (els.barK2Progress) {
      els.barK2Progress.style.width = `${Math.min(100, k2Percent)}%`;
      els.barK2Progress.className = `h-full metric-bar-fill ${k2Over ? 'bg-rose-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`;
    }
    if (els.lblK2Alert) {
      if (k2Over) {
        els.lblK2Alert.classList.remove('hidden');
        els.lblK2Alert.innerText = `⚠️ K-2 ინტენსივობა გადაჭარბებულია: +${(k2Used - k2Allowed).toLocaleString()} მ² (GFA)`;
      } else {
        els.lblK2Alert.classList.add('hidden');
      }
    }

    // --- Update K-3 DOM ---
    if (els.inputK3Coeff) els.inputK3Coeff.value = k3;
    if (els.lblK3Required) els.lblK3Required.innerText = `${k3Required.toLocaleString()} მ²`;
    if (els.lblK3Actual) els.lblK3Actual.innerText = `${k3Actual.toLocaleString()} მ²`;
    if (els.lblK3Balance) {
      els.lblK3Balance.innerText = k3Balance >= 0 ? `+${k3Balance.toLocaleString()} მ²` : `-${Math.abs(k3Balance).toLocaleString()} მ²`;
      els.lblK3Balance.className = `text-xs font-bold ${k3Deficit ? 'text-rose-400' : 'text-emerald-400'}`;
    }
    if (els.barK3Progress) {
      els.barK3Progress.style.width = `${k3Percent}%`;
      els.barK3Progress.className = `h-full metric-bar-fill ${k3Deficit ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-green-400'}`;
    }
    if (els.lblHardscapeTotal) els.lblHardscapeTotal.innerText = `${totalHardscape.toLocaleString()} მ²`;
    if (els.lblOpenGround) els.lblOpenGround.innerText = `${openGround.toLocaleString()} მ²`;
    if (els.lblPlantedTreesCount) {
      els.lblPlantedTreesCount.innerText = `${state.trees.length} ხე (~${treesCanopyArea} მ²)`;
    }
    if (els.lblK3Alert) {
      if (k3Deficit) {
        els.lblK3Alert.classList.remove('hidden');
        els.lblK3Alert.innerText = `⚠️ გამწვანების დეფიციტი: -${Math.abs(k3Balance).toLocaleString()} მ² (დარგეთ ხეები ან შეამცირეთ საფარი)`;
      } else {
        els.lblK3Alert.classList.add('hidden');
      }
    }

    updateSelectedBuildingUI();
  }

  // --- Active Building UI updates (Two-Way Dual Slider & Numeric Sync) ---
  function updateSelectedBuildingUI() {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId) || state.footprints[0];
    if (els.lblFootprintsCount) els.lblFootprintsCount.innerText = state.footprints.length;

    if (fp) {
      if (els.lblSelectedBuildingName) els.lblSelectedBuildingName.innerText = fp.name;
      if (els.txtBuildingName) els.txtBuildingName.value = fp.name;
      
      // Width
      if (els.sliderBuildingWidth) els.sliderBuildingWidth.value = fp.width;
      if (els.lblBuildingWidthVal) els.lblBuildingWidthVal.innerText = `${fp.width.toFixed(1)} მ`;
      if (els.inputNumBuildingWidth) els.inputNumBuildingWidth.value = fp.width.toFixed(1);
      if (els.quickBldW) els.quickBldW.value = fp.width.toFixed(1);

      // Length
      if (els.sliderBuildingLength) els.sliderBuildingLength.value = fp.length;
      if (els.lblBuildingLengthVal) els.lblBuildingLengthVal.innerText = `${fp.length.toFixed(1)} მ`;
      if (els.inputNumBuildingLength) els.inputNumBuildingLength.value = fp.length.toFixed(1);
      if (els.quickBldL) els.quickBldL.value = fp.length.toFixed(1);

      // Area
      if (els.inputNumBuildingArea) els.inputNumBuildingArea.value = fp.areaSqm;

      // Rotation
      if (els.sliderBuildingRotation) els.sliderBuildingRotation.value = fp.rotation;
      if (els.lblBuildingRotationVal) els.lblBuildingRotationVal.innerText = `${fp.rotation}°`;
      if (els.inputNumBuildingRotation) els.inputNumBuildingRotation.value = fp.rotation;

      // Floors
      if (els.sliderFloors) els.sliderFloors.value = fp.floors;
      if (els.lblFloorsCountVal) els.lblFloorsCountVal.innerText = fp.floors;
      if (els.inputNumBuildingFloors) els.inputNumBuildingFloors.value = fp.floors;
      if (els.quickBldFloors) els.quickBldFloors.value = fp.floors;

      // Heights
      if (els.lblFloorHeightVal) els.lblFloorHeightVal.innerText = fp.floorHeight.toFixed(1) + ' მ';
      if (els.inputNumFloorHeight) els.inputNumFloorHeight.value = fp.floorHeight.toFixed(1);
      if (els.lblTotalHeightVal) els.lblTotalHeightVal.innerText = fp.totalHeight.toFixed(1);
      if (els.selBuildingFunction) els.selBuildingFunction.value = fp.functionType || 'residential';
    }

    if (els.lstBuildingsContainer) {
      els.lstBuildingsContainer.innerHTML = state.footprints.map(f => `
        <div onclick="selectFootprint('${f.id}')" class="p-2 rounded border cursor-pointer transition flex items-center justify-between ${f.id === state.selectedFootprintId ? 'bg-sky-500/15 border-sky-400 text-white' : 'bg-[#0e1628] border-white/5 text-slate-300 hover:bg-[#142038]'}">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${f.id === state.selectedFootprintId ? 'bg-sky-400' : 'bg-slate-500'}"></span>
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

  window.renameSelectedBuilding = function (name) {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return;
    fp.name = name.trim() || 'შენობა';
    if (els.lblSelectedBuildingName) els.lblSelectedBuildingName.innerText = fp.name;
    renderCadWorld();
  };

  window.selectFootprint = function (id) {
    state.selectedFootprintId = id;
    updateSelectedBuildingUI();
    renderCadWorld();
  };

  window.deleteFootprint = function (id) {
    saveUndoSnapshot();
    state.footprints = state.footprints.filter(f => f.id !== id);
    if (state.selectedFootprintId === id) {
      state.selectedFootprintId = state.footprints[0] ? state.footprints[0].id : null;
    }
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  // Parametric Resizing (W & L) with Dual Input Synchronization
  window.updateBuildingDimensions = function (wVal, lVal) {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) {
      if (wVal !== null) state.stampWidth = parseFloat(wVal) || 15;
      if (lVal !== null) state.stampLength = parseFloat(lVal) || 12;
      return;
    }

    if (wVal !== null) fp.width = parseFloat(wVal) || fp.width;
    if (lVal !== null) fp.length = parseFloat(lVal) || fp.length;

    if (fp.shape === 'freeform' && fp.baseVertices) {
      const scaleX = wVal !== null ? (parseFloat(wVal) / (fp.width || 1)) : 1;
      const scaleY = lVal !== null ? (parseFloat(lVal) / (fp.length || 1)) : 1;
      if (wVal !== null) fp.width = parseFloat(wVal) || fp.width;
      if (lVal !== null) fp.length = parseFloat(lVal) || fp.length;
      fp.baseVertices = fp.baseVertices.map(pt => [pt[0] * scaleX, pt[1] * scaleY]);
      const rad = (fp.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      fp.vertices = fp.baseVertices.map(pt => [
        fp.center[0] + pt[0] * cos - pt[1] * sin,
        fp.center[1] + pt[0] * sin + pt[1] * cos
      ]);
      fp.areaSqm = Math.round(calculatePolygonArea(fp.vertices));
    } else {
      const newFp = createFootprintObject(fp.name, fp.shape, fp.width, fp.length, fp.rotation, fp.center[0], fp.center[1], fp.floors, fp.floorHeight, fp.functionType);
      fp.vertices = newFp.vertices;
      fp.areaSqm = newFp.areaSqm;
    }

    // Sync dual controls
    if (els.inputNumBuildingWidth) els.inputNumBuildingWidth.value = fp.width.toFixed(1);
    if (els.sliderBuildingWidth) els.sliderBuildingWidth.value = fp.width;
    if (els.lblBuildingWidthVal) els.lblBuildingWidthVal.innerText = `${fp.width.toFixed(1)} მ`;
    if (els.quickBldW) els.quickBldW.value = fp.width.toFixed(1);

    if (els.inputNumBuildingLength) els.inputNumBuildingLength.value = fp.length.toFixed(1);
    if (els.sliderBuildingLength) els.sliderBuildingLength.value = fp.length;
    if (els.lblBuildingLengthVal) els.lblBuildingLengthVal.innerText = `${fp.length.toFixed(1)} მ`;
    if (els.quickBldL) els.quickBldL.value = fp.length.toFixed(1);

    if (els.inputNumBuildingArea) els.inputNumBuildingArea.value = fp.areaSqm;

    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  // Manual Ground Area Input (ფართობის ხელით შეყვანა)
  window.updateBuildingByArea = function (areaVal) {
    const targetArea = parseFloat(areaVal);
    if (!targetArea || targetArea <= 0) return;
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return;

    // Maintain aspect ratio or adjust length
    const newLength = Math.max(3, Math.round((targetArea / fp.width) * 10) / 10);
    window.updateBuildingDimensions(null, newLength);
  };

  // Rotation Control
  window.setBuildingRotation = function (deg) {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return;

    fp.rotation = parseInt(deg, 10) % 360;
    if (fp.rotation < 0) fp.rotation += 360;

    if (fp.shape === 'freeform' && fp.baseVertices) {
      const rad = (fp.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      fp.vertices = fp.baseVertices.map(pt => [
        fp.center[0] + pt[0] * cos - pt[1] * sin,
        fp.center[1] + pt[0] * sin + pt[1] * cos
      ]);
    } else {
      const newFp = createFootprintObject(fp.name, fp.shape, fp.width, fp.length, fp.rotation, fp.center[0], fp.center[1], fp.floors, fp.floorHeight, fp.functionType);
      fp.vertices = newFp.vertices;
    }

    if (els.inputNumBuildingRotation) els.inputNumBuildingRotation.value = fp.rotation;
    if (els.sliderBuildingRotation) els.sliderBuildingRotation.value = fp.rotation;
    if (els.lblBuildingRotationVal) els.lblBuildingRotationVal.innerText = `${fp.rotation}°`;

    renderCadWorld();
  };

  // Setback distance
  window.setSetbackDistance = function (dist) {
    const d = parseFloat(dist);
    if (!d || d < 0) return;
    saveUndoSnapshot();
    state.setbackDistance = d;
    if (els.lblSetbackDistVal) els.lblSetbackDistVal.innerText = `${d.toFixed(1)} მ`;
    if (els.quickSetbackNum) els.quickSetbackNum.value = d;
    if (els.inputSiteSetbackDist) els.inputSiteSetbackDist.value = d;
    renderCadWorld();
    updateToolStatus(`სამეზობლო მიჯნა განისაზღვრა: ${d} მეტრი.`);
  };

  // Quick CAD Parameter Helpers
  window.applyQuickBuildingDim = function () {
    const w = els.quickBldW ? parseFloat(els.quickBldW.value) : null;
    const l = els.quickBldL ? parseFloat(els.quickBldL.value) : null;
    if (w !== null) state.stampWidth = w;
    if (l !== null) state.stampLength = l;
    window.updateBuildingDimensions(w, l);
  };

  window.applyQuickBuildingFloors = function () {
    const fl = els.quickBldFloors ? parseInt(els.quickBldFloors.value, 10) : 4;
    state.stampFloors = fl;
    window.updateBuildingFloors(fl);
  };

  window.applyQuickRoadWidth = function (w) {
    const val = parseFloat(w) || 6.0;
    state.activeRoadWidth = val;
    if (els.quickRoadW) els.quickRoadW.value = val;
    if (els.inputSiteRoadWidth) els.inputSiteRoadWidth.value = val;
    (state.roads || []).forEach(r => r.width = val);
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  window.applyQuickWalkwayWidth = function (w) {
    const val = parseFloat(w) || 1.8;
    state.activeWalkwayWidth = val;
    if (els.quickWalkW) els.quickWalkW.value = val;
    if (els.inputSiteWalkWidth) els.inputSiteWalkWidth.value = val;
    (state.walkways || []).forEach(wk => wk.width = val);
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  window.applyQuickTreeDiam = function (d) {
    const diam = parseFloat(d) || 5.0;
    state.activeTreeRadius = diam / 2;
    if (els.quickTreeDiam) els.quickTreeDiam.value = diam;
    if (els.inputSiteTreeDiam) els.inputSiteTreeDiam.value = diam;
    state.trees.forEach(t => {
      if (t.treeType !== 'pine') t.radius = state.activeTreeRadius;
    });
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  window.resetZoningToDefaults = function () {
    state.k1Limit = 0.5;
    state.k2Limit = 2.5;
    state.k3Limit = 0.2;
    if (els.inputK1Coeff) els.inputK1Coeff.value = 0.5;
    if (els.inputK2Coeff) els.inputK2Coeff.value = 2.5;
    if (els.inputK3Coeff) els.inputK3Coeff.value = 0.2;
    updateZoningCoefficientsUI();
    updateToolStatus('კოეფიციენტები განულდა ზონის ნორმატივებზე (K1=0.5, K2=2.5, K3=0.2).');
  };

  window.updateBuildingFloors = function (floors) {
    const fl = parseInt(floors, 10);
    if (!fl || fl < 1) return;
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) {
      state.stampFloors = fl;
      return;
    }
    fp.floors = fl;
    fp.totalHeight = Math.round((fl * (fp.floorHeight || 3.0) + 0.8) * 10) / 10;
    if (els.sliderFloors) els.sliderFloors.value = fl;
    if (els.lblFloorsCountVal) els.lblFloorsCountVal.innerText = fl;
    if (els.inputNumBuildingFloors) els.inputNumBuildingFloors.value = fl;
    if (els.quickBldFloors) els.quickBldFloors.value = fl;
    if (els.lblTotalHeightVal) els.lblTotalHeightVal.innerText = fp.totalHeight.toFixed(1);
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  window.setFloorHeight = function (height) {
    const h = parseFloat(height);
    if (!h || h <= 0) return;
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return;
    fp.floorHeight = h;
    fp.totalHeight = Math.round((fp.floors * h + 0.8) * 10) / 10;
    if (els.lblFloorHeightVal) els.lblFloorHeightVal.innerText = `${h.toFixed(1)} მ`;
    if (els.inputNumFloorHeight) els.inputNumFloorHeight.value = h.toFixed(1);
    if (els.lblTotalHeightVal) els.lblTotalHeightVal.innerText = fp.totalHeight.toFixed(1);
    renderCadWorld();
  };

  window.updateBuildingFunction = function (type) {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (fp) fp.functionType = type;
    state.stampFn = type;
    renderCadWorld();
  };

  window.updatePoolParams = function (w, l) {
    state.waterBodies.forEach(wb => {
      if (w !== null && w !== undefined) wb.width = parseFloat(w) || wb.width;
      if (l !== null && l !== undefined) wb.length = parseFloat(l) || wb.length;
    });
    updateZoningCoefficientsUI();
    renderCadWorld();
  };

  window.updateTerraceParams = function (w, l) {
    state.terraces.forEach(tr => {
      if (w !== null && w !== undefined) tr.width = parseFloat(w) || tr.width;
      if (l !== null && l !== undefined) tr.length = parseFloat(l) || tr.length;
    });
    updateZoningCoefficientsUI();
    renderCadWorld();
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

  // --- Architectural Visual Styles Map (24+ Styles including Real Engineering Drawing Plots) ---
  const styleNamesMap = {
    'autocad': '📐 AutoCAD Model Space (შავი CAD)',
    'cadplot': '📄 AutoCAD Paper Plot (თეთრი პლოტი)',
    'napr': '🏛️ საჯარო რეესტრის გეგმა (წითელი ხაზები)',
    'vellum': '📜 არქიტექტურული კალკა & ტუში',
    'topographic': '🗺️ ტოპოგრაფიული გეოდეზია',
    'masterplan': '🌳 საპრეზენტაციო ფერადი გენგეგმა',
    'blueprint': '📐 Royal Blueprint (ლურჯი)',
    'classic': '🏛️ არქიტექტურული თეთრი',
    'presentation': '🌿 კლასიკური გენგეგმა',
    'satellite': '🛰️ სატელიტური ორთოფოტო',
    'dark': '🌑 OLED Dark CAD',
    'sepia': '📜 ვინტაჟური პერგამენტი',
    'mono': '🏙️ მონოქრომული გრაფიტი',
    'aqua': '💧 საკურორტო აკვა',
    'scandi': '🌲 სკანდინავიური მწვანე',
    'terracotta': '🧱 ტოსკანური ტერაკოტა',
    'cyberpunk': '🌌 კიბერპანკ ნეონი',
    'municipal': '📑 მუნიციპალური / მერიის',
    'sunset': '🌅 ოქროს საათი',
    'slate': '🪨 ფიქალი & სპილენძი',
    'pastel': '🎨 თანამედროვე პასტელი',
    'graph': '📐 მილიმეტრული ბადე',
    'nordic': '⚪ მინიმალისტური თეთრი',
    'zen': '🏯 იაპონური ზენ / Muji',
    'bauhaus': '🏛️ ბაუჰაუსი (Modernist)',
    'sketch': '✏️ ფანქრის ესკიზი',
    'desert': '🏜️ უდაბნოს ქვიშა / ვილა',
    'concrete': '🏭 ურბანული ბეტონი',
    'emerald': '💎 ზურმუხტისფერი ლუქსი',
    'nightglow': '🌙 ღამის განათება'
  };

  window.setDrawingStyle = function (styleName) {
    state.activeStyle = styleName;
    const wrapper = els.cadCanvasWrapper;
    if (wrapper) {
      wrapper.className = `flex-1 relative overflow-hidden style-${styleName}`;
    }

    const selStyle = document.getElementById('selCadDrawingStyle');
    if (selStyle && selStyle.value !== styleName) {
      selStyle.value = styleName;
    }

    renderCadWorld();
  };

  // --- Layer Visibility Toggle ---
  window.toggleLayer = function (layerName, isChecked) {
    state.layers[layerName] = isChecked;
    renderCadWorld();
  };

  // --- Ribbon Dropdown Menu Toggle Helpers ---
  window.toggleDropdownMenu = function (menuId, e) {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    const target = document.getElementById(menuId);
    if (!target) return;
    const isCurrentlyOpen = !target.classList.contains('hidden');
    window.closeAllDropdowns();
    if (!isCurrentlyOpen) {
      target.classList.remove('hidden');
    }
  };

  window.closeAllDropdowns = function () {
    document.querySelectorAll('.cad-menu-popup').forEach(p => p.classList.add('hidden'));
  };

  window.addEventListener('click', (e) => {
    if (e.target.closest('.cad-menu-popup')) return;
    if (e.target.closest('[onclick*="toggleDropdownMenu"]') || e.target.closest('[id^="btn"][id$="Menu"]') || e.target.closest('#btnLayersMenuTrigger')) return;
    window.closeAllDropdowns();
  });

  // --- REAL ARCHITECTURAL SCALE CONTROLS ---
  window.changeCadScale = function (scaleStr) {
    if (!scaleStr) return;
    const ratio = parseInt(scaleStr.replace('1:', '').replace('M', '').trim(), 10) || 500;
    
    state.zoomScale = METERS_TO_PIXELS_REAL / ratio;

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

  function updateGraphicScaleBar() {
    if (!els.lblGraphicScaleUnit || !els.lblCurrentScaleRatio) return;

    const currentRatio = Math.round(METERS_TO_PIXELS_REAL / Math.max(0.001, state.zoomScale));
    els.lblCurrentScaleRatio.innerText = `M 1:${currentRatio}`;

    if (els.selCadScale) {
      const standards = [100, 200, 500, 1000, 2000, 5000];
      const closest = standards.reduce((prev, curr) => Math.abs(curr - currentRatio) < Math.abs(prev - currentRatio) ? curr : prev);
      if (Math.abs(closest - currentRatio) / closest < 0.18) {
        els.selCadScale.value = `1:${closest}`;
      }
    }

    const targetPx = 110;
    const rawMeters = targetPx / Math.max(0.001, state.zoomScale);
    
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
      if (seg) seg.style.width = `${segWidthPx}px`;
    }
  }

  // --- Tools Activation ---
  window.setCadActiveTool = function (toolName) {
    state.activeTool = toolName;
    state.drawPoints = [];
    state.splitLine = [];
    state.rulerPoints = [];
    state.currentWalkwayPoints = [];
    state.currentRoadPoints = [];
    state.currentBikePathPoints = [];
    state.currentHedgePoints = [];

    document.querySelectorAll('.btn-cad-tool').forEach(btn => btn.classList.remove('btn-tool-active'));
    const btnMap = {
      'pan': 'toolBtnPan',
      'delete': 'toolBtnDelete',
      'split': 'toolBtnSplit',
      'draw_footprint': 'toolBtnDrawFootprint',
      'draw_polygon': 'toolBtnDrawFootprint',
      'draw_rect_footprint': 'toolBtnDrawFootprint',
      'tree': 'toolBtnTree',
      'pine_tree': 'toolBtnTree',
      'water': 'toolBtnWater',
      'terrace': 'toolBtnTerrace',
      'walkway': 'toolBtnWalkway',
      'bike_path': 'toolBtnWalkway',
      'draw_road': 'toolBtnDrawRoad',
      'parking': 'toolBtnParking',
      'ruler': 'toolBtnRuler'
    };
    if (btnMap[toolName]) {
      const btn = document.getElementById(btnMap[toolName]);
      if (btn) btn.classList.add('btn-tool-active');
    }

    if (els.cadSvgContainer) {
      els.cadSvgContainer.classList.remove('mode-pan', 'mode-delete');
      if (toolName === 'pan') els.cadSvgContainer.classList.add('mode-pan');
      else if (toolName === 'delete') els.cadSvgContainer.classList.add('mode-delete');
    }

    const hintMap = {
      'pan': 'არჩევა და გადაადგილება: დააკლიკეთ შენობას გადასაადგილებლად ან როტაციისთვის',
      'stamp_footprint': `🏢 შენობის ლაქის დასმა: დააკლიკეთ ნაკვეთის ნებისმიერ ადგილას (${state.stampWidth || 15}×${state.stampLength || 12}მ)`,
      'draw_rect_footprint': '✏️ ლაქის მოხაზვა: დააჭირეთ მაუსს და გადაატარეთ მართკუთხედის მოსახაზად, ხელის გაშვებით ლაქა დაჯდება ნაკვეთზე',
      'draw_polygon': 'ლაქის ხელით მოხაზვა: დააკლიკეთ წერტილების დასასმელად, ორმაგი კლიკით ასრულებს',
      'draw_footprint': 'ლაქის ხელით მოხაზვა: დააკლიკეთ წერტილების დასასმელად, ორმაგი კლიკით ასრულებს',
      'delete': 'საშლელი: დააკლიკეთ ნებისმიერ ობიექტზე (შენობა, ხე, აუზი, ტერასა, გზა, ბილიკი, პარკინგი) მის წასაშლელად',
      'split': 'ნაკვეთის დაყოფა: დააკლიკეთ ორ წერტილზე გამყოფი ხაზის გასავლებად',
      'tree': 'ფოთლოვანი ხე: დააკლიკეთ ნაკვეთის ნებისმიერ ადგილას ხის დასარგავად (Ø5მ)',
      'pine_tree': 'წიწვოვანი ხე: დააკლიკეთ ნაკვეთზე მარადმწვანე წიწვოვანი ხის დასარგავად (Ø3.5მ)',
      'hedge': 'ბუჩქნარი / ცოცხალი ღობე: დააკლიკეთ წერტილების დასასმელად, ორმაგი კლიკი დაასრულებს',
      'water': 'აუზი: დააკლიკეთ ნაკვეთზე საცურაო აუზის განსათავსებლად',
      'fountain': 'დეკორატიული შადრევანი: დააკლიკეთ ნაკვეთზე შადრევნის განსათავსებლად (Ø5მ)',
      'terrace': 'ტერასა: დააკლიკეთ ნაკვეთზე ხის ტერასის / დეკის განსათავსებლად',
      'walkway': 'საფეხმავლო ბილიკი: დააკლიკეთ წერტილების დასასმელად, ორმაგი კლიკი დაასრულებს (1.8მ)',
      'bike_path': 'ველობილიკი: დააკლიკეთ წერტილების დასასმელად, ორმაგი კლიკი დაასრულებს (2.0მ)',
      'draw_road': 'საავტომობილო გზა: დააკლიკეთ წერტილების დასასმელად, ორმაგი კლიკი დაასრულებს (6.0მ)',
      'parking': 'ავტოსადგომი: დააკლიკეთ ნაკვეთზე საპარკინგე ადგილის განსათავსებლად (2.5×5მ)',
      'ruler': 'საზომი: დააკლიკეთ ორ წერტილზე მანძილის გასაზომად'
    };
    updateToolStatus(hintMap[toolName] || '');
    renderInteractionLayer();
  };

  function updateToolStatus(text) {
    if (els.lblToolStatusHint) els.lblToolStatusHint.innerText = text;
  }

  // --- Footprint Stamp Activation & Templates ---
  window.activateFootprintStamp = function (shape = 'rect', name = 'შენობა') {
    state.stampShape = shape;
    state.stampName = name;
    if (els.inputNumBuildingWidth && els.inputNumBuildingLength) {
      state.stampWidth = parseFloat(els.inputNumBuildingWidth.value) || state.stampWidth || 15;
      state.stampLength = parseFloat(els.inputNumBuildingLength.value) || state.stampLength || 12;
    }
    if (els.inputNumBuildingFloors) {
      state.stampFloors = parseInt(els.inputNumBuildingFloors.value, 10) || state.stampFloors || 4;
    }
    setCadActiveTool('stamp_footprint');
  };

  window.stampTemplate = function (type) {
    saveUndoSnapshot();
    if (type === 'rect') {
      state.stampShape = 'rect';
      state.stampWidth = 15;
      state.stampLength = 12;
      state.stampFloors = 4;
      state.stampFn = 'residential';
      state.stampName = 'მართკუთხა ბლოკი';
    } else if (type === 'l_shape') {
      state.stampShape = 'l_shape';
      state.stampWidth = 18;
      state.stampLength = 16;
      state.stampFloors = 5;
      state.stampFn = 'residential';
      state.stampName = 'L-კორპუსი';
    } else if (type === 'u_shape') {
      state.stampShape = 'u_shape';
      state.stampWidth = 22;
      state.stampLength = 18;
      state.stampFloors = 6;
      state.stampFn = 'residential';
      state.stampName = 'U-შენობა';
    } else if (type === 'tower') {
      state.stampShape = 'rect';
      state.stampWidth = 20;
      state.stampLength = 20;
      state.stampFloors = 16;
      state.stampFn = 'residential';
      state.stampName = 'საცხოვრებელი კოშკი';
    } else if (type === 'villa') {
      state.stampShape = 'rect';
      state.stampWidth = 14;
      state.stampLength = 10;
      state.stampFloors = 2;
      state.stampFn = 'residential';
      state.stampName = 'კერძო ვილა';
    } else if (type === 'apartment') {
      state.stampShape = 'rect';
      state.stampWidth = 30;
      state.stampLength = 14;
      state.stampFloors = 8;
      state.stampFn = 'residential';
      state.stampName = 'საცხოვრებელი კორპუსი';
    } else if (type === 'commercial') {
      state.stampShape = 'rect';
      state.stampWidth = 12;
      state.stampLength = 8;
      state.stampFloors = 1;
      state.stampFn = 'commercial';
      state.stampName = 'კომერციული პავილიონი';
    }

    if (els.inputNumBuildingWidth) els.inputNumBuildingWidth.value = state.stampWidth;
    if (els.inputNumBuildingLength) els.inputNumBuildingLength.value = state.stampLength;
    if (els.inputNumBuildingFloors) els.inputNumBuildingFloors.value = state.stampFloors;
    if (els.quickBldW) els.quickBldW.value = state.stampWidth;
    if (els.quickBldL) els.quickBldL.value = state.stampLength;
    if (els.quickBldFloors) els.quickBldFloors.value = state.stampFloors;

    // Calculate parcel center
    let cx = 0, cy = 0;
    if (state.boundaryMeters && state.boundaryMeters.length >= 3) {
      const xs = state.boundaryMeters.map(p => p[0]);
      const ys = state.boundaryMeters.map(p => p[1]);
      cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    // Offset slightly if buildings already exist
    const offset = (state.footprints.length) * 6;
    cx += offset;
    cy += offset;

    const nextNum = state.footprints.length + 1;
    const newFp = createFootprintObject(`${state.stampName} ${nextNum}`, state.stampShape, state.stampWidth, state.stampLength, 0, Math.round(cx * 10) / 10, Math.round(cy * 10) / 10, state.stampFloors, 3.0, state.stampFn);
    state.footprints.push(newFp);
    state.selectedFootprintId = newFp.id;
    setCadActiveTool('pan');
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus(`შენობა "${newFp.name}" (${state.stampWidth}×${state.stampLength}მ, ${state.stampFloors} სართ.) განთავსდა ნაკვეთზე. შეგიძლიათ მართოთ პარამეტრები.`);
  };

  window.addParkingRow = function () {
    saveUndoSnapshot();
    const cx = state.centerPoint ? state.centerPoint[0] : 0;
    const cy = state.centerPoint ? state.centerPoint[1] + 10 : 0;
    const count = 5;
    const stallW = 2.5;
    const startX = cx - ((count - 1) * stallW) / 2;

    for (let i = 0; i < count; i++) {
      state.parkingBays.push({
        id: 'park_' + Date.now() + '_' + i,
        center: [Math.round((startX + i * stallW) * 10) / 10, Math.round(cy * 10) / 10],
        width: 2.5,
        length: 5.0,
        rotation: 0
      });
    }
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('განთავსდა 5-ადგილიანი პარკინგის რიგი.');
  };

  // --- Walkway, Road, Bike Path & Hedge Finish Helpers ---
  function finishWalkway() {
    if (state.currentWalkwayPoints.length >= 2) {
      saveUndoSnapshot();
      state.walkways.push({
        id: 'walk_' + Date.now(),
        points: [...state.currentWalkwayPoints],
        width: state.activeWalkwayWidth || 1.8
      });
      state.currentWalkwayPoints = [];
      updateZoningCoefficientsUI();
      renderCadWorld();
      updateToolStatus('საფეხმავლო ბილიკი დაემატა.');
    }
  }

  function finishBikePath() {
    if (state.currentBikePathPoints && state.currentBikePathPoints.length >= 2) {
      saveUndoSnapshot();
      state.bikePaths.push({
        id: 'bike_' + Date.now(),
        points: [...state.currentBikePathPoints],
        width: 2.0
      });
      state.currentBikePathPoints = [];
      updateZoningCoefficientsUI();
      renderCadWorld();
      updateToolStatus('ველობილიკი (2.0მ) დაემატა.');
    }
  }

  function finishHedge() {
    if (state.currentHedgePoints && state.currentHedgePoints.length >= 2) {
      saveUndoSnapshot();
      state.hedges.push({
        id: 'hedge_' + Date.now(),
        points: [...state.currentHedgePoints],
        width: 1.0
      });
      state.currentHedgePoints = [];
      updateZoningCoefficientsUI();
      renderCadWorld();
      updateToolStatus('ცოცხალი ღობე / ბუჩქნარი დაემატა.');
    }
  }

  function finishRoad() {
    if (state.currentRoadPoints.length >= 2) {
      saveUndoSnapshot();
      state.roads.push({
        id: 'road_' + Date.now(),
        points: [...state.currentRoadPoints],
        width: state.activeRoadWidth || 6.0
      });
      state.currentRoadPoints = [];
      updateZoningCoefficientsUI();
      renderCadWorld();
      updateToolStatus('საავტომობილო გზა დაემატა.');
    }
  }

  // --- Auto-Plant Trees along setback / perimeter ---
  window.autoPlantTrees = function (count = 8) {
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) return;
    saveUndoSnapshot();
    const setbackPoly = computeSetbackPolygon(state.boundaryMeters, state.setbackDistance);
    const poly = setbackPoly.length >= 3 ? setbackPoly : state.boundaryMeters;
    
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i / count) * poly.length);
      const nextIdx = (idx + 1) % poly.length;
      const t = 0.25 + 0.5 * (i % 2);
      const x = poly[idx][0] + (poly[nextIdx][0] - poly[idx][0]) * t;
      const y = poly[idx][1] + (poly[nextIdx][1] - poly[idx][1]) * t;
      state.trees.push({
        id: 'tree_' + Date.now() + '_' + i,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        radius: 2.2 + Math.random() * 0.8
      });
    }
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus(`დაირგო ${count} ხე ნაკვეთის პერიმეტრზე.`);
  };

  // --- Interactive CAD Canvas Mouse Handlers ---
  function initCadCanvas() {
    const container = els.cadSvgContainer;
    if (!container) return;

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

      // 1. ERASER TOOL MODE (DELETE ON CLICK)
      if (state.activeTool === 'delete') {
        saveUndoSnapshot();
        // Check if hit building
        const hitFp = checkFootprintHit(worldPos);
        if (hitFp) {
          state.footprints = state.footprints.filter(f => f.id !== hitFp.id);
          if (state.selectedFootprintId === hitFp.id) {
            state.selectedFootprintId = state.footprints[0] ? state.footprints[0].id : null;
          }
          updateSelectedBuildingUI();
          updateZoningCoefficientsUI();
          renderCadWorld();
          updateToolStatus(`შენობა "${hitFp.name}" წაიშალა.`);
          return;
        }

        // Check if hit tree
        const treeIdx = state.trees.findIndex(t => Math.hypot(worldPos[0] - t.x, worldPos[1] - t.y) < (t.radius || 3.0));
        if (treeIdx !== -1) {
          state.trees.splice(treeIdx, 1);
          updateZoningCoefficientsUI();
          renderCadWorld();
          updateToolStatus('ხე წაიშალა.');
          return;
        }

        // Check if hit water body
        const waterIdx = state.waterBodies.findIndex(w => Math.abs(worldPos[0] - w.x) < (w.width || 10) / 2 && Math.abs(worldPos[1] - w.y) < (w.length || 5) / 2);
        if (waterIdx !== -1) {
          state.waterBodies.splice(waterIdx, 1);
          renderCadWorld();
          updateToolStatus('აუზი წაიშალა.');
          return;
        }

        // Check if hit terrace
        const terraceIdx = state.terraces.findIndex(t => Math.abs(worldPos[0] - t.x) < (t.width || 12) / 2 && Math.abs(worldPos[1] - t.y) < (t.length || 6) / 2);
        if (terraceIdx !== -1) {
          state.terraces.splice(terraceIdx, 1);
          renderCadWorld();
          updateToolStatus('ტერასა წაიშალა.');
          return;
        }

        // Check if hit parking
        const parkIdx = state.parkingBays.findIndex(p => Math.hypot(worldPos[0] - p.center[0], worldPos[1] - p.center[1]) < 3.0);
        if (parkIdx !== -1) {
          state.parkingBays.splice(parkIdx, 1);
          renderCadWorld();
          updateToolStatus('ავტოსადგომი წაიშალა.');
          return;
        }

        // Check if hit walkway
        const walkIdx = state.walkways.findIndex(w => {
          if (!w.points || w.points.length < 2) return false;
          for (let i = 0; i < w.points.length - 1; i++) {
            const p1 = w.points[i];
            const p2 = w.points[i + 1];
            const dist = distToSegment(worldPos, p1, p2);
            if (dist < 2.0) return true;
          }
          return false;
        });
        if (walkIdx !== -1) {
          state.walkways.splice(walkIdx, 1);
          renderCadWorld();
          updateToolStatus('საფეხმავლო ბილიკი წაიშალა.');
          return;
        }

        // Check if hit road
        const roadIdx = state.roads.findIndex(r => {
          if (!r.points || r.points.length < 2) return false;
          for (let i = 0; i < r.points.length - 1; i++) {
            const p1 = r.points[i];
            const p2 = r.points[i + 1];
            const dist = distToSegment(worldPos, p1, p2);
            if (dist < 4.0) return true;
          }
          return false;
        });
        if (roadIdx !== -1) {
          state.roads.splice(roadIdx, 1);
          renderCadWorld();
          updateToolStatus('გზა წაიშალა.');
          return;
        }

        // Check if hit bike path
        const bikeIdx = (state.bikePaths || []).findIndex(b => {
          if (!b.points || b.points.length < 2) return false;
          for (let i = 0; i < b.points.length - 1; i++) {
            if (distToSegment(worldPos, b.points[i], b.points[i + 1]) < 2.0) return true;
          }
          return false;
        });
        if (bikeIdx !== -1) {
          state.bikePaths.splice(bikeIdx, 1);
          updateZoningCoefficientsUI();
          renderCadWorld();
          updateToolStatus('ველობილიკი წაიშალა.');
          return;
        }

        // Check if hit hedge
        const hedgeIdx = (state.hedges || []).findIndex(h => {
          if (!h.points || h.points.length < 2) return false;
          for (let i = 0; i < h.points.length - 1; i++) {
            if (distToSegment(worldPos, h.points[i], h.points[i + 1]) < 1.5) return true;
          }
          return false;
        });
        if (hedgeIdx !== -1) {
          state.hedges.splice(hedgeIdx, 1);
          updateZoningCoefficientsUI();
          renderCadWorld();
          updateToolStatus('ცოცხალი ღობე წაიშალა.');
          return;
        }

        // Check if hit fountain
        const fountIdx = (state.fountains || []).findIndex(f => Math.hypot(worldPos[0] - f.x, worldPos[1] - f.y) < (f.radius || 2.5));
        if (fountIdx !== -1) {
          state.fountains.splice(fountIdx, 1);
          updateZoningCoefficientsUI();
          renderCadWorld();
          updateToolStatus('შადრევანი წაიშალა.');
          return;
        }

        return;
      }

      // DRAG-TO-DRAW RECTANGLE FOOTPRINT MODE
      if (state.activeTool === 'draw_rect_footprint') {
        state.isDrawingRect = true;
        state.drawRectStart = [worldPos[0], worldPos[1]];
        state.drawRectCurrent = [worldPos[0], worldPos[1]];
        renderInteractionLayer();
        return;
      }

      // STAMP BUILDING FOOTPRINT MODE (1-CLICK DIRECT PLACEMENT)
      if (state.activeTool === 'stamp_footprint' || state.activeTool === 'add_footprint') {
        saveUndoSnapshot();
        const nextNum = state.footprints.length + 1;
        const shape = state.stampShape || 'rect';
        const w = state.stampWidth || (els.inputNumBuildingWidth ? parseFloat(els.inputNumBuildingWidth.value) : 15) || 15;
        const l = state.stampLength || (els.inputNumBuildingLength ? parseFloat(els.inputNumBuildingLength.value) : 12) || 12;
        const floors = state.stampFloors || (els.inputNumBuildingFloors ? parseInt(els.inputNumBuildingFloors.value, 10) : 4) || 4;
        const flH = (els.inputNumFloorHeight ? parseFloat(els.inputNumFloorHeight.value) : 3.0) || 3.0;
        const name = state.stampName || `შენობა ${nextNum}`;
        const fn = state.stampFn || 'residential';
        const cx = Math.round(worldPos[0] * 10) / 10;
        const cy = Math.round(worldPos[1] * 10) / 10;

        const newFp = createFootprintObject(name, shape, w, l, 0, cx, cy, floors, flH, fn);
        state.footprints.push(newFp);
        state.selectedFootprintId = newFp.id;
        setCadActiveTool('pan');
        updateSelectedBuildingUI();
        updateZoningCoefficientsUI();
        renderCadWorld();
        updateToolStatus(`შენობა "${name}" (${w}×${l}მ, ${floors} სართ.) განთავსდა გეგმაზე.`);
        return;
      }

      // 2. PAN TOOL MODE
      if (state.activeTool === 'pan' || e.button === 1 || e.spaceKey) {
        // Rotate Handle check
        const rotTarget = checkRotationHandleHit(worldPos);
        if (rotTarget) {
          saveUndoSnapshot();
          state.isRotatingFootprint = true;
          state.draggedFootprintId = rotTarget.id;
          state.rotateStartAngle = Math.atan2(worldPos[1] - rotTarget.center[1], worldPos[0] - rotTarget.center[0]);
          state.footprintInitialRot = rotTarget.rotation || 0;
          return;
        }

        // Footprint Drag check
        const hitFp = checkFootprintHit(worldPos);
        if (hitFp) {
          saveUndoSnapshot();
          state.isDraggingFootprint = true;
          state.draggedFootprintId = hitFp.id;
          state.selectedFootprintId = hitFp.id;
          state.dragStartPos = { x: worldPos[0], y: worldPos[1] };
          state.dragStartCenter = [hitFp.center[0], hitFp.center[1]];
          updateSelectedBuildingUI();
          renderCadWorld();
          return;
        }

        state.isPanning = true;
        state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
        return;
      }

      // 3. SPLIT PARCEL TOOL
      if (state.activeTool === 'split') {
        state.splitLine.push(worldPos);
        if (state.splitLine.length === 2) {
          splitParcelByLine(state.splitLine[0], state.splitLine[1]);
          state.splitLine = [];
        }
        renderInteractionLayer();
        return;
      }

      // 4. TREE PLANTING TOOL
      if (state.activeTool === 'tree') {
        saveUndoSnapshot();
        const r = (state.activeTreeRadius || 2.5);
        state.trees.push({
          id: 'tree_' + Date.now(),
          x: Math.round(worldPos[0] * 10) / 10,
          y: Math.round(worldPos[1] * 10) / 10,
          radius: r,
          treeType: 'deciduous'
        });
        updateZoningCoefficientsUI();
        renderCadWorld();
        updateToolStatus(`დაირგო ფოთლოვანი ხე (დიამეტრი ${(r * 2).toFixed(1)}მ).`);
        return;
      }

      // 4b. PINE TREE TOOL
      if (state.activeTool === 'pine_tree') {
        saveUndoSnapshot();
        const r = 1.8;
        state.trees.push({
          id: 'tree_' + Date.now(),
          x: Math.round(worldPos[0] * 10) / 10,
          y: Math.round(worldPos[1] * 10) / 10,
          radius: r,
          treeType: 'pine'
        });
        updateZoningCoefficientsUI();
        renderCadWorld();
        updateToolStatus(`დაირგო წიწვოვანი ხე (დიამეტრი ${(r * 2).toFixed(1)}მ).`);
        return;
      }

      // 4c. HEDGE TOOL
      if (state.activeTool === 'hedge') {
        state.currentHedgePoints.push([Math.round(worldPos[0] * 10) / 10, Math.round(worldPos[1] * 10) / 10]);
        renderInteractionLayer();
        updateToolStatus(`ცოცხალი ღობე: მონიშნულია ${state.currentHedgePoints.length} წერტილი (ორმაგი კლიკი ასრულებს).`);
        return;
      }

      // 4d. FOUNTAIN TOOL
      if (state.activeTool === 'fountain') {
        saveUndoSnapshot();
        state.fountains.push({
          id: 'fount_' + Date.now(),
          x: Math.round(worldPos[0] * 10) / 10,
          y: Math.round(worldPos[1] * 10) / 10,
          radius: 2.5
        });
        updateZoningCoefficientsUI();
        renderCadWorld();
        updateToolStatus('განთავსდა დეკორატიული შადრევანი (Ø5მ).');
        return;
      }

      // 5. WATER / POOL TOOL
      if (state.activeTool === 'water') {
        saveUndoSnapshot();
        state.waterBodies.push({
          id: 'water_' + Date.now(),
          x: Math.round(worldPos[0] * 10) / 10,
          y: Math.round(worldPos[1] * 10) / 10,
          width: 10,
          length: 5
        });
        renderCadWorld();
        updateToolStatus('განთავსდა საცურაო აუზი (10მ × 5მ).');
        return;
      }

      // 6. TERRACE / DECK TOOL
      if (state.activeTool === 'terrace') {
        saveUndoSnapshot();
        state.terraces.push({
          id: 'terrace_' + Date.now(),
          x: Math.round(worldPos[0] * 10) / 10,
          y: Math.round(worldPos[1] * 10) / 10,
          width: 12,
          length: 6
        });
        renderCadWorld();
        updateToolStatus('განთავსდა ხის ტერასა (12მ × 6მ).');
        return;
      }

      // 7. WALKWAY / PATHWAY TOOL
      if (state.activeTool === 'walkway') {
        state.currentWalkwayPoints.push([Math.round(worldPos[0] * 10) / 10, Math.round(worldPos[1] * 10) / 10]);
        renderInteractionLayer();
        updateToolStatus(`ბილიკი: მონიშნულია ${state.currentWalkwayPoints.length} წერტილი (ორმაგი კლიკი ასრულებს).`);
        return;
      }

      // 7b. BIKE PATH TOOL
      if (state.activeTool === 'bike_path') {
        state.currentBikePathPoints.push([Math.round(worldPos[0] * 10) / 10, Math.round(worldPos[1] * 10) / 10]);
        renderInteractionLayer();
        updateToolStatus(`ველობილიკი (2.0მ): მონიშნულია ${state.currentBikePathPoints.length} წერტილი (ორმაგი კლიკი ასრულებს).`);
        return;
      }

      // 8. ROAD TOOL
      if (state.activeTool === 'draw_road') {
        state.currentRoadPoints.push([Math.round(worldPos[0] * 10) / 10, Math.round(worldPos[1] * 10) / 10]);
        renderInteractionLayer();
        updateToolStatus(`გზა: მონიშნულია ${state.currentRoadPoints.length} წერტილი (ორმაგი კლიკი ასრულებს).`);
        return;
      }

      // 9. PARKING TOOL
      if (state.activeTool === 'parking') {
        saveUndoSnapshot();
        state.parkingBays.push({
          id: 'park_' + Date.now(),
          center: [Math.round(worldPos[0] * 10) / 10, Math.round(worldPos[1] * 10) / 10],
          width: 2.5,
          length: 5.0,
          rotation: 0
        });
        renderCadWorld();
        updateToolStatus('განთავსდა ავტოსადგომის ადგილი (2.5×5.0მ).');
        return;
      }

      // 10. DRAW FOOTPRINT / POLYGON TOOL
      if (state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon') {
        const pxToM = 1 / Math.max(0.001, state.zoomScale);
        const snapDist = 12 * pxToM;
        if (state.drawPoints.length >= 3) {
          // 1. Check if clicked close to start point -> FINISH!
          const dStart = Math.hypot(worldPos[0] - state.drawPoints[0][0], worldPos[1] - state.drawPoints[0][1]);
          if (dStart < snapDist) {
            finishDrawnFootprint();
            return;
          }
          // 2. Check if clicked in place (repeat click on last point) -> FINISH!
          const lastP = state.drawPoints[state.drawPoints.length - 1];
          const dLast = Math.hypot(worldPos[0] - lastP[0], worldPos[1] - lastP[1]);
          if (dLast < 4 * pxToM) {
            finishDrawnFootprint();
            return;
          }
        }
        state.drawPoints.push([Math.round(worldPos[0] * 10) / 10, Math.round(worldPos[1] * 10) / 10]);
        updateToolStatus(`მრავალკუთხედი: მონიშნულია ${state.drawPoints.length} წერტილი. დასასრულებლად დააკლიკეთ მწვანე წერტილზე [🎯], დააჭირეთ Enter-ს ან მარჯვენა ღილაკს.`);
        renderInteractionLayer();
        return;
      }

      // 11. RULER TOOL
      if (state.activeTool === 'ruler') {
        if (state.rulerPoints.length >= 2) state.rulerPoints = [];
        state.rulerPoints.push(worldPos);
        renderInteractionLayer();
        return;
      }
    });

    container.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if ((state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon') && state.drawPoints.length >= 3) {
        finishDrawnFootprint();
      } else if (state.activeTool === 'walkway') {
        finishWalkway();
      } else if (state.activeTool === 'bike_path') {
        finishBikePath();
      } else if (state.activeTool === 'draw_road') {
        finishRoad();
      } else if (state.activeTool === 'hedge') {
        finishHedge();
      }
    });

    container.addEventListener('contextmenu', (e) => {
      if ((state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon') && state.drawPoints.length >= 3) {
        e.preventDefault();
        finishDrawnFootprint();
      }
    });

    // Mouse Move
    window.addEventListener('mousemove', (e) => {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      state.mouseWorldPos = worldPos;

      if (state.isDrawingRect && state.activeTool === 'draw_rect_footprint') {
        state.drawRectCurrent = [worldPos[0], worldPos[1]];
        renderInteractionLayer();
        return;
      }

      if (state.activeTool === 'stamp_footprint' || state.activeTool === 'draw_rect_footprint' || state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon' || state.activeTool === 'walkway' || state.activeTool === 'bike_path' || state.activeTool === 'draw_road' || state.activeTool === 'hedge') {
        renderInteractionLayer();
      }

      if (els.lblMouseCoords) {
        els.lblMouseCoords.innerText = `X: ${worldPos[0].toFixed(1)}მ | Y: ${(-worldPos[1]).toFixed(1)}მ`;
      }

      if (state.isPanning) {
        state.panX = e.clientX - state.panStart.x;
        state.panY = e.clientY - state.panStart.y;
        applyTransform();
        return;
      }

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

      if (state.isDraggingFootprint && state.draggedFootprintId) {
        const fp = state.footprints.find(f => f.id === state.draggedFootprintId);
        if (fp) {
          const dx = worldPos[0] - state.dragStartPos.x;
          const dy = worldPos[1] - state.dragStartPos.y;
          const newCx = state.dragStartCenter[0] + dx;
          const newCy = state.dragStartCenter[1] + dy;

          if (fp.shape === 'freeform' && fp.baseVertices) {
            const rad = (fp.rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            fp.center = [newCx, newCy];
            fp.vertices = fp.baseVertices.map(pt => [
              newCx + pt[0] * cos - pt[1] * sin,
              newCy + pt[0] * sin + pt[1] * cos
            ]);
          } else {
            const newFp = createFootprintObject(fp.name, fp.shape, fp.width, fp.length, fp.rotation, newCx, newCy, fp.floors, fp.floorHeight, fp.functionType);
            fp.center = [newCx, newCy];
            fp.vertices = newFp.vertices;
          }

          renderCadWorld();
        }
        return;
      }
    });

    window.addEventListener('mouseup', (e) => {
      const wasDragging = state.isDraggingFootprint || state.isRotatingFootprint;
      state.isPanning = false;
      state.isDraggingFootprint = false;
      state.isRotatingFootprint = false;
      if (wasDragging) {
        updateZoningCoefficientsUI();
      }

      if (state.isDrawingRect && state.activeTool === 'draw_rect_footprint') {
        state.isDrawingRect = false;
        const p0 = state.drawRectStart;
        const p1 = state.drawRectCurrent || screenToWorld(e.clientX, e.clientY);
        if (p0) {
          saveUndoSnapshot();
          let w = Math.abs(p1[0] - p0[0]);
          let l = Math.abs(p1[1] - p0[1]);
          let cx = (p0[0] + p1[0]) / 2;
          let cy = (p0[1] + p1[1]) / 2;
          if (w < 2 || l < 2) {
            w = state.stampWidth || 15;
            l = state.stampLength || 12;
            cx = p0[0];
            cy = p0[1];
          }
          w = Math.max(3, Math.round(w * 10) / 10);
          l = Math.max(3, Math.round(l * 10) / 10);
          cx = Math.round(cx * 10) / 10;
          cy = Math.round(cy * 10) / 10;
          const floors = state.stampFloors || (els.inputNumBuildingFloors ? parseInt(els.inputNumBuildingFloors.value, 10) : 4) || 4;
          const flH = (els.inputNumFloorHeight ? parseFloat(els.inputNumFloorHeight.value) : 3.0) || 3.0;
          const nextNum = state.footprints.length + 1;
          const name = `შენობა ${nextNum}`;
          const newFp = createFootprintObject(name, 'rect', w, l, 0, cx, cy, floors, flH, 'residential');
          state.footprints.push(newFp);
          state.selectedFootprintId = newFp.id;
          setCadActiveTool('pan');
          updateSelectedBuildingUI();
          updateZoningCoefficientsUI();
          renderCadWorld();
          updateToolStatus(`მოხაზული შენობა "${name}" (${w}×${l}მ = ${newFp.areaSqm} მ²) დაჯდა ნაკვეთზე. შეგიძლიათ მართოთ პარამეტრები.`);
        }
        state.drawRectStart = null;
        state.drawRectCurrent = null;
        renderInteractionLayer();
        return;
      }
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
    renderCadWorld();
  }

  function checkFootprintHit(worldPos) {
    const pxToM = 1 / Math.max(0.001, state.zoomScale);
    const hitTolerance = 6 * pxToM;

    for (let i = state.footprints.length - 1; i >= 0; i--) {
      const fp = state.footprints[i];
      const dCenter = Math.hypot(worldPos[0] - fp.center[0], worldPos[1] - fp.center[1]);
      if (dCenter < 8 * pxToM) return fp;
      if (pointInPolygon(worldPos, fp.vertices, hitTolerance)) return fp;
    }
    return null;
  }

  function checkRotationHandleHit(worldPos) {
    const pxToM = 1 / Math.max(0.001, state.zoomScale);
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return null;

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

  function distToSegment(p, v, w) {
    const l2 = (v[0] - w[0]) * (v[0] - w[0]) + (v[1] - w[1]) * (v[1] - w[1]);
    if (l2 === 0) return Math.hypot(p[0] - v[0], p[1] - v[1]);
    let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v[0] + t * (w[0] - v[0]);
    const projY = v[1] + t * (w[1] - v[1]);
    return Math.hypot(p[0] - projX, p[1] - projY);
  }

  function finishDrawnFootprint() {
    if (!state.drawPoints || state.drawPoints.length < 3) {
      updateToolStatus('მრავალკუთხედის შესაქმნელად საჭიროა მინიმუმ 3 წერტილი.');
      return;
    }

    // Filter duplicate consecutive points (from rapid clicks or double clicks)
    const cleanPoints = [];
    for (let i = 0; i < state.drawPoints.length; i++) {
      const p = state.drawPoints[i];
      if (cleanPoints.length === 0 || Math.hypot(p[0] - cleanPoints[cleanPoints.length - 1][0], p[1] - cleanPoints[cleanPoints.length - 1][1]) > 0.2) {
        cleanPoints.push(p);
      }
    }
    // If last point was clicked on the start point, pop it to close cleanly
    if (cleanPoints.length >= 4) {
      const first = cleanPoints[0];
      const last = cleanPoints[cleanPoints.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1.5) {
        cleanPoints.pop();
      }
    }
    if (cleanPoints.length < 3) {
      updateToolStatus('მრავალკუთხედის შესაქმნელად საჭიროა მინიმუმ 3 განსხვავებული წერტილი.');
      return;
    }

    saveUndoSnapshot();
    const area = calculatePolygonArea(cleanPoints);
    const cx = cleanPoints.reduce((s, p) => s + p[0], 0) / cleanPoints.length;
    const cy = cleanPoints.reduce((s, p) => s + p[1], 0) / cleanPoints.length;

    const xs = cleanPoints.map(p => p[0]);
    const ys = cleanPoints.map(p => p[1]);
    const bldW = Math.max(4, Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10);
    const bldL = Math.max(4, Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10);

    const baseVerts = cleanPoints.map(p => [p[0] - cx, p[1] - cy]);
    const floors = state.stampFloors || (els.inputNumBuildingFloors ? parseInt(els.inputNumBuildingFloors.value, 10) : 4) || 4;
    const flH = (els.inputNumFloorHeight ? parseFloat(els.inputNumFloorHeight.value) : 3.0) || 3.0;
    const nextNum = state.footprints.length + 1;

    const fp = {
      id: 'bld_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: `შენობა ${nextNum} (მრავალკუთხა)`,
      shape: 'freeform',
      baseVertices: baseVerts,
      width: bldW,
      length: bldL,
      rotation: 0,
      center: [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10],
      vertices: cleanPoints,
      floors: floors,
      floorHeight: flH,
      totalHeight: Math.round((floors * flH + 0.8) * 10) / 10,
      functionType: state.stampFn || 'residential',
      areaSqm: Math.round(area)
    };

    state.footprints.push(fp);
    state.selectedFootprintId = fp.id;
    state.drawPoints = [];
    setCadActiveTool('pan');
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus(`მრავალკუთხა შენობა "${fp.name}" (${fp.areaSqm} მ², ${fp.floors}ს) წარმატებით დაჯდა ნაკვეთზე და აისახა კოეფიციენტებზე!`);
  }
  window.finishDrawnFootprint = finishDrawnFootprint;

  // =========================================================================
  // --- ARCHITECTURAL RENDER PIPELINE WITH SCREEN-SCALED GRAPHICS ---
  // =========================================================================
  function renderCadWorld() {
    const pxToM = 1 / Math.max(0.001, state.zoomScale);

    renderCadastralBoundary(pxToM);
    renderSetbackBuffer(pxToM);
    renderSubParcels(pxToM);
    renderRoads(pxToM);
    renderWalkways(pxToM);
    renderBikePaths(pxToM);
    renderHedges(pxToM);
    renderParking(pxToM);
    renderWaterBodies(pxToM);
    renderFountains(pxToM);
    renderTerraces(pxToM);
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

  // 2. Setback Buffer Layer (სამეზობლო მიჯნა 1.5მ - 6.0მ)
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

  // 4. Driveways & Roads (+ საავტომობილო გზა)
  function renderRoads(pxToM) {
    if (!els.roadsLayer) return;
    if (!state.layers.roads) {
      els.roadsLayer.innerHTML = '';
      return;
    }

    let html = '';

    // Default parcel entrance access road
    if (state.boundaryMeters && state.boundaryMeters.length >= 3) {
      const ys = state.boundaryMeters.map(p => p[1]);
      const maxY = Math.max(...ys);
      const roadW = 28;
      const roadH = 6;
      const rx = -roadW / 2;
      const ry = maxY + 1;

      html += `
        <g>
          <rect x="${rx}" y="${ry}" width="${roadW}" height="${roadH}" fill="var(--road-fill)" stroke="#475569" stroke-width="${0.8 * pxToM}" rx="${1 * pxToM}"/>
          <line x1="${rx}" y1="${ry + roadH / 2}" x2="${rx + roadW}" y2="${ry + roadH / 2}" stroke="var(--road-stripe, #facc15)" stroke-width="${0.6 * pxToM}" stroke-dasharray="${3 * pxToM}, ${3 * pxToM}"/>
          <text x="0" y="${ry + roadH / 2 + 1.2 * pxToM}" text-anchor="middle" fill="#94a3b8" font-size="${8 * pxToM}" font-family="Inter, sans-serif" font-weight="600">მისასვლელი გზა (6.0მ)</text>
        </g>
      `;
    }

    // User drawn roads
    (state.roads || []).forEach(r => {
      if (!r.points || r.points.length < 2) return;
      const ptsStr = r.points.map(p => `${p[0]},${p[1]}`).join(' ');
      const roadW = r.width || 6.0;

      html += `
        <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteRoad('${r.id}');}">
          <polyline points="${ptsStr}" fill="none" stroke="var(--road-fill)" stroke-width="${roadW}" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
          <polyline points="${ptsStr}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="${roadW}" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="${ptsStr}" fill="none" stroke="var(--road-stripe, #facc15)" stroke-width="${Math.max(0.2, 0.6 * pxToM)}" stroke-dasharray="${4 * pxToM}, ${3 * pxToM}" stroke-linecap="round"/>
          <polyline points="${ptsStr}" fill="none" stroke="transparent" stroke-width="${roadW + 2 * pxToM}" />
        </g>
      `;
    });

    els.roadsLayer.innerHTML = html;
  }

  function deleteRoad(id) {
    saveUndoSnapshot();
    state.roads = (state.roads || []).filter(r => r.id !== id);
    renderCadWorld();
    updateToolStatus('გზა წაიშალა.');
  }

  // 5. Walkways Layer (+ საფეხმავლო ბილიკი)
  function renderWalkways(pxToM) {
    if (!els.walkwaysLayer) return;
    if (!state.layers.roads || !state.walkways || state.walkways.length === 0) {
      els.walkwaysLayer.innerHTML = '';
      return;
    }

    els.walkwaysLayer.innerHTML = state.walkways.map(w => {
      if (!w.points || w.points.length < 2) return '';
      const ptsStr = w.points.map(p => `${p[0]},${p[1]}`).join(' ');
      const walkW = w.width || 1.8;

      return `
        <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteWalkway('${w.id}');}">
          <!-- Outer border -->
          <polyline points="${ptsStr}" fill="none" stroke="var(--walkway-stroke, #64748b)" stroke-width="${walkW + 0.3 * pxToM}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
          <!-- Walkway Paver Body -->
          <polyline points="${ptsStr}" fill="none" stroke="var(--walkway-fill, #94a3b8)" stroke-width="${walkW}" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Dotted center paver seam -->
          <polyline points="${ptsStr}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="${0.4 * pxToM}" stroke-dasharray="${1.5 * pxToM}, ${1.5 * pxToM}" stroke-linecap="round"/>
          <!-- Hit area for easy deletion -->
          <polyline points="${ptsStr}" fill="none" stroke="transparent" stroke-width="${walkW + 3 * pxToM}"/>
        </g>
      `;
    }).join('');
  }

  function deleteWalkway(id) {
    saveUndoSnapshot();
    state.walkways = (state.walkways || []).filter(w => w.id !== id);
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('საფეხმავლო ბილიკი წაიშალა.');
  }

  // 5b. Bike Paths (+ ველობილიკი)
  function renderBikePaths(pxToM) {
    if (!els.bikePathsLayer) return;
    if (!state.layers.roads || !state.bikePaths || state.bikePaths.length === 0) {
      els.bikePathsLayer.innerHTML = '';
      return;
    }

    els.bikePathsLayer.innerHTML = state.bikePaths.map(b => {
      if (!b.points || b.points.length < 2) return '';
      const ptsStr = b.points.map(p => `${p[0]},${p[1]}`).join(' ');
      const bikeW = b.width || 2.0;

      return `
        <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteBikePath('${b.id}');}">
          <polyline points="${ptsStr}" fill="none" stroke="#047857" stroke-width="${bikeW + 0.3 * pxToM}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
          <polyline points="${ptsStr}" fill="none" stroke="#10b981" stroke-width="${bikeW}" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="${ptsStr}" fill="none" stroke="#ffffff" stroke-width="${0.4 * pxToM}" stroke-dasharray="${2 * pxToM}, ${2 * pxToM}" stroke-linecap="round"/>
          <polyline points="${ptsStr}" fill="none" stroke="transparent" stroke-width="${bikeW + 3 * pxToM}"/>
        </g>
      `;
    }).join('');
  }

  function deleteBikePath(id) {
    saveUndoSnapshot();
    state.bikePaths = (state.bikePaths || []).filter(b => b.id !== id);
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('ველობილიკი წაიშალა.');
  }

  // 5c. Hedges & Living Fences (+ ცოცხალი ღობე)
  function renderHedges(pxToM) {
    if (!els.hedgesLayer) return;
    if (!state.layers.trees || !state.hedges || state.hedges.length === 0) {
      els.hedgesLayer.innerHTML = '';
      return;
    }

    els.hedgesLayer.innerHTML = state.hedges.map(h => {
      if (!h.points || h.points.length < 2) return '';
      const ptsStr = h.points.map(p => `${p[0]},${p[1]}`).join(' ');
      const hedgeW = h.width || 1.2;

      return `
        <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteHedge('${h.id}');}">
          <polyline points="${ptsStr}" fill="none" stroke="#14532d" stroke-width="${hedgeW + 0.3 * pxToM}" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="${ptsStr}" fill="none" stroke="#22c55e" stroke-width="${hedgeW}" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="${ptsStr}" fill="none" stroke="#86efac" stroke-width="${hedgeW * 0.45}" stroke-dasharray="${1.5 * pxToM}, ${1.5 * pxToM}" stroke-linecap="round"/>
          <polyline points="${ptsStr}" fill="none" stroke="transparent" stroke-width="${hedgeW + 3 * pxToM}"/>
        </g>
      `;
    }).join('');
  }

  function deleteHedge(id) {
    saveUndoSnapshot();
    state.hedges = (state.hedges || []).filter(h => h.id !== id);
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('ცოცხალი ღობე წაიშალა.');
  }

  // 6. Parking Bays (+ ავტოსადგომი)
  function renderParking(pxToM) {
    if (!els.parkingLayer) return;
    if (!state.layers.roads || !state.parkingBays || state.parkingBays.length === 0) {
      els.parkingLayer.innerHTML = '';
      return;
    }

    els.parkingLayer.innerHTML = state.parkingBays.map(p => {
      const w = p.width || 2.5;
      const l = p.length || 5.0;
      const rot = p.rotation || 0;

      return `
        <g class="cursor-pointer" transform="rotate(${rot}, ${p.center[0]}, ${p.center[1]})" onclick="if(state.activeTool==='delete'){deleteParking('${p.id}');}">
          <!-- Stall asphalt/paving surface -->
          <rect x="${p.center[0] - w / 2}" y="${p.center[1] - l / 2}" width="${w}" height="${l}" fill="var(--parking-fill)" opacity="0.88" stroke="var(--parking-line, #ffffff)" stroke-width="${0.5 * pxToM}" rx="${0.4 * pxToM}"/>
          <!-- Stall divider lines on sides -->
          <line x1="${p.center[0] - w / 2}" y1="${p.center[1] - l / 2}" x2="${p.center[0] - w / 2}" y2="${p.center[1] + l / 2}" stroke="var(--parking-line, #ffffff)" stroke-width="${0.8 * pxToM}" />
          <line x1="${p.center[0] + w / 2}" y1="${p.center[1] - l / 2}" x2="${p.center[0] + w / 2}" y2="${p.center[1] + l / 2}" stroke="var(--parking-line, #ffffff)" stroke-width="${0.8 * pxToM}" />
          <!-- Wheel stop bar -->
          <rect x="${p.center[0] - w / 2 + 0.3}" y="${p.center[1] + l / 2 - 0.7}" width="${w - 0.6}" height="${0.3}" fill="#cbd5e1" rx="${0.1}"/>
          <!-- 'P' Badge -->
          <circle cx="${p.center[0]}" cy="${p.center[1] - 0.5}" r="${1.2}" fill="rgba(15,23,42,0.6)"/>
          <text x="${p.center[0]}" y="${p.center[1] - 0.5 + 2.5 * pxToM}" text-anchor="middle" fill="#ffffff" font-size="${7 * pxToM}" font-weight="bold" font-family="'JetBrains Mono', monospace">P</text>
        </g>
      `;
    }).join('');
  }

  function deleteParking(id) {
    saveUndoSnapshot();
    state.parkingBays = (state.parkingBays || []).filter(p => p.id !== id);
    renderCadWorld();
    updateToolStatus('ავტოსადგომი წაიშალა.');
  }


  // 6. Water Bodies / Swimming Pools (+ აუზი)
  function renderWaterBodies(pxToM) {
    if (!els.waterLayer) return;
    if (!state.layers.water || state.waterBodies.length === 0) {
      els.waterLayer.innerHTML = '';
      return;
    }

    els.waterLayer.innerHTML = state.waterBodies.map(w => `
      <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteWaterBody('${w.id}');}">
        <!-- Pool Coping stone border -->
        <rect x="${w.x - w.width / 2 - 0.8}" y="${w.y - w.length / 2 - 0.8}" width="${w.width + 1.6}" height="${w.length + 1.6}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="${0.6 * pxToM}" rx="${1 * pxToM}"/>
        <!-- Water Body -->
        <rect x="${w.x - w.width / 2}" y="${w.y - w.length / 2}" width="${w.width}" height="${w.length}" fill="var(--water-fill)" opacity="0.85" rx="${0.5 * pxToM}"/>
        <!-- Water Pattern overlay -->
        <rect x="${w.x - w.width / 2}" y="${w.y - w.length / 2}" width="${w.width}" height="${w.length}" fill="url(#hatchWaterWaves)" opacity="0.6"/>
        <text x="${w.x}" y="${w.y + 2.5 * pxToM}" text-anchor="middle" fill="#ffffff" font-size="${8 * pxToM}" font-weight="bold" font-family="'JetBrains Mono', monospace">აუზი ${w.width}×${w.length}მ</text>
      </g>
    `).join('');
  }

  function deleteWaterBody(id) {
    saveUndoSnapshot();
    state.waterBodies = state.waterBodies.filter(w => w.id !== id);
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('აუზი წაიშალა.');
  }

  // 6b. Decorative Fountains (+ დეკორატიული შადრევანი)
  function renderFountains(pxToM) {
    if (!els.fountainsLayer) return;
    if (!state.layers.water || !state.fountains || state.fountains.length === 0) {
      els.fountainsLayer.innerHTML = '';
      return;
    }

    els.fountainsLayer.innerHTML = state.fountains.map(f => {
      const r = f.radius || 2.5;
      return `
        <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteFountain('${f.id}');}">
          <!-- Outer basin ring -->
          <circle cx="${f.x}" cy="${f.y}" r="${r + 0.4}" fill="#e2e8f0" stroke="#64748b" stroke-width="${0.7 * pxToM}"/>
          <!-- Water basin -->
          <circle cx="${f.x}" cy="${f.y}" r="${r}" fill="#0284c7" opacity="0.85"/>
          <!-- Ripples -->
          <circle cx="${f.x}" cy="${f.y}" r="${r * 0.65}" fill="none" stroke="#38bdf8" stroke-width="${0.5 * pxToM}" stroke-dasharray="${2 * pxToM}, ${1.5 * pxToM}"/>
          <circle cx="${f.x}" cy="${f.y}" r="${r * 0.35}" fill="none" stroke="#e0f2fe" stroke-width="${0.5 * pxToM}"/>
          <!-- Center Jet nozzle -->
          <circle cx="${f.x}" cy="${f.y}" r="${0.8 * pxToM}" fill="#ffffff"/>
          <text x="${f.x}" y="${f.y + r + 2.5 * pxToM}" text-anchor="middle" fill="#38bdf8" font-size="${7.5 * pxToM}" font-family="Inter, sans-serif" font-weight="600">შადრევანი</text>
        </g>
      `;
    }).join('');
  }

  function deleteFountain(id) {
    saveUndoSnapshot();
    state.fountains = (state.fountains || []).filter(f => f.id !== id);
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('შადრევანი წაიშალა.');
  }

  // 7. Terraces & Decks (+ ტერასა)
  function renderTerraces(pxToM) {
    if (!els.terracesLayer) return;
    if (state.terraces.length === 0) {
      els.terracesLayer.innerHTML = '';
      return;
    }

    els.terracesLayer.innerHTML = state.terraces.map(t => `
      <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteTerrace('${t.id}');}">
        <rect x="${t.x - t.width / 2}" y="${t.y - t.length / 2}" width="${t.width}" height="${t.length}" fill="var(--terrace-fill)" stroke="#b45309" stroke-width="${0.8 * pxToM}" rx="${0.8 * pxToM}"/>
        <rect x="${t.x - t.width / 2}" y="${t.y - t.length / 2}" width="${t.width}" height="${t.length}" fill="url(#hatchTerraceWood)" opacity="0.7"/>
        <text x="${t.x}" y="${t.y + 2 * pxToM}" text-anchor="middle" fill="#78350f" font-size="${8 * pxToM}" font-weight="bold" font-family="Inter, sans-serif">ტერასა ${t.width}×${t.length}მ</text>
      </g>
    `).join('');
  }

  function deleteTerrace(id) {
    saveUndoSnapshot();
    state.terraces = state.terraces.filter(t => t.id !== id);
    renderCadWorld();
    updateToolStatus('ტერასა წაიშალა.');
  }

  // 8. 2D Shadow Projection
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
      return `<polygon points="${shadowPoly}" fill="rgba(0,0,0,0.32)" />`;
    }).join('');
  }

  // 9. Trees & Landscaping (+ ხეები)
  function renderTrees(pxToM) {
    if (!els.treesLayer) return;
    if (!state.layers.trees || state.trees.length === 0) {
      els.treesLayer.innerHTML = '';
      return;
    }

    els.treesLayer.innerHTML = state.trees.map(t => {
      const r = t.radius || 2.8;
      const isPine = t.treeType === 'pine';

      if (isPine) {
        // Conifer / Pine: 8-point geometric spruce polygon with deep forest green
        const points = [];
        const nPoints = 8;
        for (let i = 0; i < nPoints * 2; i++) {
          const angle = (i * Math.PI) / nPoints - Math.PI / 2;
          const currR = (i % 2 === 0) ? r : r * 0.55;
          points.push(`${t.x + Math.cos(angle) * currR},${t.y + Math.sin(angle) * currR}`);
        }
        return `
          <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteTree('${t.id}');}">
            <polygon points="${points.join(' ')}" fill="#14532d" opacity="0.9" stroke="#052e16" stroke-width="${0.7 * pxToM}"/>
            <circle cx="${t.x}" cy="${t.y}" r="${r * 0.3}" fill="#166534" stroke="#86efac" stroke-width="${0.4 * pxToM}"/>
            <circle cx="${t.x}" cy="${t.y}" r="${0.5 * pxToM}" fill="#78350f"/>
          </g>
        `;
      }

      const branchR = r * 0.7;
      return `
        <g class="cursor-pointer" onclick="if(state.activeTool==='delete'){deleteTree('${t.id}');}">
          <circle cx="${t.x + 0.5}" cy="${t.y + 0.5}" r="${r}" fill="rgba(0,0,0,0.2)"/>
          <circle cx="${t.x}" cy="${t.y}" r="${r}" fill="var(--tree-fill)" opacity="0.88" stroke="#15803d" stroke-width="${0.6 * pxToM}"/>
          <circle cx="${t.x}" cy="${t.y}" r="${branchR}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="${0.5 * pxToM}" stroke-dasharray="${1.5 * pxToM}, ${1.5 * pxToM}"/>
          <circle cx="${t.x}" cy="${t.y}" r="${0.6 * pxToM}" fill="#78350f"/>
        </g>
      `;
    }).join('');
  }

  function deleteTree(id) {
    saveUndoSnapshot();
    state.trees = state.trees.filter(t => t.id !== id);
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('ხე წაიშალა.');
  }

  // 10. Building Footprints Layer
  function renderFootprints(pxToM) {
    if (!els.footprintsLayer) return;
    if (!state.layers.footprints) {
      els.footprintsLayer.innerHTML = '';
      return;
    }

    const lightHatchStyles = ['classic', 'cadplot', 'napr', 'vellum', 'topographic', 'masterplan', 'presentation', 'nordic', 'sepia', 'graph', 'zen', 'bauhaus', 'sketch', 'desert'];
    const hatchId = lightHatchStyles.includes(state.activeStyle) ? 'hatchBuildingClassic' : 'hatchBuildingBlueprint';
    const setbackPoly = (state.boundaryMeters && state.boundaryMeters.length >= 3)
      ? computeSetbackPolygon(state.boundaryMeters, state.setbackDistance)
      : null;

    els.footprintsLayer.innerHTML = state.footprints.map(f => {
      const pts = f.vertices.map(p => `${p[0]},${p[1]}`).join(' ');
      const isSelected = f.id === state.selectedFootprintId;

      // Check setback violation: does any vertex cross outside the setback zone?
      let isSetbackViolated = false;
      if (setbackPoly && setbackPoly.length >= 3) {
        for (const v of f.vertices) {
          if (!pointInPolygon(v, setbackPoly)) {
            isSetbackViolated = true;
            break;
          }
        }
      }

      const badgeW = (isSetbackViolated ? 115 : 95) * pxToM;
      const badgeH = 26 * pxToM;
      const cornerR = 4 * pxToM;
      const strokeW = isSelected ? Math.max(0.4, 2.0 * pxToM) : Math.max(0.3, 1.2 * pxToM);

      let strokeColor = isSelected ? '#00f0ff' : 'var(--footprint-stroke)';
      if (isSetbackViolated) {
        strokeColor = '#ef4444';
      }

      let rotationHandleSvg = '';
      if (isSelected) {
        const stemDist = (f.length / 2) + (16 * pxToM);
        const rad = ((f.rotation - 90) * Math.PI) / 180;
        const hx = f.center[0] + Math.cos(rad) * stemDist;
        const hy = f.center[1] + Math.sin(rad) * stemDist;

        rotationHandleSvg = `
          <line x1="${f.center[0]}" y1="${f.center[1]}" x2="${hx}" y2="${hy}" stroke="#f59e0b" stroke-width="${1 * pxToM}" stroke-dasharray="${2 * pxToM}, ${2 * pxToM}" />
          <circle cx="${hx}" cy="${hy}" r="${4.5 * pxToM}" fill="#f59e0b" stroke="#ffffff" stroke-width="${1 * pxToM}" class="cursor-grab" title="დაატრიალეთ შენობა" />
        `;
      }

      return `
        <g class="cursor-pointer" onclick="handleFootprintClick('${f.id}')">
          ${isSetbackViolated ? `<polygon points="${pts}" fill="none" stroke="#ef4444" stroke-width="${strokeW + 2 * pxToM}" stroke-dasharray="${3 * pxToM}, ${2 * pxToM}" opacity="0.8"/>` : ''}
          <polygon points="${pts}" fill="var(--footprint-fill)" stroke="${strokeColor}" stroke-width="${strokeW}" />
          <polygon points="${pts}" fill="url(#${hatchId})" opacity="0.65" pointer-events="none" />

          ${rotationHandleSvg}

          <circle cx="${f.center[0]}" cy="${f.center[1]}" r="${4.5 * pxToM}" fill="${isSelected ? '#00f0ff' : (isSetbackViolated ? '#ef4444' : '#ffffff')}" stroke="#0a101d" stroke-width="${1 * pxToM}" />

          <rect x="${f.center[0] - badgeW / 2}" y="${f.center[1] - badgeH / 2}" width="${badgeW}" height="${badgeH}" rx="${cornerR}" fill="rgba(8,13,26,0.92)" stroke="${isSetbackViolated ? '#ef4444' : (isSelected ? '#00f0ff' : '#334155')}" stroke-width="${0.8 * pxToM}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))" pointer-events="none" />
          <text x="${f.center[0]}" y="${f.center[1] - 2 * pxToM}" text-anchor="middle" fill="${isSetbackViolated ? '#f87171' : '#ffffff'}" font-size="${9 * pxToM}" font-weight="bold" font-family="Inter, sans-serif" pointer-events="none">${f.name} ${isSetbackViolated ? '⚠️ მიჯნა' : ''}</text>
          <text x="${f.center[0]}" y="${f.center[1] + 8 * pxToM}" text-anchor="middle" fill="${isSelected ? '#38bdf8' : (isSetbackViolated ? '#fca5a5' : '#94a3b8')}" font-size="${8 * pxToM}" font-family="'JetBrains Mono', monospace" font-weight="600" pointer-events="none">${f.areaSqm} მ² · ${f.floors}ს (H:${f.totalHeight}მ)</text>
        </g>
      `;
    }).join('');
  }

  function handleFootprintClick(id) {
    if (state.activeTool === 'delete') {
      deleteFootprint(id);
      return;
    }
    selectFootprint(id);
  }

  // 11. Architectural Dimension Strings
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

      if (dist < 2.5) continue;

      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;

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
          <rect x="${tx - pillW / 2}" y="${ty - pillH / 2}" width="${pillW}" height="${pillH}" rx="${2.5 * pxToM}" fill="var(--canvas-bg)" stroke="var(--grid-major)" stroke-width="${0.6 * pxToM}" opacity="0.95" />
          <text x="${tx}" y="${ty + 3.5 * pxToM}" text-anchor="middle" fill="var(--text-color)" font-size="${8.5 * pxToM}" font-family="'JetBrains Mono', monospace" font-weight="bold">${textStr}</text>
        </g>
      `;
    }
    els.dimensionsLayer.innerHTML = dimSvg;
  }

  // 12. Node Numbers Layer
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

  // 13. Temporary Interaction Layer
  function renderInteractionLayer(pxToM) {
    if (!els.interactionLayer) return;
    const p2m = pxToM || (1 / Math.max(0.001, state.zoomScale));

    if (state.activeTool === 'draw_rect_footprint') {
      if (state.isDrawingRect && state.drawRectStart && state.drawRectCurrent) {
        const p0 = state.drawRectStart;
        const p1 = state.drawRectCurrent;
        const rx = Math.min(p0[0], p1[0]);
        const ry = Math.min(p0[1], p1[1]);
        const rw = Math.max(0.5, Math.abs(p1[0] - p0[0]));
        const rh = Math.max(0.5, Math.abs(p1[1] - p0[1]));
        const area = Math.round(rw * rh);
        const floors = state.stampFloors || (els.inputNumBuildingFloors ? parseInt(els.inputNumBuildingFloors.value, 10) : 4) || 4;
        const badgeW = 140 * p2m;
        const badgeH = 18 * p2m;
        els.interactionLayer.innerHTML = `
          <g pointer-events="none">
            <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="rgba(14, 165, 233, 0.22)" stroke="#38bdf8" stroke-width="${2 * p2m}" stroke-dasharray="${5 * p2m}, ${3 * p2m}"/>
            <rect x="${rx}" y="${ry - badgeH - 3 * p2m}" width="${badgeW}" height="${badgeH}" rx="${3 * p2m}" fill="rgba(8,13,26,0.92)" stroke="#38bdf8" stroke-width="${0.8 * p2m}"/>
            <text x="${rx + badgeW / 2}" y="${ry - 5 * p2m}" text-anchor="middle" fill="#38bdf8" font-size="${9 * p2m}" font-weight="bold" font-family="'JetBrains Mono', monospace">${rw.toFixed(1)}მ × ${rh.toFixed(1)}მ | ${area} მ² (${floors}ს)</text>
          </g>
        `;
        return;
      } else if (state.mouseWorldPos) {
        const cx = state.mouseWorldPos[0];
        const cy = state.mouseWorldPos[1];
        els.interactionLayer.innerHTML = `
          <g pointer-events="none">
            <circle cx="${cx}" cy="${cy}" r="${4 * p2m}" fill="#38bdf8" stroke="#ffffff" stroke-width="${1 * p2m}"/>
            <text x="${cx}" y="${cy - 8 * p2m}" text-anchor="middle" fill="#38bdf8" font-size="${8.5 * p2m}" font-family="Inter, sans-serif" font-weight="bold">დააჭირეთ და გადაატარეთ ლაქის მოსახაზად</text>
          </g>
        `;
        return;
      }
    }

    if (state.activeTool === 'stamp_footprint' && state.mouseWorldPos) {
      const w = state.stampWidth || (els.inputNumBuildingWidth ? parseFloat(els.inputNumBuildingWidth.value) : 15) || 15;
      const l = state.stampLength || (els.inputNumBuildingLength ? parseFloat(els.inputNumBuildingLength.value) : 12) || 12;
      const floors = state.stampFloors || (els.inputNumBuildingFloors ? parseInt(els.inputNumBuildingFloors.value, 10) : 4) || 4;
      const cx = state.mouseWorldPos[0];
      const cy = state.mouseWorldPos[1];
      const rx = cx - w / 2;
      const ry = cy - l / 2;

      els.interactionLayer.innerHTML = `
        <g pointer-events="none">
          <rect x="${rx}" y="${ry}" width="${w}" height="${l}" fill="rgba(0, 240, 255, 0.18)" stroke="#00f0ff" stroke-width="${1.5 * p2m}" stroke-dasharray="${4 * p2m}, ${3 * p2m}"/>
          <circle cx="${cx}" cy="${cy}" r="${4 * p2m}" fill="#00f0ff" stroke="#080d1a" stroke-width="${1 * p2m}"/>
          <rect x="${cx - 50 * p2m}" y="${ry - 18 * p2m}" width="${100 * p2m}" height="${15 * p2m}" rx="${3 * p2m}" fill="rgba(8,13,26,0.9)" stroke="#00f0ff" stroke-width="${0.7 * p2m}"/>
          <text x="${cx}" y="${ry - 7 * p2m}" text-anchor="middle" fill="#00f0ff" font-size="${8.5 * p2m}" font-weight="bold" font-family="'JetBrains Mono', monospace">${w}მ × ${l}მ · ${(w * l).toFixed(0)} მ² (${floors}ს)</text>
          <text x="${cx}" y="${cy + 14 * p2m}" text-anchor="middle" fill="#ffffff" font-size="${8 * p2m}" font-family="Inter, sans-serif" font-weight="600">დააკლიკეთ დასასმელად</text>
        </g>
      `;
      return;
    }

    if (state.activeTool === 'split' && state.splitLine.length === 1) {
      els.interactionLayer.innerHTML = `
        <circle cx="${state.splitLine[0][0]}" cy="${state.splitLine[0][1]}" r="${4 * p2m}" fill="#f59e0b" stroke="#ffffff" stroke-width="${1 * p2m}" />
      `;
    } else if ((state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon') && state.drawPoints.length > 0) {
      const p0 = state.drawPoints[0];
      const lastP = state.drawPoints[state.drawPoints.length - 1];
      const curMouse = state.mouseWorldPos || lastP;
      
      const distToStart = Math.hypot(curMouse[0] - p0[0], curMouse[1] - p0[1]);
      const isNearStart = state.drawPoints.length >= 3 && distToStart < 14 * p2m;

      const pts = state.drawPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      const targetX = isNearStart ? p0[0] : curMouse[0];
      const targetY = isNearStart ? p0[1] : curMouse[1];

      // Live area estimate
      const previewPolygon = [...state.drawPoints, [targetX, targetY]];
      const previewArea = state.drawPoints.length >= 2 ? Math.round(calculatePolygonArea(previewPolygon)) : 0;

      // Start point target badge
      const startPointSvg = state.drawPoints.length >= 3 ? `
        <circle cx="${p0[0]}" cy="${p0[1]}" r="${9 * p2m}" fill="${isNearStart ? '#10b981' : 'rgba(16, 185, 129, 0.35)'}" stroke="#10b981" stroke-width="${2 * p2m}" />
        <circle cx="${p0[0]}" cy="${p0[1]}" r="${4.5 * p2m}" fill="#ffffff" />
        <rect x="${p0[0] - 60 * p2m}" y="${p0[1] - 24 * p2m}" width="${120 * p2m}" height="${17 * p2m}" rx="${3.5 * p2m}" fill="rgba(8,13,26,0.95)" stroke="#10b981" stroke-width="${0.9 * p2m}"/>
        <text x="${p0[0]}" y="${p0[1] - 12 * p2m}" text-anchor="middle" fill="#10b981" font-size="${8.5 * p2m}" font-weight="bold" font-family="'JetBrains Mono', monospace">🎯 დააკლიკეთ დასახურად</text>
      ` : `
        <circle cx="${p0[0]}" cy="${p0[1]}" r="${5 * p2m}" fill="#00f0ff" stroke="#ffffff" stroke-width="${1.5 * p2m}"/>
      `;

      // Floating Finish Button (appears when >= 3 points)
      let finishBtnSvg = '';
      if (state.drawPoints.length >= 3) {
        const btnX = lastP[0] + 12 * p2m;
        const btnY = lastP[1] - 28 * p2m;
        finishBtnSvg = `
          <g onclick="window.finishDrawnFootprint()" class="cursor-pointer" style="cursor: pointer;">
            <rect x="${btnX}" y="${btnY}" width="${160 * p2m}" height="${24 * p2m}" rx="${4 * p2m}" fill="#0284c7" stroke="#38bdf8" stroke-width="${1.2 * p2m}" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.6))"/>
            <text x="${btnX + 80 * p2m}" y="${btnY + 16 * p2m}" text-anchor="middle" fill="#ffffff" font-size="${9.5 * p2m}" font-weight="bold" font-family="Inter, sans-serif">✓ ლაქის დასრულება (Enter)</text>
          </g>
        `;
      }

      els.interactionLayer.innerHTML = `
        <polygon points="${pts} ${targetX},${targetY}" fill="rgba(0, 240, 255, 0.12)" stroke="none" pointer-events="none" />
        <polyline points="${pts}" fill="none" stroke="#00f0ff" stroke-width="${1.8 * p2m}" stroke-dasharray="${3 * p2m}, ${2 * p2m}" pointer-events="none" />
        <line x1="${lastP[0]}" y1="${lastP[1]}" x2="${targetX}" y2="${targetY}" stroke="${isNearStart ? '#10b981' : '#38bdf8'}" stroke-width="${2 * p2m}" stroke-dasharray="${4 * p2m}, ${3 * p2m}" pointer-events="none" />
        ${state.drawPoints.length >= 3 ? `<line x1="${targetX}" y1="${targetY}" x2="${p0[0]}" y2="${p0[1]}" stroke="rgba(16, 185, 129, 0.6)" stroke-width="${1.2 * p2m}" stroke-dasharray="${3 * p2m}, ${3 * p2m}" pointer-events="none" />` : ''}
        ${state.drawPoints.map((p, idx) => idx === 0 ? '' : `<circle cx="${p[0]}" cy="${p[1]}" r="${3.5 * p2m}" fill="#00f0ff" stroke="#080d1a" stroke-width="${0.8 * p2m}" pointer-events="none"/>`).join('')}
        ${startPointSvg}
        ${previewArea > 0 ? `
          <rect x="${targetX + 10 * p2m}" y="${targetY + 10 * p2m}" width="${85 * p2m}" height="${17 * p2m}" rx="${3 * p2m}" fill="rgba(8,13,26,0.92)" stroke="#38bdf8" stroke-width="${0.8 * p2m}" pointer-events="none"/>
          <text x="${targetX + 52.5 * p2m}" y="${targetY + 22 * p2m}" text-anchor="middle" fill="#38bdf8" font-size="${8.5 * p2m}" font-family="'JetBrains Mono', monospace" font-weight="bold" pointer-events="none">~${previewArea} მ²</text>
        ` : ''}
        ${finishBtnSvg}
      `;
    } else if (state.activeTool === 'walkway' && state.currentWalkwayPoints && state.currentWalkwayPoints.length > 0) {
      const pts = state.currentWalkwayPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      els.interactionLayer.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="#2dd4bf" stroke-width="${state.activeWalkwayWidth || 1.8}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${3 * p2m}, ${2 * p2m}" />
        ${state.currentWalkwayPoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3.5 * p2m}" fill="#2dd4bf" stroke="#ffffff" stroke-width="${1 * p2m}"/>`).join('')}
      `;
    } else if (state.activeTool === 'bike_path' && state.currentBikePathPoints && state.currentBikePathPoints.length > 0) {
      const pts = state.currentBikePathPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      els.interactionLayer.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="#10b981" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${3 * p2m}, ${2 * p2m}" />
        ${state.currentBikePathPoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3.5 * p2m}" fill="#10b981" stroke="#ffffff" stroke-width="${1 * p2m}"/>`).join('')}
      `;
    } else if (state.activeTool === 'hedge' && state.currentHedgePoints && state.currentHedgePoints.length > 0) {
      const pts = state.currentHedgePoints.map(p => `${p[0]},${p[1]}`).join(' ');
      els.interactionLayer.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="#22c55e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${2 * p2m}, ${2 * p2m}" />
        ${state.currentHedgePoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3 * p2m}" fill="#22c55e" stroke="#ffffff" stroke-width="${1 * p2m}"/>`).join('')}
      `;
    } else if (state.activeTool === 'draw_road' && state.currentRoadPoints && state.currentRoadPoints.length > 0) {
      const pts = state.currentRoadPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      els.interactionLayer.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="#94a3b8" stroke-width="${state.activeRoadWidth || 6.0}" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" />
        <polyline points="${pts}" fill="none" stroke="#facc15" stroke-width="${1.2 * p2m}" stroke-dasharray="${3 * p2m}, ${2 * p2m}" />
        ${state.currentRoadPoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${4 * p2m}" fill="#facc15" stroke="#ffffff" stroke-width="${1 * p2m}"/>`).join('')}
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
    const prep = getPreparedSvgForExport(1800, 1200);
    if (prep) {
      const svgBlob = new Blob([prep.svgString], { type: 'image/svg+xml;charset=utf-8' });
      const DOMURL = window.URL || window.webkitURL || window;
      const url = DOMURL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = 1800;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = prep.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        DOMURL.revokeObjectURL(url);

        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 145, 35, pageWidth - 165, pageHeight - 100);
        doc.save(`BIMX_Tsinare_${state.cadastralCode}.pdf`);
      };
      img.onerror = function() {
        console.error('PDF SVG snapshot rasterization fallback');
        doc.save(`BIMX_Tsinare_${state.cadastralCode}.pdf`);
      };
      img.src = url;
    } else {
      doc.save(`BIMX_Tsinare_${state.cadastralCode}.pdf`);
    }
  };

  // --- Helper to prepare self-contained SVG for HD Export ---
  function getPreparedSvgForExport(targetW, targetH) {
    const svgEl = document.getElementById('cadSvgStage');
    if (!svgEl) return null;

    const clone = svgEl.cloneNode(true);
    const container = els.cadSvgContainer || svgEl.parentElement;
    const clientRect = container ? container.getBoundingClientRect() : { width: 1200, height: 800 };
    const clientW = Math.max(300, Math.round(clientRect.width || 1200));
    const clientH = Math.max(200, Math.round(clientRect.height || 800));

    const w = targetW || 2400;
    const h = targetH || 1600;

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('viewBox', `0 0 ${clientW} ${clientH}`);

    // Clear temporary interaction layer from output
    const interLayer = clone.querySelector('#interactionLayer');
    if (interLayer) interLayer.innerHTML = '';

    // Get current wrapper computed styles
    const wrapper = document.getElementById('cadCanvasWrapper') || document.body;
    const comp = window.getComputedStyle(wrapper);

    const varList = [
      '--canvas-bg', '--grid-line', '--grid-major', '--parcel-fill', '--parcel-stroke',
      '--parcel-stroke-width', '--setback-stroke', '--footprint-fill', '--footprint-stroke',
      '--text-color', '--dim-color', '--tree-fill', '--tree-stroke', '--water-fill',
      '--terrace-fill', '--road-fill', '--road-stripe', '--walkway-fill', '--walkway-stroke',
      '--parking-fill'
    ];

    const bgMap = {
      'autocad': '#0b0d12',
      'cadplot': '#ffffff',
      'napr': '#fcfbf7',
      'vellum': '#f6f1e5',
      'topographic': '#f4f6f8',
      'masterplan': '#f8fafc',
      'classic': '#fdfdfd',
      'presentation': '#f1f8f3',
      'sepia': '#f8f3e6',
      'mono': '#e2e8f0',
      'aqua': '#e0f2fe',
      'nordic': '#ffffff',
      'zen': '#f4f0ea',
      'bauhaus': '#faf7ee',
      'sketch': '#f8f6f0',
      'desert': '#faf4eb',
      'concrete': '#1c1f24',
      'emerald': '#03140e',
      'dark': '#05080f',
      'nightglow': '#070b14',
      'satellite': '#091018',
      'blueprint': '#071329'
    };

    const varMap = {};
    let styleRules = ':root, svg { ';
    varList.forEach(v => {
      let val = comp.getPropertyValue(v).trim();
      if (!val) {
        if (v === '--canvas-bg') val = bgMap[state.activeStyle] || '#071329';
        else if (v === '--parcel-fill') val = 'rgba(14, 165, 233, 0.08)';
        else if (v === '--parcel-stroke') val = '#00f0ff';
        else if (v === '--setback-stroke') val = '#f43f5e';
        else if (v === '--footprint-fill') val = 'rgba(14, 165, 233, 0.35)';
        else if (v === '--footprint-stroke') val = '#ffffff';
        else if (v === '--text-color') val = '#38bdf8';
        else if (v === '--dim-color') val = '#f59e0b';
        else if (v === '--tree-fill') val = '#22c55e';
        else if (v === '--water-fill') val = '#38bdf8';
        else if (v === '--terrace-fill') val = '#fcd34d';
        else if (v === '--road-fill') val = '#1e293b';
        else if (v === '--road-stripe') val = '#38bdf8';
        else if (v === '--walkway-fill') val = '#172554';
        else if (v === '--walkway-stroke') val = '#38bdf8';
        else if (v === '--parking-fill') val = '#94a3b8';
        else val = 'transparent';
      }
      varMap[v] = val;
      styleRules += `${v}: ${val}; `;
    });
    styleRules += 'text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; } }';

    let defs = clone.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      clone.insertBefore(defs, clone.firstChild);
    }
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = styleRules;
    defs.appendChild(styleEl);

    const canvasBgColor = varMap['--canvas-bg'] || bgMap[state.activeStyle] || '#071329';
    const gridBg = clone.querySelector('#cadGridBackground');
    if (gridBg) {
      gridBg.setAttribute('fill', canvasBgColor);
    }

    let serialized = new XMLSerializer().serializeToString(clone);
    // Explicitly inline CSS variables in all attributes
    Object.keys(varMap).forEach(v => {
      const reg = new RegExp(`var\\(${v}[^)]*\\)`, 'g');
      serialized = serialized.replace(reg, varMap[v]);
    });

    return {
      svgString: serialized,
      bgColor: canvasBgColor
    };
  }

  // --- High-Res PNG Image Export ---
  window.exportTsinarePng = function () {
    const prep = getPreparedSvgForExport(2400, 1600);
    if (!prep) return;

    const svgBlob = new Blob([prep.svgString], { type: 'image/svg+xml;charset=utf-8' });
    const DOMURL = window.URL || window.webkitURL || window;
    const url = DOMURL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = prep.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      DOMURL.revokeObjectURL(url);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `BIMX_Tsinare_${state.cadastralCode}.png`;
      a.click();
    };
    img.onerror = function (err) {
      console.error('PNG export rendering error, fallback to SVG download:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BIMX_Tsinare_${state.cadastralCode}.svg`;
      a.click();
    };
    img.src = url;
  };

  // --- AutoCAD DXF Export ---
  window.exportTsinareDxf = function () {
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n7\n";
    dxf += "0\nLAYER\n2\nCADASTRAL_BOUNDARY\n70\n0\n62\n1\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nSETBACK_BUFFER\n70\n0\n62\n6\n6\nDASHED\n";
    dxf += "0\nLAYER\n2\nBUILDING_FOOTPRINTS\n70\n0\n62\n4\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nSUBDIVISION_PARCELS\n70\n0\n62\n3\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nTREES_GREENERY\n70\n0\n62\n2\n6\nCONTINUOUS\n";
    dxf += "0\nLAYER\n2\nWATER_BODIES\n70\n0\n62\n5\n6\nCONTINUOUS\n";
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
    (state.roads || []).forEach(r => addPolyline('ROADS', r.points));
    (state.walkways || []).forEach(w => addPolyline('WALKWAYS', w.points));
    (state.bikePaths || []).forEach(b => addPolyline('BIKE_PATHS', b.points));
    (state.hedges || []).forEach(h => addPolyline('HEDGES', h.points));

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

  // Keyboard Shortcuts: Delete, Undo, Tool shortcuts
  function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.target && ['input', 'select', 'textarea'].includes(e.target.tagName.toLowerCase())) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        window.deleteSelectedObject();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        window.undoLastAction();
        return;
      }
      if (e.key === 'Enter') {
        if ((state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon') && state.drawPoints.length >= 3) {
          e.preventDefault();
          finishDrawnFootprint();
          return;
        }
      }
      if (e.key === ' ' || e.key.toLowerCase() === 'v') setCadActiveTool('pan');
      if (e.key.toLowerCase() === 'p') setCadActiveTool('parking');
      if (e.key.toLowerCase() === 'e') setCadActiveTool('delete');
      if (e.key.toLowerCase() === 's') setCadActiveTool('split');
      if (e.key.toLowerCase() === 'b') activateFootprintStamp();
      if (e.key.toLowerCase() === 't') setCadActiveTool('tree');
      if (e.key.toLowerCase() === 'w') setCadActiveTool('water');
      if (e.key.toLowerCase() === 'k') setCadActiveTool('walkway');
      if (e.key.toLowerCase() === 'g') setCadActiveTool('draw_road');
      if (e.key.toLowerCase() === 'r') setCadActiveTool('ruler');
      if (e.key === 'Escape') {
        state.drawPoints = [];
        setCadActiveTool('pan');
      }
    });
  }

})();
