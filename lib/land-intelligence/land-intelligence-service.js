/**
 * lib/land-intelligence/land-intelligence-service.js
 * -----------------------------------------------------------------------
 * Master Orchestrator for LAND INTELLIGENCE ENGINE GEORGIA.
 * Coordinates all spatial providers, statutory engines, and AI explanation.
 * Powers POST /api/land-analysis.
 */

const NaprProvider = require('./providers/napr-provider');
const NSDIProvider = require('./providers/nsdi-provider');
const MunicipalityProvider = require('./providers/municipality-provider');
const UrbanPlanResolver = require('./providers/urban-plan-resolver');
const TbilisiZoningProvider = require('./providers/tbilisi-zoning-provider');
const RestrictionProvider = require('./providers/restriction-provider');
const MEPAProvider = require('./providers/mepa-provider');
const CulturalHeritageProvider = require('./providers/heritage-provider');
const LegalSourceProvider = require('./providers/legal-source-provider');
const TasProjectsProvider = require('./providers/tas-projects-provider');

const RulesEngine = require('./rules-engine');
const BuildableAreaEngine = require('./buildable-area-engine');
const ConstructionPossibilityEngine = require('./construction-possibility-engine');
const AIExplanationEngine = require('./ai-explanation-engine');
const { DATA_QUALITY } = require('./types');

class LandIntelligenceService {
  constructor() {
    this.napr = new NaprProvider();
    this.nsdi = new NSDIProvider();
    this.municipality = new MunicipalityProvider();
    this.urbanPlan = new UrbanPlanResolver();
    this.tbilisiZoning = new TbilisiZoningProvider();
    this.restrictions = new RestrictionProvider();
    this.mepa = new MEPAProvider();
    this.heritage = new CulturalHeritageProvider();
    this.legal = new LegalSourceProvider();
    this.tasProjects = new TasProjectsProvider();

    this.rulesEngine = new RulesEngine();
    this.buildableEngine = new BuildableAreaEngine();
    this.possibilityEngine = new ConstructionPossibilityEngine();
    this.aiExplanation = new AIExplanationEngine();
  }

