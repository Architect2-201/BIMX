-- ============================================================================
-- LAND INTELLIGENCE ENGINE GEORGIA
-- Enterprise PostgreSQL + PostGIS Spatial Schema
-- Compliant with Georgian Urban Planning & Geospatial Legislation:
-- - Decree No. 59 (2014) of the Government of Georgia
-- - Resolution No. 14-39 (2016) of Tbilisi City Municipality
-- - Resolution No. 41 (2019) on Technical Regulations for Buildings
-- ============================================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Municipalities & Administrative Boundaries
CREATE TABLE IF NOT EXISTS municipalities (
    id VARCHAR(50) PRIMARY KEY,
    name_ka VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    region VARCHAR(100),
    official_source VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS municipality_boundaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipality_id VARCHAR(50) REFERENCES municipalities(id) ON DELETE CASCADE,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    source VARCHAR(255) NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_municipality_boundaries_geom ON municipality_boundaries USING GIST(geom);

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipality_id VARCHAR(50) REFERENCES municipalities(id),
    name_ka VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    type VARCHAR(50), -- city, town, village
    geom GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_settlements_geom ON settlements USING GIST(geom);

-- 2. Official Urban Master Plans (გენგეგმები)
CREATE TABLE IF NOT EXISTS urban_plans (
    id VARCHAR(100) PRIMARY KEY,
    municipality_id VARCHAR(50) REFERENCES municipalities(id),
    name_ka VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    approval_act VARCHAR(255) NOT NULL,
    approval_date DATE NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    official_source VARCHAR(255),
    matsne_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS urban_plan_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id VARCHAR(100) REFERENCES urban_plans(id),
    version_number VARCHAR(50) NOT NULL,
    amendment_act VARCHAR(255),
    amendment_date DATE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    geom GEOMETRY(MultiPolygon, 4326),
    notes TEXT
);

-- 3. Functional Zones & Geometry
CREATE TABLE IF NOT EXISTS functional_zones (
    id VARCHAR(100) PRIMARY KEY,
    municipality_id VARCHAR(50) REFERENCES municipalities(id),
    plan_id VARCHAR(100) REFERENCES urban_plans(id),
    zone_code VARCHAR(50) NOT NULL, -- e.g. SZ-1, SZ-2, SSZ-1, SSZ-2, LZ, etc.
    zone_name_ka VARCHAR(255) NOT NULL,
    zone_name_en VARCHAR(255),
    category VARCHAR(100) NOT NULL, -- residential, commercial, industrial, recreational, landscape, special
    color_hex VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zone_geometries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id VARCHAR(100) REFERENCES functional_zones(id) ON DELETE CASCADE,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    source VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_zone_geometries_geom ON zone_geometries USING GIST(geom);

-- 4. Zone Regulations & Statutory Parameters
CREATE TABLE IF NOT EXISTS zone_regulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipality_id VARCHAR(50) REFERENCES municipalities(id),
    plan_id VARCHAR(100) REFERENCES urban_plans(id),
    plan_version VARCHAR(50),
    zone_code VARCHAR(50) NOT NULL,
    construction_type VARCHAR(100), -- new_construction, reconstruction, extension
    building_use VARCHAR(100),       -- residential, multi_family, commercial, office, hotel, etc.
    k1 NUMERIC(5,2),                 -- Building footprint intensity coefficient
    k2 NUMERIC(5,2),                 -- Total gross floor area intensity coefficient
    k3 NUMERIC(5,2),                 -- Greenery coefficient
    minimum_parcel_area NUMERIC(10,2), -- in sqm
    minimum_parcel_width NUMERIC(6,2), -- in meters
    minimum_parcel_depth NUMERIC(6,2), -- in meters
    maximum_height NUMERIC(6,2),     -- in meters
    maximum_floors INTEGER,
    front_setback NUMERIC(6,2),      -- in meters
    side_setback NUMERIC(6,2),       -- in meters
    rear_setback NUMERIC(6,2),       -- in meters
    legal_source_id VARCHAR(100),
    effective_from DATE NOT NULL,
    effective_to DATE,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    source_url VARCHAR(500)
);

-- 5. Legal Rules & Corpus (Decree 59, 14-39, 41)
CREATE TABLE IF NOT EXISTS legal_documents (
    id VARCHAR(100) PRIMARY KEY,
    document_title_ka VARCHAR(500) NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    promulgation_date DATE,
    effective_date DATE NOT NULL,
    matsne_url VARCHAR(500) NOT NULL,
    current_version VARCHAR(50),
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legal_rules (
    id VARCHAR(100) PRIMARY KEY,
    document_id VARCHAR(100) REFERENCES legal_documents(id),
    article VARCHAR(50) NOT NULL,
    paragraph VARCHAR(50),
    subparagraph VARCHAR(50),
    rule_type VARCHAR(100) NOT NULL, -- coefficient, setback, minimum_dimensions, use_permission, environmental
    rule_description_ka TEXT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_url VARCHAR(500)
);

-- 6. Cadastral Parcels & Live Spatial Cache
CREATE TABLE IF NOT EXISTS parcels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cadastral_code VARCHAR(50) UNIQUE NOT NULL,
    municipality_id VARCHAR(50) REFERENCES municipalities(id),
    area_sqm NUMERIC(12,2) NOT NULL,
    address_ka TEXT,
    official_status VARCHAR(50) DEFAULT 'ACTIVE',
    source VARCHAR(255) NOT NULL DEFAULT 'maps.gov.ge (NAPR Live)',
    source_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_parcels_cadastral ON parcels(cadastral_code);

CREATE TABLE IF NOT EXISTS parcel_geometries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cadastral_code VARCHAR(50) REFERENCES parcels(cadastral_code) ON DELETE CASCADE,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    shape_wkt TEXT,
    centroid GEOMETRY(Point, 4326),
    perimeter_m NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_parcel_geometries_geom ON parcel_geometries USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_parcel_geometries_centroid ON parcel_geometries USING GIST(centroid);

-- 7. Specific Geometric Restrictions & Overlays
CREATE TABLE IF NOT EXISTS red_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipality_id VARCHAR(50) REFERENCES municipalities(id),
    road_name VARCHAR(255),
    geom GEOMETRY(MultiLineString, 4326) NOT NULL,
    legal_basis VARCHAR(255),
    effective_from DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_red_lines_geom ON red_lines USING GIST(geom);

CREATE TABLE IF NOT EXISTS blue_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    water_body_name VARCHAR(255),
    buffer_meters NUMERIC(6,2),
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    legal_basis VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_blue_lines_geom ON blue_lines USING GIST(geom);

CREATE TABLE IF NOT EXISTS servitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cadastral_code VARCHAR(50),
    servitude_type VARCHAR(100) NOT NULL, -- right_of_way, utility_pipeline, drainage, cable
    geom GEOMETRY(Geometry, 4326),
    description TEXT,
    registration_date DATE,
    source VARCHAR(255) DEFAULT 'NAPR'
);
CREATE INDEX IF NOT EXISTS idx_servitudes_geom ON servitudes USING GIST(geom);

-- 8. Environmental, Protected Areas & Cultural Heritage
CREATE TABLE IF NOT EXISTS protected_areas (
    id VARCHAR(100) PRIMARY KEY,
    name_ka VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- national_park, strict_nature_reserve, protected_landscape
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    mepa_code VARCHAR(100),
    source VARCHAR(255) DEFAULT 'portal.mepa.gov.ge'
);
CREATE INDEX IF NOT EXISTS idx_protected_areas_geom ON protected_areas USING GIST(geom);

CREATE TABLE IF NOT EXISTS heritage_zones (
    id VARCHAR(100) PRIMARY KEY,
    name_ka VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- national_monument, cultural_reserve, historical_protection_zone
    protection_level VARCHAR(50) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    legal_basis VARCHAR(255),
    source VARCHAR(255) DEFAULT 'memkvidreoba.gov.ge'
);
CREATE INDEX IF NOT EXISTS idx_heritage_zones_geom ON heritage_zones USING GIST(geom);

CREATE TABLE IF NOT EXISTS archaeological_zones (
    id VARCHAR(100) PRIMARY KEY,
    site_name_ka VARCHAR(255) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    legal_basis VARCHAR(255),
    source VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_archaeological_zones_geom ON archaeological_zones USING GIST(geom);

CREATE TABLE IF NOT EXISTS infrastructure_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    infrastructure_type VARCHAR(100) NOT NULL, -- high_voltage_powerline, gas_pipeline, railway_buffer, airport_cone
    buffer_distance_m NUMERIC(6,2),
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    legal_basis VARCHAR(255),
    source VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_infrastructure_restrictions_geom ON infrastructure_restrictions USING GIST(geom);

-- 9. Building Uses & Permissions
CREATE TABLE IF NOT EXISTS building_uses (
    id VARCHAR(100) PRIMARY KEY,
    name_ka VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    category VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS zone_permitted_uses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id VARCHAR(100) REFERENCES functional_zones(id),
    use_id VARCHAR(100) REFERENCES building_uses(id),
    permission_type VARCHAR(50) NOT NULL, -- PRIMARY_ALLOWED, CONDITIONALLY_ALLOWED, SPECIAL_APPROVAL_REQUIRED, PROHIBITED
    conditions_ka TEXT,
    legal_rule_id VARCHAR(100) REFERENCES legal_rules(id)
);

-- 10. Analysis Logs & Audit Records
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cadastral_code VARCHAR(50) NOT NULL,
    construction_type VARCHAR(100),
    building_use VARCHAR(100),
    status VARCHAR(50) NOT NULL, -- GREEN, YELLOW, ORANGE, RED, GRAY
    result_json JSONB NOT NULL,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_quality_json JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_results_cadastral ON analysis_results(cadastral_code);

CREATE TABLE IF NOT EXISTS source_status (
    source_name VARCHAR(100) PRIMARY KEY,
    provider_class VARCHAR(100) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_successful_sync TIMESTAMP WITH TIME ZONE,
    current_version VARCHAR(50),
    notes TEXT
);
