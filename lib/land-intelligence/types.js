/**
 * lib/land-intelligence/types.js
 * -----------------------------------------------------------------------
 * Domain models, data quality classifications, and statutory definitions
 * for the LAND INTELLIGENCE ENGINE GEORGIA.
 */

// Data Quality Classification (Section 44)
const DATA_QUALITY = {
  VERIFIED_OFFICIAL: 'VERIFIED_OFFICIAL',
  CALCULATED_FROM_OFFICIAL_DATA: 'CALCULATED_FROM_OFFICIAL_DATA',
  RULE_BASED: 'RULE_BASED',
  REQUIRES_OFFICIAL_VERIFICATION: 'REQUIRES_OFFICIAL_VERIFICATION',
  OFFICIAL_DATA_NOT_AVAILABLE: 'OFFICIAL_DATA_NOT_AVAILABLE',
  DATA_SOURCE_TEMPORARILY_UNAVAILABLE: 'DATA_SOURCE_TEMPORARILY_UNAVAILABLE',
  AI_INTERPRETATION: 'AI_INTERPRETATION',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
};

// Overall Compliance Color Status (Section 50)
const COMPLIANCE_COLOR = {
  GREEN: 'GREEN',   // Requirements met under standard regulations
  YELLOW: 'YELLOW', // Allowed with conditions / subject to specific verification
  ORANGE: 'ORANGE', // Significant restrictions / requires special approvals or DDP (გდგ)
  RED: 'RED',       // Development heavily restricted or prohibited
  GRAY: 'GRAY'      // Insufficient official data for definitive conclusion
};

// Construction Possibility Status (Section 23)
const CONSTRUCTION_STATUS = {
  LIKELY_ALLOWED: 'LIKELY_ALLOWED',
  ALLOWED_WITH_CONDITIONS: 'ALLOWED_WITH_CONDITIONS',
  REQUIRES_SPECIAL_APPROVAL: 'REQUIRES_SPECIAL_APPROVAL',
  REQUIRES_DETAILED_PLAN: 'REQUIRES_DETAILED_PLAN',
  RESTRICTED: 'RESTRICTED',
  LIKELY_NOT_ALLOWED: 'LIKELY_NOT_ALLOWED',
  OFFICIAL_DATA_INSUFFICIENT: 'OFFICIAL_DATA_INSUFFICIENT'
};

// Use Permission Classifications (Section 24)
const PERMISSION_TYPE = {
  PRIMARY_ALLOWED: 'PRIMARY_ALLOWED',
  CONDITIONALLY_ALLOWED: 'CONDITIONALLY_ALLOWED',
  SPECIAL_APPROVAL_REQUIRED: 'SPECIAL_APPROVAL_REQUIRED',
  RESTRICTED: 'RESTRICTED',
  PROHIBITED: 'PROHIBITED'
};

// Supported Project Intention Options
const PROJECT_TYPES = [
  { id: 'residential_single', labelKa: 'ინდივიდუალური საცხოვრებელი სახლი', labelEn: 'Single-Family Residential' },
  { id: 'residential_multi', labelKa: 'მრავალბინიანი საცხოვრებელი სახლი', labelEn: 'Multi-Family Residential' },
  { id: 'commercial', labelKa: 'კომერციული შენობა', labelEn: 'Commercial Building' },
  { id: 'office', labelKa: 'საოფისე შენობა', labelEn: 'Office Building' },
  { id: 'hotel', labelKa: 'სასტუმრო', labelEn: 'Hotel' },
  { id: 'apartments', labelKa: 'აპარტამენტები', labelEn: 'Apartment Hotel' },
  { id: 'public', labelKa: 'საზოგადოებრივი შენობა', labelEn: 'Public Building' },
  { id: 'educational', labelKa: 'საგანმანათლებლო ობიექტი', labelEn: 'Educational Facility' },
  { id: 'medical', labelKa: 'სამედიცინო ობიექტი', labelEn: 'Medical Facility' },
  { id: 'sports', labelKa: 'სპორტული ობიექტი', labelEn: 'Sports Facility' },
  { id: 'industrial', labelKa: 'სამრეწველო ობიექტი', labelEn: 'Industrial Facility' },
  { id: 'mixed_use', labelKa: 'მრავალფუნქციური შენობა', labelEn: 'Mixed-Use Building' },
  { id: 'reconstruction', labelKa: 'რეკონსტრუქცია', labelEn: 'Reconstruction' },
  { id: 'extension', labelKa: 'გაფართოება', labelEn: 'Building Extension' },
  { id: 'new_construction', labelKa: 'ახალი მშენებლობა', labelEn: 'New Construction' },
  { id: 'other', labelKa: 'სხვა', labelEn: 'Other' }
];

module.exports = {
  DATA_QUALITY,
  COMPLIANCE_COLOR,
  CONSTRUCTION_STATUS,
  PERMISSION_TYPE,
  PROJECT_TYPES
};
