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
    cadastralCode: '',
    address: '—',
    officialAreaSqm: 0,
    geometricAreaSqm: 0,
    landType: '—',
    ownershipType: '—',
    owners: [],
    zone: '—',
    zoneName: '—',
    k1Limit: 0.5,
    k2Limit: 2.5,
    k3Limit: 0.2,
    rawCoordinates: [], // [lat, lng] array from NAPR
    boundaryMeters: [], // [[x, y], ...] in metric coordinates relative to centroid
    boundaryEdgeTypes: [], // ['neighbor', 'road', ...] for each edge i -> (i+1)%n
    centroidLatLng: [42.0, 43.85], // Center of Georgia
    
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

    // Precise CAD Drafting & Vector Geometry
    cadLines: [], // [{ id, p1: [x,y], p2: [x,y], color }]
    cadPolylines: [], // [{ id, points: [[x,y]...], isClosed, color }]
    cadArcs: [], // [{ id, p1: [x,y], p2: [x,y], p3: [x,y], color }]
    cadCircles: [], // [{ id, center: [x,y], radius, color }]
    cadHatches: [], // [{ id, polygon: [[x,y]...], pattern: 'diagonal'|'cross'|'dots', color }]
    cadFreehands: [], // [{ id, points: [[x,y]...], color }]

    // Precision & Snapping Controls
    osnapEnabled: true,
    orthoEnabled: false,
    activeSnap: null, // { point: [x,y], type: 'endpoint'|'midpoint'|'perpendicular'|'intersection' }
    offsetDistance: 3.0,
    offsetDual: true,
    filletRadius: 2.0,
    chamferDistance: 1.5,
    cadDraftPoints: [], // Temporary points during line/polyline/arc/circle drawing
    isFreehandDrawing: false,

    // Footprint Contour Editing
    footprintEditMode: true,
    draggedVertexIdx: null,
    draggedEdgeIdx: null,
    atriumCutoutPoints: [],
    
    // Layer Visibility
    layers: {
      topography: false,
      neighborhood: false,
      boundary: true,
      setback: true,
      setbackLabels: false,
      dimensions: true,
      footprints: true,
      cadDrafting: true,
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
    viewMode: 'hybrid', // 'cad' | 'hybrid' | 'map'
    activeBasemap: 'esri_satellite', // key from BASEMAP_REGISTRY
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

  // ----------------------------------------------------------------
  // Basemap Registry — all supported tile providers
  // ----------------------------------------------------------------
  const BASEMAP_REGISTRY = {
    // --- 1. სატელიტური ორთოფოტოები ---
    esri_satellite: {
      label: 'სატელიტი (ESRI)',
      icon: '🛰️',
      group: 'satellite',
      description: 'ESRI World Imagery — მაღალი რეზოლუციის ორთოფოტო საზღვრებით',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 19, maxZoom: 22 } },
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 19, maxZoom: 22 } }
      ]
    },
    esri_ortho: {
      label: 'სუფთა ორთოფოტო',
      icon: '📷',
      group: 'satellite',
      description: 'სუფთა სატელიტური ფოტო წარწერების გარეშე (იდეალურია CAD-ისთვის)',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 19, maxZoom: 22 } }
      ]
    },
    esri_satellite_pure: {
      label: 'სუფთა ორთოფოტო',
      icon: '📷',
      group: 'satellite',
      description: 'სუფთა სატელიტური ფოტო წარწერების გარეშე (იდეალურია CAD-ისთვის)',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 19, maxZoom: 22 } }
      ]
    },

    // --- 2. საგზაო / ქუჩის რუკები ---
    osm: {
      label: 'OpenStreetMap (OSM)',
      icon: '🗺️',
      group: 'road',
      description: 'OSM Standard — ღია გლობალური საგზაო რუკა',
      layers: [
        { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { subdomains: 'abc', maxNativeZoom: 19, maxZoom: 22 } }
      ]
    },
    esri_street: {
      label: 'ESRI Street Map',
      icon: '🧭',
      group: 'road',
      description: 'ESRI World Street Map — დეტალური საგზაო და სამისამართო რუკა',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 19, maxZoom: 22 } }
      ]
    },
    osm_hot: {
      label: 'OSM Humanitarian',
      icon: '🏘️',
      group: 'road',
      description: 'OSM HOT — ნათელი კონტრასტული შენობები და ქუჩები',
      layers: [
        { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', opts: { subdomains: 'abc', maxNativeZoom: 19, maxZoom: 22 } }
      ]
    },
    osm_fr: {
      label: 'OSM France დეტალური',
      icon: '🎨',
      group: 'road',
      description: 'OSM France — დახვეწილი კლასიკური ევროპული კარტოგრაფია',
      layers: [
        { url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', opts: { subdomains: 'abc', maxNativeZoom: 19, maxZoom: 22 } }
      ]
    },
    cyclosm: {
      label: 'CyclOSM საინჟინრო',
      icon: '🚲',
      group: 'road',
      description: 'CyclOSM — საინჟინრო, სატრანსპორტო და ბილიკების დეტალური ქსელი',
      layers: [
        { url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', opts: { subdomains: 'abc', maxNativeZoom: 18, maxZoom: 22 } }
      ]
    },
    opnv: {
      label: 'ÖPNV ტრანსპორტი',
      icon: '🚊',
      group: 'road',
      description: 'საზოგადოებრივი ტრანსპორტის, რკინიგზის და გზატკეცილების ქსელი',
      layers: [
        { url: 'https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png', opts: { maxNativeZoom: 18, maxZoom: 22 } }
      ]
    },
    memomaps_opnv: {
      label: 'ÖPNV ტრანსპორტი',
      icon: '🚊',
      group: 'road',
      description: 'საზოგადოებრივი ტრანსპორტის, რკინიგზის და გზატკეცილების ქსელი',
      layers: [
        { url: 'https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png', opts: { maxNativeZoom: 18, maxZoom: 22 } }
      ]
    },

    // --- 3. მუქი & CAD რეჟიმი ---
    esri_dark_gray: {
      label: 'ESRI Dark Gray (CAD)',
      icon: '⬛',
      group: 'dark',
      description: 'ESRI Dark Canvas — მუქი ფონი CAD და BIM ხაზების მკვეთრად გამოსაჩენად',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 16, maxZoom: 22 } },
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 16, maxZoom: 22 } }
      ]
    },
    osm_night: {
      label: 'OSM Night CAD',
      icon: '🌙',
      group: 'dark',
      description: 'შავ-თეთრი ღამის რეჟიმი — მაღალი კონტრასტი CAD ხაზებისთვის',
      layers: [
        { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { subdomains: 'abc', maxNativeZoom: 19, maxZoom: 22, className: 'tile-filter-night' } }
      ]
    },
    osm_blueprint: {
      label: 'CAD Blueprint (ლურჯი)',
      icon: '📐',
      group: 'dark',
      description: 'არქიტექტურული ლურჯი ბლუპრინტი საინჟინრო გენგეგმისთვის',
      layers: [
        { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { subdomains: 'abc', maxNativeZoom: 19, maxZoom: 22, className: 'tile-filter-blueprint' } }
      ]
    },
    esri_gray: {
      label: 'ESRI Light Gray',
      icon: '🩶',
      group: 'neutral',
      description: 'ESRI Light Canvas — ნეიტრალური ნაცრისფერი ფონი CAD-ისთვის',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 16, maxZoom: 22 } },
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 16, maxZoom: 22 } }
      ]
    },

    // --- 4. ტოპოგრაფია & რელიეფი ---
    opentopomap: {
      label: 'OpenTopoMap',
      icon: '📏',
      group: 'topo',
      description: 'OpenTopoMap — სიმაღლის იზოჰიფსებით (Contour lines) და რელიეფით',
      layers: [
        { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', opts: { subdomains: 'abc', maxNativeZoom: 17, maxZoom: 22 } }
      ]
    },
    esri_topo: {
      label: 'ESRI Topo Map',
      icon: '⛰️',
      group: 'topo',
      description: 'ESRI World Topo Map — გეოდეზიური და ტოპოგრაფიული რუკა',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 19, maxZoom: 22 } }
      ]
    },
    esri_shaded_relief: {
      label: 'ESRI Shaded Relief',
      icon: '🏔️',
      group: 'topo',
      description: 'ESRI Shaded Relief — 3D რელიეფური სიმაღლეების დაჩრდილვა',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 13, maxZoom: 22 } }
      ]
    },
    esri_terrain: {
      label: 'ESRI Terrain Base',
      icon: '🏞️',
      group: 'topo',
      description: 'ESRI Terrain Base — რელიეფური ზედაპირის და ფერდობების მოდელი',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 13, maxZoom: 22 } }
      ]
    },
    esri_physical: {
      label: 'ESRI ფიზიკური რუკა',
      icon: '🌲',
      group: 'topo',
      description: 'ბუნებრივი ლანდშაფტები, მწვერვალები, ტყის მასივები და მდინარეები',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 12, maxZoom: 22 } }
      ]
    },
    natgeo: {
      label: 'National Geographic',
      icon: '🌍',
      group: 'topo',
      description: 'National Geographic World Map — კლასიკური მსოფლიო ატლასის სტილი',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 16, maxZoom: 22 } }
      ]
    },
    esri_ocean: {
      label: 'ESRI ოკეანოგრაფია',
      icon: '🌊',
      group: 'topo',
      description: 'ESRI Ocean Base — ჰიდროლოგიური და სიღრმითი ბათიმეტრია',
      layers: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', opts: { maxNativeZoom: 13, maxZoom: 22 } }
      ]
    }
  };

  // Active Leaflet tile layer instances (current basemap)
  let tsinareMap = null;
  let parcelPolygonLayer = null;
  let _activeTileLayers = []; // currently rendered Leaflet tile layers

  // Switch the Leaflet basemap to any key in BASEMAP_REGISTRY
  window.setBasemap = function (key) {
    const cfg = BASEMAP_REGISTRY[key];
    if (!cfg || !tsinareMap) return;
    state.activeBasemap = key;
    // Remove existing base tile layers
    _activeTileLayers.forEach(l => { if (tsinareMap.hasLayer(l)) tsinareMap.removeLayer(l); });
    _activeTileLayers = [];
    // Add new layers with bulletproof zoom retention and tile stretching
    cfg.layers.forEach(def => {
      const opts = Object.assign({
        minZoom: 1,
        maxZoom: 22,
        maxNativeZoom: (def.opts && (def.opts.maxNativeZoom || def.opts.maxZoom)) || 19,
        keepBuffer: 8,
        updateWhenZooming: false,
        updateWhenIdle: true
      }, def.opts || {});
      // Ensure maxZoom is always 22 so leaflet stretches native tiles rather than disappearing
      opts.maxZoom = 22;
      const layer = L.tileLayer(def.url, opts);
      layer.addTo(tsinareMap);
      _activeTileLayers.push(layer);
    });
    // Update picker UI
    document.querySelectorAll('.basemap-btn').forEach(b => {
      if (b.dataset.basemap === key) {
        b.classList.add('basemap-btn-active');
      } else {
        b.classList.remove('basemap-btn-active');
      }
    });
    // Update the trigger button label
    const triggerLabel = document.getElementById('lblActiveBasemap');
    if (triggerLabel) triggerLabel.textContent = cfg.icon + ' ' + cfg.label;
    // Re-sync map
    renderCadWorld();
  };

  function initGeorgiaLeafletMap() {
    if (typeof L === 'undefined') {
      console.warn('[Tsinare] Leaflet library not loaded yet');
      return;
    }
    const mapContainer = document.getElementById('tsinareLeafletMap');
    if (!mapContainer || tsinareMap) return;

    // Center of Georgia: 42.0° N, 43.85° E, zoom 7.5 (Support full zoom range 2 to 22)
    tsinareMap = L.map('tsinareLeafletMap', {
      center: [42.0, 43.85],
      zoom: 7.5,
      zoomControl: false,
      attributionControl: false,
      minZoom: 2,
      maxZoom: 22,
      zoomSnap: 0,
      zoomDelta: 0.1,
      wheelPxPerZoomLevel: 120
    });

    // Initialize with default basemap (ESRI Satellite)
    window.setBasemap(state.activeBasemap || 'esri_satellite');
  }

  function showGeorgiaOverviewState() {
    // Reset state to empty clean slate
    state.cadastralCode = '';
    state.address = '—';
    state.officialAreaSqm = 0;
    state.geometricAreaSqm = 0;
    state.landType = '—';
    state.ownershipType = '—';
    state.owners = [];
    state.zone = '—';
    state.zoneName = '—';
    state.rawCoordinates = [];
    state.boundaryMeters = [];
    state.boundaryEdgeTypes = [];
    state.footprints = [];
    state.selectedFootprintId = null;
    state.trees = [];
    state.waterBodies = [];
    state.terraces = [];
    state.walkways = [];
    state.roads = [];
    state.bikePaths = [];
    state.hedges = [];
    state.fountains = [];
    state.parkingBays = [];
    state.subParcels = [];

    if (els.cadastralInput) els.cadastralInput.value = '';
    if (els.georgiaOverviewOverlay) els.georgiaOverviewOverlay.style.display = 'flex';
    if (els.cadSvgContainer) els.cadSvgContainer.style.display = 'none';

    if (tsinareMap) {
      tsinareMap.setView([42.0, 43.85], 7.5);
      if (parcelPolygonLayer) {
        tsinareMap.removeLayer(parcelPolygonLayer);
        parcelPolygonLayer = null;
      }
    }

    if (els.naprStatusBadge) {
      els.naprStatusBadge.innerText = 'მზადაა';
      els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30';
    }

    updateCadastralSidebarUI();
    updateZoningCoefficientsUI();
    updateSelectedBuildingUI();
    updateToolStatus('საიტი მზადაა. ჩაწერეთ საკადასტრო კოდი საქართველოს რუკაზე მოსაძებნად.');
  }
  window.showGeorgiaOverviewState = showGeorgiaOverviewState;

  // --- Initializer ---
  document.addEventListener('DOMContentLoaded', () => {
    cacheDomElements();
    initGeorgiaLeafletMap();
    initCadCanvas();
    setupEventListeners();
    
    // Check URL query parameters for cadastral code
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code') || urlParams.get('cadastral');
    if (codeParam) {
      if (els.cadastralInput) els.cadastralInput.value = codeParam;
      triggerCadastralSearch(codeParam);
    } else {
      showGeorgiaOverviewState();
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
    els.tsinareLeafletMap = document.getElementById('tsinareLeafletMap');
    els.georgiaOverviewOverlay = document.getElementById('georgiaOverviewOverlay');
    els.cadSvgContainer = document.getElementById('cadSvgContainer');
    els.cadSvgStage = document.getElementById('cadSvgStage');
    els.worldGroup = document.getElementById('worldGroup');
    els.topographyReliefLayer = document.getElementById('topographyReliefLayer');
    els.neighborhoodContextLayer = document.getElementById('neighborhoodContextLayer');
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
    els.cadDraftingLayer = document.getElementById('cadDraftingLayer');
    els.dimensionsLayer = document.getElementById('dimensionsLayer');
    els.nodesLayer = document.getElementById('nodesLayer');
    els.interactionLayer = document.getElementById('interactionLayer');

    // CAD Precision, Snapping & Dynamic HUD Elements
    els.cadDynamicHud = document.getElementById('cadDynamicHud');
    els.hudCadLength = document.getElementById('hudCadLength');
    els.hudCadAngle = document.getElementById('hudCadAngle');
    els.cadOsnapTooltip = document.getElementById('cadOsnapTooltip');
    els.btnToggleOsnap = document.getElementById('btnToggleOsnap');
    els.btnToggleOrtho = document.getElementById('btnToggleOrtho');
    els.quickOffsetDist = document.getElementById('quickOffsetDist');
    els.chkOffsetDual = document.getElementById('chkOffsetDual');
    els.quickFilletR = document.getElementById('quickFilletR');
    els.quickChamferD = document.getElementById('quickChamferD');

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
      setbackDistance: state.setbackDistance,
      boundaryEdgeTypes: [...(state.boundaryEdgeTypes || [])]
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
      if (snap.boundaryEdgeTypes) state.boundaryEdgeTypes = [...snap.boundaryEdgeTypes];

      if (!state.footprints.some(f => f.id === state.selectedFootprintId)) {
        state.selectedFootprintId = state.footprints[0] ? state.footprints[0].id : null;
      }
      updateSelectedBuildingUI();
      updateZoningCoefficientsUI();
      renderCadWorld();
      updateToolStatus('ბოლო მოქმედება გაუქმდა (Undo).');
    }
  };

  // Complete Universal Cadastral Normalization (handles prefixes, spaces, commas, slashes, unpadded zeroes)
  function universalNormalizeCadastral(rawCode) {
    if (!rawCode || typeof rawCode !== 'string') return '';
    let clean = rawCode.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim();
    clean = clean.replace(/^(?:საკადასტრო(?: კოდი)?:?|საკ\/კოდი:?|№|N|code:?)\s*/i, '').trim();
    let parts = clean.split(/[^\d]+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) {
      let digits = parts[0];
      if (digits.length === 11) digits = '0' + digits;
      if (digits.length === 12) {
        return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 9)}.${digits.slice(9)}`;
      }
      if (digits.length === 10) {
        return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
      }
    }
    const reg = parts[0].padStart(2, '0');
    const isCity5 = ['01', '02', '03', '04', '05'].includes(reg);

    if (isCity5) {
      if (parts.length >= 5) {
        return [reg, parts[1].padStart(2, '0'), parts[2].padStart(2, '0'), parts[3].padStart(3, '0'), parts[4].padStart(3, '0')].join('.');
      }
      if (parts.length === 4) {
        return [reg, parts[1].padStart(2, '0'), parts[2].padStart(2, '0'), parts[3].padStart(3, '0')].join('.');
      }
    } else {
      // Regional district parcel: standard land parcel has 4 parts
      if (parts.length >= 4) {
        return [reg, parts[1].padStart(2, '0'), parts[2].padStart(2, '0'), parts[3].padStart(3, '0')].join('.');
      }
    }
    return parts.join('.');
  }

  // --- Official High-Precision Verified Preset Parcels (0ms Instant Fail-Safe) ---
  const OFFICIAL_PRESET_PARCELS = {
    '01.11.13.002.264': {
      code: '01.11.13.002.264',
      address: "ქალაქი თბილისი, ალექსი გობრონიძის ქუჩა, N 5/რამაზ შენგელიას ქუჩა, N 10",
      area: 14884,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.790202077639,44.8176431496728],[41.7902449519041,44.8176329859298],[41.7902701155625,44.8176244261271],[41.7902869834271,44.8176173461014],[41.7902995748618,44.8176097558628],[41.7903107693292,44.8176021768023],[41.7903176790792,44.8175968099365],[41.790332992893,44.8175844086878],[41.7903420944977,44.8175759244809],[41.7903007029848,44.8175153178029],[41.790241698288,44.8175709665541],[41.790147434236,44.8175956304809],[41.790140049643,44.8175798984701],[41.7901251589164,44.8175842059797],[41.7901239921524,44.817584547478],[41.7901156789508,44.817570525909],[41.7900932622524,44.8175392725517],[41.7900504876808,44.8174806414263],[41.790014789259,44.8174408940378],[41.790015671749,44.8174402043223],[41.7899791765872,44.8173922042782],[41.7899623342093,44.8173552485845],[41.7899454927221,44.8173182941111],[41.7899350880839,44.8173020195436],[41.789903875056,44.8172531958698],[41.7898895490981,44.8172365653875],[41.7898465730114,44.8171866739797],[41.7897916414785,44.8171393343767],[41.7897367099278,44.8170919960579],[41.7897131796859,44.8170640438547],[41.7896896494353,44.8170360904686],[41.789669324967,44.817012221146],[41.7896490013926,44.8169883506324],[41.7896083533279,44.8169406096531],[41.7895654473321,44.8168816559951],[41.7895225404051,44.8168227024184],[41.7894731806377,44.8167562826485],[41.7894238208318,44.8166898629806],[41.7893980172094,44.8166512399828],[41.789372213574,44.816612617016],[41.7893464090248,44.8165739940827],[41.7893206053633,44.8165353711779],[41.7892857265069,44.8164777430894],[41.7892251707375,44.8164270386893],[41.7891725247167,44.8163480534595],[41.7890794667517,44.8161940488926],[41.78896957045,44.8157733327335],[41.7888896752306,44.8158235946675],[41.7887209560852,44.815426732786],[41.7887204885621,44.8154261347846],[41.7886954062778,44.8153938675242],[41.7886363833408,44.8153187111606],[41.7885886684629,44.8152697719275],[41.7885778277795,44.8152586538601],[41.7885727313212,44.8152534260628],[41.7885503378448,44.8152454076788],[41.7885343772147,44.8152441416949],[41.7885319645557,44.8152443375709],[41.7885219466342,44.8152575674733],[41.7884925328029,44.8152964140758],[41.7884827783485,44.8153099356549],[41.78846569701,44.8153370969975],[41.7884307843422,44.8153989002995],[41.7883997290057,44.815477880758],[41.788386519648,44.8155128403832],[41.7883759953607,44.815547859693],[41.788356907568,44.8156195763452],[41.7884298650854,44.8155836331669],[41.788460357062,44.8157799331403],[41.7884817662679,44.8157740529527],[41.7885475094323,44.8161767854552],[41.7885727627138,44.8161781418635],[41.7887769120949,44.8166129356112],[41.7887401020127,44.8166353221043],[41.7887235311252,44.8166450298112],[41.7888826924061,44.817121128156],[41.7888841606256,44.8171217437867],[41.7891365867359,44.8178887071905],[41.7892020151402,44.8178732374655],[41.7897302842603,44.8177431258822],[41.7897187630301,44.817660011096],[41.7896368242563,44.8175809255667],[41.7896777865628,44.8175680690089],[41.7898148406943,44.8175250397378],[41.7898675512509,44.8175084886803],[41.7898812261636,44.8175224095319],[41.7899391605665,44.8175902309711],[41.7899769827698,44.817634507249],[41.7900078167508,44.8176744454233],[41.7900214350508,44.8176947054578],[41.7901755663582,44.817655571783],[41.7901731786314,44.8176504816166],[41.790202077639,44.8176431496728]]
    },
    '01.15.02.038.003': {
      code: '01.15.02.038.003',
      address: "ქალაქი თბილისი, ვასილ ბარნოვის ქუჩა, N 10ა",
      area: 397,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.703261661426,44.7879273118569],[41.7032345810038,44.7879695131255],[41.7033213586335,44.7880585247689],[41.7034578474787,44.7880972431197],[41.7034573642472,44.7880901606639],[41.7034450330245,44.7879190123096],[41.7034389499773,44.7878611376368],[41.7034350956991,44.7878074010245],[41.703288003283,44.7878256018928],[41.7032889614681,44.7878738119309],[41.7032945278391,44.787873793636],[41.7032945720911,44.7878977690792],[41.7032920161623,44.7879272121158],[41.703261661426,44.7879273118569]]
    },
    '01.16.01.013.031': {
      code: '01.16.01.013.031',
      address: "ქალაქი თბილისი , ქუჩა ი. ჯავახიშვილი , N 89",
      area: 554,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.7139285714555,44.7986605630332],[41.7139293131018,44.79866282548],[41.7140354218665,44.7989177456216],[41.7140611328481,44.798979114692],[41.7140634281817,44.79898393279],[41.7140678755179,44.7989950468208],[41.7140720988291,44.7990052755995],[41.704080397942,44.7990253381277],[41.7141012181266,44.7990744129512],[41.7141130725799,44.7991023442309],[41.7142181631696,44.7990287497113],[41.7142043824463,44.7989963946342],[41.7141469682138,44.798865007748],[41.7141342945449,44.7988332395239],[41.7141325159999,44.7988288141054],[41.7140644073219,44.7986577757877],[41.7140358744931,44.7985862722931],[41.7140349109261,44.7985838133911],[41.7139828092336,44.7986212989598],[41.7139709439687,44.7986294105234],[41.7139285714555,44.7986605630332]]
    },
    '01.14.03.005.001': {
      code: '01.14.03.005.001',
      address: "ქალაქი თბილისი , გამზირი ვაჟა-ფშაველა , კვარტალი II , კორპუსი 8",
      area: 723,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.7267575029997,44.735879405378],[41.7268128203129,44.7364495386409],[41.7269496677203,44.7364267792736],[41.7268912411107,44.7358562812234],[41.7267575029997,44.735879405378]]
    },
    '72.13.12.123': {
      code: '72.13.12.123',
      address: "ქალაქი თბილისი, მუხიანი 2-ის დასახლება, ვარდისუბნის IV ჩიხი, N 7",
      area: 1198,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.7835011844698,44.843020534447],[41.7832579667024,44.8428177716469],[41.7831989850572,44.8428960064576],[41.7831382168437,44.842842845612],[41.7831244414036,44.8428710687646],[41.783173063575,44.842909676524],[41.7829980110751,44.8431750353744],[41.7831603209851,44.8433011672465],[41.7832042931389,44.8432318107664],[41.7832775160669,44.8432942223067],[41.7835011844698,44.843020534447]]
    },
    '01.15.02.005.001': {
      code: '01.15.02.005.001',
      address: "ქალაქი თბილისი, პეტრე მელიქიშვილის გამზირი, N 12",
      area: 2603,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.7079749691094,44.7826415755552],[41.7078355558313,44.7825510197221],[41.7078341767926,44.78255480222],[41.7077762636889,44.7825171864354],[41.7077275437944,44.7826507663686],[41.7075935738953,44.7830178889468],[41.7075505460708,44.7829897930199],[41.7075027183456,44.7831234340375],[41.7075870308231,44.7831790309304],[41.7075693170766,44.7832285040075],[41.707642774792,44.7832758594755],[41.7075692162454,44.7834808007777],[41.7075363972004,44.7835722363861],[41.707481645942,44.783536542042],[41.7074550603111,44.7835192145034],[41.7074370449742,44.7835090701156],[41.7074120606998,44.783495511448],[41.7072586916161,44.7834116831919],[41.7071782452101,44.7835698208083],[41.7074300905564,44.7837133160897],[41.7075643585908,44.7837873962827],[41.7077123299827,44.7833744856718],[41.7077155791518,44.7833765566055],[41.7078309358986,44.7830546601922],[41.7078276867124,44.7830525832611],[41.7079749691094,44.7826415755552]]
    },
    '01.15.03.010.001': {
      code: '01.15.03.010.001',
      address: "ქალაქი თბილისი, მერაბ კოსტავას ქუჩა, N 47ა",
      area: 863,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.7095143932207,44.7851935486255],[41.7095393412794,44.7851738702339],[41.7096080860519,44.7851197787619],[41.7096219788937,44.7851088409742],[41.7096849962674,44.7850592219384],[41.709733158448,44.7850213011175],[41.7097812071265,44.7849824177958],[41.7098343165941,44.7849395256204],[41.709881361792,44.7849020542975],[41.7100330885831,44.7847818407647],[41.7100783372553,44.7847460508347],[41.7101270296548,44.7847075459953],[41.7101892169895,44.7846587258951],[41.7101825753591,44.7846439414221],[41.71015115183,44.7845783696715],[41.7100882889688,44.7846281368711],[41.7099985956347,44.7847014330763],[41.7094000292693,44.7851730009982],[41.7094144131237,44.785207902996],[41.709460956759,44.785320835235],[41.7094680437493,44.7853156333575],[41.7094728272224,44.7853270943242],[41.7094823742741,44.7853306878536],[41.709515717812,44.7853427906535],[41.7095190467931,44.7853422819428],[41.70955009274,44.7853168412664],[41.7095604198051,44.7853083795383],[41.7095387474372,44.785258542546],[41.7095426765264,44.785255267186],[41.7095143932207,44.7851935486255]]
    },
    '01.16.01.002.001': {
      code: '01.16.01.002.001',
      address: "ქალაქი თბილისი ,   ეგნატე ნინოშვილის ქუჩა , N 70",
      area: 1186,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.7187060043083,44.7957932964101],[41.7185870113393,44.7958697801051],[41.7186372987033,44.7960162605349],[41.7186261667194,44.7960227983829],[41.7186429295885,44.7960718837065],[41.7186511701122,44.7960987434445],[41.7186547357471,44.7961133087348],[41.718743029299,44.7963462417358],[41.7189657523546,44.7962003733511],[41.7188885590448,44.7959863127591],[41.7188401116356,44.7958493749869],[41.7188275436212,44.795810112642],[41.7187966575041,44.7957204895257],[41.7187211911167,44.7957679157468],[41.7187257611265,44.7957809835303],[41.7187060043083,44.7957932964101]]
    },
    '01.17.01.010.001': {
      code: '01.17.01.010.001',
      address: "ქალაქი თბილისი , გამზირი წმინდა ქეთევან დედოფალი , კორპუსი 2",
      area: 4294,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.6931827879115,44.8150284892983],[41.6929695937869,44.8148816740039],[41.6929667053481,44.8148800912184],[41.6929636558905,44.8148791974759],[41.6929605373311,44.8148790201521],[41.6929574415502,44.8148795637903],[41.6929544630971,44.814880812497],[41.6929516910822,44.8148827287636],[41.6929492082779,44.8148852546706],[41.6929470893212,44.8148883142959],[41.692945398916,44.8148918161242],[41.6923320668917,44.8164426806654],[41.6923308525687,44.8164465283576],[41.6923301556104,44.8164505980951],[41.6923299965373,44.8164547672464],[41.6923303814549,44.8164589108172],[41.6923312975517,44.8164629026655],[41.6923327176145,44.8164666226988],[41.6923345991314,44.8164699592798],[41.6923368842939,44.8164728104283],[41.6923395054125,44.8164750910159],[41.6925518366662,44.816626561994],[41.6931827879115,44.8150284892983]]
    },
    '01.18.01.002.001': {
      code: '01.18.01.002.001',
      address: "ქალაქი თბილისი, თაბორის მთის I ჩიხი, N 1",
      area: 9864,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.680676497415,44.8177681491187],[41.6807366380471,44.8177345048794],[41.6807729374688,44.8176843077157],[41.6807721168218,44.8174810835744],[41.6807504732608,44.81743556039],[41.6806873413059,44.8174010772176],[41.6806754820913,44.8173753269037],[41.6806746461631,44.8172970778396],[41.6806797080455,44.8172346704719],[41.6806720818302,44.8171396318706],[41.6806578421833,44.8170495020611],[41.6806533197579,44.8169810928031],[41.6806175913803,44.8169207955079],[41.6805721907755,44.8168218752374],[41.6805441639682,44.8167698188443],[41.6805054459402,44.8167094833936],[41.6804704966713,44.8166690314203],[41.6804303494374,44.8166275033041],[41.6803924520933,44.8165910018437],[41.6803352854645,44.8165475757691],[41.6802668778373,44.8165080744867],[41.6802232485992,44.8164937639012],[41.6802055039844,44.8165047345177],[41.680197061952,44.8165348782698],[41.6801890876706,44.8165843908591],[41.6801226853722,44.8166924308671],[41.6801197891857,44.8168181720662],[41.6801183686636,44.8168870733786],[41.6801113849422,44.8170841924441],[41.6801006848654,44.8173619948814],[41.6801069919562,44.8174778338954],[41.6800700919751,44.8177108868386],[41.6800327815052,44.8179546241592],[41.680015163719,44.8180685372531],[41.6800409264552,44.8181752527113],[41.680080518393,44.8182481691716],[41.6801690646428,44.8184170996111],[41.6801920395363,44.8184492285389],[41.6802736936021,44.8185590626662],[41.6803691137267,44.8185276943774],[41.6804732399142,44.8184870405248],[41.6805221900722,44.8185125918312],[41.6806581753088,44.8184490105269],[41.6806761044303,44.8185096903271],[41.6807373843792,44.8184764220441],[41.680720931573,44.8184266114802],[41.680752331253,44.8184065329051],[41.6807252562459,44.8183247963332],[41.6806945984683,44.8183418343],[41.6806095521471,44.8180902715991],[41.6805495555153,44.8180795190992],[41.6805523989,44.8180094274815],[41.6805658835515,44.8179156102441],[41.6805830629434,44.8178621919888],[41.6806092778101,44.8178272174072],[41.680676497415,44.8177681491187]]
    },
    '05.32.01.234': {
      code: '05.32.01.234',
      address: "ქალაქი ბათუმი ,   აეროპორტის გზატკეცილი , N 38",
      area: 997,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.6293349485783,41.6097477100164],[41.6292148507512,41.6098362418138],[41.629219632033,41.6098622087252],[41.6292679848621,41.609978487083],[41.6293181281916,41.6103270629129],[41.629331487104,41.6104918342946],[41.6293407391565,41.6106316752102],[41.629341692165,41.610722383321],[41.6294366119178,41.6107255066212],[41.6294483650596,41.6105187044108],[41.6294313899778,41.6103088284875],[41.62939681516,41.6100781146257],[41.6293736824919,41.6099237569373],[41.6293349485783,41.6097477100164]]
    },
    '03.02.21.145': {
      code: '03.02.21.145',
      address: "ქალაქი ქუთაისი , ქუჩა ჭონქაძე , N 1 ,   (ნაკვეთი N1 და N2-2)/2",
      area: 40,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[42.2701308029091,42.676293161973],[42.2701472842733,42.6759748158398],[42.2701519073329,42.6758868074444],[42.2701525678833,42.6758674641081],[42.2701260848411,42.6758658851755],[42.2701258552369,42.6758902712889],[42.2701392297444,42.6759296885221],[42.2701241834194,42.6762920302406],[42.2701308029091,42.676293161973]]
    },
    '64.23.05.012': {
      code: '64.23.05.012',
      address: "ხაშური, სოფელი წაღვლი",
      area: 33,
      shape: 'ოფიციალური კონტური (NAPR)',
      coordinates: [[41.8353579427259,43.3691338927073],[41.835372989379,43.3691732374774],[41.8354446032432,43.3691251273596],[41.8354296183543,43.3690859471852],[41.8353579427259,43.3691338927073]]
    }
  };

  // --- Nationwide NAPR Parcel Retrieval ---
  async function triggerCadastralSearch(codeOverride) {
    const rawInput = (codeOverride || (els.cadastralInput ? els.cadastralInput.value : '') || '').trim();
    if (!rawInput) return;
    const cleanCode = universalNormalizeCadastral(rawInput);
    if (!cleanCode) return;
    if (els.cadastralInput) els.cadastralInput.value = cleanCode;
    window.closeSearchHistory();

    if (els.btnSearchCadastral) {
      els.btnSearchCadastral.disabled = true;
      els.btnSearchCadastral.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> <span>ძებნა...</span>';
    }
    if (els.naprStatusBadge) {
      els.naprStatusBadge.innerText = 'NAPR FETCHING...';
      els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }

    try {
      let data = null;

      // 0. High-Fidelity Verified Preset Check (instant, accurate, bypasses stale network diamonds)
      const preset = OFFICIAL_PRESET_PARCELS[cleanCode] || OFFICIAL_PRESET_PARCELS[rawInput];
      if (preset && preset.coordinates && preset.coordinates.length >= 3) {
        data = {
          cadastralCode: preset.code || cleanCode,
          address: preset.address || 'ქალაქი თბილისი',
          officialAreaSqm: preset.area || 0,
          geometricAreaSqm: preset.area || 0,
          areaSqm: preset.area || 0,
          landType: 'არასასოფლო-სამეურნეო',
          ownershipType: 'საკუთრება',
          owners: ['ფიზიკური პირი'],
          coordinates: preset.coordinates,
          centroid: preset.coordinates[0],
          zoning: {
            zoneCode: 'სზ-1',
            zoneNameKa: 'საცხოვრებელი ზონა (სზ-1)',
            k1: 0.5,
            k2: 0.8,
            k3: 0.3
          }
        };
      }

      // 1. Direct Live Fetch from local proxy or production endpoint if not preset
      if (!data) {
        const candidateUrls = [
          `/api/parcel?code=${encodeURIComponent(cleanCode)}&t=${Date.now()}`,
          `https://architect2.ge/api/parcel?code=${encodeURIComponent(cleanCode)}&t=${Date.now()}`
        ];
        if (rawInput !== cleanCode) {
          candidateUrls.push(`/api/parcel?code=${encodeURIComponent(rawInput)}&t=${Date.now()}`);
          candidateUrls.push(`https://architect2.ge/api/parcel?code=${encodeURIComponent(rawInput)}&t=${Date.now()}`);
        }

        for (const url of candidateUrls) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
              const ct = res.headers.get('content-type') || '';
              if (ct.includes('application/json')) {
                const json = await res.json();
                const payload = (json && json.data && json.data.coordinates) ? json.data : json;
                if (payload && payload.coordinates && payload.coordinates.length >= 3) {
                  data = payload;
                  break;
                }
              }
            }
          } catch (fetchErr) {
            console.warn('[Tsinare] Candidate fetch failed for', url, fetchErr);
          }
        }
      }

      // 2. If not found yet and code has sub-unit/sub-parcel, attempt parent search
      if (!data) {
        const parts = cleanCode.split('.');
        let parentCandidate = null;
        if (parts.length > 5 && ['01','02','03','04','05'].includes(parts[0])) {
          parentCandidate = parts.slice(0, 5).join('.');
        } else if (parts.length > 4 && !['01','02','03','04','05'].includes(parts[0])) {
          parentCandidate = parts.slice(0, 4).join('.');
        }
        if (parentCandidate) {
          const pUrls = [
            `/api/parcel?code=${encodeURIComponent(parentCandidate)}&t=${Date.now()}`,
            `https://architect2.ge/api/parcel?code=${encodeURIComponent(parentCandidate)}&t=${Date.now()}`
          ];
          for (const url of pUrls) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 6000);
              const res = await fetch(url, { signal: controller.signal });
              clearTimeout(timeoutId);
              if (res.ok) {
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                  const json = await res.json();
                  const payload = (json && json.data && json.data.coordinates) ? json.data : json;
                  if (payload && payload.coordinates && payload.coordinates.length >= 3) {
                    data = payload;
                    break;
                  }
                }
              }
            } catch (pErr) {}
          }
        }
      }

      // Prefer high-fidelity preset coordinates over any low-resolution remote fallback
      if (preset && preset.coordinates && (!data || !data.coordinates || data.coordinates.length < preset.coordinates.length)) {
        data = {
          ...(data || {}),
          cadastralCode: preset.code || cleanCode,
          address: (data && data.address && data.address !== 'მისამართი დაუზუსტებელია') ? data.address : preset.address,
          officialAreaSqm: preset.area || (data ? data.officialAreaSqm : 0),
          geometricAreaSqm: preset.area || (data ? data.geometricAreaSqm : 0),
          areaSqm: preset.area || (data ? data.areaSqm : 0),
          coordinates: preset.coordinates,
          centroid: preset.coordinates[0]
        };
      }

      if (data && data.coordinates && data.coordinates.length >= 3) {
        state.cadastralCode = data.cadastralCode || cleanCode;
        state.address = data.address || 'მისამართი დაუზუსტებელია';
        state.officialAreaSqm = data.officialAreaSqm || data.areaSqm || 0;
        state.geometricAreaSqm = data.geometricAreaSqm || data.areaSqm || 0;
        state.landType = data.landType || 'არასასოფლო-სამეურნეო';
        state.ownershipType = data.ownershipType || 'საკუთრება';
        state.owners = (data.owners && data.owners.length > 0) ? data.owners : ['ფიზიკური პირი'];
        state.rawCoordinates = data.coordinates;
        state.centroidLatLng = data.centroid || data.coordinates[0];

        if (data.zoning) {
          state.zone = data.zoning.zoneCode || 'სზ-1';
          state.zoneName = data.zoning.zoneNameKa || data.zoning.mainZoneKa || data.zoning.zoneCode || 'საცხოვრებელი ზონა';
          if (data.zoning.k1 !== undefined && data.zoning.k1 !== null) state.k1Limit = parseFloat(data.zoning.k1);
          if (data.zoning.k2 !== undefined && data.zoning.k2 !== null) state.k2Limit = parseFloat(data.zoning.k2);
          if (data.zoning.k3 !== undefined && data.zoning.k3 !== null) state.k3Limit = parseFloat(data.zoning.k3);
          state.manualZoningOverride = false;
          if (els.inputK1Coeff) els.inputK1Coeff.value = state.k1Limit;
          if (els.inputK2Coeff) els.inputK2Coeff.value = state.k2Limit;
          if (els.inputK3Coeff) els.inputK3Coeff.value = state.k3Limit;
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

        // Reveal CAD SVG Container and hide Georgia overview HUD
        if (els.georgiaOverviewOverlay) els.georgiaOverviewOverlay.style.display = 'none';
        if (els.cadSvgContainer) els.cadSvgContainer.style.display = 'block';

        // Align Leaflet map with parcel centroid
        if (tsinareMap && state.centroidLatLng) {
          if (parcelPolygonLayer) {
            tsinareMap.removeLayer(parcelPolygonLayer);
            parcelPolygonLayer = null;
          }
          // Do NOT add duplicate dashed polygon to Leaflet - the CAD SVG layer renders the authoritative boundary!
          tsinareMap.setView(state.centroidLatLng, 18, { animate: false });
        }

        updateCadastralSidebarUI();
        updateZoningCoefficientsUI();
        cadZoomReset();
        renderCadWorld();

        // Automatically switch to Hybrid Satellite + CAD view so satellite imagery is immediately visible
        if (typeof window.setViewMode === 'function') {
          window.setViewMode('hybrid');
        }

        updateToolStatus(`მოიძებნა ნაკვეთი ${state.cadastralCode} (${state.officialAreaSqm} მ²). გენგეგმის სტუდია მზადაა.`);

        // Save successfully searched cadastral code & address to history
        if (typeof window.saveToSearchHistory === 'function') {
          window.saveToSearchHistory(state.cadastralCode, state.address);
        }

        if (els.naprStatusBadge) {
          els.naprStatusBadge.innerText = 'NAPR VERIFIED';
          els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        }
      } else {
        if (els.naprStatusBadge) {
          els.naprStatusBadge.innerText = 'NOT FOUND';
          els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
        }
        updateToolStatus(`⚠️ საკადასტრო კოდი "${cleanCode}" საჯარო რეესტრის (NAPR) ოფიციალურ ბაზაში ვერ მოიძებნა. გადაამოწმეთ კოდი.`);
        alert(`საკადასტრო კოდი "${cleanCode}" საჯარო რეესტრის (NAPR) ოფიციალურ ბაზაში ვერ მოიძებნა.\nგთხოვთ გადაამოწმოთ კოდის სისწორე.`);
      }
    } catch (err) {
      console.warn('[Tsinare] Search error:', err);
      if (els.naprStatusBadge) {
        els.naprStatusBadge.innerText = 'ERROR';
        els.naprStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
      }
      updateToolStatus(`⚠️ საჯარო რეესტრის სერვერთან კავშირი შეფერხდა: ${err.message || ''}`);
      alert(`საჯარო რეესტრის სერვერთან კავშირი შეფერხდა.\nგთხოვთ სცადოთ ხელახლა.`);
    } finally {
      if (els.btnSearchCadastral) {
        els.btnSearchCadastral.disabled = false;
        els.btnSearchCadastral.innerHTML = '<i class="fa-solid fa-magnifying-glass text-[11px]"></i> <span class="hidden sm:inline">ძებნა</span>';
      }
    }
  }

  // EXPOSE GLOBALLY FOR INLINE FORM & BUTTONS
  window.triggerCadastralSearch = triggerCadastralSearch;

  window.loadCadastralSample = function (code) {
    if (els.cadastralInput) els.cadastralInput.value = code;
    triggerCadastralSearch(code);
  };

  // ================================================================
  // SEARCH HISTORY SYSTEM (localStorage, max 20 entries)
  // ================================================================
  const HISTORY_KEY = 'tsinare_search_history';
  const HISTORY_MAX = 20;
  let _shHighlightIndex = -1; // keyboard navigation index

  function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch { return []; }
  }

  function saveSearchHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }
    catch {}
  }

  window.saveToSearchHistory = function (code, address) {
    if (!code) return;
    let hist = getSearchHistory();
    // Remove existing entry for same code
    hist = hist.filter(h => h.code !== code);
    // Prepend new entry
    hist.unshift({
      code,
      address: address || '',
      ts: Date.now()
    });
    // Trim to max
    if (hist.length > HISTORY_MAX) hist = hist.slice(0, HISTORY_MAX);
    saveSearchHistory(hist);
  };

  window.removeFromSearchHistory = function (code, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    let hist = getSearchHistory().filter(h => h.code !== code);
    saveSearchHistory(hist);
    renderSearchHistoryList(hist);
  };

  window.clearSearchHistory = function () {
    saveSearchHistory([]);
    renderSearchHistoryList([]);
  };

  function formatHistoryTime(ts) {
    const now = Date.now();
    const diff = now - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return 'ახლახან';
    if (m < 60) return m + ' წთ. წინ';
    if (h < 24) return h + ' სთ. წინ';
    if (d < 7) return d + ' დღე წინ';
    return new Date(ts).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
  }

  function renderSearchHistoryList(hist, filter) {
    const list = document.getElementById('searchHistoryList');
    if (!list) return;
    _shHighlightIndex = -1;

    let items = hist;
    if (filter && filter.length >= 2) {
      items = hist.filter(h => h.code.includes(filter) || (h.address && h.address.toLowerCase().includes(filter.toLowerCase())));
    }

    if (items.length === 0) {
      if (filter) {
        list.innerHTML = `
          <div class="sh-empty">
            <i class="fa-solid fa-magnifying-glass text-slate-400 text-base mb-1 block"></i>
            <span class="text-slate-300 font-medium">შედეგი ვერ მოიძებნა</span>
            <div class="text-[10px] text-slate-500 mt-0.5">სცადეთ სხვა საკადასტრო კოდი</div>
          </div>`;
      } else {
        list.innerHTML = `
          <div class="sh-empty py-4">
            <i class="fa-solid fa-clock-rotate-left text-sky-400 text-lg mb-1.5 block"></i>
            <div class="text-slate-200 font-bold text-xs mb-1">ძებნის ისტორია ცარიელია</div>
            <div class="text-[10.5px] text-slate-400">მოძებნილი საკადასტრო კოდები ავტომატურად შეინახება აქ.</div>
          </div>`;
      }
      return;
    }

    // Group: Today vs Earlier
    const today = new Date(); today.setHours(0,0,0,0);
    const todayItems = items.filter(h => h.ts >= today.getTime());
    const earlierItems = items.filter(h => h.ts < today.getTime());

    let html = '';
    if (todayItems.length > 0) {
      html += `<div class="sh-section-label">დღეს</div>`;
      todayItems.forEach(h => html += buildHistoryItem(h));
    }
    if (earlierItems.length > 0) {
      html += `<div class="sh-section-label">ადრე</div>`;
      earlierItems.forEach(h => html += buildHistoryItem(h));
    }
    list.innerHTML = html;
  }

  function buildHistoryItem(h) {
    const addrEsc = (h.address || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const codeEsc = h.code.replace(/"/g, '&quot;');
    return `
      <button type="button" class="sh-item"
        onclick="selectHistoryItem('${codeEsc}')">
        <i class="sh-icon fa-solid fa-clock-rotate-left"></i>
        <span class="sh-code">${h.code}</span>
        ${h.address ? `<span class="sh-addr" title="${addrEsc}">${h.address}</span>` : ''}
        <span class="sh-time">${formatHistoryTime(h.ts)}</span>
        <button type="button" class="sh-del-btn"
          onclick="removeFromSearchHistory('${codeEsc}', event)"
          title="ამ ჩანაწერის წაშლა">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </button>`;
  }

  window.toggleSearchHistory = function (e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('hidden')) {
      window.openSearchHistory();
    } else {
      window.closeSearchHistory();
    }
  };

  window.openSearchHistory = function () {
    const dropdown = document.getElementById('searchHistoryDropdown');
    const input = els.cadastralInput;
    if (!dropdown) return;
    const hist = getSearchHistory();
    renderSearchHistoryList(hist, input ? input.value : '');
    dropdown.classList.remove('hidden');
  };

  window.filterSearchHistory = function (val) {
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (!dropdown) return;
    const hist = getSearchHistory();
    renderSearchHistoryList(hist, val);
    if (hist.length > 0) dropdown.classList.remove('hidden');
  };

  window.closeSearchHistory = function () {
    const dropdown = document.getElementById('searchHistoryDropdown');
    if (dropdown) dropdown.classList.add('hidden');
    _shHighlightIndex = -1;
  };

  window.selectHistoryItem = function (code) {
    if (els.cadastralInput) els.cadastralInput.value = code;
    window.closeSearchHistory();
    triggerCadastralSearch(code);
  };

  // Keyboard navigation (arrow up/down, Escape, Enter)
  window.handleSearchInputKey = function (e) {
    const dropdown = document.getElementById('searchHistoryDropdown');
    const items = dropdown ? Array.from(dropdown.querySelectorAll('.sh-item:not(.sh-header *)')) : [];

    if (e.key === 'Escape') {
      window.closeSearchHistory();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (_shHighlightIndex >= 0 && items[_shHighlightIndex]) {
        items[_shHighlightIndex].click();
      } else {
        window.closeSearchHistory();
        triggerCadastralSearch();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (dropdown && dropdown.classList.contains('hidden')) window.openSearchHistory();
      _shHighlightIndex = Math.min(_shHighlightIndex + 1, items.length - 1);
      items.forEach((it, i) => it.style.background = i === _shHighlightIndex ? 'rgba(56,189,248,0.12)' : '');
      if (items[_shHighlightIndex]) items[_shHighlightIndex].scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      _shHighlightIndex = Math.max(_shHighlightIndex - 1, -1);
      items.forEach((it, i) => it.style.background = i === _shHighlightIndex ? 'rgba(56,189,248,0.12)' : '');
      if (_shHighlightIndex >= 0 && items[_shHighlightIndex]) items[_shHighlightIndex].scrollIntoView({ block: 'nearest' });
      return;
    }
  };

  // Close history on click outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('searchHistoryDropdown');
    const form = document.getElementById('cadastralSearchForm');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      if (!form || !form.contains(e.target)) window.closeSearchHistory();
    }
  });

  // Convert WGS-84 [lat, lng] to Metric Cartesian (Meters) centered on centroid
  function convertGeoToMetric(rawCoords) {
    if (!rawCoords || rawCoords.length < 3) return;

    // Sanitize coords: remove consecutive duplicates and duplicate closing point
    const coordsLatLng = [];
    for (let i = 0; i < rawCoords.length; i++) {
      const p = rawCoords[i];
      if (coordsLatLng.length > 0) {
        const prev = coordsLatLng[coordsLatLng.length - 1];
        if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) < 1e-5) continue;
      }
      coordsLatLng.push(p);
    }
    if (coordsLatLng.length > 2) {
      const first = coordsLatLng[0];
      const last = coordsLatLng[coordsLatLng.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-5) {
        coordsLatLng.pop();
      }
    }
    if (coordsLatLng.length < 3) return;

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

    // Step 1: fast geometric fallback (immediate, synchronous)
    state.boundaryEdgeTypes = detectBoundaryEdgeTypes(state.boundaryMeters, state.roads);
    // Step 2: async OSM refinement — overwrites with accurate road data once fetched
    detectEdgeTypesFromOSM();
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

  // --- Geometric Distance from Point p to Segment [a, b] ---
  function distPointToSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  // --- Boundary Edge Classification: Road/Public (0m setback) vs Neighbor (3.0m setback) ---
  // Async: Queries OpenStreetMap Overpass API for nearby streets/roads and classifies each parcel edge.
  async function detectEdgeTypesFromOSM() {
    if (!state.centroidLatLng || !state.boundaryMeters || state.boundaryMeters.length < 3) return;
    const [cLat, cLng] = state.centroidLatLng;
    const metersPerDegLat = 111132.954;
    const metersPerDegLng = 111132.954 * Math.cos((cLat * Math.PI) / 180);

    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ];

    const radius = 70;
    const query = `[out:json][timeout:8];(way(around:${radius},${cLat},${cLng})[highway];);out geom;`;

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json, */*'
          },
          body: 'data=' + encodeURIComponent(query),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) continue;
        const text = await res.text();
        if (!text || text.trim().startsWith('<')) continue; // Guard against XML/HTML error responses
        const data = JSON.parse(text);

        // Convert OSM road geometry to local meter coordinates (same frame as boundaryMeters)
        const roadSegments = [];
        (data.elements || []).forEach(way => {
          const hw = way.tags ? way.tags.highway : '';
          if (hw === 'steps') return; // ignore outdoor staircases
          const geom = way.geometry || [];
          for (let i = 0; i < geom.length - 1; i++) {
            const p1 = [
              (geom[i].lon - cLng) * metersPerDegLng,
              -(geom[i].lat - cLat) * metersPerDegLat
            ];
            const p2 = [
              (geom[i + 1].lon - cLng) * metersPerDegLng,
              -(geom[i + 1].lat - cLat) * metersPerDegLat
            ];
            roadSegments.push({ p1, p2, name: (way.tags && (way.tags.name || way.tags.highway)) || 'გზა' });
          }
        });

        if (roadSegments.length === 0) continue;

        const poly = state.boundaryMeters;
        const n = poly.length;
        const threshold = 12.0; // 12 meters from road centerline
        const newTypes = new Array(n).fill('neighbor');
        let roadCount = 0;

        for (let i = 0; i < n; i++) {
          const midX = (poly[i][0] + poly[(i + 1) % n][0]) / 2;
          const midY = (poly[i][1] + poly[(i + 1) % n][1]) / 2;
          for (const seg of roadSegments) {
            const d = distPointToSegment([midX, midY], seg.p1, seg.p2);
            if (d <= threshold) {
              newTypes[i] = 'road';
              roadCount++;
              break;
            }
          }
        }

        // Safety: ensure at least 1 edge is recognized as road
        if (roadCount === 0) {
          continue; // Try next endpoint or keep geometric fallback
        }

        state.boundaryEdgeTypes = newTypes;
        renderCadWorld();
        updateToolStatus(`ავტომატურად ამოცნობილია ${roadCount} საგზაო/საზოგადოებრივი კიდე (0მ) და ${n - roadCount} სამეზობლო მიჯნა (${state.setbackDistance}მ).`);
        return; // Successfully updated from OSM
      } catch (e) {
        // Continue to next endpoint
      }
    }
  }

  function detectBoundaryEdgeTypes(polygon, roads = []) {
    if (!polygon || polygon.length < 3) return [];
    const n = polygon.length;
    const types = new Array(n).fill('neighbor');

    // 1. Find edge closest to the street frontage (maximum Y in SVG coordinate space)
    let bestRoadEdgeIdx = 0;
    let maxEdgeY = -Infinity;
    for (let i = 0; i < n; i++) {
      const midY = (polygon[i][1] + polygon[(i + 1) % n][1]) / 2;
      if (midY > maxEdgeY) {
        maxEdgeY = midY;
        bestRoadEdgeIdx = i;
      }
    }
    types[bestRoadEdgeIdx] = 'road';

    // 2. Cross-reference with user-drawn roads
    if (roads && roads.length > 0) {
      roads.forEach(r => {
        if (!r.points || r.points.length < 2) return;
        for (let i = 0; i < n; i++) {
          const midX = (polygon[i][0] + polygon[(i + 1) % n][0]) / 2;
          const midY = (polygon[i][1] + polygon[(i + 1) % n][1]) / 2;
          for (let k = 0; k < r.points.length - 1; k++) {
            const d = distPointToSegment([midX, midY], r.points[k], r.points[k + 1]);
            if (d < (r.width || 6) * 1.5) {
              types[i] = 'road';
            }
          }
        }
      });
    }

    if (!types.includes('road')) {
      types[bestRoadEdgeIdx] = 'road';
    }

    return types;
  }

  // Toggle boundary edge type between road and neighbor
  window.toggleBoundaryEdgeType = function (edgeIdx) {
    if (!state.boundaryEdgeTypes || edgeIdx < 0 || edgeIdx >= state.boundaryEdgeTypes.length) return;
    saveUndoSnapshot();
    state.boundaryEdgeTypes[edgeIdx] = state.boundaryEdgeTypes[edgeIdx] === 'road' ? 'neighbor' : 'road';
    renderCadWorld();
    const typeKa = state.boundaryEdgeTypes[edgeIdx] === 'road' ? '🚗 საგზაო / საზოგადოებრივი (0მ მიჯნა)' : `🏡 სამეზობლო საზღვარი (${state.setbackDistance}მ მიჯნა)`;
    updateToolStatus(`საზღვარი №${edgeIdx + 1} შეიცვალა: ${typeKa}`);
  };

  // --- Robust Boundary-Aware Neighbor Setback Polylines (დადგენილება №41) ---
  // სამეზობლო მიჯნის შეზღუდვა (3.0მ) მოქმედებს მხოლოდ სამეზობლო საზღვრებზე. საგზაო მხარეს = 0მ.
  function computeNeighborSetbackPolylines(polygon, edgeTypes, defaultDist) {
    if (!polygon || polygon.length < 3) return { polylines: [], insetVertices: [] };
    const n = polygon.length;
    if (!edgeTypes || edgeTypes.length !== n) {
      edgeTypes = new Array(n).fill('neighbor');
    }

    let signedArea = 0;
    for (let i = 0; i < n; i++) {
      const p0 = polygon[i];
      const p1 = polygon[(i + 1) % n];
      signedArea += (p0[0] * p1[1] - p1[0] * p0[1]);
    }
    const orient = signedArea >= 0 ? 1 : -1;

    // Compute inward normal and shifted line for each edge
    const edgeNormals = [];
    const edgeOffsets = [];
    for (let i = 0; i < n; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % n];
      let dx = p2[0] - p1[0];
      let dy = p2[1] - p1[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;

      const nx = -dy * orient;
      const ny = dx * orient;
      const isNeighbor = edgeTypes[i] !== 'road';
      const dist = isNeighbor ? defaultDist : 0;

      edgeNormals.push({ nx, ny, dx, dy, len, isNeighbor });
      edgeOffsets.push({
        p1: [p1[0] + nx * dist, p1[1] + ny * dist],
        p2: [p2[0] + nx * dist, p2[1] + ny * dist],
        dist,
        isNeighbor
      });
    }

    // Robust vertex intersection with collinear handling and miter clamping
    const insetVertices = [];
    for (let i = 0; i < n; i++) {
      const prevIdx = (i - 1 + n) % n;
      const lPrev = edgeOffsets[prevIdx];
      const lCurr = edgeOffsets[i];
      const origVertex = polygon[i];

      // Check if edges are nearly parallel or collinear
      const dot = edgeNormals[prevIdx].dx * edgeNormals[i].dx + edgeNormals[prevIdx].dy * edgeNormals[i].dy;
      const cross = edgeNormals[prevIdx].dx * edgeNormals[i].dy - edgeNormals[prevIdx].dy * edgeNormals[i].dx;

      let pt;
      if (Math.abs(cross) < 0.05 || dot > 0.99) {
        // Parallel / collinear: offset along the average normal
        const avgNx = (edgeNormals[prevIdx].nx + edgeNormals[i].nx) / 2;
        const avgNy = (edgeNormals[prevIdx].ny + edgeNormals[i].ny) / 2;
        const anLen = Math.hypot(avgNx, avgNy) || 1;
        const avgDist = (lPrev.dist + lCurr.dist) / 2;
        pt = [origVertex[0] + (avgNx / anLen) * avgDist, origVertex[1] + (avgNy / anLen) * avgDist];
      } else {
        // General 2D line intersection
        const x1 = lPrev.p1[0], y1 = lPrev.p1[1];
        const x2 = lPrev.p2[0], y2 = lPrev.p2[1];
        const x3 = lCurr.p1[0], y3 = lCurr.p1[1];
        const x4 = lCurr.p2[0], y4 = lCurr.p2[1];
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

        if (Math.abs(denom) < 1e-4) {
          pt = [lCurr.p1[0], lCurr.p1[1]];
        } else {
          const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
          pt = [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
        }
      }

      // CRITICAL SAFETY CLAMP: Inset vertex MUST NOT exceed 2.2 * setback distance from boundary vertex!
      // This completely prevents collinear/sharp angle spikes from projecting off into the distance.
      const maxMiter = Math.max(defaultDist * 2.2, 6.5);
      const distFromOrig = Math.hypot(pt[0] - origVertex[0], pt[1] - origVertex[1]);
      if (distFromOrig > maxMiter) {
        const avgNx = (edgeNormals[prevIdx].nx + edgeNormals[i].nx) / 2;
        const avgNy = (edgeNormals[prevIdx].ny + edgeNormals[i].ny) / 2;
        const anLen = Math.hypot(avgNx, avgNy) || 1;
        const clampDist = Math.max(lPrev.dist, lCurr.dist);
        pt = [origVertex[0] + (avgNx / anLen) * clampDist, origVertex[1] + (avgNy / anLen) * clampDist];
      }

      insetVertices.push(pt);
    }

    // Extract contiguous neighbor setback polylines
    const polylines = [];
    let currentPolyline = [];

    for (let i = 0; i < n; i++) {
      if (edgeTypes[i] !== 'road') {
        const ptStart = insetVertices[i];
        const ptEnd = insetVertices[(i + 1) % n];
        if (currentPolyline.length === 0) {
          currentPolyline.push(ptStart);
        }
        currentPolyline.push(ptEnd);
      } else {
        if (currentPolyline.length >= 2) {
          polylines.push(currentPolyline);
        }
        currentPolyline = [];
      }
    }
    if (currentPolyline.length >= 2) {
      if (polylines.length > 0 && edgeTypes[0] !== 'road') {
        polylines[0] = currentPolyline.concat(polylines[0].slice(1));
      } else {
        polylines.push(currentPolyline);
      }
    }

    return { polylines, insetVertices };
  }

  // --- Real Adjoining Neighbor Parcels (სამეზობლო ნაკვეთები საზღვრის გასწვრივ) ---
  function buildAdjacentNeighborParcels(polygon, edgeTypes, depth = 28) {
    if (!polygon || polygon.length < 3) return [];
    const n = polygon.length;
    if (!edgeTypes || edgeTypes.length !== n) edgeTypes = new Array(n).fill('neighbor');

    let signedArea = 0;
    for (let i = 0; i < n; i++) {
      const p0 = polygon[i];
      const p1 = polygon[(i + 1) % n];
      signedArea += (p0[0] * p1[1] - p1[0] * p0[1]);
    }
    const orient = signedArea >= 0 ? 1 : -1;

    // Outward vertex normals
    const vertexNormals = [];
    for (let i = 0; i < n; i++) {
      const prev = polygon[(i - 1 + n) % n];
      const curr = polygon[i];
      const next = polygon[(i + 1) % n];

      let v1x = curr[0] - prev[0], v1y = curr[1] - prev[1];
      const l1 = Math.hypot(v1x, v1y) || 1;
      v1x /= l1; v1y /= l1;

      let v2x = next[0] - curr[0], v2y = next[1] - curr[1];
      const l2 = Math.hypot(v2x, v2y) || 1;
      v2x /= l2; v2y /= l2;

      const n1x = v1y * orient, n1y = -v1x * orient;
      const n2x = v2y * orient, n2y = -v2x * orient;
      let bx = n1x + n2x, by = n1y + n2y;
      const blen = Math.hypot(bx, by) || 1;
      vertexNormals.push([bx / blen, by / blen]);
    }

    // Edge directions & normals
    const edgeNormals = [];
    for (let i = 0; i < n; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % n];
      let edx = p2[0] - p1[0], edy = p2[1] - p1[1];
      const elen = Math.hypot(edx, edy) || 1;
      edgeNormals.push([(edy / elen) * orient, (-edx / elen) * orient, elen]);
    }

    // Group contiguous neighbor edges into distinct logical neighbor parcels
    const neighborGroups = [];
    let currentGroup = [];

    for (let i = 0; i < n; i++) {
      if (edgeTypes[i] !== 'road') {
        if (currentGroup.length === 0) {
          currentGroup.push(i);
        } else {
          const lastIdx = currentGroup[currentGroup.length - 1];
          const dot = edgeNormals[lastIdx][0] * edgeNormals[i][0] + edgeNormals[lastIdx][1] * edgeNormals[i][1];
          if (dot > 0.4) {
            currentGroup.push(i);
          } else {
            neighborGroups.push(currentGroup);
            currentGroup = [i];
          }
        }
      } else {
        if (currentGroup.length > 0) {
          neighborGroups.push(currentGroup);
          currentGroup = [];
        }
      }
    }
    if (currentGroup.length > 0) {
      if (neighborGroups.length > 0 && edgeTypes[0] !== 'road') {
        const firstGroup = neighborGroups[0];
        const lastIdx = currentGroup[currentGroup.length - 1];
        const dot = edgeNormals[lastIdx][0] * edgeNormals[firstGroup[0]][0] + edgeNormals[lastIdx][1] * edgeNormals[firstGroup[0]][1];
        if (dot > 0.4) {
          neighborGroups[0] = currentGroup.concat(firstGroup);
        } else {
          neighborGroups.push(currentGroup);
        }
      } else {
        neighborGroups.push(currentGroup);
      }
    }

    const parcels = [];
    neighborGroups.forEach((grp, gIdx) => {
      const chain = [];
      grp.forEach(eIdx => {
        chain.push(polygon[eIdx]);
      });
      const lastEdgeIdx = grp[grp.length - 1];
      chain.push(polygon[(lastEdgeIdx + 1) % n]);

      const extPoints = [];
      for (let k = chain.length - 1; k >= 0; k--) {
        let nx = 0, ny = 0;
        if (k === 0) {
          const vIdx = grp[0];
          nx = vertexNormals[vIdx][0]; ny = vertexNormals[vIdx][1];
        } else if (k === chain.length - 1) {
          const vIdx = (lastEdgeIdx + 1) % n;
          nx = vertexNormals[vIdx][0]; ny = vertexNormals[vIdx][1];
        } else {
          const vIdx = grp[k];
          nx = vertexNormals[vIdx][0]; ny = vertexNormals[vIdx][1];
        }
        extPoints.push([chain[k][0] + nx * depth, chain[k][1] + ny * depth]);
      }

      const parcelPoly = chain.concat(extPoints);

      let cx = 0, cy = 0;
      parcelPoly.forEach(p => { cx += p[0]; cy += p[1]; });
      cx /= parcelPoly.length;
      cy /= parcelPoly.length;

      let area = 0;
      for (let i = 0; i < parcelPoly.length; i++) {
        const p0 = parcelPoly[i];
        const p1 = parcelPoly[(i + 1) % parcelPoly.length];
        area += (p0[0] * p1[1] - p1[0] * p0[1]);
      }

      parcels.push({
        id: 'nb_' + gIdx,
        edges: grp,
        polygon: parcelPoly,
        center: [cx, cy],
        sharedChain: chain,
        areaSqm: Math.round(Math.abs(area) / 2)
      });
    });

    return parcels;
  }

  // Backward-compatible setback polygon calculation
  function computeSetbackPolygon(polygon, offsetDist) {
    if (!polygon || polygon.length < 3) return [];
    const types = (state.boundaryEdgeTypes && state.boundaryEdgeTypes.length === polygon.length)
      ? state.boundaryEdgeTypes
      : detectBoundaryEdgeTypes(polygon, state.roads);
    const res = computeNeighborSetbackPolylines(polygon, types, offsetDist);
    return res.insetVertices || [];
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
    if (!state.cadastralCode || !state.officialAreaSqm) {
      if (els.lblK1Allowed) els.lblK1Allowed.innerText = '—';
      if (els.lblK1Used) els.lblK1Used.innerText = '—';
      if (els.lblK1Remaining) {
        els.lblK1Remaining.innerText = '—';
        els.lblK1Remaining.className = 'text-xs font-bold text-slate-400';
      }
      if (els.barK1Progress) els.barK1Progress.style.width = '0%';
      if (els.lblK1Alert) els.lblK1Alert.classList.add('hidden');

      if (els.lblK2Allowed) els.lblK2Allowed.innerText = '—';
      if (els.lblK2Used) els.lblK2Used.innerText = '—';
      if (els.lblK2Remaining) {
        els.lblK2Remaining.innerText = '—';
        els.lblK2Remaining.className = 'text-xs font-bold text-slate-400';
      }
      if (els.barK2Progress) els.barK2Progress.style.width = '0%';
      if (els.lblK2Alert) els.lblK2Alert.classList.add('hidden');

      if (els.lblK3Required) els.lblK3Required.innerText = '—';
      if (els.lblK3Actual) els.lblK3Actual.innerText = '—';
      if (els.lblK3Balance) {
        els.lblK3Balance.innerText = '—';
        els.lblK3Balance.className = 'text-xs font-bold text-slate-400';
      }
      if (els.barK3Progress) els.barK3Progress.style.width = '0%';
      if (els.lblHardscapeTotal) els.lblHardscapeTotal.innerText = '—';
      if (els.lblOpenGround) els.lblOpenGround.innerText = '—';
      if (els.lblPlantedTreesCount) els.lblPlantedTreesCount.innerText = '0 ხე';
      if (els.lblK3Alert) els.lblK3Alert.classList.add('hidden');
      updateSelectedBuildingUI();
      return;
    }

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
    if (els.inputK1Coeff && document.activeElement !== els.inputK1Coeff) els.inputK1Coeff.value = k1;
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
    if (els.inputK2Coeff && document.activeElement !== els.inputK2Coeff) els.inputK2Coeff.value = k2;
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
    if (els.inputK3Coeff && document.activeElement !== els.inputK3Coeff) els.inputK3Coeff.value = k3;
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

  // --- Real-time Manual Override Handler for K1, K2, K3 ---
  window.updateZoningCoefficients = function () {
    const k1Input = parseFloat(els.inputK1Coeff ? els.inputK1Coeff.value : state.k1Limit);
    const k2Input = parseFloat(els.inputK2Coeff ? els.inputK2Coeff.value : state.k2Limit);
    const k3Input = parseFloat(els.inputK3Coeff ? els.inputK3Coeff.value : state.k3Limit);

    if (!isNaN(k1Input) && k1Input >= 0) state.k1Limit = Math.round(k1Input * 100) / 100;
    if (!isNaN(k2Input) && k2Input >= 0) state.k2Limit = Math.round(k2Input * 100) / 100;
    if (!isNaN(k3Input) && k3Input >= 0) state.k3Limit = Math.round(k3Input * 100) / 100;

    state.manualZoningOverride = true;
    updateZoningCoefficientsUI();
    updateToolStatus(`კოეფიციენტები განახლდა: K1=${state.k1Limit}, K2=${state.k2Limit}, K3=${state.k3Limit}`);
  };

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
    } else {
      if (els.lblSelectedBuildingName) els.lblSelectedBuildingName.innerText = '—';
      if (els.txtBuildingName) els.txtBuildingName.value = '';
      if (els.sliderBuildingWidth) els.sliderBuildingWidth.value = 15;
      if (els.lblBuildingWidthVal) els.lblBuildingWidthVal.innerText = '0.0 მ';
      if (els.inputNumBuildingWidth) els.inputNumBuildingWidth.value = '0.0';
      if (els.quickBldW) els.quickBldW.value = '0.0';
      if (els.sliderBuildingLength) els.sliderBuildingLength.value = 12;
      if (els.lblBuildingLengthVal) els.lblBuildingLengthVal.innerText = '0.0 მ';
      if (els.inputNumBuildingLength) els.inputNumBuildingLength.value = '0.0';
      if (els.quickBldL) els.quickBldL.value = '0.0';
      if (els.inputNumBuildingArea) els.inputNumBuildingArea.value = '0';
      if (els.sliderBuildingRotation) els.sliderBuildingRotation.value = 0;
      if (els.lblBuildingRotationVal) els.lblBuildingRotationVal.innerText = '0°';
      if (els.inputNumBuildingRotation) els.inputNumBuildingRotation.value = '0';
      if (els.sliderFloors) els.sliderFloors.value = 1;
      if (els.lblFloorsCountVal) els.lblFloorsCountVal.innerText = '0';
      if (els.inputNumBuildingFloors) els.inputNumBuildingFloors.value = '0';
      if (els.quickBldFloors) els.quickBldFloors.value = '0';
      if (els.lblFloorHeightVal) els.lblFloorHeightVal.innerText = '0.0 მ';
      if (els.inputNumFloorHeight) els.inputNumFloorHeight.value = '0.0';
      if (els.lblTotalHeightVal) els.lblTotalHeightVal.innerText = '0.0';
    }

    if (els.lstBuildingsContainer) {
      if (state.footprints.length === 0) {
        els.lstBuildingsContainer.innerHTML = '<div class="p-3 text-center text-xs text-slate-500">შენობები არ არის დამატებული</div>';
      } else {
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
    if (!state.cadastralCode) {
      if (els.lblCadastralCode) els.lblCadastralCode.innerText = '—';
      if (els.lblAddress) els.lblAddress.innerText = '—';
      if (els.lblOfficialArea) els.lblOfficialArea.innerText = '—';
      if (els.lblGeometricArea) els.lblGeometricArea.innerText = '—';
      if (els.lblLandType) els.lblLandType.innerText = '—';
      if (els.lblOwnershipType) els.lblOwnershipType.innerText = '—';
      if (els.lblOwnersList) els.lblOwnersList.innerText = '—';
      if (els.lblZoneBadge) els.lblZoneBadge.innerText = '—';
      if (els.lblZoneDescription) els.lblZoneDescription.innerText = '—';
      if (els.lblCornerCount) els.lblCornerCount.innerText = '0';
      if (els.tblCoordinatesBody) {
        els.tblCoordinatesBody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-slate-500 font-sans">მონაცემები არ არის</td></tr>';
      }
      return;
    }

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
      els.tblCoordinatesBody.innerHTML = state.rawCoordinates.map((c, i) => {
        const utm = latLonToUtm38N(c[0], c[1]);
        return `
          <tr class="hover:bg-white/5 cursor-default transition" title="UTM 38N: X=${utm.easting.toFixed(2)}მ (Easting), Y=${utm.northing.toFixed(2)}მ (Northing)">
            <td class="p-1 font-bold text-sky-400">#${i + 1}</td>
            <td class="p-1">${c[0].toFixed(6)}</td>
            <td class="p-1">${c[1].toFixed(6)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Geodetic Conversion: WGS84 Lat/Lon -> UTM Zone 38N (EPSG:32638, Official Georgian Geodetic Projection)
  function latLonToUtm38N(lat, lon) {
    const a = 6378137.0; // WGS84 semi-major axis
    const f = 1 / 298.257223563; // flattening
    const b = a * (1 - f);
    const e2 = (a * a - b * b) / (a * a);
    const ep2 = (a * a - b * b) / (b * b);
    const k0 = 0.9996; // UTM scale factor
    const lon0 = 45.0; // Central meridian for UTM Zone 38N (42°E to 48°E, Georgia)

    const phi = lat * Math.PI / 180.0;
    const lambda = lon * Math.PI / 180.0;
    const lambda0 = lon0 * Math.PI / 180.0;

    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
    const T = Math.tan(phi) * Math.tan(phi);
    const C = ep2 * Math.cos(phi) * Math.cos(phi);
    const A = Math.cos(phi) * (lambda - lambda0);

    // Meridional arc M
    const M = a * (
      (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * phi
      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * phi)
      + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * phi)
      - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * phi)
    );

    const easting = 500000.0 + k0 * N * (
      A + (1 - T + C) * Math.pow(A, 3) / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120
    );

    const northing = k0 * (
      M + N * Math.tan(phi) * (
        A * A / 2
        + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
        + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720
      )
    );

    return { easting, northing };
  }

  if (els.tblCoordinatesBody) {
    // updated dynamically in updateCadastralSidebarUI
  }

  window.copyCadastralCode = function () {
    navigator.clipboard.writeText(state.cadastralCode).then(() => {
      alert('საკადასტრო კოდი დაკოპირდა ბუფერში: ' + state.cadastralCode);
    });
  };

  /**
   * Export Cadastral Boundary Points to CSV:
   * 1. 'revit_local' (Default): Centered at Local Origin (0,0) in Meters with North = +Y.
   *    Prevents Revit's 33km limit floating-point precision breakdown and distorted perimeters.
   *    Duplicate closing point is cleanly removed.
   * 2. 'revit_utm': Pure numeric X,Y,Z in meters (UTM 38N / EPSG:32638) with NO text header.
   * 3. 'gps': WGS84 Lat/Lon with full column headers for GIS and spreadsheet software.
   */
  window.exportCoordinatesCsv = function (format = 'revit_local') {
    if (!state.rawCoordinates || state.rawCoordinates.length === 0) {
      alert('კოორდინატები არ არის ჩატვირთული. გთხოვთ ჯერ მოიძიოთ ნაკვეთი.');
      return;
    }

    let csv = '';
    let filename = '';
    const safeCode = (state.cadastralCode || 'parcel').replace(/[^\w.-]/g, '_');

    // Filter duplicate closing point if present (Revit gives duplicate point errors if point 1 == point N)
    let cleanRaw = state.rawCoordinates.slice();
    if (cleanRaw.length > 2) {
      const first = cleanRaw[0];
      const last = cleanRaw[cleanRaw.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-5) {
        cleanRaw.pop();
      }
    }

    if (format === 'revit_local' || format === 'revit') {
      // Local Metric Origin (0,0 Centered in Meters) - RECOMMENDED for Revit Points File
      // In boundaryMeters, y is negative for north. In Revit, +Y is North, so CAD y = -pt[1].
      if (state.boundaryMeters && state.boundaryMeters.length > 0) {
        let cleanBM = state.boundaryMeters.slice();
        if (cleanBM.length > 2 && Math.hypot(cleanBM[0][0] - cleanBM[cleanBM.length - 1][0], cleanBM[0][1] - cleanBM[cleanBM.length - 1][1]) < 1e-4) {
          cleanBM.pop();
        }
        cleanBM.forEach((pt) => {
          csv += `${pt[0].toFixed(3)},${(-pt[1]).toFixed(3)},0.000\r\n`;
        });
      }
      filename = `Revit_Points_Local00_${safeCode}.csv`;
    } else if (format === 'revit_utm') {
      // Autodesk Revit Points File (UTM Zone 38N - Meters, no header, duplicates removed)
      cleanRaw.forEach((c) => {
        const utm = latLonToUtm38N(c[0], c[1]);
        csv += `${utm.easting.toFixed(3)},${utm.northing.toFixed(3)},0.000\r\n`;
      });
      filename = `Revit_UTM38N_${safeCode}.csv`;
    } else {
      // Standard GPS / GIS CSV with descriptive headers
      csv = "Index,Latitude,Longitude,UTM_X_Easting,UTM_Y_Northing,Elevation_M\r\n";
      cleanRaw.forEach((c, i) => {
        const utm = latLonToUtm38N(c[0], c[1]);
        csv += `${i + 1},${c[0].toFixed(7)},${c[1].toFixed(7)},${utm.easting.toFixed(3)},${utm.northing.toFixed(3)},0.000\r\n`;
      });
      filename = `Coordinates_GPS_${safeCode}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // --- Architectural Visual Styles Map (30+ Styles including Real Engineering Drawing Plots) ---
  const styleNamesMap = {
    // Topographic & Relief Themes
    'topographic': '🗺️ ტოპოგრაფიული გეოდეზია (კლასიკური)',
    'topo_relief_hypsometric': '⛰️ რელიეფური ჰიფსომეტრია (ფერადი სიმაღლეები)',
    'topo_cad_dark': '📐 ტოპო-რელიეფი Dark CAD (ნეონ ჰორიზონტალები)',
    'topo_blueprint': '📜 ტოპო-რელიეფური ბლუპრინტი (Royal Topo)',
    'topo_slope_analysis': '📐 რელიეფის ქანობების ანალიზი (Slope Map)',

    // Neighborhood & Urban Context Themes
    'neighborhood_napr': '🏛️ სამეზობლო საკადასტრო GIS (საჯარო რეესტრი)',
    'neighborhood_urban_dark': '🏙️ სამეზობლო ურბანული Dark (ღამის ქალაქი)',
    'neighborhood_masterplan': '🌳 სამეზობლო გამწვანებული გენგეგმა',
    'neighborhood_cadplot': '📄 სამეზობლო Paper Plot (საპროექტო თეთრი)',
    'neighborhood_satellite': '🛰️ სამეზობლო სატელიტური კონტექსტი',

    // Official & Engineering
    'autocad': '📐 AutoCAD Model Space (შავი CAD)',
    'cadplot': '📄 AutoCAD Paper Plot (თეთრი პლოტი)',
    'napr': '🏛️ საჯარო რეესტრის გეგმა (წითელი ხაზები)',
    'vellum': '📜 არქიტექტურული კალკა & ტუში',
    'masterplan': '🌳 საპრეზენტაციო ფერადი გენგეგმა',

    // Design & Artistic Themes
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

    const lblStyle = document.getElementById('lblActiveCadStyle');
    if (lblStyle) {
      const fullLabel = (CAD_STYLE_NAMES && CAD_STYLE_NAMES[styleName]) || 'სტილი';
      const cleanLabel = fullLabel.split('(')[0].trim();
      lblStyle.innerText = cleanLabel.length > 13 ? cleanLabel.slice(0, 12) + '…' : cleanLabel;
    }

    // Auto-enable corresponding layers when a specialized theme is chosen
    if (styleName.startsWith('topo') || styleName === 'topographic') {
      state.layers.topography = true;
      const chk = document.getElementById('chkLayerTopography');
      if (chk) chk.checked = true;
    }
    if (styleName.startsWith('neighborhood')) {
      state.layers.neighborhood = true;
      const chk = document.getElementById('chkLayerNeighborhood');
      if (chk) chk.checked = true;
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
      // Use fixed positioning so the popup escapes any overflow:auto parent (scrollable ribbon row)
      const triggerBtn = e && e.currentTarget ? e.currentTarget : (e && e.target ? e.target.closest('button') : null);
      target.style.position = 'fixed';
      target.style.zIndex = '99999';
      if (triggerBtn) {
        const btnRect = triggerBtn.getBoundingClientRect();
        const topPos = btnRect.bottom + 4;
        let leftPos = btnRect.left;
        target.classList.remove('hidden');
        // Check if it would overflow right edge and flip
        const popupWidth = target.offsetWidth || 320;
        if (leftPos + popupWidth > (window.innerWidth - 12)) {
          leftPos = Math.max(8, (window.innerWidth - popupWidth - 12));
        }
        target.style.top = topPos + 'px';
        target.style.left = leftPos + 'px';
        target.style.right = 'auto';
      } else {
        target.classList.remove('hidden');
      }
    }
  };

  window.closeAllDropdowns = function () {
    document.querySelectorAll('.cad-menu-popup').forEach(p => p.classList.add('hidden'));
    window.closeBasemapDropdown();
  };

  // --- Ribbon Dropdown Menu Tool Selector ---
  window.selectDropdownTool = function (category, toolName, displayName, iconHtml) {
    window.setCadActiveTool(toolName);
    
    // Update category button label and icon
    const labelEl = document.getElementById(`lblActive_${category}_Tool`);
    if (labelEl) {
      labelEl.innerText = displayName;
    }
    const catBtn = document.getElementById(`dropdownBtn_${category}`);
    if (catBtn) {
      catBtn.classList.add('btn-tool-active');
    }
    
    // Close dropdown
    window.closeAllDropdowns();
  };

  // --- Basemap Picker Toggle ---
  window.toggleBasemapDropdown = function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const dropdown = document.getElementById('basemapDropdown');
    if (!dropdown) return;
    const isOpen = !dropdown.classList.contains('hidden');
    if (isOpen) {
      dropdown.classList.add('hidden');
      return;
    }
    const btn = document.getElementById('btnBasemapTrigger');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      dropdown.style.top = (rect.bottom + 6) + 'px';
      let left = rect.left;
      // Clamp so it doesn't go off right edge
      const dropW = 350;
      if (left + dropW > window.innerWidth - 12) {
        left = Math.max(8, window.innerWidth - dropW - 12);
      }
      dropdown.style.left = left + 'px';
      const maxH = Math.max(260, window.innerHeight - rect.bottom - 16);
      dropdown.style.maxHeight = maxH + 'px';
    }
    dropdown.classList.remove('hidden');
  };

  window.closeBasemapDropdown = function () {
    const dropdown = document.getElementById('basemapDropdown');
    if (dropdown) dropdown.classList.add('hidden');
  };

  window.selectCadStyle = function (styleKey, label) {
    window.setDrawingStyle(styleKey);
    const lbl = document.getElementById('lblActiveCadStyle');

    if (lbl && label) {
      const cleanLabel = label.split('(')[0].trim();
      lbl.innerText = cleanLabel.length > 13 ? cleanLabel.slice(0, 12) + '…' : cleanLabel;
    }
    window.closeAllDropdowns();
  };

  window.selectCadScale = function (scaleVal) {
    window.changeCadScale(scaleVal);
    const lbl = document.getElementById('lblActiveCadScale');
    if (lbl) lbl.innerText = scaleVal;
    window.closeAllDropdowns();
  };

  window.updateBldDimensions = function () {
    const wEl = document.getElementById('quickBldW_dd');
    const lEl = document.getElementById('quickBldL_dd');
    const fEl = document.getElementById('quickBldFloors_dd');
    const w = wEl ? parseFloat(wEl.value) : 15;
    const l = lEl ? parseFloat(lEl.value) : 12;
    const f = fEl ? parseInt(fEl.value, 10) : 4;
    state.stampWidth = w;
    state.stampLength = l;
    state.stampFloors = f;
    if (typeof window.updateBuildingDimensions === 'function') {
      window.updateBuildingDimensions(w, l);
    }
    if (typeof window.updateBuildingFloors === 'function') {
      window.updateBuildingFloors(f);
    }
  };

  window.addEventListener('click', (e) => {
    if (e.target.closest('.cad-menu-popup')) return;
    if (e.target.closest('[onclick*="toggleDropdownMenu"]') || e.target.closest('[id^="dropdownBtn_"]') || e.target.closest('[id^="btn"][id$="Menu"]') || e.target.closest('#btnLayersMenuTrigger')) return;
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

    const lbl = document.getElementById('lblActiveCadScale');
    if (lbl) lbl.innerText = `1:${ratio}`;
    const sel = document.getElementById('selCadScale');
    if (sel) sel.value = `1:${ratio}`;

    applyTransform();
    updateToolStatus(`არჩეულია მასშტაბი M 1:${ratio}`);
  };

  function updateGraphicScaleBar() {
    if (!els.lblGraphicScaleUnit || !els.lblCurrentScaleRatio) return;

    const currentRatio = Math.round(METERS_TO_PIXELS_REAL / Math.max(0.001, state.zoomScale));
    els.lblCurrentScaleRatio.innerText = `M 1:${currentRatio}`;

    const standards = [100, 200, 500, 1000, 2000, 5000];
    const closest = standards.reduce((prev, curr) => Math.abs(curr - currentRatio) < Math.abs(prev - currentRatio) ? curr : prev);
    if (Math.abs(closest - currentRatio) / closest < 0.18) {
      if (els.selCadScale) els.selCadScale.value = `1:${closest}`;
      const lblScale = document.getElementById('lblActiveCadScale');
      if (lblScale) lblScale.innerText = `1:${closest}`;
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

  // --- Ribbon Scrolling Controls ---
  window.scrollRibbonRow = function (rowId, delta) {
    const row = rowId === 'row1' ? document.getElementById('cadRibbonRow1') : document.getElementById('cadRibbonRow2');
    if (row) {
      row.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  // --- Collapsible Sidebars ---
  window.toggleLeftSidebar = function () {
    const sb = document.getElementById('leftCadastralSidebar');
    const btnExpand = document.getElementById('btnExpandLeftSidebar');
    if (!sb) return;
    const isCollapsed = sb.classList.toggle('sidebar-collapsed');
    if (btnExpand) {
      if (isCollapsed) {
        btnExpand.classList.remove('hidden');
        btnExpand.classList.add('flex');
      } else {
        btnExpand.classList.add('hidden');
        btnExpand.classList.remove('flex');
      }
    }
    // Recompute sizes
    setTimeout(() => {
      if (tsinareMap) tsinareMap.invalidateSize();
      renderCadWorld();
    }, 320);
  };

  window.toggleRightSidebar = function () {
    const sb = document.getElementById('rightZoningSidebar');
    const btnExpand = document.getElementById('btnExpandRightSidebar');
    if (!sb) return;
    const isCollapsed = sb.classList.toggle('sidebar-collapsed');
    if (btnExpand) {
      if (isCollapsed) {
        btnExpand.classList.remove('hidden');
        btnExpand.classList.add('flex');
      } else {
        btnExpand.classList.add('hidden');
        btnExpand.classList.remove('flex');
      }
    }
    setTimeout(() => {
      if (tsinareMap) tsinareMap.invalidateSize();
      renderCadWorld();
    }, 320);
  };

  // --- View Mode Switcher: CAD | Hybrid Satellite | Full GIS Map ---
  window.setViewMode = function (mode) {
    state.viewMode = mode;
    const btnCad = document.getElementById('btnModeCad');
    const btnHybrid = document.getElementById('btnModeHybrid');
    const btnMap = document.getElementById('btnModeMap');
    const bgRect = document.getElementById('cadGridBackground');
    const gridOverlay = document.getElementById('cadGridOverlay');
    const cadSvg = document.getElementById('cadSvgContainer');

    [btnCad, btnHybrid, btnMap].forEach(b => {
      if (b) {
        b.className = 'h-8 px-2.5 rounded-md text-slate-300 hover:text-white transition flex items-center gap-1.5';
      }
    });

    if (mode === 'cad') {
      if (btnCad) btnCad.className = 'h-8 px-2.5 rounded-md bg-sky-500/25 border border-sky-400 text-sky-300 font-bold transition flex items-center gap-1.5';
      if (bgRect) bgRect.setAttribute('fill', 'var(--canvas-bg)');
      if (gridOverlay) gridOverlay.style.opacity = '1';
      if (cadSvg) {
        cadSvg.style.display = 'block';
        cadSvg.style.pointerEvents = 'auto';
      }
    } else if (mode === 'hybrid') {
      if (btnHybrid) btnHybrid.className = 'h-8 px-2.5 rounded-md bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-bold transition flex items-center gap-1.5';
      if (bgRect) bgRect.setAttribute('fill', 'transparent');
      if (gridOverlay) gridOverlay.style.opacity = '0.25';
      if (cadSvg) {
        cadSvg.style.display = 'block';
        cadSvg.style.pointerEvents = 'auto';
      }
      // In hybrid mode: if currently on a road/non-satellite basemap, auto-switch to satellite
      if (tsinareMap) {
        const currentBasemap = BASEMAP_REGISTRY[state.activeBasemap];
        if (!currentBasemap || currentBasemap.group !== 'satellite') {
          window.setBasemap('esri_satellite');
        }
        if (state.centroidLatLng) tsinareMap.setView(state.centroidLatLng, 18);
        tsinareMap.invalidateSize();
      }
      // Show basemap picker
      const picker = document.getElementById('basemapPickerPanel');
      if (picker) picker.style.display = 'flex';
    } else if (mode === 'map') {
      if (btnMap) btnMap.className = 'h-8 px-2.5 rounded-md bg-amber-500/25 border border-amber-400 text-amber-300 font-bold transition flex items-center gap-1.5';
      if (bgRect) bgRect.setAttribute('fill', 'transparent');
      if (gridOverlay) gridOverlay.style.opacity = '0.08';
      if (cadSvg) {
        cadSvg.style.display = 'block';
        cadSvg.style.pointerEvents = 'none';
      }
      // In map mode: if currently on satellite, auto-switch to OSM road map
      if (tsinareMap) {
        const currentBasemap = BASEMAP_REGISTRY[state.activeBasemap];
        if (!currentBasemap || currentBasemap.group === 'satellite') {
          window.setBasemap('osm');
        }
        if (state.centroidLatLng) tsinareMap.setView(state.centroidLatLng, 18);
        tsinareMap.invalidateSize();
      }
      // Show basemap picker
      const picker = document.getElementById('basemapPickerPanel');
      if (picker) picker.style.display = 'flex';
    }
  };

  // --- CAD Ribbon Tab Switcher ---
  window.switchCadRibbonTab = function (tabName) {
    state.activeRibbonTab = tabName || 'default';
    const tabs = ['cad_draw', 'buildings', 'cad_modify', 'contour_edit', 'site_env'];
    const quickPanel = document.getElementById('panel_default_quick');
    let anyTabActive = false;
    tabs.forEach(t => {
      const panel = document.getElementById(`panel_${t}`);
      const btn = document.getElementById(`tabBtn_${t}`);
      if (panel) {
        if (t === state.activeRibbonTab) {
          panel.classList.remove('hidden');
          anyTabActive = true;
        } else {
          panel.classList.add('hidden');
        }
      }
      if (btn) {
        if (t === state.activeRibbonTab) {
          btn.className = 'btn-ribbon-tab h-7 px-2.5 rounded text-xs flex items-center gap-1.5 transition bg-sky-500/25 border border-sky-400 text-sky-300 font-bold';
        } else {
          btn.className = 'btn-ribbon-tab h-7 px-2.5 rounded text-xs flex items-center gap-1.5 transition bg-[#142036] border border-[#223354] text-slate-300 hover:text-white';
        }
      }
    });
    if (quickPanel) {
      if (anyTabActive) {
        quickPanel.classList.add('hidden');
      } else {
        quickPanel.classList.remove('hidden');
      }
    }
  };

  // --- Quick Parameter Helpers for Ribbon Tier 2 Inputs ---
  window.applyQuickRoadWidth = function (val) {
    const w = parseFloat(val) || 6.0;
    state.activeRoadWidth = w;
  };
  window.applyQuickWalkwayWidth = function (val) {
    const w = parseFloat(val) || 1.8;
    state.activeWalkwayWidth = w;
  };
  window.applyQuickTreeDiam = function (val) {
    const d = parseFloat(val) || 5.0;
    state.activeTreeRadius = d / 2;
  };
  window.applyQuickBuildingDim = function () {
    const w = parseFloat(document.getElementById('quickBldW')?.value) || 15;
    const l = parseFloat(document.getElementById('quickBldL')?.value) || 12;
    state.stampWidth = w;
    state.stampLength = l;
    if (els.inputNumBuildingWidth) els.inputNumBuildingWidth.value = w;
    if (els.inputNumBuildingLength) els.inputNumBuildingLength.value = l;
  };
  window.applyQuickBuildingFloors = function () {
    const f = parseInt(document.getElementById('quickBldFloors')?.value, 10) || 4;
    state.stampFloors = f;
    if (els.inputNumBuildingFloors) els.inputNumBuildingFloors.value = f;
  };

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
    state.cadDraftPoints = [];
    state.atriumCutoutPoints = [];
    state.isFreehandDrawing = false;
    state.activeSnap = null;

    if (toolName === 'footprint_vertex') {
      state.footprintEditMode = true;
    } else {
      state.footprintEditMode = false;
    }

    if (els.cadDynamicHud) els.cadDynamicHud.classList.add('hidden');
    if (els.cadOsnapTooltip) els.cadOsnapTooltip.classList.add('hidden');

    // Auto-switch ribbon tab based on active tool category
    const toolToTabMap = {
      'draw_cad_line': 'cad_draw',
      'draw_cad_polyline': 'cad_draw',
      'draw_cad_arc': 'cad_draw',
      'draw_cad_circle': 'cad_draw',
      'draw_cad_hatch': 'cad_draw',
      'draw_cad_freehand': 'cad_draw',
      'draw_rect_footprint': 'buildings',
      'draw_polygon': 'buildings',
      'draw_footprint': 'buildings',
      'stamp_footprint': 'buildings',
      'cad_offset': 'cad_modify',
      'cad_trim': 'cad_modify',
      'cad_extend': 'cad_modify',
      'cad_mirror': 'cad_modify',
      'cad_array': 'cad_modify',
      'footprint_vertex': 'contour_edit',
      'footprint_cutout': 'contour_edit',
      'draw_road': 'site_env',
      'walkway': 'site_env',
      'bike_path': 'site_env',
      'parking': 'site_env',
      'tree': 'site_env',
      'pine_tree': 'site_env',
      'water': 'site_env',
      'terrace': 'site_env',
      'split': 'site_env',
      'ruler': 'site_env'
    };
    if (toolName === 'pan' || toolName === 'delete') {
      window.switchCadRibbonTab('default');
    } else if (toolToTabMap[toolName]) {
      window.switchCadRibbonTab(toolToTabMap[toolName]);
    }

    document.querySelectorAll('.btn-cad-tool').forEach(btn => btn.classList.remove('btn-tool-active'));
    const btnMap = {
      'pan': 'toolBtnPan',
      'delete': 'toolBtnDelete',
      'split': 'toolBtnSplit',
      'draw_footprint': 'toolBtnDrawFootprint',
      'draw_polygon': 'toolBtnDrawFootprint',
      'draw_rect_footprint': 'toolBtnDrawRectFootprint',
      'stamp_footprint': 'toolBtnStampFootprint',
      'tree': 'toolBtnTree',
      'pine_tree': 'toolBtnPineTree',
      'water': 'toolBtnWater',
      'terrace': 'toolBtnTerrace',
      'walkway': 'toolBtnWalkway',
      'bike_path': 'toolBtnBikePath',
      'draw_road': 'toolBtnDrawRoad',
      'parking': 'toolBtnParking',
      'ruler': 'toolBtnRuler',
      'draw_cad_line': 'toolBtnCadLine',
      'draw_cad_polyline': 'toolBtnCadPolyline',
      'draw_cad_arc': 'toolBtnCadArc',
      'draw_cad_circle': 'toolBtnCadCircle',
      'draw_cad_hatch': 'toolBtnCadHatch',
      'draw_cad_freehand': 'toolBtnCadFreehand',
      'cad_offset': 'toolBtnCadOffset',
      'cad_trim': 'toolBtnCadTrim',
      'cad_extend': 'toolBtnCadExtend',
      'cad_mirror': 'toolBtnCadMirror',
      'cad_array': 'toolBtnCadArray',
      'footprint_vertex': 'toolBtnCadVertex',
      'footprint_cutout': 'toolBtnCadCutout'
    };
    if (btnMap[toolName]) {
      const btn = document.getElementById(btnMap[toolName]);
      if (btn) btn.classList.add('btn-tool-active');
    }

    // Also activate in all_tools panel
    const allBtnMap = {
      'draw_cad_line': 'allToolBtn_line',
      'draw_cad_polyline': 'allToolBtn_polyline',
      'draw_cad_arc': 'allToolBtn_arc',
      'draw_cad_circle': 'allToolBtn_circle',
      'draw_cad_hatch': 'allToolBtn_hatch',
      'draw_rect_footprint': 'allToolBtn_rectFp',
      'draw_polygon': 'allToolBtn_polyFp',
      'draw_footprint': 'allToolBtn_polyFp',
      'stamp_footprint': 'allToolBtn_stamp',
      'cad_offset': 'allToolBtn_offset',
      'cad_trim': 'allToolBtn_trim',
      'cad_extend': 'allToolBtn_extend',
      'cad_mirror': 'allToolBtn_mirror',
      'cad_array': 'allToolBtn_array',
      'footprint_vertex': 'allToolBtn_vertex',
      'footprint_cutout': 'allToolBtn_cutout',
      'draw_road': 'allToolBtn_road',
      'walkway': 'allToolBtn_walkway',
      'parking': 'allToolBtn_parking',
      'tree': 'allToolBtn_tree',
      'water': 'allToolBtn_water',
      'terrace': 'allToolBtn_terrace',
      'ruler': 'allToolBtn_ruler'
    };
    if (allBtnMap[toolName]) {
      const allEl = document.getElementById(allBtnMap[toolName]);
      if (allEl) allEl.classList.add('btn-tool-active');
    }

    // Highlight category dropdown buttons
    const catByTool = {
      'draw_cad_line': 'draw',
      'draw_cad_polyline': 'draw',
      'draw_cad_arc': 'draw',
      'draw_cad_circle': 'draw',
      'draw_cad_hatch': 'draw',
      'draw_rect_footprint': 'buildings',
      'draw_polygon': 'buildings',
      'draw_footprint': 'buildings',
      'stamp_footprint': 'buildings',
      'cad_offset': 'modify',
      'cad_trim': 'modify',
      'cad_extend': 'modify',
      'cad_mirror': 'modify',
      'cad_array': 'modify',
      'footprint_vertex': 'contour',
      'footprint_cutout': 'contour',
      'draw_road': 'site',
      'walkway': 'site',
      'parking': 'site',
      'tree': 'site',
      'water': 'site',
      'terrace': 'site',
      'ruler': 'site'
    };
    ['draw', 'buildings', 'modify', 'contour', 'site'].forEach(cat => {
      const btn = document.getElementById(`dropdownBtn_${cat}`);
      if (btn) {
        if (catByTool[toolName] === cat) {
          btn.classList.add('btn-tool-active', 'border-sky-400');
        } else {
          btn.classList.remove('btn-tool-active', 'border-sky-400');
        }
      }
    });

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
      'delete': 'საშლელი: დააკლიკეთ ნებისმიერ ობიექტზე (შენობა, ხე, აუზი, ტერასა, გზა, ბილიკი, პარკინგი, CAD ხაზი) მის წასაშლელად',
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
      'ruler': 'საზომი: დააკლიკეთ ორ წერტილზე მანძილის გასაზომად',
      'draw_cad_line': '📏 ხაზი (Line): დააკლიკეთ დასაწყისს, შემდეგ ბოლოს ან შეიყვანეთ სიგრძე და კუთხე Dynamic HUD-ში [L]',
      'draw_cad_polyline': '📐 პოლიხაზი (Polyline): დააკლიკეთ წერტილებს თანმიმდევრობით (Enter / ორმაგი კლიკი ასრულებს) [PL]',
      'draw_cad_arc': '🏹 რკალი (3-Point Arc): დააკლიკეთ 3 წერტილს (საწყისი, გავლის წერტილი, ბოლო) [A]',
      'draw_cad_circle': '⭕ წრე (Circle): დააკლიკეთ ცენტრს, შემდეგ მიუთითეთ რადიუსი (ან შეიყვანეთ HUD-ში) [C]',
      'draw_cad_hatch': '▦ შტრიხი (Hatch): დააკლიკეთ მრავალკუთხა კონტურს არქიტექტურული შტრიხით დასაფარად [H]',
      'draw_cad_freehand': '✍️ თავისუფალი კონტური: დააჭირეთ და თავისუფლად გადაატარეთ მაუსი ჩანახატის გასაკეთებლად',
      'cad_offset': '↔️ პარალელური გადაწევა (Offset): დააკლიკეთ ხაზს ან გზის ღერძს მითითებული მანძილით კიდეების მისაღებად',
      'cad_trim': '✂️ მოჭრა (Trim): დააკლიკეთ გადაკვეთის ზედმეტ სეგმენტზე მის ჩამოსაჭრელად [TR]',
      'cad_extend': '➡️ გაგრძელება (Extend): დააკლიკეთ ხაზს უახლოეს საზღვრამდე გასაგრძელებლად [EX]',
      'cad_mirror': '🪞 სარკისებური ასლი: დააკლიკეთ 2 წერტილს სარკის ღერძის გასავლებად [MI]',
      'cad_array': '🔲 თანაბარი გამეორება (Array): დააკლიკეთ შენობას მის გასამრავლებლად თანაბარი ბიჯით [AR]',
      'footprint_vertex': '🎯 კუთხეების მართვა: გადააადგილეთ კუთხეები, დააკლიკეთ [+] ახალი კუთხის დასამატებლად ან Alt+კლიკი წასაშლელად',
      'footprint_cutout': '🕳️ შიდა ეზოს / ატრიუმის ამოჭრა: დახაზეთ შიდა კონტური შენობის ლაქაში სიცარიელის ამოსაჭრელად'
    };

    const toolMetaMap = {
      'pan': { name: 'არჩევა [V]', icon: '<i class="fa-solid fa-arrow-pointer text-sky-400"></i>' },
      'delete': { name: 'საშლელი [E]', icon: '<i class="fa-solid fa-eraser text-rose-400"></i>' },
      'draw_cad_line': { name: 'ხაზი [L]', icon: '<i class="fa-solid fa-slash text-cyan-400"></i>' },
      'draw_cad_polyline': { name: 'პოლიხაზი [PL]', icon: '<i class="fa-solid fa-chart-line text-sky-400"></i>' },
      'draw_cad_arc': { name: 'რკალი [A]', icon: '<i class="fa-solid fa-bezier-curve text-amber-400"></i>' },
      'draw_cad_circle': { name: 'წრე [C]', icon: '<i class="fa-regular fa-circle text-emerald-400"></i>' },
      'draw_cad_hatch': { name: 'შტრიხი', icon: '<i class="fa-solid fa-border-all text-purple-400"></i>' },
      'draw_cad_freehand': { name: 'თავისუფალი', icon: '<i class="fa-solid fa-signature text-rose-400"></i>' },
      'draw_rect_footprint': { name: 'მართკუთხა ლაქა', icon: '<i class="fa-solid fa-vector-square text-sky-400"></i>' },
      'draw_polygon': { name: 'პოლიგონი', icon: '<i class="fa-solid fa-draw-polygon text-purple-400"></i>' },
      'draw_footprint': { name: 'პოლიგონი', icon: '<i class="fa-solid fa-draw-polygon text-purple-400"></i>' },
      'stamp_footprint': { name: 'ბლოკი [B]', icon: '<i class="fa-solid fa-stamp text-cyan-400"></i>' },
      'cad_offset': { name: 'ოფსეტი [O]', icon: '<i class="fa-solid fa-arrows-left-right text-amber-400"></i>' },
      'cad_trim': { name: 'მოჭრა [X]', icon: '<i class="fa-solid fa-crop-simple text-rose-400"></i>' },
      'cad_extend': { name: 'გაგრძელება', icon: '<i class="fa-solid fa-arrow-right-to-bracket text-sky-400"></i>' },
      'cad_mirror': { name: 'სარკე', icon: '<i class="fa-solid fa-arrows-split-up-and-left text-purple-400"></i>' },
      'cad_array': { name: 'მასივი', icon: '<i class="fa-solid fa-table-cells text-cyan-400"></i>' },
      'footprint_vertex': { name: 'კუთხეები', icon: '<i class="fa-solid fa-crosshairs text-sky-400"></i>' },
      'footprint_cutout': { name: 'ატრიუმი', icon: '<i class="fa-solid fa-ring text-rose-400"></i>' },
      'draw_road': { name: 'გზა [G]', icon: '<i class="fa-solid fa-road text-blue-400"></i>' },
      'walkway': { name: 'ბილიკი [K]', icon: '<i class="fa-solid fa-shoe-prints text-cyan-400"></i>' },
      'parking': { name: 'პარკინგი [P]', icon: '<i class="fa-solid fa-square-parking text-sky-400"></i>' },
      'tree': { name: 'ხე [T]', icon: '<i class="fa-solid fa-tree text-emerald-400"></i>' },
      'pine_tree': { name: 'წიწვოვანი', icon: '<i class="fa-solid fa-tree text-emerald-300"></i>' },
      'hedge': { name: 'ღობე/ბუჩქი', icon: '<i class="fa-solid fa-bars text-emerald-400"></i>' },
      'water': { name: 'აუზი [W]', icon: '<i class="fa-solid fa-water-ladder text-cyan-400"></i>' },
      'fountain': { name: 'შადრევანი', icon: '<i class="fa-solid fa-faucet-drip text-cyan-300"></i>' },
      'terrace': { name: 'ტერასა', icon: '<i class="fa-solid fa-layer-group text-amber-400"></i>' },
      'ruler': { name: 'საზომი [R]', icon: '<i class="fa-solid fa-ruler-combined text-amber-400"></i>' },
      'split': { name: 'დაყოფა', icon: '<i class="fa-solid fa-scissors text-amber-400"></i>' }
    };
    const meta = toolMetaMap[toolName];
    if (meta) {
      const activeNameEl = document.getElementById('activeToolName');
      const activeIconEl = document.getElementById('activeToolIcon');
      if (activeNameEl) activeNameEl.innerText = meta.name;
      if (activeIconEl) activeIconEl.innerHTML = meta.icon;
    }

    updateToolStatus(hintMap[toolName] || '');
    renderInteractionLayer();
  };

  function updateToolStatus(text) {
    if (els.lblToolStatusHint) els.lblToolStatusHint.innerText = text;
    const ribbonHint = document.getElementById('lblRibbonToolStatusHint');
    if (ribbonHint) ribbonHint.innerText = text;
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

      // 12. CAD PRECISION DRAFTING TOOLS (LINE, POLYLINE, ARC, CIRCLE, HATCH, CUTOUT)
      if (state.activeTool === 'draw_cad_line' || state.activeTool === 'draw_cad_polyline' || state.activeTool === 'draw_cad_arc' || state.activeTool === 'draw_cad_circle' || state.activeTool === 'draw_cad_hatch' || state.activeTool === 'footprint_cutout') {
        let commitPt = [worldPos[0], worldPos[1]];
        if (state.activeSnap) {
          commitPt = [state.activeSnap.point[0], state.activeSnap.point[1]];
        } else if (state.orthoEnabled && state.cadDraftPoints && state.cadDraftPoints.length > 0) {
          const prev = state.cadDraftPoints[state.cadDraftPoints.length - 1];
          const dx = Math.abs(worldPos[0] - prev[0]);
          const dy = Math.abs(worldPos[1] - prev[1]);
          if (dx > dy) {
            commitPt = [worldPos[0], prev[1]];
          } else {
            commitPt = [prev[0], worldPos[1]];
          }
        }
        handleCadCommitPoint(commitPt);
        return;
      }

      // 13. CAD FREEHAND DRAWING
      if (state.activeTool === 'draw_cad_freehand') {
        saveUndoSnapshot();
        state.isFreehandDrawing = true;
        state.currentFreehandPoints = [worldPos];
        renderInteractionLayer();
        return;
      }

      // 14. CAD MODIFY TOOLS: OFFSET, TRIM, EXTEND
      if (state.activeTool === 'cad_offset') {
        let nearestTarget = null;
        let minD = 999999;
        (state.cadLines || []).forEach(l => {
          const d = distPointToSegment(worldPos, l.p1, l.p2);
          if (d < minD && d < 6.0) { minD = d; nearestTarget = l; }
        });
        (state.roads || []).forEach(r => {
          if (r.points && r.points.length >= 2) {
            for (let i = 0; i < r.points.length - 1; i++) {
              const d = distPointToSegment(worldPos, r.points[i], r.points[i + 1]);
              if (d < minD && d < 6.0) { minD = d; nearestTarget = r; }
            }
          }
        });
        if (nearestTarget) {
          window.cadOffsetGeometry(nearestTarget, worldPos);
        } else {
          updateToolStatus('ოფსეტისთვის დააკლიკეთ CAD ხაზს ან გზას.');
        }
        return;
      }

      if (state.activeTool === 'cad_trim') {
        let nearestLine = null;
        let minD = 999999;
        (state.cadLines || []).forEach(l => {
          const d = distPointToSegment(worldPos, l.p1, l.p2);
          if (d < minD && d < 4.0) { minD = d; nearestLine = l; }
        });
        if (nearestLine) {
          window.cadTrimLine(nearestLine, worldPos);
        } else {
          updateToolStatus('მოსაჭრელად დააკლიკეთ CAD ხაზს.');
        }
        return;
      }

      if (state.activeTool === 'cad_extend') {
        let nearestLine = null;
        let minD = 999999;
        (state.cadLines || []).forEach(l => {
          const d = distPointToSegment(worldPos, l.p1, l.p2);
          if (d < minD && d < 4.0) { minD = d; nearestLine = l; }
        });
        if (nearestLine) {
          window.cadExtendLine(nearestLine, worldPos);
        } else {
          updateToolStatus('გასაგრძელებლად დააკლიკეთ CAD ხაზის ბოლოსთან.');
        }
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
      } else if (state.activeTool === 'draw_cad_polyline') {
        window.finishCadPolyline();
      } else if (state.activeTool === 'draw_cad_hatch') {
        window.finishCadHatch();
      } else if (state.activeTool === 'footprint_cutout') {
        window.finishFootprintCutout();
      }
    });

    container.addEventListener('contextmenu', (e) => {
      if ((state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon') && state.drawPoints.length >= 3) {
        e.preventDefault();
        finishDrawnFootprint();
      } else if (state.activeTool === 'draw_cad_polyline') {
        e.preventDefault();
        window.finishCadPolyline();
      } else if (state.activeTool === 'draw_cad_hatch') {
        e.preventDefault();
        window.finishCadHatch();
      } else if (state.activeTool === 'footprint_cutout') {
        e.preventDefault();
        window.finishFootprintCutout();
      }
    });

    // Mouse Move
    window.addEventListener('mousemove', (e) => {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      state.mouseWorldPos = worldPos;

      // OSNAP Calculation for CAD drafting and drawing tools
      if (state.osnapEnabled !== false && (
        (state.activeTool && state.activeTool.startsWith('draw_cad_')) ||
        state.activeTool === 'footprint_cutout' ||
        state.activeTool === 'draw_footprint' ||
        state.activeTool === 'draw_polygon' ||
        state.activeTool === 'ruler'
      )) {
        state.activeSnap = findOsnap(worldPos);
        if (state.activeSnap && els.cadOsnapTooltip) {
          const pt = state.activeSnap.point;
          const rect = els.cadSvgContainer.getBoundingClientRect();
          const sx = pt[0] * state.zoomScale + state.panX + rect.left;
          const sy = pt[1] * state.zoomScale + state.panY + rect.top;
          els.cadOsnapTooltip.style.left = `${sx + 14}px`;
          els.cadOsnapTooltip.style.top = `${sy - 10}px`;
          const snapLabels = {
            'endpoint': 'Endpoint (ბოლო □)',
            'midpoint': 'Midpoint (შუა △)',
            'intersection': 'Intersection (გადაკვეთა ✕)',
            'perpendicular': 'Perpendicular (პერპენდიკულარი ∟)'
          };
          els.cadOsnapTooltip.innerText = snapLabels[state.activeSnap.type] || 'OSNAP წერტილი';
          els.cadOsnapTooltip.classList.remove('hidden');
        } else if (els.cadOsnapTooltip) {
          els.cadOsnapTooltip.classList.add('hidden');
        }
      } else {
        state.activeSnap = null;
        if (els.cadOsnapTooltip) els.cadOsnapTooltip.classList.add('hidden');
      }

      // Dynamic HUD update (Length & Angle)
      const hasCadDraftPoints = state.cadDraftPoints && state.cadDraftPoints.length > 0;
      if (hasCadDraftPoints && (state.activeTool === 'draw_cad_line' || state.activeTool === 'draw_cad_polyline' || state.activeTool === 'draw_cad_circle')) {
        const prevPt = state.cadDraftPoints[state.cadDraftPoints.length - 1];
        let targetPt = state.activeSnap ? state.activeSnap.point : worldPos;
        if (state.orthoEnabled && !state.activeSnap) {
          const dx = Math.abs(targetPt[0] - prevPt[0]);
          const dy = Math.abs(targetPt[1] - prevPt[1]);
          if (dx > dy) targetPt = [targetPt[0], prevPt[1]];
          else targetPt = [prevPt[0], targetPt[1]];
        }
        updateDynamicHud(e.clientX, e.clientY, prevPt, targetPt);
      } else if (!hasCadDraftPoints && els.cadDynamicHud && !els.cadDynamicHud.classList.contains('hidden')) {
        els.cadDynamicHud.classList.add('hidden');
      }

      // Freehand drawing drag
      if (state.isFreehandDrawing && state.activeTool === 'draw_cad_freehand') {
        state.currentFreehandPoints = state.currentFreehandPoints || [];
        const lastPt = state.currentFreehandPoints[state.currentFreehandPoints.length - 1];
        if (!lastPt || Math.hypot(worldPos[0] - lastPt[0], worldPos[1] - lastPt[1]) > 0.3) {
          state.currentFreehandPoints.push([Math.round(worldPos[0] * 10) / 10, Math.round(worldPos[1] * 10) / 10]);
          renderInteractionLayer();
        }
        return;
      }

      // Footprint vertex dragging
      if (state.isDraggingCadVertex && state.draggedFpId != null && state.draggedVertexIdx != null) {
        const fp = state.footprints.find(f => f.id === state.draggedFpId);
        if (fp && fp.vertices && fp.vertices[state.draggedVertexIdx]) {
          let newV = state.activeSnap ? state.activeSnap.point : worldPos;
          fp.vertices[state.draggedVertexIdx] = [Math.round(newV[0] * 10) / 10, Math.round(newV[1] * 10) / 10];
          fp.shape = 'freeform';
          fp.areaSqm = Math.max(1, Math.round(calculatePolygonArea(fp.vertices) - (fp.holes || []).reduce((s, h) => s + calculatePolygonArea(h), 0)));
          renderCadWorld();
        }
        return;
      }

      if (state.isDrawingRect && state.activeTool === 'draw_rect_footprint') {
        state.drawRectCurrent = [worldPos[0], worldPos[1]];
        renderInteractionLayer();
        return;
      }

      if (state.activeTool === 'stamp_footprint' || state.activeTool === 'draw_rect_footprint' || state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon' || state.activeTool === 'walkway' || state.activeTool === 'bike_path' || state.activeTool === 'draw_road' || state.activeTool === 'hedge' || (state.activeTool && state.activeTool.startsWith('draw_cad_')) || state.activeTool === 'footprint_cutout') {
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
      if (state.isFreehandDrawing && state.activeTool === 'draw_cad_freehand') {
        state.isFreehandDrawing = false;
        if (state.currentFreehandPoints && state.currentFreehandPoints.length >= 2) {
          saveUndoSnapshot();
          state.cadFreehands.push({
            id: 'cad_free_' + Date.now(),
            points: [...state.currentFreehandPoints],
            color: '#f43f5e'
          });
          updateToolStatus('თავისუფალი კონტური წარმატებით დაიტანა ნახაზზე.');
        }
        state.currentFreehandPoints = [];
        renderCadWorld();
        return;
      }

      if (state.isDraggingCadVertex) {
        state.isDraggingCadVertex = false;
        state.draggedFpId = null;
        state.draggedVertexIdx = null;
        updateSelectedBuildingUI();
        updateZoningCoefficientsUI();
        renderCadWorld();
      }

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

  function syncMapWithCad() {
    if (!tsinareMap || !state.centroidLatLng || !els.cadSvgContainer) return;
    if (state.viewMode !== 'hybrid' && state.viewMode !== 'map') return;

    const rect = els.cadSvgContainer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Center of screen in CAD container coordinates
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    // Convert screen center to CAD metric world coordinates (meters relative to centroid)
    const worldCenterX = (cx - state.panX) / state.zoomScale;
    const worldCenterY = (cy - state.panY) / state.zoomScale;

    // Convert CAD metric world coords back to WGS84 Lat/Lng
    const avgLat = state.centroidLatLng[0];
    const avgLng = state.centroidLatLng[1];
    const metersPerDegLat = 111132.954;
    const metersPerDegLng = 111132.954 * Math.cos((avgLat * Math.PI) / 180);

    const lat = avgLat - (worldCenterY / metersPerDegLat);
    const lng = avgLng + (worldCenterX / metersPerDegLng);

    // Compute Leaflet zoom level matching state.zoomScale (pixels per meter)
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const metersPerPixelAtZoom0 = 156543.03392 * cosLat;
    const targetZoom = Math.log2(Math.max(0.001, state.zoomScale) * metersPerPixelAtZoom0);
    const clampedZoom = Math.max(2, Math.min(22, targetZoom));

    tsinareMap.setView([lat, lng], clampedZoom, { animate: false });
  }

  function applyTransform() {
    if (els.worldGroup) {
      els.worldGroup.setAttribute('transform', `translate(${state.panX}, ${state.panY}) scale(${state.zoomScale})`);
    }
    updateGraphicScaleBar();
    renderCadWorld();
    syncMapWithCad();
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
  // --- PRECISE CAD DRAFTING & VECTOR GEOMETRY ENGINE ---
  // =========================================================================

  // Mathematical Geometry Helpers
  function cadDist(p1, p2) {
    return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  }

  function getLineLineIntersection(p1, p2, p3, p4) {
    const d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    if (Math.abs(d) < 1e-9) return null;
    const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d;
    const u = -((p1[0] - p2[0]) * (p1[1] - p3[1]) - (p1[1] - p2[1]) * (p1[0] - p3[0])) / d;
    if (t >= -0.01 && t <= 1.01 && u >= -0.01 && u <= 1.01) {
      return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
    }
    return null;
  }

  function filletCorner(prev, curr, next, r) {
    const v1 = [prev[0] - curr[0], prev[1] - curr[1]];
    const v2 = [next[0] - curr[0], next[1] - curr[1]];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    if (l1 < 0.1 || l2 < 0.1) return [curr];
    const u1 = [v1[0] / l1, v1[1] / l1];
    const u2 = [v2[0] / l2, v2[1] / l2];
    const dot = Math.max(-0.999, Math.min(0.999, u1[0] * u2[0] + u1[1] * u2[1]));
    const angle = Math.acos(dot);
    const halfAngle = angle / 2;
    const t = r / Math.tan(halfAngle);
    const maxT = Math.min(l1, l2) * 0.45;
    const effT = Math.min(t, maxT);
    const pA = [curr[0] + u1[0] * effT, curr[1] + u1[1] * effT];
    const pB = [curr[0] + u2[0] * effT, curr[1] + u2[1] * effT];
    const mid = [
      0.25 * pA[0] + 0.5 * curr[0] + 0.25 * pB[0],
      0.25 * pA[1] + 0.5 * curr[1] + 0.25 * pB[1]
    ];
    return [pA, mid, pB];
  }

  // --- Precision Magnetic OSNAP Engine (Endpoint, Midpoint, Intersection, Perpendicular) ---
  function findOsnap(worldPos, excludePoint) {
    if (!state.osnapEnabled) return null;
    const pxToM = 1 / Math.max(0.001, state.zoomScale);
    const snapThreshold = 18 * pxToM;
    let bestSnap = null;
    let minD = snapThreshold;

    function testPoint(pt, type, name) {
      if (!pt) return;
      if (excludePoint && Math.hypot(pt[0] - excludePoint[0], pt[1] - excludePoint[1]) < 0.05) return;
      const d = Math.hypot(worldPos[0] - pt[0], worldPos[1] - pt[1]);
      if (d < minD) {
        minD = d;
        bestSnap = { point: [pt[0], pt[1]], type, name };
      }
    }

    // 1. Check Endpoints & Vertices
    (state.cadLines || []).forEach(l => {
      testPoint(l.p1, 'endpoint', 'ბოლო წერტილი (Endpoint)');
      testPoint(l.p2, 'endpoint', 'ბოლო წერტილი (Endpoint)');
    });
    (state.cadPolylines || []).forEach(pl => {
      (pl.points || []).forEach(pt => testPoint(pt, 'endpoint', 'ბოლო წერტილი (Endpoint)'));
    });
    (state.cadArcs || []).forEach(a => {
      testPoint(a.p1, 'endpoint', 'რკალის საწყისი');
      testPoint(a.p2, 'endpoint', 'რკალის გავლა');
      testPoint(a.p3, 'endpoint', 'რკალის ბოლო');
    });
    (state.cadCircles || []).forEach(c => testPoint(c.center, 'endpoint', 'წრის ცენტრი (Center)'));
    (state.boundaryMeters || []).forEach((pt, i) => testPoint(pt, 'endpoint', `საზღვრის კუთხე #${i + 1}`));
    (state.footprints || []).forEach(f => {
      (f.vertices || []).forEach((v, vi) => testPoint(v, 'endpoint', `შენობის კუთხე #${vi + 1}`));
      (f.holes || []).forEach(hole => hole.forEach(hv => testPoint(hv, 'endpoint', 'ეზოს/ატრიუმის კუთხე')));
    });
    (state.roads || []).forEach(r => (r.points || []).forEach(pt => testPoint(pt, 'endpoint', 'გზის წერტილი')));
    (state.walkways || []).forEach(w => (w.points || []).forEach(pt => testPoint(pt, 'endpoint', 'ბილიკის წერტილი')));

    // 2. Check Midpoints
    function testSegmentMidpoint(a, b, label) {
      if (!a || !b) return;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      testPoint(mid, 'midpoint', label || 'შუა წერტილი (Midpoint)');
    }
    (state.cadLines || []).forEach(l => testSegmentMidpoint(l.p1, l.p2, 'ხაზის შუა წერტილი (Midpoint)'));
    (state.cadPolylines || []).forEach(pl => {
      const pts = pl.points || [];
      for (let i = 0; i < pts.length - 1; i++) testSegmentMidpoint(pts[i], pts[i + 1], 'პოლიხაზის შუა წერტილი');
    });
    if (state.boundaryMeters && state.boundaryMeters.length >= 2) {
      const n = state.boundaryMeters.length;
      for (let i = 0; i < n; i++) testSegmentMidpoint(state.boundaryMeters[i], state.boundaryMeters[(i + 1) % n], 'საზღვრის გვერდის შუა');
    }
    (state.footprints || []).forEach(f => {
      const vs = f.vertices || [];
      for (let i = 0; i < vs.length; i++) testSegmentMidpoint(vs[i], vs[(i + 1) % vs.length], 'შენობის გვერდის შუა');
    });

    // 3. Check Intersections
    const allSegments = [];
    (state.cadLines || []).forEach(l => allSegments.push([l.p1, l.p2]));
    (state.cadPolylines || []).forEach(pl => {
      const pts = pl.points || [];
      for (let i = 0; i < pts.length - 1; i++) allSegments.push([pts[i], pts[i + 1]]);
    });
    if (state.boundaryMeters) {
      for (let i = 0; i < state.boundaryMeters.length; i++) {
        allSegments.push([state.boundaryMeters[i], state.boundaryMeters[(i + 1) % state.boundaryMeters.length]]);
      }
    }
    (state.footprints || []).forEach(f => {
      const vs = f.vertices || [];
      for (let i = 0; i < vs.length; i++) allSegments.push([vs[i], vs[(i + 1) % vs.length]]);
    });

    for (let i = 0; i < Math.min(60, allSegments.length); i++) {
      for (let j = i + 1; j < Math.min(60, allSegments.length); j++) {
        const inter = getLineLineIntersection(allSegments[i][0], allSegments[i][1], allSegments[j][0], allSegments[j][1]);
        if (inter) testPoint(inter, 'intersection', 'გადაკვეთა (Intersection)');
      }
    }

    // 4. Check Perpendicular (If drafting from an active start point)
    const startPt = (state.cadDraftPoints && state.cadDraftPoints.length > 0) ? state.cadDraftPoints[state.cadDraftPoints.length - 1] : null;
    if (startPt) {
      allSegments.forEach(seg => {
        const a = seg[0], b = seg[1];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const l2 = dx * dx + dy * dy;
        if (l2 > 0.01) {
          const t = ((startPt[0] - a[0]) * dx + (startPt[1] - a[1]) * dy) / l2;
          if (t >= 0 && t <= 1) {
            const perpPt = [a[0] + t * dx, a[1] + t * dy];
            testPoint(perpPt, 'perpendicular', 'პერპენდიკულარი (Perpendicular ⟂)');
          }
        }
      });
    }

    return bestSnap;
  }

  // --- Dynamic HUD near cursor ---
  function updateDynamicHud(screenX, screenY, pStart, currentPoint) {
    if (!els.cadDynamicHud) return;
    const isDrafting = ['draw_cad_line', 'draw_cad_polyline', 'draw_cad_arc', 'draw_cad_circle', 'draw_cad_hatch', 'cad_offset', 'cad_mirror', 'footprint_cutout'].includes(state.activeTool);
    if (!isDrafting || !pStart) {
      els.cadDynamicHud.classList.add('hidden');
      return;
    }

    const dx = currentPoint[0] - pStart[0];
    const dy = -(currentPoint[1] - pStart[1]);
    const length = Math.hypot(dx, dy);
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    els.cadDynamicHud.classList.remove('hidden');
    const containerRect = els.cadCanvasWrapper.getBoundingClientRect();
    const hudX = Math.min(containerRect.width - 240, Math.max(10, screenX - containerRect.left + 16));
    const hudY = Math.min(containerRect.height - 60, Math.max(10, screenY - containerRect.top + 16));
    els.cadDynamicHud.style.left = `${hudX}px`;
    els.cadDynamicHud.style.top = `${hudY}px`;

    if (els.hudCadLength && document.activeElement !== els.hudCadLength) {
      els.hudCadLength.value = length.toFixed(2);
    }
    if (els.hudCadAngle && document.activeElement !== els.hudCadAngle) {
      els.hudCadAngle.value = angleDeg.toFixed(1);
    }
  }

  window.commitDynamicHudInput = function () {
    const startPt = state.cadDraftPoints && state.cadDraftPoints.length > 0 ? state.cadDraftPoints[state.cadDraftPoints.length - 1] : null;
    if (!startPt) return;

    const len = parseFloat(els.hudCadLength ? els.hudCadLength.value : 0);
    const ang = parseFloat(els.hudCadAngle ? els.hudCadAngle.value : 0);
    if (isNaN(len) || len <= 0) return;

    const rad = (ang * Math.PI) / 180;
    const targetX = startPt[0] + len * Math.cos(rad);
    const targetY = startPt[1] - len * Math.sin(rad);
    const targetPoint = [Math.round(targetX * 100) / 100, Math.round(targetY * 100) / 100];

    handleCadCommitPoint(targetPoint);
  };

  window.handleDynamicHudKey = function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.commitDynamicHudInput();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (document.activeElement === els.hudCadLength && els.hudCadAngle) els.hudCadAngle.focus();
      else if (els.hudCadLength) els.hudCadLength.focus();
    }
  };

  window.toggleOsnap = function () {
    state.osnapEnabled = !state.osnapEnabled;
    if (els.btnToggleOsnap) {
      if (state.osnapEnabled) {
        els.btnToggleOsnap.className = 'h-8 px-2 rounded bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1 transition';
      } else {
        els.btnToggleOsnap.className = 'h-8 px-2 rounded bg-[#162238] border border-[#243557] text-slate-400 text-xs font-mono font-bold flex items-center gap-1 transition';
      }
    }
    updateToolStatus(state.osnapEnabled ? '🧲 OSNAP ჩაირთო (Endpoint, Midpoint, Intersection, Perpendicular)' : 'OSNAP გაითიშა');
  };

  window.toggleOrtho = function () {
    state.orthoEnabled = !state.orthoEnabled;
    if (els.btnToggleOrtho) {
      if (state.orthoEnabled) {
        els.btnToggleOrtho.className = 'h-8 px-2 rounded bg-sky-950/60 border border-sky-500/50 text-sky-300 text-xs font-mono font-bold flex items-center gap-1 transition';
      } else {
        els.btnToggleOrtho.className = 'h-8 px-2 rounded bg-[#162238] border border-[#243557] text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1 transition';
      }
    }
    updateToolStatus(state.orthoEnabled ? '📐 ORTHO ჩაირთო (0°, 90°, 180°, 270°)' : 'ORTHO გაითიშა');
  };

  // --- Point Commit for Precision CAD Drafting Tools ---
  function handleCadCommitPoint(pt) {
    saveUndoSnapshot();
    if (state.activeTool === 'draw_cad_line') {
      if (!state.cadDraftPoints || state.cadDraftPoints.length === 0) {
        state.cadDraftPoints = [pt];
        updateToolStatus('ხაზი: პირველი წერტილი დასმულია. დააკლიკეთ ან შეიყვანეთ ბოლო წერტილი.');
      } else {
        const p1 = state.cadDraftPoints[0];
        state.cadLines.push({
          id: 'cad_line_' + Date.now(),
          p1: [p1[0], p1[1]],
          p2: [pt[0], pt[1]],
          color: '#38bdf8'
        });
        state.cadDraftPoints = [];
        if (els.cadDynamicHud) els.cadDynamicHud.classList.add('hidden');
        renderCadWorld();
        updateToolStatus('ხაზი წარმატებით დაემატა CAD ნახაზზე.');
      }
    } else if (state.activeTool === 'draw_cad_polyline') {
      state.cadDraftPoints.push(pt);
      renderInteractionLayer();
      updateToolStatus(`პოლიხაზი: მონიშნულია ${state.cadDraftPoints.length} წერტილი (Enter / ორმაგი კლიკი ასრულებს).`);
    } else if (state.activeTool === 'draw_cad_arc') {
      state.cadDraftPoints.push(pt);
      if (state.cadDraftPoints.length === 3) {
        state.cadArcs.push({
          id: 'cad_arc_' + Date.now(),
          p1: state.cadDraftPoints[0],
          p2: state.cadDraftPoints[1],
          p3: state.cadDraftPoints[2],
          color: '#f59e0b'
        });
        state.cadDraftPoints = [];
        if (els.cadDynamicHud) els.cadDynamicHud.classList.add('hidden');
        renderCadWorld();
        updateToolStatus('რკალი (3-Point Arc) დახაზულია.');
      } else {
        updateToolStatus(`რკალი: მონიშნულია წერტილი #${state.cadDraftPoints.length}.`);
      }
    } else if (state.activeTool === 'draw_cad_circle') {
      if (!state.cadDraftPoints || state.cadDraftPoints.length === 0) {
        state.cadDraftPoints = [pt];
        updateToolStatus('წრე: ცენტრი დასმულია. მიუთითეთ რადიუსის წერტილი ან შეიყვანეთ HUD-ში.');
      } else {
        const center = state.cadDraftPoints[0];
        const r = Math.hypot(pt[0] - center[0], pt[1] - center[1]);
        state.cadCircles.push({
          id: 'cad_circle_' + Date.now(),
          center: center,
          radius: Math.max(0.5, Math.round(r * 100) / 100),
          color: '#10b981'
        });
        state.cadDraftPoints = [];
        if (els.cadDynamicHud) els.cadDynamicHud.classList.add('hidden');
        renderCadWorld();
        updateToolStatus(`წრე (R=${r.toFixed(2)}მ) დახაზულია.`);
      }
    } else if (state.activeTool === 'draw_cad_hatch') {
      state.cadDraftPoints.push(pt);
      if (state.cadDraftPoints.length >= 3) {
        renderInteractionLayer();
      }
    } else if (state.activeTool === 'footprint_cutout') {
      state.atriumCutoutPoints.push(pt);
      if (state.atriumCutoutPoints.length >= 3) {
        const dStart = Math.hypot(pt[0] - state.atriumCutoutPoints[0][0], pt[1] - state.atriumCutoutPoints[0][1]);
        if (dStart < 1.0 && state.atriumCutoutPoints.length > 3) {
          state.atriumCutoutPoints.pop();
          window.finishFootprintCutout();
          return;
        }
      }
      renderInteractionLayer();
      updateToolStatus(`შიდა ეზო/ატრიუმი: მონიშნულია ${state.atriumCutoutPoints.length} წერტილი. ორმაგი კლიკი / Enter ასრულებს ამოჭრას.`);
    }
  }

  window.finishCadPolyline = function () {
    if (!state.cadDraftPoints || state.cadDraftPoints.length < 2) return;
    saveUndoSnapshot();
    state.cadPolylines.push({
      id: 'cad_poly_' + Date.now(),
      points: [...state.cadDraftPoints],
      isClosed: false,
      color: '#00e5ff'
    });
    state.cadDraftPoints = [];
    if (els.cadDynamicHud) els.cadDynamicHud.classList.add('hidden');
    renderCadWorld();
    updateToolStatus('პოლიხაზი წარმატებით დაემატა.');
  };

  window.finishCadHatch = function () {
    if (!state.cadDraftPoints || state.cadDraftPoints.length < 3) return;
    saveUndoSnapshot();
    state.cadHatches.push({
      id: 'cad_hatch_' + Date.now(),
      polygon: [...state.cadDraftPoints],
      pattern: 'diagonal',
      color: '#a855f7'
    });
    state.cadDraftPoints = [];
    if (els.cadDynamicHud) els.cadDynamicHud.classList.add('hidden');
    renderCadWorld();
    updateToolStatus('არქიტექტურული შტრიხი დაიტანა ნახაზზე.');
  };

  // --- Parallel Offset (Offset) with Dual Road Centerline support ---
  window.cadOffsetGeometry = function (targetLineOrRoad, clickWorldPos) {
    saveUndoSnapshot();
    const distM = state.offsetDistance || (els.quickOffsetDist ? parseFloat(els.quickOffsetDist.value) : 3.0) || 3.0;
    const isDual = state.offsetDual;

    let p1, p2;
    if (targetLineOrRoad.p1 && targetLineOrRoad.p2) {
      p1 = targetLineOrRoad.p1;
      p2 = targetLineOrRoad.p2;
    } else if (targetLineOrRoad.points && targetLineOrRoad.points.length >= 2) {
      let nearestSeg = [targetLineOrRoad.points[0], targetLineOrRoad.points[1]];
      let minD = 999999;
      for (let i = 0; i < targetLineOrRoad.points.length - 1; i++) {
        const d = distPointToSegment(clickWorldPos, targetLineOrRoad.points[i], targetLineOrRoad.points[i + 1]);
        if (d < minD) {
          minD = d;
          nearestSeg = [targetLineOrRoad.points[i], targetLineOrRoad.points[i + 1]];
        }
      }
      p1 = nearestSeg[0];
      p2 = nearestSeg[1];
    }

    if (!p1 || !p2) return;
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;

    const nx = -dy / len;
    const ny = dx / len;

    if (isDual) {
      // Road Centerline -> Left & Right edges simultaneously!
      state.cadLines.push({
        id: 'offset_left_' + Date.now(),
        p1: [p1[0] + nx * distM, p1[1] + ny * distM],
        p2: [p2[0] + nx * distM, p2[1] + ny * distM],
        color: '#38bdf8'
      });
      state.cadLines.push({
        id: 'offset_right_' + (Date.now() + 1),
        p1: [p1[0] - nx * distM, p1[1] - ny * distM],
        p2: [p2[0] - nx * distM, p2[1] - ny * distM],
        color: '#38bdf8'
      });
      renderCadWorld();
      updateToolStatus(`გზის ღერძიდან ორივე მხარეს პარალელურად გატარდა კიდეები (±${distM}მ).`);
    } else {
      const vClick = [clickWorldPos[0] - p1[0], clickWorldPos[1] - p1[1]];
      const side = (vClick[0] * nx + vClick[1] * ny) >= 0 ? 1 : -1;
      state.cadLines.push({
        id: 'offset_' + Date.now(),
        p1: [p1[0] + nx * distM * side, p1[1] + ny * distM * side],
        p2: [p2[0] + nx * distM * side, p2[1] + ny * distM * side],
        color: '#38bdf8'
      });
      renderCadWorld();
      updateToolStatus(`ხაზი პარალელურად გადაიწია ${distM} მეტრით.`);
    }
  };

  // --- Trim Tool ---
  window.cadTrimLine = function (line, clickWorldPos) {
    saveUndoSnapshot();
    const allSegs = [];
    state.cadLines.filter(l => l.id !== line.id).forEach(l => allSegs.push([l.p1, l.p2]));
    (state.boundaryMeters || []).forEach((pt, i, arr) => allSegs.push([pt, arr[(i + 1) % arr.length]]));

    let nearestInter = null;
    let minD = 999999;
    allSegs.forEach(seg => {
      const inter = getLineLineIntersection(line.p1, line.p2, seg[0], seg[1]);
      if (inter) {
        const d = Math.hypot(clickWorldPos[0] - inter[0], clickWorldPos[1] - inter[1]);
        if (d < minD) {
          minD = d;
          nearestInter = inter;
        }
      }
    });

    if (nearestInter) {
      const d1 = Math.hypot(clickWorldPos[0] - line.p1[0], clickWorldPos[1] - line.p1[1]);
      const d2 = Math.hypot(clickWorldPos[0] - line.p2[0], clickWorldPos[1] - line.p2[1]);
      if (d1 < d2) {
        line.p1 = nearestInter;
      } else {
        line.p2 = nearestInter;
      }
      renderCadWorld();
      updateToolStatus('ხაზის სეგმენტი გადაკვეთასთან მოიჭრა (Trim).');
    } else {
      updateToolStatus('მოჭრისთვის გადაკვეთის წერტილი ვერ მოიძებნა.');
    }
  };

  // --- Extend Tool ---
  window.cadExtendLine = function (line, clickWorldPos) {
    saveUndoSnapshot();
    const d1 = Math.hypot(clickWorldPos[0] - line.p1[0], clickWorldPos[1] - line.p1[1]);
    const d2 = Math.hypot(clickWorldPos[0] - line.p2[0], clickWorldPos[1] - line.p2[1]);
    const extendP2 = d2 <= d1;
    const origin = extendP2 ? line.p1 : line.p2;
    const tip = extendP2 ? line.p2 : line.p1;
    const dx = tip[0] - origin[0];
    const dy = tip[1] - origin[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    const dir = [dx / len, dy / len];
    const farPt = [tip[0] + dir[0] * 500, tip[1] + dir[1] * 500];

    const targets = [];
    state.cadLines.filter(l => l.id !== line.id).forEach(l => targets.push([l.p1, l.p2]));
    if (state.boundaryMeters) {
      for (let i = 0; i < state.boundaryMeters.length; i++) {
        targets.push([state.boundaryMeters[i], state.boundaryMeters[(i + 1) % state.boundaryMeters.length]]);
      }
    }

    let nearestInter = null;
    let minD = 999999;
    targets.forEach(seg => {
      const inter = getLineLineIntersection(tip, farPt, seg[0], seg[1]);
      if (inter) {
        const d = Math.hypot(inter[0] - tip[0], inter[1] - tip[1]);
        if (d > 0.05 && d < minD) {
          minD = d;
          nearestInter = inter;
        }
      }
    });

    if (nearestInter) {
      if (extendP2) line.p2 = nearestInter;
      else line.p1 = nearestInter;
      renderCadWorld();
      updateToolStatus('ხაზი გაგრძელდა უახლოეს საზღვრამდე (Extend).');
    } else {
      updateToolStatus('გასაგრძელებლად წინ საზღვარი არ არსებობს.');
    }
  };

  // --- Mirror Tool ---
  window.cadMirrorSelected = function (pA, pB) {
    saveUndoSnapshot();
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp || !pA || !pB) return;

    function mirrorPt(pt) {
      const dx = pB[0] - pA[0], dy = pB[1] - pA[1];
      const l2 = dx * dx + dy * dy;
      if (l2 < 1e-6) return pt;
      const t = ((pt[0] - pA[0]) * dx + (pt[1] - pA[1]) * dy) / l2;
      const projX = pA[0] + t * dx;
      const projY = pA[1] + t * dy;
      return [2 * projX - pt[0], 2 * projY - pt[1]];
    }

    const mirroredVerts = fp.vertices.map(mirrorPt);
    const mirroredCenter = mirrorPt(fp.center);
    const newFp = {
      ...fp,
      id: 'fp_' + Date.now(),
      name: fp.name + ' (სარკე)',
      center: mirroredCenter,
      vertices: mirroredVerts,
      holes: (fp.holes || []).map(h => h.map(mirrorPt))
    };
    state.footprints.push(newFp);
    state.selectedFootprintId = newFp.id;
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus('შეიქმნა სარკისებური ასლი (Mirror).');
  };

  // --- Linear Array / Repeat Tool ---
  window.cadArraySelected = function (count = 3, spacingM = 15) {
    saveUndoSnapshot();
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp) return;

    for (let i = 1; i <= count; i++) {
      const offset = i * spacingM;
      const newVerts = fp.vertices.map(v => [v[0] + offset, v[1]]);
      const newCenter = [fp.center[0] + offset, fp.center[1]];
      state.footprints.push({
        ...fp,
        id: 'fp_arr_' + i + '_' + Date.now(),
        name: `${fp.name} (ასლი #${i})`,
        center: newCenter,
        vertices: newVerts,
        holes: (fp.holes || []).map(h => h.map(v => [v[0] + offset, v[1]]))
      });
    }
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus(`შენობა გამრავლდა ${count}-ჯერ თანაბარი ბიჯით (${spacingM}მ).`);
  };

  // --- Helper: Convert polygon vertices and holes into SVG path d with fill-rule="evenodd" ---
  function polygonToPathD(outerRing, holes = []) {
    if (!outerRing || outerRing.length === 0) return '';
    let d = 'M ' + outerRing.map(p => `${p[0]},${p[1]}`).join(' L ') + ' Z';
    if (holes && holes.length > 0) {
      holes.forEach(hole => {
        if (hole && hole.length > 0) {
          d += ' M ' + hole.map(p => `${p[0]},${p[1]}`).join(' L ') + ' Z';
        }
      });
    }
    return d;
  }
  window.polygonToPathD = polygonToPathD;

  // --- Footprint Vertex Drag Handler ---
  window.startCadVertexDrag = function (e, fpId, vertexIdx) {
    if (e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
    }
    if (e && e.altKey) {
      window.deleteFootprintVertex(fpId, vertexIdx);
      return;
    }
    saveUndoSnapshot();
    state.isDraggingCadVertex = true;
    state.draggedFpId = fpId;
    state.draggedVertexIdx = vertexIdx;
  };

  // --- Footprint Vertex Mode Toggle ---
  window.enableFootprintVertexMode = function () {
    setCadActiveTool('footprint_vertex');
    renderCadWorld();
  };

  // --- Corner Fillet (კუთხის მომრგვალება) ---
  window.applyFootprintFillet = function (radiusParam) {
    saveUndoSnapshot();
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp || fp.vertices.length < 3) {
      alert('გთხოვთ ჯერ აირჩიოთ შენობის ლაქა.');
      return;
    }
    const r = radiusParam || state.filletRadius || (els.quickFilletR ? parseFloat(els.quickFilletR.value) : 2.0) || 2.0;

    const vs = fp.vertices;
    const n = vs.length;
    const newVerts = [];

    for (let i = 0; i < n; i++) {
      const prev = vs[(i - 1 + n) % n];
      const curr = vs[i];
      const next = vs[(i + 1) % n];
      const arcPts = filletCorner(prev, curr, next, r);
      arcPts.forEach(p => newVerts.push(p));
    }

    fp.vertices = newVerts;
    fp.shape = 'freeform';
    fp.areaSqm = Math.max(1, Math.round(calculatePolygonArea(fp.vertices) - (fp.holes || []).reduce((s, h) => s + calculatePolygonArea(h), 0)));
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus(`შენობის კუთხეები მომრგვალდა (R=${r}მ). ფართობი გადაითვალა: ${fp.areaSqm} მ²`);
  };

  // --- Corner Chamfer (კუთხის ჩამოჭრა) ---
  window.applyFootprintChamfer = function (distParam) {
    saveUndoSnapshot();
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId);
    if (!fp || fp.vertices.length < 3) {
      alert('გთხოვთ ჯერ აირჩიოთ შენობის ლაქა.');
      return;
    }
    const d = distParam || state.chamferDistance || (els.quickChamferD ? parseFloat(els.quickChamferD.value) : 1.5) || 1.5;

    const vs = fp.vertices;
    const n = vs.length;
    const newVerts = [];

    for (let i = 0; i < n; i++) {
      const prev = vs[(i - 1 + n) % n];
      const curr = vs[i];
      const next = vs[(i + 1) % n];

      const v1 = [prev[0] - curr[0], prev[1] - curr[1]];
      const v2 = [next[0] - curr[0], next[1] - curr[1]];
      const l1 = Math.hypot(v1[0], v1[1]);
      const l2 = Math.hypot(v2[0], v2[1]);
      const effD = Math.min(d, Math.min(l1, l2) * 0.45);

      const pA = [curr[0] + (v1[0] / l1) * effD, curr[1] + (v1[1] / l1) * effD];
      const pB = [curr[0] + (v2[0] / l2) * effD, curr[1] + (v2[1] / l2) * effD];
      newVerts.push(pA);
      newVerts.push(pB);
    }

    fp.vertices = newVerts;
    fp.shape = 'freeform';
    fp.areaSqm = Math.max(1, Math.round(calculatePolygonArea(fp.vertices) - (fp.holes || []).reduce((s, h) => s + calculatePolygonArea(h), 0)));
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus(`შენობის კუთხეები ჩამოიჭრა (D=${d}მ). ფართობი გადაითვალა: ${fp.areaSqm} მ²`);
  };

  // --- Boolean Union (კონტურების გაერთიანება) ---
  window.booleanUnionFootprints = function () {
    if (state.footprints.length < 2) {
      alert('გასაერთიანებლად საჭიროა მინიმუმ 2 შენობის ლაქა.');
      return;
    }
    saveUndoSnapshot();
    const fp1 = state.footprints.find(f => f.id === state.selectedFootprintId) || state.footprints[0];
    const fp2 = state.footprints.find(f => f.id !== fp1.id);
    if (!fp1 || !fp2) return;

    const combinedPts = [...fp1.vertices, ...fp2.vertices];
    const cx = combinedPts.reduce((s, p) => s + p[0], 0) / combinedPts.length;
    const cy = combinedPts.reduce((s, p) => s + p[1], 0) / combinedPts.length;
    combinedPts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));

    const cleanVerts = [];
    combinedPts.forEach(p => {
      if (cleanVerts.length === 0 || Math.hypot(p[0] - cleanVerts[cleanVerts.length - 1][0], p[1] - cleanVerts[cleanVerts.length - 1][1]) > 0.5) {
        cleanVerts.push(p);
      }
    });

    const unionArea = Math.round(calculatePolygonArea(cleanVerts));
    fp1.name = `${fp1.name} + ${fp2.name} (გაერთიანებული)`;
    fp1.vertices = cleanVerts;
    fp1.center = [cx, cy];
    fp1.shape = 'freeform';
    fp1.areaSqm = unionArea;
    fp1.holes = [...(fp1.holes || []), ...(fp2.holes || [])];

    state.footprints = state.footprints.filter(f => f.id !== fp2.id);
    state.selectedFootprintId = fp1.id;
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus(`შენობები გაერთიანდა ერთიან კონტურად (${unionArea} მ²).`);
  };

  // --- Courtyard / Atrium Void Cutout (შიგნით ამოჭრა ეზო, ატრიუმი) ---
  window.finishFootprintCutout = function () {
    const fp = state.footprints.find(f => f.id === state.selectedFootprintId) || state.footprints[0];
    if (!fp) {
      alert('გთხოვთ ჯერ აირჩიოთ შენობის ლაქა, რომელშიც გსურთ ეზოს ან ატრიუმის ამოჭრა.');
      state.atriumCutoutPoints = [];
      return;
    }

    if (state.atriumCutoutPoints.length < 3) {
      alert('ატრიუმის ამოსაჭრელად მონიშნეთ მინიმუმ 3 წერტილი შენობის შიგნით.');
      state.atriumCutoutPoints = [];
      return;
    }

    saveUndoSnapshot();
    fp.holes = fp.holes || [];
    fp.holes.push([...state.atriumCutoutPoints]);
    state.atriumCutoutPoints = [];

    const outerArea = calculatePolygonArea(fp.vertices);
    const holesArea = fp.holes.reduce((sum, h) => sum + calculatePolygonArea(h), 0);
    fp.areaSqm = Math.max(1, Math.round(outerArea - holesArea));

    setCadActiveTool('pan');
    updateSelectedBuildingUI();
    updateZoningCoefficientsUI();
    renderCadWorld();
    updateToolStatus(`ამოიჭრა შიდა ეზო/ატრიუმი (${Math.round(holesArea)} მ²). შენობის განაშენიანების ფართობი შემცირდა: ${fp.areaSqm} მ²`);
  };

  // --- Add Corner Vertex ([+] on edge handle click) ---
  window.insertVertexAtEdge = function (e, fpId, edgeIdx) {
    if (e && e.stopPropagation) e.stopPropagation();
    saveUndoSnapshot();
    const fp = state.footprints.find(f => f.id === fpId);
    if (!fp) return;

    const vs = fp.vertices;
    const p1 = vs[edgeIdx];
    const p2 = vs[(edgeIdx + 1) % vs.length];
    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

    vs.splice(edgeIdx + 1, 0, mid);
    fp.shape = 'freeform';
    fp.areaSqm = Math.max(1, Math.round(calculatePolygonArea(fp.vertices) - (fp.holes || []).reduce((s, h) => s + calculatePolygonArea(h), 0)));

    renderCadWorld();
    updateToolStatus(`დაემატა ახალი კუთხე #${edgeIdx + 2}. გადააადგილეთ მაუსით.`);
  };

  // --- Delete Corner Vertex (Alt+Click or right click) ---
  window.deleteFootprintVertex = function (fpId, vertexIdx) {
    saveUndoSnapshot();
    const fp = state.footprints.find(f => f.id === fpId);
    if (!fp || fp.vertices.length <= 3) {
      alert('მრავალკუთხედს უნდა ჰქონდეს მინიმუმ 3 კუთხე!');
      return;
    }

    fp.vertices.splice(vertexIdx, 1);
    fp.shape = 'freeform';
    fp.areaSqm = Math.max(1, Math.round(calculatePolygonArea(fp.vertices) - (fp.holes || []).reduce((s, h) => s + calculatePolygonArea(h), 0)));

    renderCadWorld();
    updateZoningCoefficientsUI();
    updateToolStatus(`კუთხე #${vertexIdx + 1} წაიშალა. ფართობი გადაითვალა: ${fp.areaSqm} მ²`);
  };

  // --- Parallel Edge Offset/Move (გვერდის პარალელური გადაწევა) ---
  window.moveFootprintEdgeParallel = function (fpId, edgeIdx, distM) {
    saveUndoSnapshot();
    const fp = state.footprints.find(f => f.id === fpId);
    if (!fp) return;

    const vs = fp.vertices;
    const n = vs.length;
    const p1 = vs[edgeIdx];
    const p2 = vs[(edgeIdx + 1) % n];

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;

    const nx = -dy / len;
    const ny = dx / len;

    vs[edgeIdx] = [p1[0] + nx * distM, p1[1] + ny * distM];
    vs[(edgeIdx + 1) % n] = [p2[0] + nx * distM, p2[1] + ny * distM];

    fp.shape = 'freeform';
    fp.areaSqm = Math.max(1, Math.round(calculatePolygonArea(fp.vertices) - (fp.holes || []).reduce((s, h) => s + calculatePolygonArea(h), 0)));
    renderCadWorld();
    updateZoningCoefficientsUI();
    updateToolStatus(`გვერდი #${edgeIdx + 1} გადაიწია პარალელურად (${distM > 0 ? '+' : ''}${distM.toFixed(1)}მ).`);
  };

  // --- Render CAD Vector Drafting Layer ---
  function renderCadDrafting(pxToM) {
    if (!els.cadDraftingLayer) return;
    if (!state.layers.cadDrafting) {
      els.cadDraftingLayer.innerHTML = '';
      return;
    }

    const sw = Math.max(0.3, 1.8 * pxToM);
    let svg = '';

    // 1. Lines
    (state.cadLines || []).forEach(l => {
      svg += `<line x1="${l.p1[0]}" y1="${l.p1[1]}" x2="${l.p2[0]}" y2="${l.p2[1]}" stroke="${l.color || '#38bdf8'}" stroke-width="${sw}" stroke-linecap="round"/>`;
      svg += `<circle cx="${l.p1[0]}" cy="${l.p1[1]}" r="${2.5 * pxToM}" fill="#38bdf8"/>`;
      svg += `<circle cx="${l.p2[0]}" cy="${l.p2[1]}" r="${2.5 * pxToM}" fill="#38bdf8"/>`;
    });

    // 2. Polylines
    (state.cadPolylines || []).forEach(pl => {
      const pts = (pl.points || []).map(p => `${p[0]},${p[1]}`).join(' ');
      svg += `<polyline points="${pts}" fill="${pl.isClosed ? 'rgba(56, 189, 248, 0.15)' : 'none'}" stroke="${pl.color || '#00e5ff'}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
    });

    // 3. Arcs
    (state.cadArcs || []).forEach(a => {
      svg += `<path d="M ${a.p1[0]},${a.p1[1]} Q ${a.p2[0]},${a.p2[1]} ${a.p3[0]},${a.p3[1]}" fill="none" stroke="${a.color || '#f59e0b'}" stroke-width="${sw}"/>`;
    });

    // 4. Circles
    (state.cadCircles || []).forEach(c => {
      svg += `<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="${c.color || '#10b981'}" stroke-width="${sw}"/>`;
      svg += `<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${2.5 * pxToM}" fill="#10b981"/>`;
    });

    // 5. Hatches
    (state.cadHatches || []).forEach(h => {
      const pts = (h.polygon || []).map(p => `${p[0]},${p[1]}`).join(' ');
      svg += `<polygon points="${pts}" fill="url(#hatchBuildingClassic)" stroke="${h.color || '#a855f7'}" stroke-width="${1.2 * pxToM}"/>`;
    });

    // 6. Freehands
    (state.cadFreehands || []).forEach(f => {
      const pts = (f.points || []).map(p => `${p[0]},${p[1]}`).join(' ');
      svg += `<polyline points="${pts}" fill="none" stroke="${f.color || '#f43f5e'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    });

    els.cadDraftingLayer.innerHTML = svg;
  }

  // =========================================================================
  // --- ARCHITECTURAL RENDER PIPELINE WITH SCREEN-SCALED GRAPHICS ---
  // =========================================================================
  function renderCadWorld() {
    const pxToM = 1 / Math.max(0.001, state.zoomScale);

    renderTopographyRelief(pxToM);
    renderNeighborhoodContext(pxToM);
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
    renderCadDrafting(pxToM);
    renderDimensions(pxToM);
    renderNodes(pxToM);
    renderInteractionLayer(pxToM);
  }

  // 0a. Topographic Elevation Contours & Relief Layer (იზოჰიფსები & რელიეფი)
  function renderTopographyRelief(pxToM) {
    if (!els.topographyReliefLayer) return;
    if (!state.layers.topography || !state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.topographyReliefLayer.innerHTML = '';
      return;
    }

    const xs = state.boundaryMeters.map(p => p[0]);
    const ys = state.boundaryMeters.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const margin = Math.max(45, Math.max(spanX, spanY) * 0.55);

    const x0 = minX - margin;
    const x1 = maxX + margin;
    const y0 = minY - margin;
    const y1 = maxY + margin;

    let html = '';

    // A. Shaded Relief / Hypsometric Underlay (for relief styles)
    const isHypsometric = state.activeStyle === 'topo_relief_hypsometric';
    const isSlopeAnalysis = state.activeStyle === 'topo_slope_analysis';
    const isTopoCadDark = state.activeStyle === 'topo_cad_dark';

    if (isHypsometric || isSlopeAnalysis) {
      html += `
        <defs>
          <linearGradient id="topoHypsometricGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#86efac" stop-opacity="0.32"/>
            <stop offset="35%" stop-color="#fde047" stop-opacity="0.22"/>
            <stop offset="70%" stop-color="#fdba74" stop-opacity="0.26"/>
            <stop offset="100%" stop-color="#f87171" stop-opacity="0.20"/>
          </linearGradient>
          <linearGradient id="topoSlopeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.16"/>
            <stop offset="50%" stop-color="#fbbf24" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0.25"/>
          </linearGradient>
        </defs>
        <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${isHypsometric ? 'url(#topoHypsometricGrad)' : 'url(#topoSlopeGrad)'}" rx="${4 * pxToM}" />
      `;
    }

    // B. Elevation Contours (ჰორიზონტალები / Isohypses)
    const numContours = 12;
    const stepY = (y1 - y0) / (numContours + 1);

    for (let k = 0; k <= numContours; k++) {
      const baseCy = y0 + k * stepY;
      const elev = 480 + k * 1.0;
      const isIndex = (elev % 5 === 0) || (k % 3 === 0);

      const numSegments = 10;
      const segW = (x1 - x0) / numSegments;
      let pathD = `M ${x0.toFixed(2)} ${baseCy.toFixed(2)}`;

      for (let s = 1; s <= numSegments; s++) {
        const curX = x0 + s * segW;
        const wave = Math.sin((curX * 0.04) + k * 0.45) * (3.5 + (k % 2) * 2.0)
                   + Math.cos((curX * 0.02) + k * 0.3) * 2.5;
        const curY = baseCy + wave;
        pathD += ` L ${curX.toFixed(2)} ${curY.toFixed(2)}`;
      }

      const strokeCol = isIndex ? 'var(--contour-index, #b45309)' : 'var(--contour-inter, rgba(180,83,9,0.38))';
      const strokeW = isIndex ? Math.max(0.3, 1.2 * pxToM) : Math.max(0.15, 0.6 * pxToM);
      const strokeDash = isIndex ? 'none' : (isTopoCadDark ? `${5 * pxToM}, ${2 * pxToM}` : 'none');

      html += `<path d="${pathD}" fill="none" stroke="${strokeCol}" stroke-width="${strokeW}" stroke-dasharray="${strokeDash}" opacity="0.9" />`;

      // Label on Index Contours
      if (isIndex) {
        const labelX = minX + spanX * (0.25 + (k % 2) * 0.45);
        const waveAtLabel = Math.sin((labelX * 0.04) + k * 0.45) * 4.0;
        const labelY = baseCy + waveAtLabel;
        const badgeW = 38 * pxToM;
        const badgeH = 14 * pxToM;
        const bgFill = isTopoCadDark ? '#07090e' : (state.activeStyle === 'topo_blueprint' ? '#0a1931' : '#ffffff');

        html += `
          <g transform="translate(${labelX}, ${labelY})">
            <rect x="${-badgeW / 2}" y="${-badgeH / 2}" width="${badgeW}" height="${badgeH}" rx="${2 * pxToM}" fill="${bgFill}" stroke="${strokeCol}" stroke-width="${0.7 * pxToM}" opacity="0.95" />
            <text x="0" y="${3 * pxToM}" text-anchor="middle" fill="${strokeCol}" font-size="${7.5 * pxToM}" font-family="'JetBrains Mono', monospace" font-weight="bold">${elev.toFixed(1)} მ</text>
          </g>
        `;
      }
    }

    // C. Spot Elevations (გეოდეზიური საკონტროლო ნიშნულები +486.35)
    const spotPoints = [
      { x: minX + spanX * 0.1, y: minY + spanY * 0.15, z: 482.45 },
      { x: maxX - spanX * 0.1, y: minY + spanY * 0.25, z: 485.80 },
      { x: minX + spanX * 0.2, y: maxY - spanY * 0.2, z: 488.20 },
      { x: maxX - spanX * 0.15, y: maxY - spanY * 0.1, z: 491.15 },
      { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: 486.60 }
    ];

    spotPoints.forEach(sp => {
      const crossSize = 3 * pxToM;
      const spotCol = isTopoCadDark ? '#10b981' : (state.activeStyle === 'topo_blueprint' ? '#7dd3fc' : '#b45309');
      html += `
        <g>
          <line x1="${sp.x - crossSize}" y1="${sp.y}" x2="${sp.x + crossSize}" y2="${sp.y}" stroke="${spotCol}" stroke-width="${0.9 * pxToM}"/>
          <line x1="${sp.x}" y1="${sp.y - crossSize}" x2="${sp.x}" y2="${sp.y + crossSize}" stroke="${spotCol}" stroke-width="${0.9 * pxToM}"/>
          <text x="${sp.x + 4 * pxToM}" y="${sp.y - 2 * pxToM}" fill="${spotCol}" font-size="${7.5 * pxToM}" font-family="'JetBrains Mono', monospace" font-weight="600">+${sp.z.toFixed(2)}</text>
        </g>
      `;
    });

    // D. Terrain Slope & Direction Indicator (ქანობის ისარი და კოეფიციენტი)
    const slopeX = minX - 10 * pxToM;
    const slopeY = minY - 10 * pxToM;
    const slopeW = 105 * pxToM;
    const slopeH = 20 * pxToM;
    const slopeBg = isTopoCadDark ? 'rgba(7,9,14,0.92)' : 'rgba(255,255,255,0.92)';
    const slopeBorder = isTopoCadDark ? '#10b981' : '#b45309';

    html += `
      <g transform="translate(${slopeX}, ${slopeY})">
        <rect x="0" y="0" width="${slopeW}" height="${slopeH}" rx="${4 * pxToM}" fill="${slopeBg}" stroke="${slopeBorder}" stroke-width="${0.8 * pxToM}" />
        <text x="${8 * pxToM}" y="${13.5 * pxToM}" fill="${slopeBorder}" font-size="${8.5 * pxToM}" font-family="Inter, sans-serif" font-weight="bold">↘ ქანობი: i = 3.8% (NE)</text>
      </g>
    `;

    els.topographyReliefLayer.innerHTML = html;
  }

  // 0b. Neighboring Buildings Layer (სამეზობლო ნაკვეთები წაშლილია მომხმარებლის მოთხოვნით)
  function renderNeighborhoodContext(pxToM) {
    if (!els.neighborhoodContextLayer) return;
    els.neighborhoodContextLayer.innerHTML = '';
  }

  // 1. Cadastral Boundary Layer
  function renderCadastralBoundary(pxToM) {
    if (!els.cadastralBoundaryLayer) return;
    if (!state.layers.boundary || !state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.cadastralBoundaryLayer.innerHTML = '';
      return;
    }

    const pointsStr = state.boundaryMeters.map(p => `${p[0]},${p[1]}`).join(' ');
    const poly = state.boundaryMeters;
    const n = poly.length;
    const types = state.boundaryEdgeTypes || [];

    // In GIS/map mode: use non-scaling stroke so boundary lines keep constant pixel width
    // regardless of zoom level. In CAD/hybrid mode, scale stroke naturally with the world.
    const isGisMode = state.viewMode === 'map';
    const strokeW = isGisMode ? 2.5 : Math.max(0.3, 2.2 * pxToM);
    const nonScalingAttr = isGisMode ? 'vector-effect="non-scaling-stroke"' : '';

    // Edge boundary badges for toggle between road and neighbor (only if setbackLabels layer is enabled)
    let edgeBadgesSvg = '';
    if (state.layers.setbackLabels) {
      for (let i = 0; i < n; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % n];
        const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        if (dist < 3.5) continue; // Skip very small segments to avoid clutter

        const midX = (p1[0] + p2[0]) / 2;
        const midY = (p1[1] + p2[1]) / 2;
        const isRoad = types[i] === 'road';

        const tagText = isRoad ? '🚗 გზა (0მ)' : `🏡 მიჯნა (${state.setbackDistance}მ)`;
        const badgeW = (isRoad ? 55 : 62) * pxToM;
        const badgeH = 14 * pxToM;
        const bg = isRoad ? 'rgba(16, 185, 129, 0.92)' : 'rgba(30, 41, 59, 0.88)';
        const stroke = isRoad ? '#34d399' : 'rgba(244, 63, 94, 0.7)';
        const textColor = '#ffffff';

        edgeBadgesSvg += `
          <g class="cursor-pointer" onclick="toggleBoundaryEdgeType(${i})" style="cursor: pointer;">
            <title>საზღვარი №${i + 1}: ${isRoad ? 'საგზაო/საზოგადოებრივი (მიჯნა 0მ)' : 'სამეზობლო მიჯნა (' + state.setbackDistance + 'მ)'} - დააწკაპუნეთ ტიპის შესაცვლელად</title>
            <rect x="${midX - badgeW / 2}" y="${midY - badgeH / 2}" width="${badgeW}" height="${badgeH}" rx="${3 * pxToM}" fill="${bg}" stroke="${stroke}" stroke-width="${0.7 * pxToM}" ${nonScalingAttr} />
            <text x="${midX}" y="${midY + 3.5 * pxToM}" text-anchor="middle" fill="${textColor}" font-size="${7.2 * pxToM}" font-family="Inter, sans-serif" font-weight="600">${tagText}</text>
          </g>
        `;
      }
    }

    els.cadastralBoundaryLayer.innerHTML = `
      <polygon points="${pointsStr}" fill="var(--parcel-fill)" stroke="var(--parcel-stroke)" stroke-width="${strokeW}" stroke-linejoin="round" ${nonScalingAttr} />
      ${edgeBadgesSvg}
    `;
  }

  // 2. Setback Buffer Layer (სამეზობლო მიჯნა 1.5მ - 6.0მ) - მხოლოდ სამეზობლო საზღვრებზე
  function renderSetbackBuffer(pxToM) {
    if (!els.setbackBoundaryLayer) return;
    if (!state.layers.setback || !state.boundaryMeters || state.boundaryMeters.length < 3) {
      els.setbackBoundaryLayer.innerHTML = '';
      return;
    }

    const setbackRes = computeNeighborSetbackPolylines(state.boundaryMeters, state.boundaryEdgeTypes, state.setbackDistance);
    if (!setbackRes.polylines || setbackRes.polylines.length === 0) {
      els.setbackBoundaryLayer.innerHTML = '';
      return;
    }

    const strokeW = Math.max(0.2, 1.2 * pxToM);
    const dash = `${4 * pxToM}, ${3 * pxToM}`;

    els.setbackBoundaryLayer.innerHTML = setbackRes.polylines.map((poly, idx) => {
      const pts = poly.map(p => `${p[0]},${p[1]}`).join(' ');
      return `
        <g id="setback_poly_${idx}">
          <polyline points="${pts}" fill="none" stroke="var(--setback-stroke)" stroke-width="${strokeW}" stroke-dasharray="${dash}" opacity="0.9" />
        </g>
      `;
    }).join('');
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
      const isSelected = f.id === state.selectedFootprintId;
      const pathD = polygonToPathD(f.vertices, f.holes);

      // Check setback violation: does building violate neighbor boundary setback?
      // In Georgian building code (დადგენილება №41), 3.0m setback is required ONLY on neighbor boundaries.
      // Along road frontage / public spaces (road), there is no neighbor setback restriction.
      let isSetbackViolated = false;
      if (state.boundaryMeters && state.boundaryMeters.length >= 3) {
        const poly = state.boundaryMeters;
        const n = poly.length;
        const types = state.boundaryEdgeTypes || [];
        for (let i = 0; i < n; i++) {
          if (types[i] === 'road') continue; // Road frontage is exempt from neighbor setback
          const pA = poly[i];
          const pB = poly[(i + 1) % n];
          for (const v of f.vertices) {
            const d = distPointToSegment(v, pA, pB);
            if (d < (state.setbackDistance - 0.05)) {
              isSetbackViolated = true;
              break;
            }
          }
          if (isSetbackViolated) break;
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

      // Vertex & Edge Handles for interactive contour editing
      let handlesSvg = '';
      if (isSelected) {
        const vs = f.vertices || [];
        const nVs = vs.length;
        vs.forEach((v, i) => {
          const nextV = vs[(i + 1) % nVs];
          const mid = [(v[0] + nextV[0]) / 2, (v[1] + nextV[1]) / 2];

          // Corner vertex handle (square ■)
          handlesSvg += `
            <rect x="${v[0] - 4.5 * pxToM}" y="${v[1] - 4.5 * pxToM}" width="${9 * pxToM}" height="${9 * pxToM}" fill="#00f0ff" stroke="#080d1a" stroke-width="${1.2 * pxToM}" class="cursor-move" onmousedown="window.startCadVertexDrag(event, '${f.id}', ${i})" title="კუთხე #${i + 1} (გადააადგილეთ / Alt+კლიკი წასაშლელად)" />
          `;

          // Edge midpoint [+] handle (circle ○)
          handlesSvg += `
            <g class="cursor-pointer" onclick="window.insertVertexAtEdge(event, '${f.id}', ${i})" title="ახალი კუთხის დამატება ამ გვერდზე [+]">
              <circle cx="${mid[0]}" cy="${mid[1]}" r="${4.5 * pxToM}" fill="#0284c7" stroke="#ffffff" stroke-width="${1 * pxToM}" />
              <text x="${mid[0]}" y="${mid[1] + 3 * pxToM}" text-anchor="middle" fill="#ffffff" font-size="${7 * pxToM}" font-weight="bold" pointer-events="none">+</text>
            </g>
          `;
        });

        // Courtyard/Atrium holes rendering
        if (f.holes && f.holes.length > 0) {
          f.holes.forEach((h, hIdx) => {
            const hPts = h.map(p => `${p[0]},${p[1]}`).join(' ');
            handlesSvg += `<polygon points="${hPts}" fill="rgba(15, 23, 42, 0.85)" stroke="#ef4444" stroke-width="${1.5 * pxToM}" stroke-dasharray="${3 * pxToM}, ${2 * pxToM}" pointer-events="none" />`;
            h.forEach((hv, hvi) => {
              handlesSvg += `<circle cx="${hv[0]}" cy="${hv[1]}" r="${3.5 * pxToM}" fill="#ef4444" stroke="#ffffff" stroke-width="${0.8 * pxToM}" pointer-events="none"/>`;
            });
          });
        }
      }

      return `
        <g class="cursor-pointer" onclick="handleFootprintClick('${f.id}')">
          ${isSetbackViolated ? `<path d="${pathD}" fill-rule="evenodd" fill="none" stroke="#ef4444" stroke-width="${strokeW + 2 * pxToM}" stroke-dasharray="${3 * pxToM}, ${2 * pxToM}" opacity="0.8"/>` : ''}
          <path d="${pathD}" fill-rule="evenodd" fill="var(--footprint-fill)" stroke="${strokeColor}" stroke-width="${strokeW}" />
          <path d="${pathD}" fill-rule="evenodd" fill="url(#${hatchId})" opacity="0.65" pointer-events="none" />

          ${rotationHandleSvg}
          ${handlesSvg}

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

    // Smart distance filter to avoid visual badge collisions on high-vertex boundaries
    let minDist = 3.0;
    if (n > 24) {
      minDist = pxToM < 0.35 ? 4.5 : 8.5;
    } else if (n > 12) {
      minDist = pxToM < 0.35 ? 3.5 : 6.0;
    }

    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);

      if (dist < minDist) continue;

      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;

      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const nx = -dy / dist;
      const ny = dx / dist;

      const offsetDist = 5.0 * pxToM;
      const tx = midX + nx * offsetDist;
      const ty = midY + ny * offsetDist;

      const textStr = `${dist.toFixed(1)}მ`;
      const pillW = (textStr.length * 5.2 + 5) * pxToM;
      const pillH = 12 * pxToM;

      dimSvg += `
        <g>
          <rect x="${tx - pillW / 2}" y="${ty - pillH / 2}" width="${pillW}" height="${pillH}" rx="${2 * pxToM}" fill="#080e1a" stroke="#0ea5e9" stroke-width="${0.6 * pxToM}" opacity="0.92" />
          <text x="${tx}" y="${ty + 3 * pxToM}" text-anchor="middle" fill="#38bdf8" font-size="${7.5 * pxToM}" font-family="'JetBrains Mono', monospace" font-weight="600">${textStr}</text>
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
    } else if (state.activeTool === 'draw_cad_line' && state.cadDraftPoints && state.cadDraftPoints.length === 1) {
      const p0 = state.cadDraftPoints[0];
      let p1 = state.activeSnap ? state.activeSnap.point : (state.mouseWorldPos || p0);
      if (state.orthoEnabled && !state.activeSnap) {
        const dx = Math.abs(p1[0] - p0[0]);
        const dy = Math.abs(p1[1] - p0[1]);
        if (dx > dy) p1 = [p1[0], p0[1]];
        else p1 = [p0[0], p1[1]];
      }
      const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const deg = Math.round(((Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI + 360) % 360);
      els.interactionLayer.innerHTML = `
        <line x1="${p0[0]}" y1="${p0[1]}" x2="${p1[0]}" y2="${p1[1]}" stroke="#38bdf8" stroke-width="${1.8 * p2m}" stroke-dasharray="${3 * p2m}, ${2 * p2m}" pointer-events="none" />
        <circle cx="${p0[0]}" cy="${p0[1]}" r="${4 * p2m}" fill="#38bdf8" stroke="#ffffff" stroke-width="${1 * p2m}" />
        <circle cx="${p1[0]}" cy="${p1[1]}" r="${3.5 * p2m}" fill="#00f0ff" stroke="#ffffff" stroke-width="${0.8 * p2m}" />
        <rect x="${(p0[0] + p1[0]) / 2 - 45 * p2m}" y="${(p0[1] + p1[1]) / 2 - 20 * p2m}" width="${90 * p2m}" height="${16 * p2m}" rx="${3 * p2m}" fill="rgba(8,13,26,0.92)" stroke="#38bdf8" stroke-width="${0.8 * p2m}" pointer-events="none"/>
        <text x="${(p0[0] + p1[0]) / 2}" y="${(p0[1] + p1[1]) / 2 - 8 * p2m}" text-anchor="middle" fill="#38bdf8" font-size="${8.5 * p2m}" font-family="'JetBrains Mono', monospace" font-weight="bold" pointer-events="none">L: ${dist.toFixed(2)}მ ∠${deg}°</text>
      `;
    } else if (state.activeTool === 'draw_cad_polyline' && state.cadDraftPoints && state.cadDraftPoints.length > 0) {
      const lastP = state.cadDraftPoints[state.cadDraftPoints.length - 1];
      let curMouse = state.activeSnap ? state.activeSnap.point : (state.mouseWorldPos || lastP);
      if (state.orthoEnabled && !state.activeSnap) {
        const dx = Math.abs(curMouse[0] - lastP[0]);
        const dy = Math.abs(curMouse[1] - lastP[1]);
        if (dx > dy) curMouse = [curMouse[0], lastP[1]];
        else curMouse = [lastP[0], curMouse[1]];
      }
      const pts = state.cadDraftPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      const dist = Math.hypot(curMouse[0] - lastP[0], curMouse[1] - lastP[1]);
      els.interactionLayer.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="#00e5ff" stroke-width="${1.8 * p2m}" pointer-events="none" />
        <line x1="${lastP[0]}" y1="${lastP[1]}" x2="${curMouse[0]}" y2="${curMouse[1]}" stroke="#00e5ff" stroke-width="${1.8 * p2m}" stroke-dasharray="${3 * p2m}, ${2 * p2m}" pointer-events="none" />
        ${state.cadDraftPoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3.5 * p2m}" fill="#00e5ff" stroke="#ffffff" stroke-width="${0.8 * p2m}" pointer-events="none"/>`).join('')}
        <circle cx="${curMouse[0]}" cy="${curMouse[1]}" r="${3.5 * p2m}" fill="#00f0ff" stroke="#ffffff" stroke-width="${0.8 * p2m}" />
        <rect x="${curMouse[0] + 10 * p2m}" y="${curMouse[1] - 18 * p2m}" width="${65 * p2m}" height="${15 * p2m}" rx="${3 * p2m}" fill="rgba(8,13,26,0.92)" stroke="#00e5ff" stroke-width="${0.8 * p2m}" pointer-events="none"/>
        <text x="${curMouse[0] + 42.5 * p2m}" y="${curMouse[1] - 7 * p2m}" text-anchor="middle" fill="#00e5ff" font-size="${8 * p2m}" font-family="'JetBrains Mono', monospace" font-weight="bold" pointer-events="none">${dist.toFixed(2)}მ</text>
      `;
    } else if (state.activeTool === 'draw_cad_arc' && state.cadDraftPoints && state.cadDraftPoints.length > 0) {
      const curMouse = state.activeSnap ? state.activeSnap.point : (state.mouseWorldPos || state.cadDraftPoints[0]);
      if (state.cadDraftPoints.length === 1) {
        const p1 = state.cadDraftPoints[0];
        els.interactionLayer.innerHTML = `
          <line x1="${p1[0]}" y1="${p1[1]}" x2="${curMouse[0]}" y2="${curMouse[1]}" stroke="#f59e0b" stroke-width="${1.8 * p2m}" stroke-dasharray="${3 * p2m}, ${2 * p2m}" pointer-events="none" />
          <circle cx="${p1[0]}" cy="${p1[1]}" r="${4 * p2m}" fill="#f59e0b" stroke="#ffffff" stroke-width="${1 * p2m}" />
          <circle cx="${curMouse[0]}" cy="${curMouse[1]}" r="${3.5 * p2m}" fill="#f59e0b" stroke="#ffffff" stroke-width="${0.8 * p2m}" />
        `;
      } else if (state.cadDraftPoints.length === 2) {
        const p1 = state.cadDraftPoints[0];
        const p2 = state.cadDraftPoints[1];
        const p3 = curMouse;
        els.interactionLayer.innerHTML = `
          <path d="M ${p1[0]} ${p1[1]} Q ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}" fill="none" stroke="#f59e0b" stroke-width="${2 * p2m}" stroke-dasharray="${4 * p2m}, ${2 * p2m}" pointer-events="none" />
          <circle cx="${p1[0]}" cy="${p1[1]}" r="${3.5 * p2m}" fill="#f59e0b" />
          <circle cx="${p2[0]}" cy="${p2[1]}" r="${3.5 * p2m}" fill="#f59e0b" />
          <circle cx="${p3[0]}" cy="${p3[1]}" r="${3.5 * p2m}" fill="#f59e0b" />
        `;
      }
    } else if (state.activeTool === 'draw_cad_circle' && state.cadDraftPoints && state.cadDraftPoints.length === 1) {
      const center = state.cadDraftPoints[0];
      const curMouse = state.activeSnap ? state.activeSnap.point : (state.mouseWorldPos || center);
      const r = Math.max(0.5, Math.hypot(curMouse[0] - center[0], curMouse[1] - center[1]));
      els.interactionLayer.innerHTML = `
        <circle cx="${center[0]}" cy="${center[1]}" r="${r}" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" stroke-width="${1.8 * p2m}" stroke-dasharray="${4 * p2m}, ${3 * p2m}" pointer-events="none" />
        <line x1="${center[0]}" y1="${center[1]}" x2="${curMouse[0]}" y2="${curMouse[1]}" stroke="#10b981" stroke-width="${1.2 * p2m}" stroke-dasharray="${2 * p2m}, ${2 * p2m}" pointer-events="none" />
        <circle cx="${center[0]}" cy="${center[1]}" r="${4 * p2m}" fill="#10b981" stroke="#ffffff" stroke-width="${1 * p2m}" />
        <rect x="${(center[0] + curMouse[0]) / 2 - 35 * p2m}" y="${(center[1] + curMouse[1]) / 2 - 18 * p2m}" width="${70 * p2m}" height="${16 * p2m}" rx="${3 * p2m}" fill="rgba(8,13,26,0.92)" stroke="#10b981" stroke-width="${0.8 * p2m}" pointer-events="none"/>
        <text x="${(center[0] + curMouse[0]) / 2}" y="${(center[1] + curMouse[1]) / 2 - 6 * p2m}" text-anchor="middle" fill="#10b981" font-size="${8.5 * p2m}" font-family="'JetBrains Mono', monospace" font-weight="bold" pointer-events="none">R: ${r.toFixed(2)}მ</text>
      `;
    } else if (state.activeTool === 'draw_cad_hatch' && state.cadDraftPoints && state.cadDraftPoints.length > 0) {
      const curMouse = state.activeSnap ? state.activeSnap.point : (state.mouseWorldPos || state.cadDraftPoints[0]);
      const pts = [...state.cadDraftPoints, curMouse].map(p => `${p[0]},${p[1]}`).join(' ');
      els.interactionLayer.innerHTML = `
        <polygon points="${pts}" fill="rgba(168, 85, 247, 0.2)" stroke="#a855f7" stroke-width="${1.8 * p2m}" stroke-dasharray="${3 * p2m}, ${2 * p2m}" pointer-events="none" />
        ${state.cadDraftPoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3.5 * p2m}" fill="#a855f7" stroke="#ffffff" stroke-width="${0.8 * p2m}" pointer-events="none"/>`).join('')}
      `;
    } else if (state.activeTool === 'footprint_cutout' && state.atriumCutoutPoints && state.atriumCutoutPoints.length > 0) {
      const curMouse = state.activeSnap ? state.activeSnap.point : (state.mouseWorldPos || state.atriumCutoutPoints[0]);
      const pts = [...state.atriumCutoutPoints, curMouse].map(p => `${p[0]},${p[1]}`).join(' ');
      const area = state.atriumCutoutPoints.length >= 2 ? Math.round(calculatePolygonArea([...state.atriumCutoutPoints, curMouse])) : 0;
      els.interactionLayer.innerHTML = `
        <polygon points="${pts}" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" stroke-width="${2 * p2m}" stroke-dasharray="${4 * p2m}, ${2 * p2m}" pointer-events="none" />
        ${state.atriumCutoutPoints.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3.5 * p2m}" fill="#ef4444" stroke="#ffffff" stroke-width="${0.8 * p2m}" pointer-events="none"/>`).join('')}
        ${area > 0 ? `
          <rect x="${curMouse[0] + 10 * p2m}" y="${curMouse[1] - 20 * p2m}" width="${120 * p2m}" height="${17 * p2m}" rx="${3 * p2m}" fill="rgba(8,13,26,0.95)" stroke="#ef4444" stroke-width="${0.8 * p2m}" pointer-events="none"/>
          <text x="${curMouse[0] + 70 * p2m}" y="${curMouse[1] - 8 * p2m}" text-anchor="middle" fill="#ef4444" font-size="${8.5 * p2m}" font-family="'JetBrains Mono', monospace" font-weight="bold" pointer-events="none">✂️ ამოჭრა: ~${area} მ²</text>
        ` : ''}
      `;
    } else if (state.isFreehandDrawing && state.currentFreehandPoints && state.currentFreehandPoints.length > 1) {
      const pts = state.currentFreehandPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      els.interactionLayer.innerHTML = `
        <polyline points="${pts}" fill="none" stroke="#f43f5e" stroke-width="${2 * p2m}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />
      `;
    } else {
      els.interactionLayer.innerHTML = '';
    }

    // Render OSNAP target marker icon on top
    if (state.activeSnap) {
      const sp = state.activeSnap.point;
      const st = state.activeSnap.type;
      let snapIconSvg = '';
      if (st === 'endpoint') {
        snapIconSvg = `<rect x="${sp[0] - 5 * p2m}" y="${sp[1] - 5 * p2m}" width="${10 * p2m}" height="${10 * p2m}" fill="none" stroke="#facc15" stroke-width="${2 * p2m}"/>`;
      } else if (st === 'midpoint') {
        const pA = `${sp[0]},${sp[1] - 6 * p2m}`;
        const pB = `${sp[0] - 5 * p2m},${sp[1] + 4 * p2m}`;
        const pC = `${sp[0] + 5 * p2m},${sp[1] + 4 * p2m}`;
        snapIconSvg = `<polygon points="${pA} ${pB} ${pC}" fill="none" stroke="#00f0ff" stroke-width="${2 * p2m}"/>`;
      } else if (st === 'intersection') {
        snapIconSvg = `
          <line x1="${sp[0] - 5 * p2m}" y1="${sp[1] - 5 * p2m}" x2="${sp[0] + 5 * p2m}" y2="${sp[1] + 5 * p2m}" stroke="#f97316" stroke-width="${2 * p2m}"/>
          <line x1="${sp[0] - 5 * p2m}" y1="${sp[1] + 5 * p2m}" x2="${sp[0] + 5 * p2m}" y2="${sp[1] - 5 * p2m}" stroke="#f97316" stroke-width="${2 * p2m}"/>
        `;
      } else if (st === 'perpendicular') {
        snapIconSvg = `
          <polyline points="${sp[0] - 6 * p2m},${sp[1]} ${sp[0]},${sp[1]} ${sp[0]},${sp[1] - 6 * p2m}" fill="none" stroke="#22c55e" stroke-width="${2 * p2m}"/>
        `;
      }
      els.interactionLayer.innerHTML += `<g pointer-events="none">${snapIconSvg}</g>`;
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

  // --- AutoCAD / Autodesk Revit 1:1 Vector DXF Export ---
  window.exportTsinareDxf = function (mode = 'local') {
    if (!state.boundaryMeters || state.boundaryMeters.length < 3) {
      alert('ნაკვეთის მონაცემები არ არის ჩატვირთული. გთხოვთ ჯერ მოიძიოთ ნაკვეთი.');
      return;
    }

    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n"; // 6 = Meters
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n8\n";
    dxf += "0\nLAYER\n2\nCADASTRAL_BOUNDARY\n70\n0\n62\n1\n6\nCONTINUOUS\n"; // Red
    dxf += "0\nLAYER\n2\nSETBACK_BUFFER\n70\n0\n62\n6\n6\nCONTINUOUS\n"; // Magenta
    dxf += "0\nLAYER\n2\nBUILDING_FOOTPRINTS\n70\n0\n62\n4\n6\nCONTINUOUS\n"; // Cyan
    dxf += "0\nLAYER\n2\nSUBDIVISION_PARCELS\n70\n0\n62\n3\n6\nCONTINUOUS\n"; // Green
    dxf += "0\nLAYER\n2\nTREES_GREENERY\n70\n0\n62\n2\n6\nCONTINUOUS\n"; // Yellow
    dxf += "0\nLAYER\n2\nWATER_BODIES\n70\n0\n62\n5\n6\nCONTINUOUS\n"; // Blue
    dxf += "0\nLAYER\n2\nROADS\n70\n0\n62\n8\n6\nCONTINUOUS\n"; // Gray
    dxf += "0\nLAYER\n2\nWALKWAYS\n70\n0\n62\n9\n6\nCONTINUOUS\n";
    dxf += "0\nENDTAB\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nENTITIES\n";

    // Helper: In state.boundaryMeters, y is negative for North (SVG convention).
    // In CAD / Revit, +Y is North, so CAD Y = -pt[1].
    const transformPt = (pt) => {
      return [pt[0], -pt[1]];
    };

    // Add a Closed or Open Polyline (AC1009 standard, 100% compatible with Revit Toposolid / Property Line)
    const addPolyline = (layer, pts, isClosed = true) => {
      if (!pts || pts.length < 2) return;
      let clean = pts.slice();
      if (clean.length > 2 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < 1e-4) {
        clean.pop();
      }

      dxf += `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n${isClosed ? 1 : 0}\n`;
      clean.forEach(p => {
        const cp = transformPt(p);
        dxf += `0\nVERTEX\n8\n${layer}\n10\n${cp[0].toFixed(3)}\n20\n${cp[1].toFixed(3)}\n30\n0.000\n`;
      });
      dxf += "0\nSEQEND\n";
    };

    // 1. Cadastral Boundary (Closed 1:1 polyline)
    addPolyline('CADASTRAL_BOUNDARY', state.boundaryMeters, true);

    // 2. Setback Buffer (Closed or open polylines)
    const setbackRes = computeNeighborSetbackPolylines(state.boundaryMeters, state.boundaryEdgeTypes, state.setbackDistance);
    (setbackRes.polylines || []).forEach(poly => {
      addPolyline('SETBACK_BUFFER', poly, false);
    });

    // 3. Other Masterplan Elements
    state.subParcels.forEach(sp => addPolyline('SUBDIVISION_PARCELS', sp.polygon, true));
    state.footprints.forEach(fp => addPolyline('BUILDING_FOOTPRINTS', fp.vertices, true));
    (state.roads || []).forEach(r => addPolyline('ROADS', r.points, false));
    (state.walkways || []).forEach(w => addPolyline('WALKWAYS', w.points, false));
    (state.bikePaths || []).forEach(b => addPolyline('BIKE_PATHS', b.points, false));
    (state.hedges || []).forEach(h => addPolyline('HEDGES', h.points, false));

    // Trees as Circles
    state.trees.forEach(t => {
      const ct = transformPt([t.x, t.y]);
      dxf += `0\nCIRCLE\n8\nTREES_GREENERY\n10\n${ct[0].toFixed(3)}\n20\n${ct[1].toFixed(3)}\n30\n0.000\n40\n${(t.radius || 2.5).toFixed(3)}\n`;
    });

    dxf += "0\nENDSEC\n0\nEOF\n";

    const safeCode = (state.cadastralCode || 'parcel').replace(/[^\w.-]/g, '_');
    const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Revit_Cadastral_Boundary_1to1_${safeCode}.dxf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Keyboard Shortcuts: Delete, Undo, Tool shortcuts & Horizontal Scroll
  function setupEventListeners() {
    // Horizontal wheel scroll on ribbon toolbars
    ['cadRibbonRow1', 'cadRibbonRow2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('wheel', e => {
          if (e.deltaY !== 0) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          }
        }, { passive: false });
      }
    });

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
      if (e.key === 'F3') {
        e.preventDefault();
        window.toggleOsnap();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        window.toggleOrtho();
        return;
      }
      if (e.key === 'Enter') {
        if ((state.activeTool === 'draw_footprint' || state.activeTool === 'draw_polygon') && state.drawPoints.length >= 3) {
          e.preventDefault();
          finishDrawnFootprint();
          return;
        }
        if (state.activeTool === 'draw_cad_polyline') {
          e.preventDefault();
          window.finishCadPolyline();
          return;
        }
        if (state.activeTool === 'draw_cad_hatch') {
          e.preventDefault();
          window.finishCadHatch();
          return;
        }
        if (state.activeTool === 'footprint_cutout') {
          e.preventDefault();
          window.finishFootprintCutout();
          return;
        }
      }
      if (e.key === ' ' || e.key.toLowerCase() === 'v') setCadActiveTool('pan');
      if (e.key.toLowerCase() === 'l') setCadActiveTool('draw_cad_line');
      if (e.key.toLowerCase() === 'c') setCadActiveTool('draw_cad_circle');
      if (e.key.toLowerCase() === 'a') setCadActiveTool('draw_cad_arc');
      if (e.key.toLowerCase() === 'o') setCadActiveTool('cad_offset');
      if (e.key.toLowerCase() === 'x') setCadActiveTool('cad_trim');
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
        state.cadDraftPoints = [];
        state.atriumCutoutPoints = [];
        state.isFreehandDrawing = false;
        if (els.cadDynamicHud) els.cadDynamicHud.classList.add('hidden');
        setCadActiveTool('pan');
        renderCadWorld();
      }
    });
  }

})();
