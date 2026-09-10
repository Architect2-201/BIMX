/**
 * lib/land-intelligence/construction-possibility-engine.js
 * -----------------------------------------------------------------------
 * Multi-Tier Construction Possibility Engine.
 * Cross-references the intended project type with official functional zoning permissions,
 * dimensional compliance, environmental overlays, and statutory restrictions.
 *
 * Emits standardized color status:
 * - GREEN: Fully compliant with primary permitted uses
 * - YELLOW: Permitted conditionally or subject to standard administrative verifications
 * - ORANGE: Significant restrictions or requires Special Approval / DDP (გდგ)
 * - RED: Development strictly prohibited or non-compliant
 * - GRAY: Official data insufficient for definitive conclusion
 */

const { COMPLIANCE_COLOR, CONSTRUCTION_STATUS, PERMISSION_TYPE } = require('./types');

class ConstructionPossibilityEngine {
  evaluatePossibility(projectIntention, zoneInfo, complianceChecks, restrictions, heritageInfo, environmentalInfo) {
    const primaryZone = zoneInfo ? zoneInfo.primaryZone : null;
    const reg = primaryZone ? primaryZone.regulations : null;

    if (!reg) {
      return {
        colorStatus: COMPLIANCE_COLOR.GRAY,
        constructionStatus: CONSTRUCTION_STATUS.OFFICIAL_DATA_INSUFFICIENT,
        statusLabelKa: 'მონაცემი არასაკმარისია',
        statusLabelEn: 'Insufficient Official Data',
        summaryKa: 'ზონის ოფიციალური რეგულაციები ამ კოორდინატისთვის სრულად დადასტურებული არ არის.',
        projectSuitabilityKa: 'შეფასება ვერ ხერხდება',
        conditions: ['საჭიროა ზონირების დამატებითი გადამოწმება მუნიციპალიტეტის არქიტექტურის სამსახურში'],
        risks: ['დაუდასტურებელი ფუნქციური ზონა'],
        requiredApprovals: []
      };
    }

    const permitted = reg.permittedUses || [];
    const conditional = reg.conditionalUses || [];
    const prohibited = reg.prohibitedUses || [];

    const projectType = (projectIntention && projectIntention.type) || 'residential_single';
    const projectLabelKa = (projectIntention && projectIntention.labelKa) || 'ინდივიდუალური საცხოვრებელი სახლი';

    // 1. Check dimensional non-compliance
    const hasDimensionalViolation = (complianceChecks || []).some(c => c.status === 'NON_COMPLIANT');

    // 2. Check heritage restrictions
    const isHeritageRestricted = heritageInfo && heritageInfo.isRestricted;

    // 3. Check environmental / protected area restrictions
    const isProtectedArea = environmentalInfo && environmentalInfo.protectedArea && environmentalInfo.protectedArea.intersects;

    // 4. Match project type with zone use permissions
    let matchedPermission = PERMISSION_TYPE.CONDITIONALLY_ALLOWED; // default baseline

    if (reg.category === 'landscape' || reg.category === 'special') {
      matchedPermission = PERMISSION_TYPE.PROHIBITED;
    } else if (projectType === 'residential_single') {
      if (permitted.some(u => u.includes('ინდივიდუალური') || u.includes('საცხოვრებელი'))) {
        matchedPermission = PERMISSION_TYPE.PRIMARY_ALLOWED;
      }
    } else if (projectType === 'residential_multi') {
      if (prohibited.some(u => u.includes('მრავალბინიანი'))) {
        matchedPermission = PERMISSION_TYPE.PROHIBITED;
      } else if (permitted.some(u => u.includes('მრავალბინიანი'))) {
        matchedPermission = PERMISSION_TYPE.PRIMARY_ALLOWED;
      } else if (conditional.some(u => u.includes('მრავალბინიანი') || u.includes('საცხოვრებელი'))) {
        matchedPermission = PERMISSION_TYPE.CONDITIONALLY_ALLOWED;
      }
    } else if (projectType === 'commercial' || projectType === 'office') {
      if (reg.category === 'commercial') {
        matchedPermission = PERMISSION_TYPE.PRIMARY_ALLOWED;
      } else if (conditional.some(u => u.includes('კომერციული') || u.includes('საოფისე') || u.includes('სავაჭრო'))) {
        matchedPermission = PERMISSION_TYPE.CONDITIONALLY_ALLOWED;
      } else if (permitted.some(u => u.includes('კომერციული') || u.includes('საოფისე'))) {
        matchedPermission = PERMISSION_TYPE.PRIMARY_ALLOWED;
      }
    } else if (projectType === 'hotel') {
      if (permitted.some(u => u.includes('სასტუმრო'))) {
        matchedPermission = PERMISSION_TYPE.PRIMARY_ALLOWED;
      } else if (conditional.some(u => u.includes('სასტუმრო'))) {
        matchedPermission = PERMISSION_TYPE.CONDITIONALLY_ALLOWED;
      }
    } else if (projectType === 'industrial') {
      if (reg.category !== 'industrial') {
        matchedPermission = PERMISSION_TYPE.PROHIBITED;
      } else {
        matchedPermission = PERMISSION_TYPE.PRIMARY_ALLOWED;
      }
    }

    // Determine Final Color and Construction Status
    let colorStatus = COMPLIANCE_COLOR.GREEN;
    let constructionStatus = CONSTRUCTION_STATUS.LIKELY_ALLOWED;
    let statusLabelKa = 'მშენებლობა დასაშვებია';
    const conditions = [];
    const risks = [];
    const requiredApprovals = ['სამშენებლოდ გამოყენების პირობები (აპზ / GAP)', 'არქიტექტურული პროექტის შეთანხმება'];

    if (matchedPermission === PERMISSION_TYPE.PROHIBITED) {
      colorStatus = COMPLIANCE_COLOR.RED;
      constructionStatus = CONSTRUCTION_STATUS.LIKELY_NOT_ALLOWED;
      statusLabelKa = 'დაგეგმილი მშენებლობა დაუშვებელია ამ ზონაში';
      risks.push(`დაგეგმილი ფუნქცია (${projectLabelKa}) არ შეესაბამება ${reg.zoneNameKa}-ის დასაშვებ პარამეტრებს.`);
    } else if (isProtectedArea) {
      colorStatus = COMPLIANCE_COLOR.RED;
      constructionStatus = CONSTRUCTION_STATUS.RESTRICTED;
      statusLabelKa = 'მკაცრად შეზღუდულია (დაცული ტერიტორია)';
      risks.push('ნაკვეთი ემიჯნება ან ხვდება დაცული ტერიტორიის გავლენის არეალში.');
      requiredApprovals.push('გარემოსდაცვითი ზედამხედველობის ორგანოს დასკვნა');
    } else if (isHeritageRestricted) {
      colorStatus = COMPLIANCE_COLOR.ORANGE;
      constructionStatus = CONSTRUCTION_STATUS.REQUIRES_SPECIAL_APPROVAL;
      statusLabelKa = 'საჭიროებს სპეციალურ შეთანხმებას (კულტურული მემკვიდრეობა)';
      conditions.push('პროექტი უნდა შეესაბამებოდეს ისტორიული განაშენიანების არქიტექტურულ რეგლამენტს.');
      risks.push('კულტურული მემკვიდრეობის საბჭოს მიერ პარამეტრების ან ფასადის გადაკეთების მოთხოვნის მაღალი ალბათობა.');
      requiredApprovals.push('კულტურული მემკვიდრეობის დაცვის საბჭოს სავალდებულო თანხმობა');
    } else if (hasDimensionalViolation) {
      colorStatus = COMPLIANCE_COLOR.ORANGE;
      constructionStatus = CONSTRUCTION_STATUS.REQUIRES_SPECIAL_APPROVAL;
      statusLabelKa = 'არ აკმაყოფილებს მინიმალურ ზომებს';
      conditions.push('საჭიროა მუნიციპალიტეტის სპეციალური ზონალური შეთანხმება ან ნაკვეთის ფორმირების კორექტირება.');
      risks.push('ნაკვეთის ფართობი ან სიგანე ნაკლებია ზონის სტანდარტულ მინიმუმზე.');
    } else if (matchedPermission === PERMISSION_TYPE.CONDITIONALLY_ALLOWED) {
      colorStatus = COMPLIANCE_COLOR.YELLOW;
      constructionStatus = CONSTRUCTION_STATUS.ALLOWED_WITH_CONDITIONS;
      statusLabelKa = 'მშენებლობა პირობითად დასაშვებია';
      conditions.push(`ფუნქცია (${projectLabelKa}) ზონაში დასაშვებია პირობითად — მოითხოვს მუნიციპალიტეტის დამატებით თანხმობას ან სპეციალურ კვლევას.`);
      risks.push('დამატებითი ადმინისტრაციული პროცედურები.');
    }

    if (reg.maximumHeight == null) {
      conditions.push('მაქსიმალური სიმაღლე მოითხოვს დეტალური განაშენიანების გეგმის (გდგ) მომზადებას.');
      requiredApprovals.push('განაშენიანების დეტალური გეგმის (გდგ) დამტკიცება');
    }

    return {
      colorStatus,
      constructionStatus,
      statusLabelKa,
      projectType,
      projectLabelKa,
      matchedPermission,
      conditions,
      risks,
      requiredApprovals,
      legalBasisKa: reg.legalBasisKa
    };
  }
}

module.exports = ConstructionPossibilityEngine;
