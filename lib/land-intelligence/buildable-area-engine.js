/**
 * lib/land-intelligence/buildable-area-engine.js
 * -----------------------------------------------------------------------
 * Buildable Area Calculation Engine.
 * Calculates:
 * PARCEL AREA minus GEOMETRICALLY VERIFIED RESTRICTIONS = POTENTIAL BUILDABLE AREA
 *
 * Strict Rule (Section 47):
 * Only subtracts area if the restriction has verified spatial geometry
 * and is legally deductible. Never deducts ungrounded textual restrictions.
 */

const { DATA_QUALITY } = require('./types');

class BuildableAreaEngine {
  calculateBuildableArea(parcelAreaSqm, restrictionsList, k1MaxFootprintSqm = null) {
    const totalArea = Number(parcelAreaSqm) || 0;
    let totalDeductionsSqm = 0;
    const deductibleItems = [];
    const nonDeductibleItems = [];

    for (const r of (restrictionsList || [])) {
      if (r.intersects && r.isGeometricallyDeductible && r.affectedAreaSqm > 0) {
        totalDeductionsSqm += r.affectedAreaSqm;
        deductibleItems.push({
          type: r.type,
          nameKa: r.nameKa,
          deductedAreaSqm: r.affectedAreaSqm,
          legalBasisKa: r.legalBasisKa
        });
      } else if (r.intersects) {
        nonDeductibleItems.push({
          type: r.type,
          nameKa: r.nameKa,
          reasonKa: 'შეზღუდვას არ აქვს მკაცრად ფიქსირებული გეომეტრიული ფართობის გამოკლების სამართლებრივი რეჟიმი.'
        });
      }
    }

    const netParcelAreaSqm = Math.max(totalArea - totalDeductionsSqm, 0);
    // Potential building footprint is limited by both net parcel area and K1 intensity
    const theoreticalFootprint = k1MaxFootprintSqm != null
      ? Math.min(k1MaxFootprintSqm, netParcelAreaSqm)
      : netParcelAreaSqm;

    return {
      parcelTotalAreaSqm: totalArea,
      totalDeductedRestrictionsAreaSqm: totalDeductionsSqm,
      netUsableParcelAreaSqm: netParcelAreaSqm,
      potentialBuildableFootprintSqm: theoreticalFootprint,
      deductibleItems,
      nonDeductibleItems,
      quality: DATA_QUALITY.CALCULATED_FROM_OFFICIAL_DATA,
      formulaDescriptionKa: totalDeductionsSqm > 0
        ? `საერთო ფართობი (${totalArea} მ²) - გეომეტრიული შეზღუდვები (${totalDeductionsSqm} მ²) = წმინდა სასარგებლო ფართობი (${netParcelAreaSqm} მ²)`
        : 'გეომეტრიული შეზღუდვებით ფართობის პირდაპირი გამოკლება არ განხორციელებულა.'
    };
  }
}

module.exports = BuildableAreaEngine;
