/**
 * lib/land-intelligence/rules-engine.js
 * -----------------------------------------------------------------------
 * Statutory Compliance & Building Parameters Rules Engine.
 * Evaluates parcel metrics against official urban regulations without guessing.
 *
 * Implements exact formulas:
 * - MAX_BUILDING_FOOTPRINT = PARCEL_AREA × K1
 * - MAX_ALLOWED_GROSS_AREA = PARCEL_AREA × K2
 * - MIN_REQUIRED_GREEN_AREA = PARCEL_AREA × K3
 *
 * Handles NOT_DEFINED status explicitly when regulations do not establish a coefficient.
 */

const { DATA_QUALITY } = require('./types');

class RulesEngine {
  evaluateStatutoryParameters(parcelAreaSqm, dimensions, zoneRegulation, manualCoefficients = null) {
    const area = Number(parcelAreaSqm) || 0;

    // 1. K1 - Building Footprint Intensity Coefficient
    let k1Val = manualCoefficients && manualCoefficients.k1 != null
      ? manualCoefficients.k1
      : (zoneRegulation ? zoneRegulation.k1 : null);

    let k1Result = {
      value: k1Val,
      status: k1Val != null ? 'DEFINED' : 'NOT_DEFINED',
      maxFootprintSqm: k1Val != null ? Number((area * k1Val).toFixed(1)) : null,
      formula: k1Val != null ? `ფართობი (${area} მ²) × K1 (${k1Val}) = ${(area * k1Val).toFixed(1)} მ²` : 'დაუდგენელია რეგულაციით',
      quality: manualCoefficients && manualCoefficients.k1 != null
        ? DATA_QUALITY.RULE_BASED
        : (k1Val != null ? DATA_QUALITY.RULE_BASED : DATA_QUALITY.OFFICIAL_DATA_NOT_AVAILABLE),
      rationaleKa: k1Val != null
        ? 'განაშენიანების მაქსიმალური დასაშვები ფართობი ნაკვეთის დონეზე.'
        : 'ამ ფუნქციური ზონისთვის K-1 კოეფიციენტი მოქმედი რეგლამენტით არ არის განსაზღვრული (მშენებლობა ან დაუშვებელია, ან მოითხოვს გდგ-ს).'
    };

    // 2. K2 - Total Gross Floor Area Intensity Coefficient
    let k2Val = manualCoefficients && manualCoefficients.k2 != null
      ? manualCoefficients.k2
      : (zoneRegulation ? zoneRegulation.k2 : null);

    let k2Result = {
      value: k2Val,
      status: k2Val != null ? 'DEFINED' : 'NOT_DEFINED',
      maxGrossFloorAreaSqm: k2Val != null ? Number((area * k2Val).toFixed(1)) : null,
      formula: k2Val != null ? `ფართობი (${area} მ²) × K2 (${k2Val}) = ${(area * k2Val).toFixed(1)} მ²` : 'დაუდგენელია რეგულაციით',
      quality: manualCoefficients && manualCoefficients.k2 != null
        ? DATA_QUALITY.RULE_BASED
        : (k2Val != null ? DATA_QUALITY.RULE_BASED : DATA_QUALITY.OFFICIAL_DATA_NOT_AVAILABLE),
      rationaleKa: k2Val != null
        ? 'მიწისზედა სართულების ჯამური საერთო ფართობის ზღვრული ოდენობა.'
        : 'K-2 კოეფიციენტი არ არის დადგენილი ამ ზონისთვის.'
    };

    // 3. K3 - Greenery Coefficient
    let k3Val = manualCoefficients && manualCoefficients.k3 != null
      ? manualCoefficients.k3
      : (zoneRegulation ? zoneRegulation.k3 : null);

    let k3Result = {
      value: k3Val,
      status: k3Val != null ? 'DEFINED' : 'NOT_DEFINED',
      minGreenAreaSqm: k3Val != null ? Number((area * k3Val).toFixed(1)) : null,
      formula: k3Val != null ? `ფართობი (${area} მ²) × K3 (${k3Val}) = ${(area * k3Val).toFixed(1)} მ²` : 'დაუდგენელია რეგულაციით',
      quality: manualCoefficients && manualCoefficients.k3 != null
        ? DATA_QUALITY.RULE_BASED
        : (k3Val != null ? DATA_QUALITY.RULE_BASED : DATA_QUALITY.OFFICIAL_DATA_NOT_AVAILABLE),
      rationaleKa: k3Val != null
        ? 'ნაკვეთზე სავალდებულო მინიმალური გამწვანებული ტერიტორიის ფართობი.'
        : 'გამწვანების კოეფიციენტი დამოკიდებულია სპეციფიკურ საპროექტო დავალებაზე.'
    };

    // 4. Minimum Dimensional Requirements (Section 21)
    const complianceChecks = [];

    // 4a. Minimum Parcel Area
    const minArea = zoneRegulation ? zoneRegulation.minimumParcelArea : null;
    let areaStatus = 'NOT_APPLICABLE';
    if (minArea != null) {
      areaStatus = area >= minArea ? 'COMPLIANT' : 'NON_COMPLIANT';
    }
    complianceChecks.push({
      requirement: 'minimum_parcel_area',
      titleKa: 'მინიმალური მიწის ფართობი',
      requiredValue: minArea != null ? `${minArea} მ²` : 'დაუწესებელია',
      actualValue: `${area} მ²`,
      status: areaStatus,
      descriptionKa: areaStatus === 'COMPLIANT'
        ? `ნაკვეთის ფართობი (${area} მ²) აკმაყოფილებს ზონის მინიმალურ მოთხოვნას (${minArea} მ²).`
        : (areaStatus === 'NON_COMPLIANT'
          ? `ნაკვეთის ფართობი (${area} მ²) ნაკლებია ზონის სტანდარტულ მინიმუმზე (${minArea} მ²). საჭიროებს სპეციალურ გამონაკლისს ან მომიჯნავე ნაკვეთთან გაერთიანებას.`
          : 'ზონას მინიმალური ფართობის ზღვარი არ აქვს დაწესებული.'),
      legalBasisKa: '№14-39 დადგენილება, მუხლი 15 („სამშენებლო ნაკვეთის მინიმალური ფართობი")'
    });

    // 4b. Minimum Parcel Width (Frontage)
    const actualWidth = dimensions ? dimensions.minWidthM : null;
    const minWidth = zoneRegulation ? zoneRegulation.minimumParcelWidth : null;
    let widthStatus = 'NOT_APPLICABLE';
    if (minWidth != null && actualWidth != null) {
      widthStatus = actualWidth >= minWidth ? 'COMPLIANT' : 'NON_COMPLIANT';
    }
    complianceChecks.push({
      requirement: 'minimum_parcel_width',
      titleKa: 'მინიმალური სიგანე (ფრონტი)',
      requiredValue: minWidth != null ? `${minWidth} მ` : 'დაუწესებელია',
      actualValue: actualWidth != null ? `${actualWidth} მ` : 'დაუზუსტებელია',
      status: widthStatus,
      descriptionKa: widthStatus === 'COMPLIANT'
        ? `ნაკვეთის სიგანე (${actualWidth} მ) შეესაბამება ნორმატიულ მინიმუმს (${minWidth} მ).`
        : (widthStatus === 'NON_COMPLIANT'
          ? `ნაკვეთის მინიმალური სიგანე (${actualWidth} მ) ნაკლებია მოთხოვნილ ${minWidth} მ-ზე.`
          : 'მინიმალური სიგანის მოთხოვნა არ ვრცელდება.'),
      legalBasisKa: '№14-39 დადგენილება, მუხლი 16'
    });

    // 4c. Minimum Parcel Depth
    const actualDepth = dimensions ? dimensions.avgDepthM : null;
    const minDepth = zoneRegulation ? zoneRegulation.minimumParcelDepth : null;
    let depthStatus = 'NOT_APPLICABLE';
    if (minDepth != null && actualDepth != null) {
      depthStatus = actualDepth >= minDepth ? 'COMPLIANT' : 'NON_COMPLIANT';
    }
    complianceChecks.push({
      requirement: 'minimum_parcel_depth',
      titleKa: 'მინიმალური სიღრმე',
      requiredValue: minDepth != null ? `${minDepth} მ` : 'დაუწესებელია',
      actualValue: actualDepth != null ? `${actualDepth} მ` : 'დაუზუსტებელია',
      status: depthStatus,
      descriptionKa: depthStatus === 'COMPLIANT'
        ? `ნაკვეთის სიღრმე (${actualDepth} მ) შეესაბამება მოთხოვნას (${minDepth} მ).`
        : (depthStatus === 'NON_COMPLIANT'
          ? `ნაკვეთის სიღრმე (${actualDepth} მ) ნაკლებია ნორმატიულ ${minDepth} მ-ზე.`
          : 'სიღრმის ზღვარი დაუწესებელია.'),
      legalBasisKa: '№14-39 დადგენილება, მუხლი 16'
    });

    // 5. Setbacks & Height Regulations
    const setbacks = (zoneRegulation && zoneRegulation.setbacks) || { front: 3.0, side: 3.0, rear: 3.0 };
    const maxHeightM = zoneRegulation ? zoneRegulation.maximumHeight : null;
    const maxFloors = zoneRegulation ? zoneRegulation.maximumFloors : null;

    return {
      coefficients: {
        k1: k1Result,
        k2: k2Result,
        k3: k3Result
      },
      complianceChecks,
      heightAndFloors: {
        maxHeightM,
        maxFloors,
        status: maxHeightM != null ? 'DEFINED' : 'REQUIRES_OFFICIAL_VERIFICATION',
        descriptionKa: maxHeightM != null
          ? `მაქსიმალური სიმაღლე: ${maxHeightM} მ${maxFloors != null ? ` (${maxFloors} სართული)` : ''}.`
          : 'მაქსიმალური სიმაღლე განისაზღვრება კონკრეტული ქუჩის განივი კვეთით ან დეტალური გეგმით (გდგ).'
      },
      setbacks: {
        frontM: setbacks.front,
        sideM: setbacks.side,
        rearM: setbacks.rear,
        descriptionKa: `ფასადის მხრიდან უკან დახევა: ${setbacks.front || 3} მ; გვერდითი: ${setbacks.side || 3} მ; უკანა: ${setbacks.rear || 3} მ.`
      }
    };
  }
}

module.exports = RulesEngine;