  async analyzeLandParcel(cadastralCode, constructionType = 'new_construction', buildingUse = 'residential_single', manualCoefficients = null, zoneOverride = null) {
    // 1. Fetch official parcel geometry & cadastral data
    const parcelRes = await this.napr.getParcelByCadastralCode(cadastralCode);

    if (!parcelRes.found) {
      return {
        status: 'ERROR',
        error: parcelRes.status,
        messageKa: parcelRes.messageKa || 'ნაკვეთი ვერ მოიძებნა',
        cadastralCode
      };
    }

    const parcelAreaSqm = parcelRes.areaSqm || 0;
    const centroid = parcelRes.centroid || [0, 0];
    const dimensions = parcelRes.dimensions || null;

    // 2. Municipality & Administrative Boundary Detection
    const municipalityInfo = this.municipality.resolveMunicipality(cadastralCode, centroid);

    // 3. Active Urban Plan Detection
    const urbanPlanInfo = this.urbanPlan.resolvePlan(municipalityInfo.municipalityId, parcelRes.boundary);

    // 4. Functional Zoning Resolution (with Multi-Zone support & explicit user manual override)
    const activeZonePreset = (zoneOverride && zoneOverride !== 'auto')
      ? zoneOverride
      : (manualCoefficients && manualCoefficients.zonePreset && manualCoefficients.zonePreset !== 'auto' ? manualCoefficients.zonePreset : null);

    const zoningInfo = this.tbilisiZoning.resolveZoning(cadastralCode, centroid, parcelAreaSqm, activeZonePreset);
    const primaryZone = zoningInfo.primaryZone;
    const reg = primaryZone.regulations;

    // 5. Restrictions (Red/Blue Lines, Servitudes, Infrastructure)
    const restrictionsInfo = this.restrictions.analyzeRestrictions(parcelRes, centroid);

    // 6. Environmental Status (MEPA)
    const mepaInfo = this.mepa.analyzeEnvironmentalStatus(centroid, municipalityInfo.municipalityId);

    // 7. Cultural Heritage & Archaeological Status
    const heritageInfo = this.heritage.analyzeHeritageStatus(centroid, municipalityInfo.municipalityId);

    // 8. Rules Engine Evaluation (K1, K2, K3, Dimensions, Setbacks)
    const rulesResult = this.rulesEngine.evaluateStatutoryParameters(parcelAreaSqm, dimensions, reg, manualCoefficients);

    // 9. Buildable Area Calculation (Net Usable Area deducting geometric restrictions)
    const buildableAreaResult = this.buildableEngine.calculateBuildableArea(
      parcelAreaSqm,
      restrictionsInfo.restrictions,
      rulesResult.coefficients.k1 ? rulesResult.coefficients.k1.maxFootprintSqm : null
    );

    // 10. Approved Municipal Projects (TAS.GE) & Remaining Building Capacity
    const k1Val = (rulesResult.coefficients && rulesResult.coefficients.k1 && rulesResult.coefficients.k1.value != null)
      ? rulesResult.coefficients.k1.value
      : (reg ? reg.k1 : 0.5);
    const k2Val = (rulesResult.coefficients && rulesResult.coefficients.k2 && rulesResult.coefficients.k2.value != null)
      ? rulesResult.coefficients.k2.value
      : (reg ? reg.k2 : 1.5);
    const k3Val = (rulesResult.coefficients && rulesResult.coefficients.k3 && rulesResult.coefficients.k3.value != null)
      ? rulesResult.coefficients.k3.value
      : (reg ? reg.k3 : 0.3);

    const tasProjectsAndCapacity = this.tasProjects.getApprovedProjectsAndCapacity(
      parcelRes.cadastralCode,
      parcelAreaSqm,
      k1Val,
      k2Val,
      k3Val,
      centroid
    );

    // 11. Project Intention & Construction Possibility
    const projectIntention = {
      type: buildingUse,
      labelKa: this.getProjectLabelKa(buildingUse),
      constructionType
    };

    const possibilityResult = this.possibilityEngine.evaluatePossibility(
      projectIntention,
      zoningInfo,
      rulesResult.complianceChecks,
      restrictionsInfo.restrictions,
      heritageInfo,
      mepaInfo
    );

    // 12. Obligations Compilation
    const allObligations = [
      ...restrictionsInfo.legalObligations,
      'მიწის ნაკვეთის სამშენებლოდ გამოყენების პირობების (აპზ) მიღება',
      'საინჟინრო-გეოლოგიური კვლევის მომზადება',
      'საინჟინრო-ტოპოგრაფიული აზომვითი გეგმის (M 1:500) შედგენა'
    ];
    if (heritageInfo.isRestricted) {
      allObligations.push('კულტურული მემკვიდრეობის საბჭოს სავალდებულო თანხმობა');
    }
    if (mepaInfo.protectedArea && mepaInfo.protectedArea.intersects) {
      allObligations.push('გარემოსდაცვითი ექსპერტიზის დასკვნა');
    }

    // 13. AI Explanation & Executive Risk Radar
    const explanationPayload = {
      parcel: parcelRes,
      municipality: municipalityInfo,
      functionalZones: zoningInfo,
      coefficients: rulesResult.coefficients,
      constructionPossibility: possibilityResult,
      buildableArea: buildableAreaResult,
      tasProjects: tasProjectsAndCapacity,
      restrictions: restrictionsInfo.restrictions,
      heritage: heritageInfo,
      environmental: mepaInfo
    };
    const finalSummary = this.aiExplanation.generateExecutiveSummary(explanationPayload);

    // 14. Sources & Transparency Registry
    const sources = [
      this.napr.getMetadata(),
      this.nsdi.getMetadata(),
      this.municipality.getMetadata(),
      this.urbanPlan.getMetadata(),
      this.tbilisiZoning.getMetadata(),
      this.tasProjects.getMetadata(),
      this.restrictions.getMetadata(),
      this.mepa.getMetadata(),
      this.heritage.getMetadata(),
      this.legal.getMetadata()
    ];

    // Build the final comprehensive API response matching Sections 51 and 53
    return {
      status: 'SUCCESS',
      analyzedAt: new Date().toISOString(),
      parcel: {
        cadastralCode: parcelRes.cadastralCode,
        areaSqm: parcelRes.areaSqm,
        address: parcelRes.address,
        centroid: parcelRes.centroid,
        coordinates: parcelRes.boundary,
        dimensions: parcelRes.dimensions,
        officialStatus: 'ACTIVE_REGISTERED',
        source: parcelRes.source,
        sourceUrl: parcelRes.sourceUrl,
        portalUrl: parcelRes.portalUrl,
        quality: parcelRes.quality
      },
      municipality: {
        id: municipalityInfo.municipalityId,
        nameKa: municipalityInfo.municipalityNameKa,
        nameEn: municipalityInfo.municipalityNameEn,
        regionKa: municipalityInfo.regionKa,
        quality: municipalityInfo.quality,
        source: municipalityInfo.source
      },
      administrativeArea: {
        districtKa: municipalityInfo.districtKa,
        quality: DATA_QUALITY.VERIFIED_OFFICIAL
      },
      urbanPlan: urbanPlanInfo,
      functionalZones: zoningInfo.allZones,
      isSplitZone: zoningInfo.isSplitZone,
      primaryZone: zoningInfo.primaryZone,
      regulations: {
        permittedUses: reg.permittedUses,
        conditionalUses: reg.conditionalUses,
        prohibitedUses: reg.prohibitedUses,
        setbacks: rulesResult.setbacks,
        heightAndFloors: rulesResult.heightAndFloors,
        legalBasisKa: reg.legalBasisKa
      },
      coefficients: rulesResult.coefficients,
      parcelRequirements: {
        complianceChecks: rulesResult.complianceChecks
      },
      permittedUses: reg.permittedUses,
      conditionalUses: reg.conditionalUses,
      prohibitedUses: reg.prohibitedUses,
      restrictions: restrictionsInfo.restrictions,
      buildableArea: buildableAreaResult,
      tasProjects: tasProjectsAndCapacity,
      approvedProjects: tasProjectsAndCapacity.projects,
      remainingCapacity: tasProjectsAndCapacity.remaining,
      environmental: mepaInfo,
      culturalHeritage: heritageInfo,
      obligations: allObligations,
      constructionPossibility: possibilityResult,
      legalReferences: this.legal.getAllStatutoryDocuments(),
      dataQuality: {
        parcelGeometry: parcelRes.quality,
        zoning: zoningInfo.quality,
        coefficients: DATA_QUALITY.RULE_BASED,
        restrictions: restrictionsInfo.quality,
        aiExplanation: DATA_QUALITY.AI_INTERPRETATION
      },
      sources,
      finalSummary
    };
  }

  getProjectLabelKa(type) {
    const labels = {
      residential_single: 'ინდივიდუალური საცხოვრებელი სახლი',
      residential_multi: 'მრავალბინიანი საცხოვრებელი სახლი',
      commercial: 'კომერციული შენობა',
      office: 'საოფისე შენობა',
      hotel: 'სასტუმრო',
      apartments: 'აპარტამენტები',
      public: 'საზოგადოებრივი შენობა',
      educational: 'საგანმანათლებლო ობიექტი',
      medical: 'სამედიცინო ობიექტი',
      sports: 'სპორტული ობიექტი',
      industrial: 'სამრეწველო ობიექტი',
      mixed_use: 'მრავალფუნქციური შენობა',
      reconstruction: 'რეკონსტრუქცია',
      extension: 'გაფართოება',
      new_construction: 'ახალი მშენებლობა',
      other: 'სხვა'
    };
    return labels[type] || 'სხვა ობიექტი';
  }
}

module.exports = LandIntelligenceService;
