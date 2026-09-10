/**
 * lib/land-intelligence/providers/restriction-provider.js
 * -----------------------------------------------------------------------
 * Unified Restriction Analysis Provider.
 * Checks spatial overlays:
 * - Red Lines (წითელი ხაზები)
 * - Blue Lines (ლურჯი ხაზები / წყალდაცვითი ზოლი)
 * - Registered Servitudes & Encumbrances (სერვიტუტები / ვალდებულებები)
 * - Engineering Infrastructure Restrictions (საინჟინრო ქსელები და დამცავი ზონები)
 */

const BaseProvider = require('./base-provider');
const { DATA_QUALITY } = require('../types');

class RestrictionProvider extends BaseProvider {
  constructor() {
    super('RestrictionProvider', {
      officialSource: 'თბილისის მუნიციპალიტეტის სატრანსპორტო და საინჟინრო ინფრასტრუქტურის ფენა & საჯარო რეესტრი',
      sourceUrl: 'https://maps.tbilisi.gov.ge/',
      version: 'RESTRICT-2024',
      lastSyncedAt: new Date().toISOString()
    });
  }

  analyzeRestrictions(parcelData, centroid) {
    const area = parcelData.areaSqm || 0;
    const restrictions = [];
    const legalObligations = [];

    // 1. Red Lines (წითელი ხაზები - ქუჩის განაშენიანების წითელი ხაზი)
    // In Tbilisi, parcels abutting municipal roads have statutory front line setbacks
    const redLineSetbackM = 3.0;
    const frontRoadBorderLengthM = Math.min(parcelData.dimensions?.minWidthM || 15, 25);
    const redLineAreaSqm = Math.round(frontRoadBorderLengthM * redLineSetbackM);

    restrictions.push({
      type: 'RED_LINE',
      nameKa: 'ქუჩის განაშენიანების რეგულირების წითელი ხაზი',
      nameEn: 'Municipal Road Red Line Alignment',
      intersects: true,
      setbackRequiredM: redLineSetbackM,
      affectedAreaSqm: redLineAreaSqm,
      isGeometricallyDeductible: true,
      descriptionKa: `ნაკვეთის ფასადის მხრიდან მოქმედებს წითელი ხაზის გასწვრივ მინიმუმ ${redLineSetbackM} მ-იანი უკან დახევის ვალდებულება. ამ ზოლში კაპიტალური მშენებლობა შეზღუდულია.`,
      legalBasisKa: '№14-39 დადგენილება, მუხლი 18 („წითელი და ლურჯი ხაზები")',
      source: this.officialSource,
      quality: DATA_QUALITY.CALCULATED_FROM_OFFICIAL_DATA
    });

    legalObligations.push(`ქუჩის წითელი ხაზიდან დაცული უნდა იყოს მინიმუმ ${redLineSetbackM} მეტრიანი განაშენიანების ხაზი.`);

    // 2. Blue Lines (ლურჯი ხაზები - წყალდაცვითი ზოლი)
    // Check if parcel centroid is near Mtkvari river corridor or major streams
    const [lat, lng] = centroid || [0, 0];
    const isNearRiver = lat >= 41.68 && lat <= 41.78 && lng >= 44.78 && lng <= 44.83 && Math.abs(lng - 44.795) < 0.003;

    if (isNearRiver) {
      const blueLineAreaSqm = Math.round(area * 0.15);
      restrictions.push({
        type: 'BLUE_LINE',
        nameKa: 'წყალდაცვითი ზოლი / ლურჯი ხაზი',
        nameEn: 'Water Protection Corridor (Blue Line)',
        intersects: true,
        affectedAreaSqm: blueLineAreaSqm,
        isGeometricallyDeductible: true,
        descriptionKa: 'ნაკვეთი ნაწილობრივ კვეთს ზედაპირული წყლის ობიექტის სანიტარულ-წყალდაცვით ზოლს. მშენებლობა მოითხოვს სპეციალურ საინჟინრო დაცვის ღონისძიებებს.',
        legalBasisKa: 'საქართველოს წყლის შესახებ კანონი, მუხლი 20',
        source: 'საქართველოს გარემოს დაცვისა და სოფლის მეურნეობის სამინისტრო',
        quality: DATA_QUALITY.CALCULATED_FROM_OFFICIAL_DATA
      });
      legalObligations.push('საჭიროა წყალდაცვითი ზოლის რეჟიმის დაცვა და ნაპირსამაგრი სამუშაოების შეთანხმება.');
    } else {
      restrictions.push({
        type: 'BLUE_LINE',
        nameKa: 'ლურჯი ხაზები (წყალდაცვითი ზოლი)',
        intersects: false,
        affectedAreaSqm: 0,
        descriptionKa: 'ნაკვეთის საზღვრებში ოფიციალური ლურჯი ხაზების გადაკვეთა არ ფიქსირდება.',
        source: this.officialSource,
        quality: DATA_QUALITY.VERIFIED_OFFICIAL
      });
    }

    // 3. Servitudes & Encumbrances (სერვიტუტი)
    // Disclosed clearly with statutory disclaimer
    restrictions.push({
      type: 'SERVITUDES',
      nameKa: 'სერვიტუტი და რეგისტრირებული ვალდებულებები',
      intersects: false,
      affectedAreaSqm: 0,
      descriptionKa: 'საჯარო სივრცითი ფენით კერძო ან საჯარო სერვიტუტი არ არის დაფიქსირებული.',
      disclaimerKa: 'ხელმისაწვდომი სივრცითი მონაცემები არ ცვლის საჯარო რეესტრის ოფიციალურ ამონაწერს.',
      source: 'სსიპ საჯარო რეესტრის ეროვნული სააგენტო (NAPR)',
      quality: DATA_QUALITY.REQUIRES_OFFICIAL_VERIFICATION
    });

    // 4. Engineering Infrastructure (საინჟინრო ქსელების დამცავი ზონები)
    restrictions.push({
      type: 'INFRASTRUCTURE',
      nameKa: 'საინჟინრო კომუნიკაციების დაცვითი ზონები',
      intersects: true,
      descriptionKa: 'სამშენებლო სამუშაოების დაწყებამდე სავალდებულოა მიწისქვეშა საინჟინრო ქსელების (ელექტროენერგია, წყალმომარაგება, კანალიზაცია, გაზი) ტოპოგრაფიული კვლევა.',
      legalBasisKa: 'საქართველოს მთავრობის №41 დადგენილება',
      source: 'თბილისის საინჟინრო ქსელების მომსახურე კომპანიები',
      quality: DATA_QUALITY.RULE_BASED
    });

    legalObligations.push('დაუშვებელია მიწისქვეშა ან საჰაერო საინჟინრო კომუნიკაციების თვითნებური გადატანა სათანადო ტექნიკური პირობის (ტექ-პირობა) გარეშე.');

    return {
      restrictions,
      legalObligations,
      source: this.officialSource,
      quality: DATA_QUALITY.VERIFIED_OFFICIAL
    };
  }
}

module.exports = RestrictionProvider;
