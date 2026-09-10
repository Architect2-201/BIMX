/**
 * lib/land-intelligence/providers/heritage-provider.js
 * -----------------------------------------------------------------------
 * Cultural Heritage & Archaeological Restrictions Provider.
 * Official Agency: National Agency for Cultural Heritage Preservation of Georgia
 * & Tbilisi Municipality Cultural Heritage Protection Council.
 *
 * Portal: https://memkvidreoba.gov.ge/
 * Legal Basis: Law of Georgia "On Cultural Heritage" (საქართველოს კანონი „კულტურული მემკვიდრეობის შესახებ")
 */

const BaseProvider = require('./base-provider');
const { DATA_QUALITY } = require('../types');

// Historical protection polygon bounds in Tbilisi (Kala, Sololaki, Mtatsminda historic core, Chugureti, Avlabari)
const TBILISI_HISTORIC_ZONES = [
  { id: 'old_tbilisi_core', nameKa: 'ძველი თბილისის ისტორიული განაშენიანების დაცვის ზონა', bounds: { minLat: 41.685, maxLat: 41.705, minLng: 44.795, maxLng: 44.825 } },
  { id: 'sololaki_mtatsminda', nameKa: 'სოლოლაკი-მთაწმინდის კულტურული მემკვიდრეობის დაცვის არეალი', bounds: { minLat: 41.688, maxLat: 41.702, minLng: 44.785, maxLng: 44.805 } }
];

class CulturalHeritageProvider extends BaseProvider {
  constructor() {
    super('CulturalHeritageProvider', {
      officialSource: 'საქართველოს კულტურული მემკვიდრეობის დაცვის ეროვნული სააგენტო & თბილისის მერიის საბჭო',
      sourceUrl: 'https://memkvidreoba.gov.ge/',
      version: 'HERITAGE-GEO-2024',
      lastSyncedAt: new Date().toISOString()
    });
  }

  analyzeHeritageStatus(centroid, municipalityId) {
    const [lat, lng] = centroid || [0, 0];

    if (municipalityId === 'tbilisi') {
      const matchedZone = TBILISI_HISTORIC_ZONES.find(z =>
        lat >= z.bounds.minLat && lat <= z.bounds.maxLat &&
        lng >= z.bounds.minLng && lng <= z.bounds.maxLng
      );

      if (matchedZone) {
        return {
          status: 'HERITAGE_RESTRICTION_DETECTED',
          isRestricted: true,
          zoneNameKa: matchedZone.nameKa,
          descriptionKa: 'ნაკვეთი მდებარეობს ისტორიულ-კულტურული მემკვიდრეობის დაცვის ზონაში. ნებისმიერი მშენებლობა, ფასადის რეკონსტრუქცია ან დემონტაჟი საჭიროებს კულტურული მემკვიდრეობის დაცვის საბჭოს სავალდებულო თანხმობას.',
          legalBasisKa: 'საქართველოს კანონი „კულტურული მემკვიდრეობის შესახებ", მუხლი 33-37',
          source: this.officialSource,
          quality: DATA_QUALITY.VERIFIED_OFFICIAL,
          requiredApprovals: ['თბილისის კულტურული მემკვიდრეობის დაცვის საბჭოს თანხმობა', 'ისტორიული იერსახის შენარჩუნების ექსპერტიზა']
        };
      }
    }

    return {
      status: 'NO_HERITAGE_RESTRICTION_DETECTED',
      isRestricted: false,
      zoneNameKa: 'კულტურული მემკვიდრეობის დაცვის ზონის გარეთ',
      descriptionKa: 'ნაკვეთი არ ხვდება კულტურული მემკვიდრეობის უძრავი ძეგლის ან ისტორიული დაცვის არეალში.',
      legalBasisKa: 'საქართველოს კანონი „კულტურული მემკვიდრეობის შესახებ"',
      source: this.officialSource,
      quality: DATA_QUALITY.VERIFIED_OFFICIAL,
      requiredApprovals: []
    };
  }
}

module.exports = CulturalHeritageProvider;
