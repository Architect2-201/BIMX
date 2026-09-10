/**
 * lib/land-intelligence/providers/base-provider.js
 * -----------------------------------------------------------------------
 * Base class for all external and official spatial data providers.
 * Enforces metadata tracking, source transparency, provenance, and data quality.
 */

const { DATA_QUALITY } = require('../types');

class BaseProvider {
  constructor(name, options = {}) {
    this.name = name;
    this.officialSource = options.officialSource || 'Official Government Portal';
    this.sourceUrl = options.sourceUrl || '';
    this.version = options.version || '1.0';
    this.isAvailable = true;
    this.lastCheckedAt = new Date().toISOString();
    this.lastSyncedAt = options.lastSyncedAt || new Date().toISOString();
  }

  getMetadata() {
    return {
      providerName: this.name,
      officialSource: this.officialSource,
      sourceUrl: this.sourceUrl,
      version: this.version,
      isAvailable: this.isAvailable,
      lastCheckedAt: this.lastCheckedAt,
      lastSyncedAt: this.lastSyncedAt
    };
  }

  wrapResult(value, quality = DATA_QUALITY.VERIFIED_OFFICIAL, notes = '') {
    return {
      value,
      quality,
      source: this.officialSource,
      sourceUrl: this.sourceUrl,
      version: this.version,
      lastVerifiedAt: this.lastSyncedAt,
      notes
    };
  }
}

module.exports = BaseProvider;
