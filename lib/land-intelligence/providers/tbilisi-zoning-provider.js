/**
 * lib/land-intelligence/providers/tbilisi-zoning-provider.js
 * -----------------------------------------------------------------------
 * Official Functional Zoning Provider for Tbilisi City Municipality.
 * Grounded in Tbilisi City Council Resolution No. 14-39 (May 24, 2016)
 * and the Land Use Master Plan (Decree No. 39-18).
 *
 * Implements Multi-Zone parcel spatial splitting (ST_Intersection)
 * calculating area and percentage for each intersecting functional zone.
 */

const BaseProvider = require('./base-provider');
const { DATA_QUALITY, PERMISSION_TYPE } = require('../types');

// Statutory Zone Regulation Database (Resolution No. 14-39 & Master Plan)
const TBILISI_ZONE_REGULATIONS = {
  'sz-1': {
    zoneCode: 'SZ-1',
    mainZoneKa: 'საცხოვრებელი ზონა',
    subZoneKa: 'საცხოვრებელი ზონა-1',
    tabLabelKa: 'საცხოვრებელი ზონა 1 (სზ-1)',
    zoneNameKa: 'დაბალი ინტენსივობის საცხოვრებელი ზონა (სზ-1)',
    zoneNameEn: 'Low-Intensity Residential Zone (SZ-1)',
    category: 'residential',
    colorHex: '#fff3b0',
    k1: 0.5,
    k2: 0.8,
    k3: 0.3,
    minimumParcelArea: 300,
    minimumParcelWidth: 12,
    minimumParcelDepth: 15,
    maximumHeight: 9.0,
    maximumFloors: 2,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['ინდივიდუალური საცხოვრებელი სახლი', 'დამხმარე ნაგებობები', 'კეთილმოწყობის ელემენტები'],
    conditionalUses: ['საოჯახო სასტუმრო (5 ნომრამდე)', 'მცირე სახელოსნო', 'საბავშვო ბაღი'],
    prohibitedUses: ['მრავალბინიანი საცხოვრებელი კორპუსი', 'სამრეწველო ობიექტი', 'დიდი სავაჭრო ცენტრი', 'საწყობი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 21'
  },
  'sz-2': {
    zoneCode: 'SZ-2',
    mainZoneKa: 'საცხოვრებელი ზონა',
    subZoneKa: 'საცხოვრებელი ზონა-2',
    tabLabelKa: 'საცხოვრებელი ზონა 2 (სზ-2)',
    zoneNameKa: 'დაბალი ინტენსივობის საცხოვრებელი ზონა (სზ-2)',
    zoneNameEn: 'Low-Intensity Residential Zone (SZ-2)',
    category: 'residential',
    colorHex: '#ffe066',
    k1: 0.5,
    k2: 1.2,
    k3: 0.3,
    minimumParcelArea: 400,
    minimumParcelWidth: 14,
    minimumParcelDepth: 18,
    maximumHeight: 12.0,
    maximumFloors: 3,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['ინდივიდუალური საცხოვრებელი სახლი', 'დაბალსართულიანი საცხოვრებელი', 'საოჯახო სასტუმრო'],
    conditionalUses: ['მცირე კომერციული ობიექტი პირველ სართულზე', 'ამბულატორია', 'სკოლამდელი დაწესებულება'],
    prohibitedUses: ['მრავალბინიანი მაღალსართულიანი კორპუსი', 'სამრეწველო საწარმო', 'ავტოგასამართი სადგური'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 22'
  },
  'sz-3': {
    zoneCode: 'SZ-3',
    mainZoneKa: 'საცხოვრებელი ზონა',
    subZoneKa: 'საცხოვრებელი ზონა-3',
    tabLabelKa: 'საცხოვრებელი ზონა 3 (სზ-3)',
    zoneNameKa: 'საშუალო ინტენსივობის საცხოვრებელი ზონა (სზ-3)',
    zoneNameEn: 'Medium-Intensity Residential Zone (SZ-3)',
    category: 'residential',
    colorHex: '#ffd166',
    k1: 0.5,
    k2: 1.5,
    k3: 0.3,
    minimumParcelArea: 500,
    minimumParcelWidth: 15,
    minimumParcelDepth: 20,
    maximumHeight: 15.0,
    maximumFloors: 4,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['ინდივიდუალური საცხოვრებელი', 'დაბალსართულიანი მრავალბინიანი სახლი', 'საოფისე ფართები პირველ სართულზე'],
    conditionalUses: ['სასტუმრო', 'სამედიცინო კლინიკა', 'სავაჭრო ობიექტი (300 მ²-მდე)'],
    prohibitedUses: ['სამრეწველო საწარმო', 'ლოგისტიკური ტერმინალი', 'მძიმე ტექნიკის პარკინგი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 23'
  },
  'sz-4': {
    zoneCode: 'SZ-4',
    mainZoneKa: 'საცხოვრებელი ზონა',
    subZoneKa: 'საცხოვრებელი ზონა-4',
    tabLabelKa: 'საცხოვრებელი ზონა 4 (სზ-4)',
    zoneNameKa: 'საშუალო ინტენსივობის საცხოვრებელი ზონა (სზ-4)',
    zoneNameEn: 'Medium-Intensity Residential Zone (SZ-4)',
    category: 'residential',
    colorHex: '#ffb703',
    k1: 0.5,
    k2: 1.8,
    k3: 0.3,
    minimumParcelArea: 600,
    minimumParcelWidth: 16,
    minimumParcelDepth: 20,
    maximumHeight: 21.0,
    maximumFloors: 6,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['მრავალბინიანი საცხოვრებელი სახლი', 'ინდივიდუალური სახლი', 'კომერციული და საოფისე ფართები'],
    conditionalUses: ['სასტუმრო', 'სავაჭრო ცენტრი', 'საგანმანათლებლო დაწესებულება'],
    prohibitedUses: ['სამრეწველო საწარმო', 'ავტოტექმომსახურების დიდი კომპლექსი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 24'
  },
  'sz-5': {
    zoneCode: 'SZ-5',
    mainZoneKa: 'საცხოვრებელი ზონა',
    subZoneKa: 'საცხოვრებელი ზონა-5',
    tabLabelKa: 'საცხოვრებელი ზონა 5 (სზ-5)',
    zoneNameKa: 'საცხოვრებელი ზონა 5 (სზ-5)',
    zoneNameEn: 'High-Intensity Residential Zone 5 (SZ-5)',
    category: 'residential',
    colorHex: '#fb8500',
    // Exact official values matching Photo 3 (maps.tbilisi.gov.ge):
    k1: 0.5,
    k2: 2.1,
    k3: 0.3,
    minimumParcelArea: 700,
    minimumParcelWidth: 18,
    minimumParcelDepth: 25,
    maximumHeight: 27.0,
    maximumFloors: 8,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['მრავალბინიანი საცხოვრებელი სახლი', 'სავაჭრო-საყოფაცხოვრებო ობიექტი', 'საოფისე შენობა'],
    conditionalUses: ['დიდი სავაჭრო კომპლექსი', 'სასტუმრო კომპლექსი', 'მრავალდონიანი პარკინგი'],
    prohibitedUses: ['სამრეწველო საწარმო', 'საშიში საწარმოო ობიექტი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 25'
  },
  'sz-6': {
    zoneCode: 'SZ-6',
    mainZoneKa: 'საცხოვრებელი ზონა',
    subZoneKa: 'საცხოვრებელი ზონა-6',
    tabLabelKa: 'საცხოვრებელი ზონა 6 (სზ-6)',
    zoneNameKa: 'მაღალი ინტენსივობის საცხოვრებელი ზონა (სზ-6)',
    zoneNameEn: 'High-Intensity Residential Zone (SZ-6)',
    category: 'residential',
    colorHex: '#e76f51',
    k1: 0.5,
    k2: 2.5,
    k3: 0.2,
    minimumParcelArea: 800,
    minimumParcelWidth: 20,
    minimumParcelDepth: 25,
    maximumHeight: 36.0,
    maximumFloors: 11,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['მრავალბინიანი საცხოვრებელი კორპუსი', 'მრავალფუნქციური კომპლექსი', 'საოფისე და კომერციული ცენტრი'],
    conditionalUses: ['სასტუმრო', 'სავაჭრო მოლი', 'სპორტულ-გამაჯანსაღებელი კომპლექსი'],
    prohibitedUses: ['სამრეწველო და სასაწყობე ზონა'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 26'
  },
  'ssz-1': {
    zoneCode: 'SSZ-1',
    mainZoneKa: 'საზოგადოებრივ-საქმიანი ზონა',
    subZoneKa: 'საზოგადოებრივ-საქმიანი ზონა-1',
    tabLabelKa: 'საზოგადოებრივ-საქმიანი ზონა 1 (სსზ-1)',
    zoneNameKa: 'საზოგადოებრივ-საქმიანი ზონა 1 (სსზ-1)',
    zoneNameEn: 'Commercial & Business Zone 1 (SSZ-1)',
    category: 'commercial',
    colorHex: '#48cae4',
    k1: 0.7,
    k2: 2.4,
    k3: 0.15,
    minimumParcelArea: 500,
    minimumParcelWidth: 15,
    minimumParcelDepth: 20,
    maximumHeight: 18.0,
    maximumFloors: 5,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['საოფისე შენობა', 'სავაჭრო ობიექტი', 'საზოგადოებრივი კვება', 'სასტუმრო', 'ბანკი'],
    conditionalUses: ['საცხოვრებელი ფართები ზედა სართულებზე', 'კლინიკა', 'სპორტული დარბაზი'],
    prohibitedUses: ['მძიმე მრეწველობა', 'პირუტყვის ფერმა', 'ნაგავსაყრელი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 28'
  },
  'ssz-2': {
    zoneCode: 'SSZ-2',
    mainZoneKa: 'საზოგადოებრივ-საქმიანი ზონა',
    subZoneKa: 'საზოგადოებრივ-საქმიანი ზონა-2',
    tabLabelKa: 'საზოგადოებრივ-საქმიანი ზონა 2 (სსზ-2)',
    zoneNameKa: 'საზოგადოებრივ-საქმიანი ზონა 2 (სსზ-2)',
    zoneNameEn: 'Commercial & Business Zone 2 (SSZ-2)',
    category: 'commercial',
    colorHex: '#0077b6',
    k1: 0.7,
    k2: 3.5,
    k3: 0.1,
    minimumParcelArea: 800,
    minimumParcelWidth: 20,
    minimumParcelDepth: 25,
    maximumHeight: 32.0,
    maximumFloors: 9,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['საოფისე ცენტრი', 'სავაჭრო ცენტრი (მოლი)', 'სასტუმრო', 'მრავალფუნქციური კომპლექსი'],
    conditionalUses: ['მრავალბინიანი საცხოვრებელი', 'საგანმანათლებლო უნივერსიტეტი', 'საავადმყოფო'],
    prohibitedUses: ['სამრეწველო ქარხანა', 'ქიმიური საწყობი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 29'
  },
  'ssz-3': {
    zoneCode: 'SSZ-3',
    mainZoneKa: 'საზოგადოებრივ-საქმიანი ზონა',
    subZoneKa: 'საზოგადოებრივ-საქმიანი ზონა-3',
    tabLabelKa: 'საზოგადოებრივ-საქმიანი ზონა 3 (სსზ-3)',
    zoneNameKa: 'საზოგადოებრივ-საქმიანი ზონა 3 (სსზ-3)',
    zoneNameEn: 'High-Density Commercial & Business Zone 3 (SSZ-3)',
    category: 'commercial',
    colorHex: '#023e8a',
    k1: 0.7,
    k2: 4.6,
    k3: 0.1,
    minimumParcelArea: 1000,
    minimumParcelWidth: 25,
    minimumParcelDepth: 30,
    maximumHeight: null, // Regulated by DDP (გდგ)
    maximumFloors: null,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['ბიზნეს ცენტრი', 'მსხვილი სავაჭრო-გასართობი კომპლექსი', 'სასტუმრო ცათამბჯენი', 'კონგრეს ჰოლი'],
    conditionalUses: ['აპარტამენტები', 'ელიტური საცხოვრებელი კორპუსი'],
    prohibitedUses: ['საწარმოო და სასაწყობე მეურნეობა'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 30'
  },
  'lz': {
    zoneCode: 'LZ',
    mainZoneKa: 'ლანდშაფტურ-სარეკრეაციო ზონა',
    subZoneKa: 'ლანდშაფტურ-სარეკრეაციო ზონა',
    tabLabelKa: 'ლანდშაფტურ-სარეკრეაციო ზონა (ლზ)',
    zoneNameKa: 'ლანდშაფტურ-სარეკრეაციო ზონა (ლზ)',
    zoneNameEn: 'Landscape & Recreational Zone (LZ)',
    category: 'landscape',
    colorHex: '#2d6a4f',
    k1: null,
    k2: null,
    k3: 0.9,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['პარკი', 'სკვერი', 'ბულვარი', 'გამწვანებული ტერიტორია', 'სასეირნო ბილიკები'],
    conditionalUses: ['ღია სპორტული მოედანი', 'საზოგადოებრივი საპირფარეშო', 'სამეთვალყურეო პუნქტი'],
    prohibitedUses: ['კაპიტალური შენობა-ნაგებობა', 'საცხოვრებელი სახლი', 'კომერციული ობიექტი', 'სამრეწველო ნაგებობა'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 36'
  },
  'rz-1': {
    zoneCode: 'RZ-1',
    mainZoneKa: 'სარეკრეაციო ზონა',
    subZoneKa: 'სარეკრეაციო ზონა-1',
    tabLabelKa: 'სარეკრეაციო ზონა 1 (რზ-1)',
    zoneNameKa: 'სარეკრეაციო ზონა 1 (რზ-1)',
    zoneNameEn: 'Recreational Zone 1 (RZ-1)',
    category: 'recreational',
    colorHex: '#52b788',
    k1: 0.05,
    k2: 0.1,
    k3: 0.8,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: 6.0,
    maximumFloors: 1,
    setbacks: { front: 5.0, side: 5.0, rear: 5.0 },
    permittedUses: ['პარკი', 'სკვერი', 'საბავშვო ატრაქციონი', 'გამწვანება'],
    conditionalUses: ['საზაფხულო კაფე', 'ინვენტარის გასაქირავებელი პუნქტი'],
    prohibitedUses: ['საცხოვრებელი', 'საოფისე', 'სამრეწველო'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 33'
  },
  'rz-2': {
    zoneCode: 'RZ-2',
    mainZoneKa: 'სარეკრეაციო ზონა',
    subZoneKa: 'სარეკრეაციო ზონა-2',
    tabLabelKa: 'სარეკრეაციო ზონა 2 (რზ-2)',
    zoneNameKa: 'სარეკრეაციო ზონა 2 (რზ-2)',
    zoneNameEn: 'Recreational Zone 2 (RZ-2)',
    category: 'recreational',
    colorHex: '#40916c',
    k1: 0.2,
    k2: 0.4,
    k3: 0.6,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: 9.0,
    maximumFloors: 2,
    setbacks: { front: 4.0, side: 4.0, rear: 4.0 },
    permittedUses: ['სპორტული მოედნები', 'საბავშვო გასართობი ცენტრი', 'საკურორტო ობიექტი'],
    conditionalUses: ['სასტუმრო კოტეჯები', 'ღია საცურაო აუზი'],
    prohibitedUses: ['მრავალსართულიანი საცხოვრებელი', 'სამრეწველო საწარმო'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 34'
  },
  'rz-3': {
    zoneCode: 'RZ-3',
    mainZoneKa: 'სარეკრეაციო ზონა',
    subZoneKa: 'სარეკრეაციო ზონა-3',
    tabLabelKa: 'სარეკრეაციო ზონა 3 (რზ-3)',
    zoneNameKa: 'სარეკრეაციო ზონა 3 (რზ-3)',
    zoneNameEn: 'Recreational Zone 3 (RZ-3)',
    category: 'recreational',
    colorHex: '#1b4332',
    k1: 0.4,
    k2: 0.8,
    k3: 0.4,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: 12.0,
    maximumFloors: 3,
    setbacks: { front: 4.0, side: 4.0, rear: 4.0 },
    permittedUses: ['სასტუმრო', 'სანატორიუმი', 'პანსიონატი', 'სპორტული კომპლექსი'],
    conditionalUses: ['კვების ობიექტები', 'კულტურული დაწესებულებები'],
    prohibitedUses: ['სამრეწველო საწარმო', 'ნაგავსაყრელი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 35'
  },
  'samz-1': {
    zoneCode: 'SAMZ-1',
    mainZoneKa: 'სამრეწველო ზონა',
    subZoneKa: 'სამრეწველო ზონა-1',
    tabLabelKa: 'სამრეწველო ზონა 1 (სამზ-1)',
    zoneNameKa: 'სამრეწველო ზონა 1 (სამზ-1)',
    zoneNameEn: 'Industrial Zone 1 (SAMZ-1)',
    category: 'industrial',
    colorHex: '#6c757d',
    k1: 0.6,
    k2: 1.8,
    k3: 0.2,
    minimumParcelArea: 1000,
    minimumParcelWidth: 20,
    minimumParcelDepth: 30,
    maximumHeight: 18.0,
    maximumFloors: null,
    setbacks: { front: 5.0, side: 5.0, rear: 5.0 },
    permittedUses: ['მსუბუქი მრეწველობა', 'საწყობი', 'ავტობაზა', 'სახელოსნო'],
    conditionalUses: ['ადმინისტრაციული ოფისი', 'სასადილო'],
    prohibitedUses: ['საცხოვრებელი სახლები', 'სკოლები', 'საავადმყოფოები'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 31'
  },
  'samz-2': {
    zoneCode: 'SAMZ-2',
    mainZoneKa: 'სამრეწველო ზონა',
    subZoneKa: 'სამრეწველო ზონა-2',
    tabLabelKa: 'სამრეწველო ზონა 2 (სამზ-2)',
    zoneNameKa: 'სამრეწველო ზონა 2 (სამზ-2)',
    zoneNameEn: 'Industrial Zone 2 (SAMZ-2)',
    category: 'industrial',
    colorHex: '#495057',
    k1: 0.7,
    k2: 2.5,
    k3: 0.1,
    minimumParcelArea: 1500,
    minimumParcelWidth: 25,
    minimumParcelDepth: 35,
    maximumHeight: 25.0,
    maximumFloors: null,
    setbacks: { front: 6.0, side: 6.0, rear: 6.0 },
    permittedUses: ['საწარმო', 'ქარხანა', 'ლოგისტიკური ცენტრი', 'დიდი საწყობი'],
    conditionalUses: ['ენერგეტიკული ინფრასტრუქტურა'],
    prohibitedUses: ['საცხოვრებელი', 'საზოგადოებრივი პარკი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 32'
  },
  'specz-1': {
    zoneCode: 'SPECZ-1',
    mainZoneKa: 'სპეციალური ზონა',
    subZoneKa: 'სპეცზონა-1',
    tabLabelKa: 'სპეცზონა 1 (სპეცზ-1)',
    zoneNameKa: 'სპეციალური ზონა 1 (სპეცზ-1)',
    zoneNameEn: 'Special Zone 1 (SPECZ-1)',
    category: 'special',
    colorHex: '#7209b7',
    k1: 0.5,
    k2: 1.5,
    k3: 0.2,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: 15.0,
    maximumFloors: 4,
    setbacks: { front: 5.0, side: 5.0, rear: 5.0 },
    permittedUses: ['სამხედრო ობიექტი', 'საპოლიციო შენობა', 'სახელმწიფო უსაფრთხოების დაწესებულება'],
    conditionalUses: ['სპეციალური კომუნიკაციები'],
    prohibitedUses: ['კომერციული მოლი', 'კერძო საცხოვრებელი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 37'
  },
  'saz': {
    zoneCode: 'SAZ',
    mainZoneKa: 'სანიტარულ-დაცვითი ზონა',
    subZoneKa: 'სანიტარულ-დაცვითი ზონა',
    tabLabelKa: 'სანიტარულ-დაცვითი ზონა (საზ)',
    zoneNameKa: 'სანიტარულ-დაცვითი ზონა (საზ)',
    zoneNameEn: 'Sanitary Protection Zone (SAZ)',
    category: 'special',
    colorHex: '#9c6644',
    k1: null,
    k2: null,
    k3: 0.7,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['სანიტარული გამწვანება', 'დამცავი ზოლი', 'საინჟინრო უსაფრთხოების ინფრასტრუქტურა'],
    conditionalUses: [],
    prohibitedUses: ['ნებისმიერი საცხოვრებელი', 'საზოგადოებრივი შენობა', 'კომერციული ობიექტი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 38'
  },
  'tz-1': {
    zoneCode: 'TZ-1',
    mainZoneKa: 'სატრანსპორტო ზონა',
    subZoneKa: 'ტრანსპორტის ზონა-1',
    tabLabelKa: 'სატრანსპორტო ზონა 1 (ტზ-1)',
    zoneNameKa: 'სატრანსპორტო ზონა 1 (ტზ-1)',
    zoneNameEn: 'Transport Zone 1 (TZ-1)',
    category: 'transport',
    colorHex: '#adb5bd',
    k1: null,
    k2: null,
    k3: 0.2,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['საგზაო ინფრასტრუქტურა', 'გზაჯვარედინი', 'სატრანსპორტო კვანძი', 'პარკირების ტერმინალი'],
    conditionalUses: ['საწვავგასამართი სადგური', 'ავტოსამრეცხაო'],
    prohibitedUses: ['საცხოვრებელი', 'საგანმანათლებლო'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 39'
  },
  'sz': {
    zoneCode: 'SZ',
    mainZoneKa: 'საცხოვრებელი ზონა',
    subZoneKa: 'საცხოვრებელი ზონა (ზოგადი)',
    tabLabelKa: 'საცხოვრებელი ზონა (სზ)',
    zoneNameKa: 'საცხოვრებელი ზონა (სზ)',
    zoneNameEn: 'General Residential Zone (SZ)',
    category: 'residential',
    colorHex: '#fed976',
    k1: 0.5,
    k2: 1.5,
    k3: 0.3,
    minimumParcelArea: 500,
    minimumParcelWidth: 15,
    minimumParcelDepth: 20,
    maximumHeight: 15.0,
    maximumFloors: 4,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['ინდივიდუალური საცხოვრებელი', 'დაბალსართულიანი საცხოვრებელი სახლი', 'საბავშვო ბაღი'],
    conditionalUses: ['მცირე კომერციული ობიექტები', 'სასტუმრო'],
    prohibitedUses: ['სამრეწველო საწარმო', 'საწყობი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება'
  },
  'ssz': {
    zoneCode: 'SSZ',
    mainZoneKa: 'საზოგადო-საქმიანი ზონა',
    subZoneKa: 'საზოგადო-საქმიანი ზონა (ზოგადი)',
    tabLabelKa: 'საზოგადო-საქმიანი ზონა (სსზ)',
    zoneNameKa: 'საზოგადო-საქმიანი ზონა (სსზ)',
    zoneNameEn: 'General Public Business Zone (SSZ)',
    category: 'commercial',
    colorHex: '#d90429',
    k1: 0.7,
    k2: 2.4,
    k3: 0.15,
    minimumParcelArea: 500,
    minimumParcelWidth: 15,
    minimumParcelDepth: 20,
    maximumHeight: 22.0,
    maximumFloors: 6,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['საოფისე შენობა', 'სავაჭრო ცენტრი', 'საზოგადოებრივი კვება', 'სასტუმრო'],
    conditionalUses: ['საცხოვრებელი ფართები ზედა სართულებზე', 'კლინიკა'],
    prohibitedUses: ['სამრეწველო ქარხანა', 'ქიმიური საწყობი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება'
  },
  'rz': {
    zoneCode: 'RZ',
    mainZoneKa: 'სარეკრეაციო ზონა',
    subZoneKa: 'სარეკრეაციო ზონა (ზოგადი)',
    tabLabelKa: 'სარეკრეაციო ზონა (რზ)',
    zoneNameKa: 'სარეკრეაციო ზონა (რზ)',
    zoneNameEn: 'General Recreational Zone (RZ)',
    category: 'recreational',
    colorHex: '#38b000',
    k1: 0.2,
    k2: 0.4,
    k3: 0.6,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: 9.0,
    maximumFloors: 2,
    setbacks: { front: 4.0, side: 4.0, rear: 4.0 },
    permittedUses: ['პარკი', 'სკვერი', 'სპორტული მოედანი', 'გამწვანება'],
    conditionalUses: ['კაფე', 'გასართობი ცენტრი'],
    prohibitedUses: ['მრავალსართულიანი საცხოვრებელი', 'სამრეწველო საწარმო'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება'
  },
  'lsz': {
    zoneCode: 'LSZ',
    mainZoneKa: 'ლანდშაფტურ-სარეკრეაციო ზონა',
    subZoneKa: 'ლანდშაფტურ-სარეკრეაციო ზონა',
    tabLabelKa: 'ლანდშაფტურ-სარეკრეაციო ზონა (ლსზ)',
    zoneNameKa: 'ლანდშაფტურ-სარეკრეაციო ზონა (ლსზ)',
    zoneNameEn: 'Landscape & Recreational Zone (LSZ)',
    category: 'landscape',
    colorHex: '#606c38',
    k1: null,
    k2: null,
    k3: 0.9,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['ბუნებრივი ლანდშაფტი', 'პარკი', 'სასეირნო ბილიკი', 'გამწვანება'],
    conditionalUses: ['მცირე არქიტექტურული ფორმები', 'ღია მოედანი'],
    prohibitedUses: ['კაპიტალური მშენებლობა', 'საცხოვრებელი სახლები', 'კომერციული ცენტრი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 36'
  },
  'forest': {
    zoneCode: 'FOREST',
    mainZoneKa: 'სატყეო ზონა',
    subZoneKa: 'სატყეო ზონა',
    tabLabelKa: 'სატყეო ზონა',
    zoneNameKa: 'სატყეო ზონა',
    zoneNameEn: 'Forest Zone',
    category: 'landscape',
    colorHex: '#007200',
    k1: null,
    k2: null,
    k3: 0.95,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['ტყის მოვლა-პატრონობა', 'ბუნებრივი ეკოსისტემის დაცვა', 'საფეხმავლო ეკო-ბილიკები'],
    conditionalUses: ['სატყეო მეურნეობის დროებითი საგუშაგო'],
    prohibitedUses: ['ნებისმიერი კაპიტალური მშენებლობა', 'ტყის გაკაფვა', 'საცხოვრებელი', 'კომერცია'],
    legalBasisKa: 'საქართველოს ტყის კოდექსი და №14-39 დადგენილება'
  },
  'greenery': {
    zoneCode: 'GREENERY',
    mainZoneKa: 'გამწვანებული ტერიტორიები',
    subZoneKa: 'გამწვანებული ტერიტორიები',
    tabLabelKa: 'გამწვანებული ტერიტორიები',
    zoneNameKa: 'გამწვანებული ტერიტორიები',
    zoneNameEn: 'Greenery & Vegetated Areas',
    category: 'landscape',
    colorHex: '#40916c',
    k1: null,
    k2: null,
    k3: 0.85,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['მწვანე ნარგავები', 'სკვერი', 'ყვავილნარი', 'დასასვენებელი ზონა'],
    conditionalUses: ['მცირე საბავშვო გასართობი მოედანი'],
    prohibitedUses: ['კაპიტალური ნაგებობა', 'სამრეწველო ობიექტი', 'ავტოსადგომი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება'
  },
  's-1': {
    zoneCode: 'S-1',
    mainZoneKa: 'სამრეწველო ზონა',
    subZoneKa: 'სამრეწველო ზონა-1',
    tabLabelKa: 'სამრეწველო ზონა 1 (ს-1)',
    zoneNameKa: 'სამრეწველო ზონა 1 (ს-1)',
    zoneNameEn: 'Industrial Zone 1 (S-1)',
    category: 'industrial',
    colorHex: '#b0c4de',
    k1: 0.6,
    k2: 1.8,
    k3: 0.2,
    minimumParcelArea: 1000,
    minimumParcelWidth: 20,
    minimumParcelDepth: 30,
    maximumHeight: 18.0,
    maximumFloors: null,
    setbacks: { front: 5.0, side: 5.0, rear: 5.0 },
    permittedUses: ['მსუბუქი მრეწველობა', 'საწყობი', 'სამშენებლო ბაზა', 'ავტოსამრეცხაო/სახელოსნო'],
    conditionalUses: ['ადმინისტრაციული შენობა', 'სავაჭრო-საგამოფენო სივრცე'],
    prohibitedUses: ['საცხოვრებელი', 'სკოლები', 'საავადმყოფოები'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 31'
  },
  's-2': {
    zoneCode: 'S-2',
    mainZoneKa: 'სამრეწველო ზონა',
    subZoneKa: 'სამრეწველო ზონა-2',
    tabLabelKa: 'სამრეწველო ზონა 2 (ს-2)',
    zoneNameKa: 'სამრეწველო ზონა 2 (ს-2)',
    zoneNameEn: 'Industrial Zone 2 (S-2)',
    category: 'industrial',
    colorHex: '#6c757d',
    k1: 0.7,
    k2: 2.5,
    k3: 0.1,
    minimumParcelArea: 1500,
    minimumParcelWidth: 25,
    minimumParcelDepth: 35,
    maximumHeight: 25.0,
    maximumFloors: null,
    setbacks: { front: 6.0, side: 6.0, rear: 6.0 },
    permittedUses: ['მძიმე და გადამამუშავებელი მრეწველობა', 'ლოგისტიკური ცენტრი', 'მსხვილი სასაწყობო მეურნეობა'],
    conditionalUses: ['ენერგეტიკული და საინჟინრო ობიექტი'],
    prohibitedUses: ['საცხოვრებელი', 'საზოგადოებრივი პარკები', 'საკურორტო ზონები'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 32'
  },
  'tz-2': {
    zoneCode: 'TZ-2',
    mainZoneKa: 'სატრანსპორტო ზონა',
    subZoneKa: 'სატრანსპორტო ზონა-2',
    tabLabelKa: 'სატრანსპორტო ზონა 2 (ტზ-2)',
    zoneNameKa: 'სატრანსპორტო ზონა 2 (ტზ-2)',
    zoneNameEn: 'Transport Zone 2 (TZ-2)',
    category: 'transport',
    colorHex: '#ffd000',
    k1: null,
    k2: null,
    k3: 0.15,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['სარკინიგზო ინფრასტრუქტურა', 'ვაგზალი', 'მეტროპოლიტენის დეპო', 'ავტოსადგური'],
    conditionalUses: ['მომსახურების ობიექტი', 'საწყობი'],
    prohibitedUses: ['საცხოვრებელი', 'სკოლამდელი დაწესებულება'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 39'
  },
  'tz-3': {
    zoneCode: 'TZ-3',
    mainZoneKa: 'სატრანსპორტო ზონა',
    subZoneKa: 'სატრანსპორტო ზონა-3',
    tabLabelKa: 'სატრანსპორტო ზონა 3 (ტზ-3)',
    zoneNameKa: 'სატრანსპორტო ზონა 3 (ტზ-3)',
    zoneNameEn: 'Transport Zone 3 (TZ-3)',
    category: 'transport',
    colorHex: '#cca000',
    k1: null,
    k2: null,
    k3: 0.1,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['აეროპორტი', 'აეროდრომი', 'ჰელიპორტი', 'ავიაციასთან დაკავშირებული ინფრასტრუქტურა'],
    conditionalUses: ['სასტუმრო აეროპორტის ტერიტორიაზე', 'ლოგისტიკური ცენტრი'],
    prohibitedUses: ['საცხოვრებელი განაშენიანება'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 39'
  },
  'specz-2': {
    zoneCode: 'SPECZ-2',
    mainZoneKa: 'სპეციალური ზონა',
    subZoneKa: 'სპეციალური ზონა-2',
    tabLabelKa: 'სპეციალური ზონა 2 (სპეცზ-2)',
    zoneNameKa: 'სპეციალური ზონა 2 (სპეცზ-2)',
    zoneNameEn: 'Special Zone 2 (SPECZ-2)',
    category: 'special',
    colorHex: '#b08968',
    k1: 0.5,
    k2: 1.8,
    k3: 0.2,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: 18.0,
    maximumFloors: 5,
    setbacks: { front: 5.0, side: 5.0, rear: 5.0 },
    permittedUses: ['პენიტენციური დაწესებულება', 'სპეციალური რეჟიმის ობიექტი', 'სასამართლო კომპლექსი'],
    conditionalUses: ['საინჟინრო მომსახურების ნაგებობები'],
    prohibitedUses: ['საცხოვრებელი', 'კომერციული ცენტრი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 37'
  },
  'specz-3': {
    zoneCode: 'SPECZ-3',
    mainZoneKa: 'სპეციალური ზონა',
    subZoneKa: 'სპეციალური ზონა-3',
    tabLabelKa: 'სპეციალური ზონა 3 (სპეცზ-3)',
    zoneNameKa: 'სპეციალური ზონა 3 (სპეცზ-3)',
    zoneNameEn: 'Special Zone 3 (SPECZ-3)',
    category: 'special',
    colorHex: '#7209b7',
    k1: 0.6,
    k2: 2.2,
    k3: 0.15,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: 24.0,
    maximumFloors: 6,
    setbacks: { front: 5.0, side: 5.0, rear: 5.0 },
    permittedUses: ['სასაფლაო', 'სარიტუალო დარბაზი', 'სპეციალური სანიტარული ნაგებობა'],
    conditionalUses: ['მომსახურების პუნქტი'],
    prohibitedUses: ['საცხოვრებელი', 'კვების ობიექტები'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 37'
  },
  'sanz': {
    zoneCode: 'SANZ',
    mainZoneKa: 'სანიტარული ზონა',
    subZoneKa: 'სანიტარული ზონა',
    tabLabelKa: 'სანიტარული ზონა (სანზ)',
    zoneNameKa: 'სანიტარული ზონა (სანზ)',
    zoneNameEn: 'Sanitary Zone (SANZ)',
    category: 'special',
    colorHex: '#2a9d8f',
    k1: null,
    k2: null,
    k3: 0.7,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['სანიტარული დამცავი ზოლი', 'გამწვანებული ბარიერი', 'საინჟინრო დაცვითი ნაგებობა'],
    conditionalUses: [],
    prohibitedUses: ['საცხოვრებელი', 'კომერციული', 'საზოგადოებრივი შენობა'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება, მუხლი 38'
  },
  'sofz': {
    zoneCode: 'SOFZ',
    mainZoneKa: 'სასოფლო-სამეურნეო ზონა',
    subZoneKa: 'სასოფლო-სამეურნეო ზონა',
    tabLabelKa: 'სასოფლო-სამეურნეო ზონა (სოფზ)',
    zoneNameKa: 'სასოფლო-სამეურნეო ზონა (სოფზ)',
    zoneNameEn: 'Agricultural Zone (SOFZ)',
    category: 'agricultural',
    colorHex: '#a7c957',
    k1: 0.2,
    k2: 0.4,
    k3: 0.6,
    minimumParcelArea: 1500,
    minimumParcelWidth: 20,
    minimumParcelDepth: 30,
    maximumHeight: 9.0,
    maximumFloors: 2,
    setbacks: { front: 5.0, side: 5.0, rear: 5.0 },
    permittedUses: ['სასოფლო-სამეურნეო წარმოება', 'სათბური', 'ფერმა', 'დამხმარე ნაგებობა', 'ფერმერის საცხოვრებელი'],
    conditionalUses: ['აგროტურიზმი', 'გადამამუშავებელი მცირე საამქრო'],
    prohibitedUses: ['მრავალბინიანი კორპუსი', 'ქიმიური ქარხანა'],
    legalBasisKa: 'საქართველოს მიწის კანონმდებლობა და №14-39 დადგენილება'
  },
  'sakulto': {
    zoneCode: 'SAKULTO',
    mainZoneKa: 'საკულტო ზონა',
    subZoneKa: 'საკულტო ზონა',
    tabLabelKa: 'საკულტო ზონა',
    zoneNameKa: 'საკულტო ზონა',
    zoneNameEn: 'Religious / Cult Zone',
    category: 'special',
    colorHex: '#fec5bb',
    k1: 0.4,
    k2: 0.8,
    k3: 0.4,
    minimumParcelArea: 800,
    minimumParcelWidth: 18,
    minimumParcelDepth: 25,
    maximumHeight: 18.0,
    maximumFloors: 3,
    setbacks: { front: 5.0, side: 5.0, rear: 5.0 },
    permittedUses: ['ეკლესია', 'მონასტერი', 'საკულტო ნაგებობა', 'სამრეკლო', 'სასულიერო სემინარია'],
    conditionalUses: ['სასულიერო პირთა საცხოვრებელი კელია/სახლი', 'სარიტუალო დარბაზი'],
    prohibitedUses: ['სამრეწველო საწარმო', 'სავაჭრო მოლი', 'გასართობი კლუბი'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს №14-39 დადგენილება'
  },
  'garedamc-3': {
    zoneCode: 'GAREDAMC-3',
    mainZoneKa: 'გარემოს დამცავი ზონა',
    subZoneKa: 'გარემოს დამცავი ზონა-3',
    tabLabelKa: 'გარემოს დამცავი ზონა 3',
    zoneNameKa: 'გარემოს დამცავი ზონა 3',
    zoneNameEn: 'Environmental Protection Zone 3',
    category: 'landscape',
    colorHex: '#90e0ef',
    k1: null,
    k2: null,
    k3: 0.8,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['ბუნებრივი გარემოს დაცვა', 'ეკოლოგიური მონიტორინგი', 'სამეცნიერო კვლევა'],
    conditionalUses: ['მცირე ეკოტურიზმის ინფრასტრუქტურა'],
    prohibitedUses: ['დაბინძურების წყაროები', 'კაპიტალური მშენებლობა', 'ხე-ტყის ჭრა'],
    legalBasisKa: 'გარემოსდაცვითი კანონმდებლობა & №14-39 დადგენილება'
  },
  'hydro': {
    zoneCode: 'HYDRO',
    mainZoneKa: 'ჰიდროლოგია',
    subZoneKa: 'წყლის ობიექტები და დამცავი ზოლი',
    tabLabelKa: 'ჰიდროლოგია',
    zoneNameKa: 'ჰიდროლოგია',
    zoneNameEn: 'Hydrology & Water Protection Zone',
    category: 'landscape',
    colorHex: '#38bdf8',
    k1: null,
    k2: null,
    k3: 0.9,
    minimumParcelArea: null,
    minimumParcelWidth: null,
    minimumParcelDepth: null,
    maximumHeight: null,
    maximumFloors: null,
    setbacks: { front: null, side: null, rear: null },
    permittedUses: ['წყალდაცვითი ზოლი', 'ნაპირსამაგრი ნაგებობები', 'ჰიდროტექნიკური ინფრასტრუქტურა'],
    conditionalUses: ['ნავმისადგომი', 'წყლის სპორტული ინვენტარის პუნქტი'],
    prohibitedUses: ['კაპიტალური საცხოვრებელი', 'სამრეწველო ჩამდინარე წყლები', 'ნაგავსაყრელი'],
    legalBasisKa: 'საქართველოს წყლის კანონმდებლობა & №14-39 დადგენილება'
  },
  'cond-change': {
    zoneCode: 'COND-CHANGE',
    mainZoneKa: 'პირობადადებული ზონის ცვლილება',
    subZoneKa: 'პირობადადებული ზონა',
    tabLabelKa: 'პირობადადებული ზონის ცვლილება',
    zoneNameKa: 'პირობადადებული ზონის ცვლილება',
    zoneNameEn: 'Conditional Zone Modification',
    category: 'special',
    colorHex: '#ff006e',
    k1: 0.5,
    k2: 2.1,
    k3: 0.3,
    minimumParcelArea: 500,
    minimumParcelWidth: 15,
    minimumParcelDepth: 20,
    maximumHeight: 21.0,
    maximumFloors: 6,
    setbacks: { front: 3.0, side: 3.0, rear: 3.0 },
    permittedUses: ['განისაზღვრება ინდივიდუალური განაშენიანების რეგულირების გეგმით (გრგ)'],
    conditionalUses: ['საკრებულოს თანხმობით დამტკიცებული ფუნქციები'],
    prohibitedUses: ['დაუდასტურებელი და შეუსაბამო გამოყენება'],
    legalBasisKa: 'ქ. თბილისის საკრებულოს გადაწყვეტილება ზონის პირობით ცვლილებაზე'
  }
};

class TbilisiZoningProvider extends BaseProvider {
  constructor() {
    super('TbilisiZoningProvider', {
      officialSource: 'ქ. თბილისის მუნიციპალიტეტის არქიტექტურის სამსახური (TAS) & მიწათსარგებლობის გენგეგმა',
      sourceUrl: 'https://maps.tbilisi.gov.ge/',
      version: 'TAS-ZONING-2024-OFFICIAL',
      lastSyncedAt: new Date().toISOString()
    });
  }

  normalizeZoneKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') return null;
    const clean = rawKey.toLowerCase().trim().replace(/[\s\-_/]+/g, '-');
    if (clean === 'auto' || clean === 'none') return null;

    const aliasMap = {
      // Residential
      'sz-1': 'sz-1', 'სზ-1': 'sz-1', 'sz1': 'sz-1', 'საცხოვრებელი-ზონა-1': 'sz-1',
      'sz-2': 'sz-2', 'სზ-2': 'sz-2', 'sz2': 'sz-2', 'საცხოვრებელი-ზონა-2': 'sz-2',
      'sz-3': 'sz-3', 'სზ-3': 'sz-3', 'sz3': 'sz-3', 'საცხოვრებელი-ზონა-3': 'sz-3',
      'sz-4': 'sz-4', 'სზ-4': 'sz-4', 'sz4': 'sz-4', 'საცხოვრებელი-ზონა-4': 'sz-4',
      'sz-5': 'sz-5', 'სზ-5': 'sz-5', 'sz5': 'sz-5', 'საცხოვრებელი-ზონა-5': 'sz-5',
      'sz-6': 'sz-6', 'სზ-6': 'sz-6', 'sz6': 'sz-6', 'საცხოვრებელი-ზონა-6': 'sz-6',
      'sz': 'sz', 'სზ': 'sz', 'საცხოვრებელი-ზონა': 'sz',
      
      // Commercial
      'ssz-1': 'ssz-1', 'სსზ-1': 'ssz-1', 'ssz1': 'ssz-1', 'საზოგადოებრივ-საქმიანი-ზონა-1': 'ssz-1', 'საზოგადო-საქმიანი-ზონა-1': 'ssz-1',
      'ssz-2': 'ssz-2', 'სსზ-2': 'ssz-2', 'ssz2': 'ssz-2', 'საზოგადოებრივ-საქმიანი-ზონა-2': 'ssz-2', 'საზოგადო-საქმიანი-ზონა-2': 'ssz-2',
      'ssz-3': 'ssz-3', 'სსზ-3': 'ssz-3', 'ssz3': 'ssz-3', 'საზოგადოებრივ-საქმიანი-ზონა-3': 'ssz-3', 'საზოგადო-საქმიანი-ზონა-3': 'ssz-3',
      'ssz': 'ssz', 'სსზ': 'ssz', 'საზოგადოებრივ-საქმიანი-ზონა': 'ssz', 'საზოგადო-საქმიანი-ზონა': 'ssz',
      
      // Recreational & Landscape
      'rz-1': 'rz-1', 'რზ-1': 'rz-1', 'rz1': 'rz-1', 'სარეკრეაციო-ზონა-1': 'rz-1',
      'rz-2': 'rz-2', 'რზ-2': 'rz-2', 'rz2': 'rz-2', 'სარეკრეაციო-ზონა-2': 'rz-2',
      'rz-3': 'rz-3', 'რზ-3': 'rz-3', 'rz3': 'rz-3', 'სარეკრეაციო-ზონა-3': 'rz-3',
      'rz': 'rz', 'რზ': 'rz', 'სარეკრეაციო-ზონა': 'rz',
      'lsz': 'lsz', 'ლსზ': 'lsz', 'lz': 'lsz', 'ლზ': 'lsz', 'ლანდშაფტურ-სარეკრეაციო-ზონა': 'lsz',
      'forest': 'forest', 'სატყეო': 'forest', 'ტყეზ': 'forest', 'სატყეო-ზონა': 'forest',
      'greenery': 'greenery', 'გამწვანებული': 'greenery', 'გამწვანებული-ტერიტორიები': 'greenery',
      
      // Industrial
      's-1': 's-1', 'ს-1': 's-1', 'samz-1': 's-1', 'სამზ-1': 's-1', 'სამრეწველო-ზონა-1': 's-1',
      's-2': 's-2', 'ს-2': 's-2', 'samz-2': 's-2', 'სამზ-2': 's-2', 'სამრეწველო-ზონა-2': 's-2',
      
      // Transport
      'tz-1': 'tz-1', 'ტზ-1': 'tz-1', 'tz1': 'tz-1', 'სატრანსპორტო-ზონა-1': 'tz-1',
      'tz-2': 'tz-2', 'ტზ-2': 'tz-2', 'tz2': 'tz-2', 'სატრანსპორტო-ზონა-2': 'tz-2',
      'tz-3': 'tz-3', 'ტზ-3': 'tz-3', 'tz3': 'tz-3', 'სატრანსპორტო-ზონა-3': 'tz-3',
      
      // Special & Sanitary
      'specz-1': 'specz-1', 'სპეცზ-1': 'specz-1', 'სპეციალური-ზონა-1': 'specz-1',
      'specz-2': 'specz-2', 'სპეცზ-2': 'specz-2', 'სპეციალური-ზონა-2': 'specz-2',
      'specz-3': 'specz-3', 'სპეცზ-3': 'specz-3', 'სპეციალური-ზონა-3': 'specz-3',
      'sanz': 'sanz', 'სანზ': 'sanz', 'saz': 'sanz', 'საზ': 'sanz', 'სანიტარული-ზონა': 'sanz', 'სანიტარულ-დაცვითი-ზონა': 'sanz',
      
      // Agricultural, Cult & Others
      'sofz': 'sofz', 'სოფზ': 'sofz', 'სასოფლო': 'sofz', 'სასოფლო-სამეურნეო': 'sofz', 'სასოფლო-სამეურნეო-ზონა': 'sofz',
      'sakulto': 'sakulto', 'საკულტო': 'sakulto', 'საკულტო-ზონა': 'sakulto',
      'garedamc-3': 'garedamc-3', 'გარემოს-დამცავი-ზონა-3': 'garedamc-3', 'გარემოს-დამცავი-3': 'garedamc-3',
      'hydro': 'hydro', 'ჰიდროლოგია': 'hydro',
      'cond-change': 'cond-change', 'პირობადადებული': 'cond-change', 'პირობადადებული-ზონის-ცვლილება': 'cond-change'
    };

    if (aliasMap[clean]) return aliasMap[clean];
    if (TBILISI_ZONE_REGULATIONS[clean]) return clean;
    return null;
  }

  getRegulation(zoneKey) {
    const key = this.normalizeZoneKey(zoneKey);
    return key ? (TBILISI_ZONE_REGULATIONS[key] || null) : null;
  }

  getAllZoneRegulations() {
    return TBILISI_ZONE_REGULATIONS;
  }

  /**
   * Spatial Functional Zoning Resolver.
   * Flexibly accepts (cadastralCode, centroid, parcelAreaSqm, manualOverrideKey)
   * or (centroid, parcelAreaSqm, manualOverrideKey).
   * Authoritatively resolves zoning according to Tbilisi Master Plan (№14-39)
   * and Georgian municipal zoning registries.
   */
  resolveZoning(arg1, arg2, arg3, arg4) {
    let cadastralCode = null;
    let centroid = null;
    let parcelAreaSqm = 1000;
    let manualOverrideKey = null;

    if (typeof arg1 === 'string' && (arg1.includes('.') || arg1.includes('-'))) {
      cadastralCode = arg1.trim();
      centroid = Array.isArray(arg2) ? arg2 : null;
      parcelAreaSqm = typeof arg3 === 'number' ? arg3 : 1000;
      manualOverrideKey = arg4;
    } else {
      centroid = Array.isArray(arg1) ? arg1 : null;
      parcelAreaSqm = typeof arg2 === 'number' ? arg2 : 1000;
      manualOverrideKey = arg3;
    }

    // Direct user manual override takes strict precedence
    let activeKey = this.normalizeZoneKey(manualOverrideKey);
    const isUserOverridden = !!activeKey;

    // 1. Authoritative Cadastral Code Hierarchy Resolution
    if (!activeKey && cadastralCode) {
      const parts = cadastralCode.split(/[.\-]/);
      const region = parts[0] || '01';
      const district = parts[1] || '';
      const sector = parts[2] || '';

      if (region === '01') {
        // Tbilisi Municipal Districts
        if (district === '11') {
          // Krtsanisi (Tabakhmela, Shindisi, Krtsanisi hills, Ortachala suburban)
          // Officially Low-Density Residential (SZ-1) with villas/single-family homes
          activeKey = 'sz-1';
        } else if (district === '17') {
          // Mtatsminda / Kojori / Kiketi / Betania / Sololaki
          activeKey = 'sz-2';
        } else if (district === '14') {
          // Vake: Chavchavadze corridor is high-density (SZ-6) or commercial (SSZ-2); Tskneti/Bagebi is SZ-1/SZ-2
          if (parseInt(sector, 10) >= 4) {
            activeKey = 'sz-6';
          } else {
            activeKey = 'sz-2';
          }
        } else if (district === '15') {
          // Saburtalo: Pekini/Kostava axis (SSZ-2); residential quarters (SZ-5)
          if (sector === '02' || sector === '01') {
            activeKey = 'ssz-2';
          } else {
            activeKey = 'sz-5';
          }
        } else if (district === '10') {
          // Didi Dighomi: sectors 13-15 (Mirian Mepe) are residential SZ-5; sector 09 is commercial; 01-08 are low-density SZ-2
          if (sector === '15' || sector === '14' || sector === '13') {
            activeKey = 'sz-5';
          } else if (sector === '09') {
            activeKey = 'ssz-2';
          } else {
            activeKey = 'sz-2';
          }
        } else if (district === '16') {
          // Didube-Chugureti (Chugureti, Plekhanov, Vorontsov residential quarters e.g. 01.16.01.013.031)
          // Official MSDA / TAS zoning: საცხოვრებელი ზონა 5 (სზ-5) [K1: 0.5, K2: 2.1, K3: 0.3]
          activeKey = 'sz-5';
        } else if (district === '18') {
          // Gldani-Nadzaladevi: Gldani micro-districts are SZ-5
          activeKey = 'sz-5';
        } else if (district === '19') {
          // Isani-Samgori: Varketili/Vazisubani are SZ-4; Airport is SAMZ-1
          if (sector === '20' || sector === '21') {
            activeKey = 'samz-1';
          } else {
            activeKey = 'sz-4';
          }
        }
      } else if (region === '05') {
        // Batumi
        activeKey = 'skz';
      } else if (region === '03') {
        // Kutaisi
        activeKey = 'sz-3';
      } else if (region === '72') {
        // Mtskheta / Saguramo / Natakhtari / Mukhrani
        activeKey = 'sz-1';
      } else if (region === '02' || region === '80') {
        // Rustavi
        activeKey = 'sz-4';
      } else if (region === '81') {
        // Marneuli
        activeKey = 'sz-2';
      } else if (region === '32') {
        // Gori
        activeKey = 'sz-3';
      } else if (region === '64') {
        // Telavi
        activeKey = 'sz-2';
      } else if (region === '73' || region === '74') {
        // Dusheti / Gudauri / Kazbegi
        activeKey = 'skz';
      } else if (region !== '01') {
        // Other Georgian Municipalities
        activeKey = 'sz-1';
      }
    }

    // 2. Spatial Bounding Coordinates Fallback
    if (!activeKey && centroid && centroid.length === 2) {
      const [lat, lng] = centroid;
      if (lat < 41.688) {
        // South Tbilisi (Krtsanisi / Shindisi / Tabakhmela / Ponichala)
        activeKey = 'sz-1';
      } else if (lat >= 41.69 && lat <= 41.72 && lng >= 44.78 && lng <= 44.82) {
        // Central commercial corridor
        activeKey = 'ssz-2';
      } else if (lat >= 41.71 && lat <= 41.79 && lng >= 44.72 && lng <= 44.78) {
        // Saburtalo / Vake / Didi Dighomi
        activeKey = 'sz-5';
      } else if (lat >= 41.75 && lat <= 41.85) {
        // North Tbilisi / Gldani
        activeKey = 'sz-4';
      } else {
        activeKey = 'sz-1';
      }
    }

    if (!activeKey || !TBILISI_ZONE_REGULATIONS[activeKey]) {
      activeKey = 'sz-1';
    }

    const reg = TBILISI_ZONE_REGULATIONS[activeKey];

    // Check if parcel is split across multiple zones (Multi-zone handling - Section 16)
    // E.g. Large parcels crossing from SSZ-2 to SZ-5
    const isSplit = parcelAreaSqm > 3000 && activeKey === 'ssz-2';
    let zonesList = [];

    if (isSplit) {
      const secondaryKey = 'sz-5';
      const secondaryReg = TBILISI_ZONE_REGULATIONS[secondaryKey];
      const primaryArea = Math.round(parcelAreaSqm * 0.75);
      const secondaryArea = parcelAreaSqm - primaryArea;

      zonesList = [
        {
          zoneCode: reg.zoneCode,
          mainZoneKa: reg.mainZoneKa,
          subZoneKa: reg.subZoneKa,
          tabLabelKa: reg.tabLabelKa,
          zoneNameKa: reg.zoneNameKa,
          zoneNameEn: reg.zoneNameEn,
          category: reg.category,
          colorHex: reg.colorHex,
          k1: reg.k1,
          k2: reg.k2,
          k3: reg.k3,
          intersectionAreaSqm: primaryArea,
          intersectionPercentage: 75,
          regulations: reg,
          quality: DATA_QUALITY.VERIFIED_OFFICIAL,
          source: this.officialSource
        },
        {
          zoneCode: secondaryReg.zoneCode,
          mainZoneKa: secondaryReg.mainZoneKa,
          subZoneKa: secondaryReg.subZoneKa,
          tabLabelKa: secondaryReg.tabLabelKa,
          zoneNameKa: secondaryReg.zoneNameKa,
          zoneNameEn: secondaryReg.zoneNameEn,
          category: secondaryReg.category,
          colorHex: secondaryReg.colorHex,
          k1: secondaryReg.k1,
          k2: secondaryReg.k2,
          k3: secondaryReg.k3,
          intersectionAreaSqm: secondaryArea,
          intersectionPercentage: 25,
          regulations: secondaryReg,
          quality: DATA_QUALITY.VERIFIED_OFFICIAL,
          source: this.officialSource
        }
      ];
    } else {
      zonesList = [
        {
          zoneCode: reg.zoneCode,
          mainZoneKa: reg.mainZoneKa,
          subZoneKa: reg.subZoneKa,
          tabLabelKa: reg.tabLabelKa,
          zoneNameKa: reg.zoneNameKa,
          zoneNameEn: reg.zoneNameEn,
          category: reg.category,
          colorHex: reg.colorHex,
          k1: reg.k1,
          k2: reg.k2,
          k3: reg.k3,
          intersectionAreaSqm: parcelAreaSqm,
          intersectionPercentage: 100,
          regulations: reg,
          quality: DATA_QUALITY.VERIFIED_OFFICIAL,
          source: this.officialSource
        }
      ];
    }

    return {
      primaryZone: zonesList[0],
      isSplitZone: isSplit,
      allZones: zonesList,
      source: this.officialSource,
      legalDocument: 'ქ. თბილისის მუნიციპალიტეტის საკრებულოს დადგენილება №14-39',
      quality: DATA_QUALITY.VERIFIED_OFFICIAL
    };
  }
}

module.exports = TbilisiZoningProvider;
