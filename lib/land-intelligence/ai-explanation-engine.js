/**
 * lib/land-intelligence/ai-explanation-engine.js
 * -----------------------------------------------------------------------
 * AI Explanation & Executive Risk Radar.
 * Strictly adheres to Axiom 1 (Official Data First, Rules Second, AI Third):
 * - Explains only verified official facts and rule-engine calculations.
 * - Discloses legal risks and administrative hurdles plainly and responsibly.
 * - Never uses unconditional guarantees ("100% გარანტირებული", "ნებართვა აუცილებლად გაიცემა").
 */

const { DATA_QUALITY } = require('./types');

class AIExplanationEngine {
  generateExecutiveSummary(analysisPayload) {
    const {
      parcel,
      municipality,
      functionalZones,
      coefficients,
      constructionPossibility,
      buildableArea,
      restrictions,
      heritage,
      environmental
    } = analysisPayload;

    const primaryZone = functionalZones && functionalZones.primaryZone;
    const zoneName = primaryZone ? primaryZone.zoneNameKa : 'უცნობი ზონა';
    const area = parcel.areaSqm || 0;
    const projectLabel = constructionPossibility.projectLabelKa;
    const color = constructionPossibility.colorStatus;

    // 1. Executive Summary Paragraph
    let summaryTextKa = '';
    if (color === 'GREEN') {
      summaryTextKa = `ოფიციალური სივრცითი მონაცემებისა და მოქმედი რეგულაციების (№14-39 დადგენილება) საფუძველზე, ნაკვეთი (${area} მ²) მდებარეობს „${zoneName}"-ში. დაგეგმილი განვითარება (${projectLabel}) მიეკუთვნება ძირითად დაშვებულ ფუნქციას და ნაკვეთი აკმაყოფილებს ძირითად ნორმატიულ პარამეტრებს.`;
    } else if (color === 'YELLOW') {
      summaryTextKa = `ნაკვეთი (${area} მ²) მდებარეობს „${zoneName}"-ში. დაგეგმილი ობიექტი (${projectLabel}) პრინციპულად შესაძლებელია, თუმცა მოქმედი რეგლამენტით კვალიფიცირდება როგორც პირობითად დაშვებული, რაც მოითხოვს მუნიციპალიტეტის სპეციალურ შეთანხმებას.`;
    } else if (color === 'ORANGE') {
      summaryTextKa = `ნაკვეთზე იკვეთება მნიშვნელოვანი ქალაქთმშენებლობითი ან სამართლებრივი შეზღუდვები. პროექტის განხორციელება მოითხოვს სპეციალურ საექსპერტო პროცედურას, დეტალურ გეგმას (გდგ) ან შესაბამისი უწყების (მაგ. კულტურული მემკვიდრეობის საბჭოს) სავალდებულო თანხმობას.`;
    } else if (color === 'RED') {
      summaryTextKa = `მოქმედი სამართლებრივი ნორმებით, დაგეგმილი მშენებლობა (${projectLabel}) ამ ფუნქციურ ზონაში („${zoneName}") ან დაცულ არეალში მიჩნეულია შეუსაბამოდ და პირდაპირი წესით ნებართვის გაცემა შეზღუდულია.`;
    } else {
      summaryTextKa = `ანალიზისთვის ხელმისაწვდომი ოფიციალური მონაცემები არასაკმარისია საბოლოო გადაწყვეტილების მისაღებად.`;
    }

    const tas = analysisPayload.tasProjects;
    if (tas && tas.hasApprovedProjects) {
      const rem = tas.remaining;
      const app = tas.approved;
      summaryTextKa += ` ნაკვეთზე შეთანხმებულია არქიტექტურული პროექტი (${app.totalGrossAreaSqm} მ²). დარჩენილია ${rem.grossAreaSqm.toLocaleString()} მ² თავისუფალი სამშენებლო ფართობი და ${rem.footprintSqm} მ² განაშენიანების ფეხი.`;
    } else if (tas) {
      summaryTextKa += ` ნაკვეთზე დამტკიცებული პროექტი არ ფიქსირდება — სამშენებლო კოეფიციენტები 100%-ით თავისუფალია.`;
    }

    // 2. What you can build (რა შეგიძლიათ ააშენოთ)
    let whatYouCanBuildKa = primaryZone && primaryZone.regulations
      ? `ზონაში დასაშვებია: ${primaryZone.regulations.permittedUses.join(', ')}.`
      : 'დაშვებული ფუნქციები განისაზღვრება ინდივიდუალური საპროექტო დავალებით.';

    if (tas && tas.hasApprovedProjects) {
      whatYouCanBuildKa += ` არსებული შეთანხმების მიღმა დარჩენილია ${tas.remaining.grossAreaSqm.toLocaleString()} მ² სამშენებლო პოტენციალი.`;
    }

    // 3. What restrictions apply (რა შეზღუდვები გაქვთ)
    const keyRestrictionsKa = [];
    if (tas && tas.hasApprovedProjects) {
      keyRestrictionsKa.push(`ათვისებული შეთანხმებული ფართობი (K2): ${tas.approved.totalGrossAreaSqm} მ² (${tas.approved.grossAreaUtilizationPercent}%)`);
      keyRestrictionsKa.push(`დარჩენილი თავისუფალი პოტენციალი: ${tas.remaining.grossAreaSqm} მ² (${tas.remaining.remainingGrossAreaPercent}%)`);
    }
    if (coefficients.k1 && coefficients.k1.maxFootprintSqm) {
      keyRestrictionsKa.push(`მაქსიმალური განაშენიანების ფართობი (K1): ${coefficients.k1.maxFootprintSqm} მ²`);
    }
    if (coefficients.k2 && coefficients.k2.maxGrossFloorAreaSqm) {
      keyRestrictionsKa.push(`მაქსიმალური საერთო სამშენებლო ფართობი (K2): ${coefficients.k2.maxGrossFloorAreaSqm} მ²`);
    }
    if (coefficients.k3 && coefficients.k3.minGreenAreaSqm) {
      keyRestrictionsKa.push(`სავალდებულო მინიმალური გამწვანება (K3): ${coefficients.k3.minGreenAreaSqm} მ²`);
    }
    if (buildableArea && buildableArea.totalDeductedRestrictionsAreaSqm > 0) {
      keyRestrictionsKa.push(`გეომეტრიული შეზღუდვების (წითელი ხაზები) გამო გამოკლებულია ${buildableArea.totalDeductedRestrictionsAreaSqm} მ²`);
    }
    if (heritage && heritage.isRestricted) {
      keyRestrictionsKa.push('კულტურული მემკვიდრეობის დაცვის მკაცრი რეჟიმი');
    }

    // 4. What you need to verify (რა უნდა გადაამოწმოთ)
    const whatToVerifyKa = [
      'საჯარო რეესტრის მიმდინარე ამონაწერი (იპოთეკა, ყადაღა, კერძო სერვიტუტები)',
      'თბილისის არქიტექტურის სამსახურის (TAS.GE) ელექტრონული საქმის დოკუმენტაცია',
      'მიწისქვეშა საინჟინრო კომუნიკაციების ზუსტი ტოპოგრაფიული გეგმა',
      'გეოლოგიური მდგრადობის საექსპერტო დასკვნა'
    ];

    // 5. Approvals you may need (რა თანხმობა შეიძლება დაგჭირდეთ)
    const neededApprovalsKa = [...(constructionPossibility.requiredApprovals || [])];

    // 6. Key Project Risk (რა არის მთავარი რისკი)
    let keyRiskKa = 'სამშენებლო ნებართვის მიღების ვადების გაჭიანურება დამატებითი კვლევების მოთხოვნის შემთხვევაში.';
    if (heritage && heritage.isRestricted) {
      keyRiskKa = 'კულტურული მემკვიდრეობის საბჭოს მიერ პარამეტრების შეზღუდვა ან უარყოფითი დასკვნა.';
    } else if (color === 'RED') {
      keyRiskKa = 'პროექტის განხორციელების იურიდიული შეუძლებლობა ზონის ცვლილების გარეშე.';
    }

    // 7. Recommended First Step (რა უნდა გააკეთოთ პირველ რიგში)
    let firstActionKa = '1. შეუკვეთეთ საინჟინრო-ტოპოგრაფიული აზომვითი ნახაზი (M 1:500).\n2. მიმართეთ თბილისის არქიტექტურის სამსახურს (TAS.GE) მიწის ნაკვეთის სამშენებლოდ გამოყენების პირობების (აპზ/GAP) მისაღებად.';

    const disclaimerKa = 'წინამდებარე ანალიზი წარმოადგენს წინასწარ საინფორმაციო და ქალაქთმშენებლობით შეფასებას საჯარო მონაცემების ბაზაზე და არ ცვლის მუნიციპალიტეტის უფლებამოსილი ორგანოს მიერ გაცემულ ოფიციალურ საპროექტო დავალებას (აპზ) ან სამშენებლო ნებართვას. საბოლოო გადაწყვეტილებამდე სავალდებულოა სერტიფიცირებულ არქიტექტორთან და იურისტთან კონსულტაცია.';

    return {
      executiveSummaryKa: summaryTextKa,
      whatYouCanBuildKa,
      keyRestrictionsKa,
      whatToVerifyKa,
      neededApprovalsKa,
      keyRiskKa,
      firstActionKa,
      disclaimerKa,
      quality: DATA_QUALITY.AI_INTERPRETATION,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = AIExplanationEngine;
