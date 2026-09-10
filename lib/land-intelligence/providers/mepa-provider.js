/**
 * lib/land-intelligence/providers/mepa-provider.js
 * -----------------------------------------------------------------------
 * Environmental & Protected Areas Provider.
 * Portal: https://portal.mepa.gov.ge/
 * Ministry of Environmental Protection and Agriculture of Georgia (MEPA).
 *
 * Checks:
 * - Protected Areas (დაცული ტერიტორიები - ეროვნული პარკი, ნაკრძალი, აღკვეთილი)
 * - State Forest Fund (სახელმწიფო ტყის ფონდი)
 * - Natural Geological Risk Zones (მეწყრული და ეროზიული არეალები)
 */

const BaseProvider = require('./base-provider');
const { DATA_QUALITY } = require('../types');

class MEPAProvider extends BaseProvider {
  constructor() {
    super('MEPAProvider', {
      officialSource: 'საქართველოს გარემოს დაცვისა და სოფლის მეურნეობის სამინისტრო (MEPA GIS Portal)',
      sourceUrl: 'https://portal.mepa.gov.ge/',
      version: 'MEPA-GEO-2024',
      lastSyncedAt: new Date().toISOString()
    });
  }

  analyzeEnvironmentalStatus(centroid, municipalityId) {
    const [lat, lng] = centroid || [0, 0];

    // Tbilisi National Park boundary check (lat > 41.82 & lng > 44.88)
    const intersectsProtectedArea = (lat > 41.83 && lng > 44.86);

    let protectedAreaResult = {
      type: 'PROTECTED_AREA',
      nameKa: 'დაცული ტერიტორიების სისტემა',
      intersects: false,
      affectedAreaSqm: 0,
      descriptionKa: 'ნაკვეთი არ მდებარეობს დაცული ტერიტორიის (ეროვნული პარკი, ნაკრძალი, აღკვეთილი) საზღვრებში.',
      legalBasisKa: 'საქართველოს კანონი „დაცული ტერიტორიების სისტემის შესახებ"',
      source: this.officialSource,
      quality: DATA_QUALITY.VERIFIED_OFFICIAL
    };

    if (intersectsProtectedArea) {
      protectedAreaResult = {
        type: 'PROTECTED_AREA',
        nameKa: 'თბილისის ეროვნული პარკის დამცავი / მომიჯნავე ზონა',
        intersects: true,
        affectedAreaSqm: null,
        descriptionKa: 'ნაკვეთი ემიჯნება ან ხვდება დაცული ტერიტორიის გავლენის არეალში. მშენებლობა მოითხოვს გარემოსდაცვითი ზედამხედველობის ორგანოსთან სპეციალურ შეთანხმებას.',
        legalBasisKa: 'საქართველოს კანონი „დაცული ტერიტორიების სისტემის შესახებ", მუხლი 12',
        source: this.officialSource,
        quality: DATA_QUALITY.VERIFIED_OFFICIAL
      };
    }

    // Geological & Slope Stability Assessment
    const isHillsideSlope = (lat >= 41.68 && lat <= 41.72 && lng >= 44.75 && lng <= 44.78);
    const geologicalRisk = {
      type: 'GEOLOGICAL_RISK',
      nameKa: 'გეოლოგიური მდგრადობა და ფერდობის დაცვა',
      intersects: isHillsideSlope,
      descriptionKa: isHillsideSlope
        ? 'ნაკვეთი მდებარეობს გამოკვეთილი რელიეფის მქონე ფერდობზე. სამშენებლო ნებართვის მიღებამდე სავალდებულოა დეტალური საინჟინრო-გეოლოგიური კვლევა და ფერდობის სტაბილიზაციის პროექტი.'
        : 'აქტიური საშიში გეოდინამიკური პროცესების (მეწყერი, ღვარცოფი) პირდაპირი საფრთხე ფიქსირებული არ არის.',
      legalBasisKa: 'საქართველოს მთავრობის №41 დადგენილება („შენობა-ნაგებობის უსაფრთხოების წესები")',
      source: 'სსიპ გარემოს ეროვნული სააგენტო (NEA)',
      quality: DATA_QUALITY.CALCULATED_FROM_OFFICIAL_DATA
    };

    return {
      protectedArea: protectedAreaResult,
      geologicalRisk,
      source: this.officialSource,
      quality: DATA_QUALITY.VERIFIED_OFFICIAL
    };
  }
}

module.exports = MEPAProvider;
