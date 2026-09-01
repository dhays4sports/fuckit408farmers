/* 408-LIFE-1.8 — separated short-lived LIFE application-start vault. */

const BUILD = '408-LIFE-1.8';
const LEGACY_SCHEMA = '408-life-application-init-v1';
const SCHEMA = '408-life-application-init-v2';
const API_PATH = '/api/life/application-init';
const CONVERSION_PATH = '/api/life/conversion';
const LEAD_PROXY_PATH = '/api/lead';
const CALLBACK_SCHEDULE_PATH = '/api/callback/schedule';
const CALLBACK_SCHEDULE_BUILD = '408-CALLBACK-1.0';
const CALLBACK_SCHEDULE_SCHEMA = '408-callback-browser-booking-v1';
const CALLBACK_SCHEDULE_MAX_BODY_BYTES = 8 * 1024;
const DEFAULT_COVERAGEFIT_CALLBACK_BOOKING_URL = 'https://coveragefit.com/api/callback/web-book';
const LOCAL_MERCHANT_APPLICATION_PATH = '/api/local/merchant-application';
const LOCAL_MERCHANT_BUILD = '408-LOCAL-1.5';
const LOCAL_EVENT_PATH = '/api/local/event';
const LOCAL_ATTRIBUTION_BUILD = '408-LOCAL-1.6';
const LOCAL_EVENT_SCHEMA = '408-local-event-v1';
const DEFAULT_FORMSPREE_ENDPOINT = 'https://formspree.io/f/mojgnegn';
const DEFAULT_COVERAGEFIT_LEAD_INTAKE_URL = 'https://coveragefit.com/api/lead/intake';
const COVERAGEFIT_LEAD_INTAKE_ORIGINS = new Set(['https://coveragefit.com','https://www.coveragefit.com','https://review.408farmers.com']);
const LEAD_OPERATIONS_BUILD = '408-LEAD-OPS-1.1';
const MAX_LEAD_BODY_BYTES = 64 * 1024;
const MAX_LOCAL_MERCHANT_BODY_BYTES = 32 * 1024;
const MAX_LOCAL_EVENT_BODY_BYTES = 6 * 1024;
const LOCAL_MERCHANT_CATEGORIES = new Set(['eat-drink','home','auto','other']);
const LOCAL_EVENT_NAMES = new Set(['local_view','merchant_view','perk_open','perk_redeem_intent','insurance_cta_click']);
const LOCAL_INSURANCE_DESTINATIONS = new Set(['insurance_root','home','auto_bundle','life','other']);
const OPS_QUEUE_PATH = '/api/life/producer/queue';
const OPS_ITEM_PATH = '/api/life/producer/item';
const OPS_STATUS_PATH = '/api/life/producer/status';
const OPS_SENSITIVE_REVEAL_PATH = '/api/life/producer/sensitive-reveal';
const OPS_CONVERSIONS_PATH = '/api/life/producer/conversions';
const OPS_READINESS_PATH = '/api/life/producer/readiness';
const MAX_BODY_BYTES = 16 * 1024;
const OPS_MAX_BODY_BYTES = 4 * 1024;
const QUEUE_LIMIT = 100;
const SENSITIVE_TTL_MS = 72 * 60 * 60 * 1000;
const SENSITIVE_REVEAL_TTL_MS = 15 * 60 * 1000;
const SENSITIVE_PURGE_INTERVAL_MS = 15 * 60 * 1000;
const PROTECTION = new Set(['family_income','home_mortgage','children','debt_final_expenses','business','coverage_in_place','not_sure']);
const RUNWAY = new Set(['under_3_months','3_to_6_months','6_to_12_months','over_1_year','income_not_primary']);
const COVERAGE = new Set(['none','work','personal','both','not_sure']);
const GENDER = new Set(['female','male','discuss']);
const QUEUE_STATUSES = new Set(['new','initiated','emailed','follow_up','completed','archived']);
const CONVERSION_EVENTS = new Set(['landing_view','start_clicked','quick_questions_complete','application_details_started','application_start_submitted']);
const LIFE_VARIANTS = new Set(['before_anything_changes','20_minutes','this_is_the_time','financial_picture']);
const LIFE_CREATIVE_CODES = new Set(['A','B','C','D']);
const LIFE_VARIANT_CODES = Object.freeze({ before_anything_changes:'A', '20_minutes':'B', this_is_the_time:'C', financial_picture:'D' });

const LOCAL_EVENT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS local_attribution_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  source TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  perk_id TEXT NOT NULL,
  merchant_slug TEXT NOT NULL,
  surface TEXT NOT NULL,
  campaign TEXT NOT NULL,
  variant TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT NOT NULL,
  utm_term TEXT NOT NULL,
  origin_partner_id TEXT NOT NULL,
  origin_perk_id TEXT NOT NULL,
  origin_merchant_slug TEXT NOT NULL,
  origin_surface TEXT NOT NULL,
  route TEXT NOT NULL,
  destination TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_local_events_name_received
  ON local_attribution_events(event_name, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_local_events_partner_received
  ON local_attribution_events(partner_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_local_events_surface_received
  ON local_attribution_events(surface, received_at DESC);
`;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let jwksCache = { domain: '', expiresAt: 0, value: null };
let lastSensitivePurgeAt = 0;

const QUEUE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS life_application_queue (
  request_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_life_application_queue_status_created
  ON life_application_queue(status, created_at DESC);
CREATE TABLE IF NOT EXISTS life_application_sensitive (
  request_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  revealed_at TEXT,
  reveal_actor TEXT,
  destroyed_at TEXT,
  FOREIGN KEY(request_id) REFERENCES life_application_queue(request_id)
);
CREATE INDEX IF NOT EXISTS idx_life_sensitive_status_expiry
  ON life_application_sensitive(status, expires_at);
CREATE TABLE IF NOT EXISTS life_application_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_email TEXT,
  from_status TEXT,
  to_status TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_life_application_events_request
  ON life_application_events(request_id, created_at DESC);
CREATE TABLE IF NOT EXISTS life_conversion_events (
  event_id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  landing_variant TEXT NOT NULL,
  creative_code TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_variant TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_life_conversion_journey_event
  ON life_conversion_events(journey_id, event_name);
CREATE INDEX IF NOT EXISTS idx_life_conversion_event_creative
  ON life_conversion_events(event_name, creative_code, occurred_at DESC);
`;

function securityHeaders(extra) {
  return Object.assign({
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'same-origin'
  }, extra || {});
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: securityHeaders({ 'Content-Type': 'application/json; charset=utf-8' })
  });
}

function fail(status) {
  return jsonResponse(status, { ok: false, error: 'request_not_completed' });
}

function text(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function exactKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => allowed.includes(key));
}

function allowedOrigins(env) {
  return String((env && env.LIFE_ALLOWED_ORIGIN) || 'https://408farmers.com')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function validOrigin(request, env) {
  const origin = String(request.headers.get('Origin') || '').replace(/\/$/, '');
  if (!origin || !allowedOrigins(env).includes(origin)) return false;
  const fetchSite = String(request.headers.get('Sec-Fetch-Site') || '').toLowerCase();
  return !fetchSite || fetchSite === 'same-origin';
}

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validDob(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  const now = new Date();
  const oldest = new Date(Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate()));
  return date < now && date >= oldest;
}

function validEmail(value) {
  return value.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value) {
  if (!value) return true;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function normalizeAttribution(value) {
  const direct = {
    channel: 'life_campaign', landing_variant: 'before_anything_changes', creative_code: 'A',
    utm_source: 'direct', utm_medium: 'direct', utm_campaign: 'life_insurability', utm_content: 'before_anything_changes',
    utm_term: '', campaign_id: '', campaign_variant: 'A'
  };
  if (value === undefined) return direct;
  const keys = ['channel','landing_variant','creative_code','utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','campaign_variant'];
  if (!exactKeys(value, keys)) return null;
  const out = {
    channel: text(value.channel, 40),
    landing_variant: text(value.landing_variant, 80),
    creative_code: text(value.creative_code, 8).toUpperCase(),
    utm_source: text(value.utm_source, 120),
    utm_medium: text(value.utm_medium, 120),
    utm_campaign: text(value.utm_campaign, 120),
    utm_content: text(value.utm_content, 120),
    utm_term: text(value.utm_term, 160),
    campaign_id: text(value.campaign_id, 120),
    campaign_variant: text(value.campaign_variant, 40)
  };
  if (out.channel !== 'life_campaign') return null;
  if (!LIFE_VARIANTS.has(out.landing_variant) || !LIFE_CREATIVE_CODES.has(out.creative_code)) return null;
  if (LIFE_VARIANT_CODES[out.landing_variant] !== out.creative_code) return null;
  if (!out.utm_source || !out.utm_medium || !out.utm_campaign || !out.utm_content) return null;
  return out;
}


function normalizeConversionAttribution(value) {
  const keys = ['channel','landing_variant','creative_code','utm_source','utm_medium','utm_campaign','utm_content','campaign_id','campaign_variant'];
  if (!exactKeys(value, keys)) return null;
  const full = normalizeAttribution(Object.assign({ utm_term: '' }, value || {}));
  if (!full) return null;
  return {
    channel: full.channel,
    landing_variant: full.landing_variant,
    creative_code: full.creative_code,
    utm_source: full.utm_source,
    utm_medium: full.utm_medium,
    utm_campaign: full.utm_campaign,
    utm_content: full.utm_content,
    campaign_id: full.campaign_id,
    campaign_variant: full.campaign_variant
  };
}

function normalizeConversion(payload) {
  if (!exactKeys(payload, ['schema_version','event_id','journey_id','event_name','attribution'])) return null;
  if (payload.schema_version !== '408-life-conversion-v1' || !validUuid(payload.event_id) || !validUuid(payload.journey_id)) return null;
  const eventName = text(payload.event_name, 48);
  if (!CONVERSION_EVENTS.has(eventName)) return null;
  const attribution = normalizeConversionAttribution(payload.attribution);
  if (!attribution) return null;
  return { event_id: payload.event_id, journey_id: payload.journey_id, event_name: eventName, attribution };
}

function normalize(payload) {
  if (!exactKeys(payload, ['schema_version','submission_mode','submission_id','attribution','engagement','applicant','sensitive','acknowledgement','anti_bot'])) return null;
  if (payload.schema_version !== SCHEMA || !validUuid(payload.submission_id)) return null;
  const submissionMode = text(payload.submission_mode, 40);
  if (!['carrier_application_start','finish_with_dylan_later'].includes(submissionMode)) return null;
  if (!exactKeys(payload.engagement, ['protection_priority','income_runway','existing_life_coverage'])) return null;
  if (!exactKeys(payload.applicant, ['first_name','middle_name','last_name','gender','residential_address','residential_address_2','residential_city','residential_state','residential_zip','email','phone'])) return null;
  if (!exactKeys(payload.sensitive, ['date_of_birth','ssn_last4'])) return null;
  if (!exactKeys(payload.acknowledgement, ['application_preparation','sensitive_use_notice'])) return null;
  if (!exactKeys(payload.anti_bot, ['website','elapsed_ms'])) return null;

  const attribution = normalizeAttribution(payload.attribution);
  if (!attribution) return null;

  if (text(payload.anti_bot.website, 200)) return null;
  if (!Number.isFinite(payload.anti_bot.elapsed_ms) || payload.anti_bot.elapsed_ms < 1200 || payload.anti_bot.elapsed_ms > 21600000) return null;

  const priorities = Array.isArray(payload.engagement.protection_priority)
    ? [...new Set(payload.engagement.protection_priority)]
    : [];
  if (!priorities.length || priorities.length > 6 || priorities.some((value) => !PROTECTION.has(value))) return null;
  if (priorities.includes('not_sure') && priorities.length !== 1) return null;

  const incomeRunway = text(payload.engagement.income_runway, 40);
  const existingCoverage = text(payload.engagement.existing_life_coverage, 40);
  if (!RUNWAY.has(incomeRunway) || !COVERAGE.has(existingCoverage)) return null;

  if (typeof payload.applicant.residential_zip !== 'string' || !/^\d{5}(?:-\d{4})?$/.test(payload.applicant.residential_zip)) return null;

  const applicant = {
    first_name: text(payload.applicant.first_name, 80),
    middle_name: text(payload.applicant.middle_name, 80),
    last_name: text(payload.applicant.last_name, 100),
    gender: text(payload.applicant.gender, 20),
    residential_address: text(payload.applicant.residential_address, 160),
    residential_address_2: text(payload.applicant.residential_address_2, 80),
    residential_city: text(payload.applicant.residential_city, 100),
    residential_state: text(payload.applicant.residential_state, 40),
    residential_zip: text(payload.applicant.residential_zip, 10),
    email: text(payload.applicant.email, 160).toLowerCase(),
    phone: text(payload.applicant.phone, 24)
  };

  if (!applicant.first_name || !applicant.last_name || !GENDER.has(applicant.gender)) return null;
  if (!applicant.residential_address || !applicant.residential_city || !applicant.residential_state) return null;
  if (!/^\d{5}(?:-\d{4})?$/.test(applicant.residential_zip) || !validEmail(applicant.email) || !validPhone(applicant.phone)) return null;

  const sensitive = {
    date_of_birth: text(payload.sensitive.date_of_birth, 10),
    ssn_last4: text(payload.sensitive.ssn_last4, 4)
  };
  const acknowledgement = {
    application_preparation: payload.acknowledgement.application_preparation === true,
    sensitive_use_notice: payload.acknowledgement.sensitive_use_notice === true
  };
  if (submissionMode === 'carrier_application_start') {
    if (!validDob(sensitive.date_of_birth) || !/^\d{4}$/.test(sensitive.ssn_last4)) return null;
    if (!acknowledgement.application_preparation || !acknowledgement.sensitive_use_notice) return null;
  } else {
    if (sensitive.date_of_birth || sensitive.ssn_last4) return null;
    if (acknowledgement.application_preparation || acknowledgement.sensitive_use_notice) return null;
  }

  const now = new Date().toISOString();
  return {
    schema_version: SCHEMA,
    submission_mode: submissionMode,
    request_id: payload.submission_id,
    received_at: now,
    source: '408farmers.com/life',
    attribution,
    engagement: {
      protection_priority: priorities,
      income_runway: incomeRunway,
      existing_life_coverage: existingCoverage
    },
    applicant,
    sensitive,
    acknowledgement
  };
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return base64ToBytes(padded);
}

function base64UrlToJson(value) {
  try {
    return JSON.parse(decoder.decode(base64UrlToBytes(value)));
  } catch (_) {
    return null;
  }
}

function queueKeyBytes(env) {
  const encoded = String((env && env.LIFE_QUEUE_ENCRYPTION_KEY_B64) || '').trim();
  if (!encoded) throw new Error('queue_key_missing');
  let raw;
  try { raw = base64ToBytes(encoded); } catch (_) { throw new Error('queue_key_invalid'); }
  if (raw.byteLength !== 32) throw new Error('queue_key_invalid');
  return raw;
}

async function queueCryptoKey(env) {
  return crypto.subtle.importKey('raw', queueKeyBytes(env), { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
}

async function sensitiveCryptoKey(env) {
  const material = await crypto.subtle.importKey('raw', queueKeyBytes(env), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: encoder.encode('408-life-sensitive-v1'),
    info: encoder.encode('carrier-required-date-of-birth-and-ssn-last-four')
  }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
}

async function sealJson(value, key, additionalDataText) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(additionalDataText) }, key, plaintext);
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function openJson(row, key, additionalDataText) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(row.iv), additionalData: encoder.encode(additionalDataText) },
    key,
    base64ToBytes(row.ciphertext)
  );
  return JSON.parse(decoder.decode(plaintext));
}

function corePayload(normalized) {
  const core = Object.assign({}, normalized);
  delete core.sensitive;
  return core;
}

async function encryptQueuePayload(normalized, env) {
  return sealJson(corePayload(normalized), await queueCryptoKey(env), SCHEMA + '.core.' + normalized.request_id);
}

async function decryptQueuePayload(row, env) {
  const key = await queueCryptoKey(env);
  try {
    return { payload: await openJson(row, key, SCHEMA + '.core.' + row.request_id), legacy: false };
  } catch (_) {
    return { payload: await openJson(row, key, LEGACY_SCHEMA + '.' + row.request_id), legacy: true };
  }
}

async function encryptSensitivePayload(requestId, sensitive, env) {
  return sealJson(sensitive, await sensitiveCryptoKey(env), SCHEMA + '.sensitive.' + requestId);
}

async function decryptSensitivePayload(row, env) {
  return openJson(row, await sensitiveCryptoKey(env), SCHEMA + '.sensitive.' + row.request_id);
}

function sensitiveExpiresAt(receivedAt) {
  const base = new Date(receivedAt).getTime();
  return new Date((Number.isFinite(base) ? base : Date.now()) + SENSITIVE_TTL_MS).toISOString();
}

function queueDb(env) {
  const db = env && env.LIFE_QUEUE_DB;
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') throw new Error('queue_db_missing');
  return db;
}

async function ensureQueueSchema(env) {
  await queueDb(env).exec(QUEUE_SCHEMA_SQL);
}

async function queueInsert(normalized, env) {
  const db = queueDb(env);
  await ensureQueueSchema(env);
  const sealed = await encryptQueuePayload(normalized, env);
  const now = normalized.received_at;
  const result = await db.prepare(`
    INSERT INTO life_application_queue (request_id, status, created_at, updated_at, ciphertext, iv)
    VALUES (?1, 'new', ?2, ?2, ?3, ?4)
    ON CONFLICT(request_id) DO NOTHING
  `).bind(normalized.request_id, now, sealed.ciphertext, sealed.iv).run();

  const changes = Number(result && result.meta && result.meta.changes);
  if (!Number.isFinite(changes) || changes > 0) {
    await db.prepare(`
      INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
      VALUES (?1, 'created', NULL, NULL, 'new', ?2)
    `).bind(normalized.request_id, now).run();
  }
  if (normalized.submission_mode === 'carrier_application_start') {
    const sensitiveSealed = await encryptSensitivePayload(normalized.request_id, normalized.sensitive, env);
    const sensitiveResult = await db.prepare(`
      INSERT INTO life_application_sensitive (
        request_id, status, created_at, expires_at, ciphertext, iv, revealed_at, reveal_actor, destroyed_at
      ) VALUES (?1, 'ready', ?2, ?3, ?4, ?5, NULL, NULL, NULL)
      ON CONFLICT(request_id) DO NOTHING
    `).bind(
      normalized.request_id, now, sensitiveExpiresAt(now), sensitiveSealed.ciphertext, sensitiveSealed.iv
    ).run();
    const sensitiveChanges = Number(sensitiveResult && sensitiveResult.meta && sensitiveResult.meta.changes);
    if (!Number.isFinite(sensitiveChanges) || sensitiveChanges > 0) {
      await db.prepare(`
        INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
        VALUES (?1, 'sensitive_vault_created', NULL, NULL, 'ready', ?2)
      `).bind(normalized.request_id, now).run();
    }
  }
  return true;
}

function storedCoreFromLegacy(payload) {
  const applicant = Object.assign({}, payload.applicant || {});
  delete applicant.date_of_birth;
  delete applicant.ssn_last4;
  return {
    schema_version: SCHEMA,
    submission_mode: 'carrier_application_start',
    request_id: payload.request_id,
    received_at: payload.received_at,
    source: payload.source || '408farmers.com/life',
    attribution: payload.attribution,
    engagement: payload.engagement,
    applicant,
    acknowledgement: { application_preparation: true, sensitive_use_notice: true }
  };
}

async function migrateLegacyQueueRow(row, payload, env) {
  const db = queueDb(env);
  const now = new Date().toISOString();
  const core = storedCoreFromLegacy(payload);
  const expiresAt = sensitiveExpiresAt(row.created_at || payload.received_at);
  const destructiveStatus = ['initiated','emailed','completed','archived'].includes(text(row.status, 32));
  const expired = new Date(expiresAt).getTime() <= Date.now();
  const sensitive = {
    date_of_birth: text(payload.applicant && payload.applicant.date_of_birth, 10),
    ssn_last4: text(payload.applicant && payload.applicant.ssn_last4, 4)
  };
  const sensitiveValid = validDob(sensitive.date_of_birth) && /^\d{4}$/.test(sensitive.ssn_last4);
  const coreSealed = await sealJson(core, await queueCryptoKey(env), SCHEMA + '.core.' + row.request_id);
  await db.prepare(`
    UPDATE life_application_queue SET ciphertext = ?1, iv = ?2, updated_at = ?3 WHERE request_id = ?4
  `).bind(coreSealed.ciphertext, coreSealed.iv, now, row.request_id).run();

  let vaultStatus = 'not_collected';
  if (sensitiveValid) {
    vaultStatus = destructiveStatus ? 'destroyed' : (expired ? 'expired' : 'ready');
    let ciphertext = '';
    let iv = '';
    if (vaultStatus === 'ready') {
      const sealed = await encryptSensitivePayload(row.request_id, sensitive, env);
      ciphertext = sealed.ciphertext;
      iv = sealed.iv;
    }
    await db.prepare(`
      INSERT INTO life_application_sensitive (
        request_id, status, created_at, expires_at, ciphertext, iv, revealed_at, reveal_actor, destroyed_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, NULL, ?7)
      ON CONFLICT(request_id) DO NOTHING
    `).bind(
      row.request_id, vaultStatus, row.created_at || now, expiresAt, ciphertext, iv,
      vaultStatus === 'ready' ? null : now
    ).run();
  }
  await db.prepare(`
    INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
    VALUES (?1, 'legacy_sensitive_payload_migrated', NULL, 'legacy_inline', ?2, ?3)
  `).bind(row.request_id, vaultStatus, now).run();
  return core;
}

async function loadCorePayload(row, env) {
  const decoded = await decryptQueuePayload(row, env);
  return decoded.legacy ? migrateLegacyQueueRow(row, decoded.payload, env) : decoded.payload;
}

async function loadSensitiveRow(requestId, env) {
  return queueDb(env).prepare(`
    SELECT request_id, status, created_at, expires_at, ciphertext, iv, revealed_at, reveal_actor, destroyed_at
    FROM life_application_sensitive WHERE request_id = ?1 LIMIT 1
  `).bind(requestId).first();
}

function sensitiveMeta(row) {
  if (!row) return { status: 'not_collected', expires_at: '', revealed_at: '', destroyed_at: '' };
  return {
    status: text(row.status, 32) || 'unavailable',
    expires_at: text(row.expires_at, 40),
    revealed_at: text(row.revealed_at, 40),
    destroyed_at: text(row.destroyed_at, 40)
  };
}

async function purgeExpiredSensitive(env) {
  const db = queueDb(env);
  await ensureQueueSchema(env);
  const now = new Date().toISOString();
  const result = await db.prepare(`
    SELECT request_id, status FROM life_application_sensitive
    WHERE status IN ('ready','revealed') AND expires_at <= ?1 LIMIT 100
  `).bind(now).all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  for (const row of rows) {
    await db.prepare(`
      UPDATE life_application_sensitive
      SET status = 'expired', ciphertext = '', iv = '', destroyed_at = ?1
      WHERE request_id = ?2 AND status IN ('ready','revealed')
    `).bind(now, row.request_id).run();
    await db.prepare(`
      INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
      VALUES (?1, 'sensitive_expired', NULL, ?2, 'expired', ?3)
    `).bind(row.request_id, text(row.status, 32), now).run();
  }
  return rows.length;
}

async function destroySensitive(requestId, env, actorEmail, reason) {
  const db = queueDb(env);
  const row = await loadSensitiveRow(requestId, env);
  if (!row || !['ready','revealed'].includes(row.status)) return sensitiveMeta(row);
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE life_application_sensitive
    SET status = 'destroyed', ciphertext = '', iv = '', destroyed_at = ?1
    WHERE request_id = ?2 AND status IN ('ready','revealed')
  `).bind(now, requestId).run();
  await db.prepare(`
    INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
    VALUES (?1, ?2, ?3, ?4, 'destroyed', ?5)
  `).bind(requestId, reason || 'sensitive_destroyed', actorEmail || null, row.status, now).run();
  return { status: 'destroyed', expires_at: row.expires_at, revealed_at: row.revealed_at || '', destroyed_at: now };
}

function normalizeTeamDomain(value) {
  let domain = String(value || '').trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!domain) return '';
  if (!domain.includes('.')) domain += '.cloudflareaccess.com';
  return domain;
}

async function loadAccessJwks(domain) {
  const now = Date.now();
  if (jwksCache.domain === domain && jwksCache.value && jwksCache.expiresAt > now) return jwksCache.value;
  const response = await fetch('https://' + domain + '/cdn-cgi/access/certs', {
    method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store', redirect: 'error'
  });
  if (!response.ok) throw new Error('access_jwks_unavailable');
  const data = await response.json();
  if (!data || !Array.isArray(data.keys)) throw new Error('access_jwks_invalid');
  jwksCache = { domain, value: data.keys, expiresAt: now + 5 * 60 * 1000 };
  return data.keys;
}

async function verifyAccessJwt(token, env) {
  const domain = normalizeTeamDomain(env && env.LIFE_ACCESS_TEAM_DOMAIN);
  const expectedAud = String((env && env.LIFE_ACCESS_AUD) || '').trim();
  if (!domain || !expectedAud || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = base64UrlToJson(parts[0]);
  const payload = base64UrlToJson(parts[1]);
  if (!header || !payload || header.alg !== 'RS256' || !header.kid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= now) return null;
  if (Number.isFinite(payload.nbf) && payload.nbf > now + 30) return null;
  if (payload.iss !== 'https://' + domain) return null;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(expectedAud)) return null;

  const keys = await loadAccessJwks(domain);
  const jwk = keys.find((candidate) => candidate && candidate.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' }, key, base64UrlToBytes(parts[2]), encoder.encode(parts[0] + '.' + parts[1])
  );
  return valid ? payload : null;
}

function producerAllowlist(env) {
  return String((env && env.LIFE_PRODUCER_EMAILS) || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function authorizedProducer(request, env) {
  const allowlist = producerAllowlist(env);
  if (!allowlist.length) return null;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  let payload;
  try { payload = await verifyAccessJwt(token, env); } catch (_) { return null; }
  const email = text(payload && payload.email, 160).toLowerCase();
  if (!email || !allowlist.includes(email)) return null;
  return { email, payload };
}

function safeQueueStatus(value) {
  const status = text(value, 32);
  return QUEUE_STATUSES.has(status) ? status : '';
}

function formatQueueListItem(row, payload, vault) {
  const applicant = payload && payload.applicant ? payload.applicant : {};
  const engagement = payload && payload.engagement ? payload.engagement : {};
  const attribution = payload && payload.attribution ? payload.attribution : {};
  return {
    request_id: row.request_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    submission_mode: payload.submission_mode || 'carrier_application_start',
    sensitive: sensitiveMeta(vault),
    name: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' '),
    email: applicant.email || '',
    phone: applicant.phone || '',
    protection_priority: Array.isArray(engagement.protection_priority) ? engagement.protection_priority : [],
    existing_life_coverage: engagement.existing_life_coverage || '',
    landing_variant: attribution.landing_variant || '',
    creative_code: attribution.creative_code || '',
    utm_source: attribution.utm_source || '',
    utm_campaign: attribution.utm_campaign || '',
    utm_content: attribution.utm_content || '',
    campaign_id: attribution.campaign_id || '',
    campaign_variant: attribution.campaign_variant || ''
  };
}

async function handleQueueList(request, env, producer) {
  if (request.method !== 'GET') return fail(405);
  const db = queueDb(env);
  await ensureQueueSchema(env);
  const url = new URL(request.url);
  const requestedStatus = text(url.searchParams.get('status'), 32);
  let statement;
  if (requestedStatus && requestedStatus !== 'all') {
    const status = safeQueueStatus(requestedStatus);
    if (!status) return fail(400);
    statement = db.prepare(`
      SELECT request_id, status, created_at, updated_at, ciphertext, iv
      FROM life_application_queue WHERE status = ?1 ORDER BY created_at DESC LIMIT ?2
    `).bind(status, QUEUE_LIMIT);
  } else {
    statement = db.prepare(`
      SELECT request_id, status, created_at, updated_at, ciphertext, iv
      FROM life_application_queue ORDER BY created_at DESC LIMIT ?1
    `).bind(QUEUE_LIMIT);
  }
  const result = await statement.all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  const items = [];
  for (const row of rows) {
    try {
      const payload = await loadCorePayload(row, env);
      const vault = await loadSensitiveRow(row.request_id, env);
      items.push(formatQueueListItem(row, payload, vault));
    } catch (_) {
      items.push({ request_id: row.request_id, status: row.status, created_at: row.created_at, updated_at: row.updated_at, submission_mode:'', sensitive:{status:'unavailable',expires_at:'',revealed_at:'',destroyed_at:''}, name: 'Unable to decrypt record', email: '', phone: '', protection_priority: [], existing_life_coverage: '', landing_variant:'', creative_code:'', utm_source:'', utm_campaign:'', utm_content:'', campaign_id:'', campaign_variant:'' });
    }
  }
  return jsonResponse(200, { ok: true, build: BUILD, producer: producer.email, items });
}

async function loadQueueRow(requestId, env) {
  const db = queueDb(env);
  await ensureQueueSchema(env);
  return db.prepare(`
    SELECT request_id, status, created_at, updated_at, ciphertext, iv
    FROM life_application_queue WHERE request_id = ?1 LIMIT 1
  `).bind(requestId).first();
}

async function handleQueueItemGet(request, env, producer) {
  if (request.method !== 'GET') return fail(405);
  const url = new URL(request.url);
  const requestId = text(url.searchParams.get('id'), 64);
  if (!validUuid(requestId)) return fail(400);
  const row = await loadQueueRow(requestId, env);
  if (!row) return fail(404);
  let payload;
  try { payload = await loadCorePayload(row, env); } catch (_) { return fail(500); }
  const vault = await loadSensitiveRow(requestId, env);
  return jsonResponse(200, {
    ok: true,
    producer: producer.email,
    item: {
      request_id: row.request_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      submission_mode: payload.submission_mode || 'carrier_application_start',
      sensitive: sensitiveMeta(vault),
      attribution: payload.attribution || normalizeAttribution(undefined),
      engagement: payload.engagement,
      applicant: payload.applicant,
      acknowledgement: payload.acknowledgement
    }
  });
}

async function readOpsJson(request) {
  const lengthHeader = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(lengthHeader) && lengthHeader > OPS_MAX_BODY_BYTES) return null;
  let raw;
  try { raw = await request.text(); } catch (_) { return null; }
  if (encoder.encode(raw).byteLength > OPS_MAX_BODY_BYTES) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

async function handleSensitiveReveal(request, env, producer) {
  if (request.method !== 'POST') return fail(405);
  if (!validOrigin(request, env) || request.headers.get('X-Life-Ops-Action') !== '1') return fail(403);
  if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers.get('Content-Type') || ''))) return fail(415);
  const body = await readOpsJson(request);
  if (!body || !exactKeys(body, ['request_id','confirmation']) || !validUuid(body.request_id) || body.confirmation !== 'REVEAL_ONCE') return fail(400);
  await purgeExpiredSensitive(env);
  const db = queueDb(env);
  const row = await loadSensitiveRow(body.request_id, env);
  if (!row) return jsonResponse(409, { ok:false, error:'sensitive_not_collected', sensitive:{ status:'not_collected' } });
  if (row.status !== 'ready' || !row.ciphertext || !row.iv) {
    return jsonResponse(409, { ok:false, error:'sensitive_unavailable', sensitive:sensitiveMeta(row) });
  }
  let sensitive;
  try { sensitive = await decryptSensitivePayload(row, env); } catch (_) { return fail(500); }
  if (!validDob(sensitive.date_of_birth) || !/^\d{4}$/.test(sensitive.ssn_last4)) return fail(500);
  const now = new Date().toISOString();
  const revealExpiry = new Date(Date.now() + SENSITIVE_REVEAL_TTL_MS).toISOString();
  const effectiveExpiry = new Date(row.expires_at).getTime() < new Date(revealExpiry).getTime() ? row.expires_at : revealExpiry;
  const result = await db.prepare(`
    UPDATE life_application_sensitive
    SET status = 'revealed', revealed_at = ?1, reveal_actor = ?2, expires_at = ?3
    WHERE request_id = ?4 AND status = 'ready'
  `).bind(now, producer.email, effectiveExpiry, body.request_id).run();
  const changes = Number(result && result.meta && result.meta.changes);
  if (Number.isFinite(changes) && changes !== 1) return jsonResponse(409, { ok:false, error:'sensitive_unavailable', sensitive:{ status:'unavailable' } });
  await db.prepare(`
    INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
    VALUES (?1, 'sensitive_revealed_once', ?2, 'ready', 'revealed', ?3)
  `).bind(body.request_id, producer.email, now).run();
  return jsonResponse(200, {
    ok:true,
    sensitive:{ date_of_birth:sensitive.date_of_birth, ssn_last4:sensitive.ssn_last4 },
    status:'revealed',
    auto_destroy_at:effectiveExpiry
  });
}

async function handleQueueStatus(request, env, producer) {
  if (request.method !== 'POST') return fail(405);
  if (!validOrigin(request, env) || request.headers.get('X-Life-Ops-Action') !== '1') return fail(403);
  if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers.get('Content-Type') || ''))) return fail(415);
  const body = await readOpsJson(request);
  if (!body || !exactKeys(body, ['request_id','status']) || !validUuid(body.request_id)) return fail(400);
  const status = safeQueueStatus(body.status);
  if (!status) return fail(400);

  const db = queueDb(env);
  await ensureQueueSchema(env);
  const current = await db.prepare('SELECT status FROM life_application_queue WHERE request_id = ?1 LIMIT 1').bind(body.request_id).first();
  if (!current) return fail(404);
  const fromStatus = safeQueueStatus(current.status);
  if (!fromStatus) return fail(500);
  if (fromStatus === status) {
    const existingSensitive = ['initiated','emailed','completed','archived'].includes(status)
      ? await destroySensitive(body.request_id, env, producer.email, 'sensitive_destroyed_after_status')
      : sensitiveMeta(await loadSensitiveRow(body.request_id, env));
    return jsonResponse(200, { ok: true, status, sensitive:existingSensitive });
  }

  const now = new Date().toISOString();
  await db.prepare('UPDATE life_application_queue SET status = ?1, updated_at = ?2 WHERE request_id = ?3').bind(status, now, body.request_id).run();
  await db.prepare(`
    INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
    VALUES (?1, 'status_changed', ?2, ?3, ?4, ?5)
  `).bind(body.request_id, producer.email, fromStatus, status, now).run();
  const vault = ['initiated','emailed','completed','archived'].includes(status)
    ? await destroySensitive(body.request_id, env, producer.email, 'sensitive_destroyed_after_status')
    : sensitiveMeta(await loadSensitiveRow(body.request_id, env));
  return jsonResponse(200, { ok: true, status, sensitive:vault });
}

async function handleQueueDelete(request, env, producer) {
  if (request.method !== 'DELETE') return fail(405);
  if (!validOrigin(request, env) || request.headers.get('X-Life-Ops-Action') !== '1') return fail(403);
  const url = new URL(request.url);
  const requestId = text(url.searchParams.get('id'), 64);
  if (!validUuid(requestId)) return fail(400);

  const db = queueDb(env);
  await ensureQueueSchema(env);
  const current = await db.prepare('SELECT status FROM life_application_queue WHERE request_id = ?1 LIMIT 1').bind(requestId).first();
  if (!current) return fail(404);
  const now = new Date().toISOString();
  await db.prepare('DELETE FROM life_application_sensitive WHERE request_id = ?1').bind(requestId).run();
  await db.prepare('DELETE FROM life_application_queue WHERE request_id = ?1').bind(requestId).run();
  await db.prepare(`
    INSERT INTO life_application_events (request_id, event_type, actor_email, from_status, to_status, created_at)
    VALUES (?1, 'deleted', ?2, ?3, NULL, ?4)
  `).bind(requestId, producer.email, safeQueueStatus(current.status) || '', now).run();
  return jsonResponse(200, { ok: true });
}


async function insertConversionEvent(normalized, env) {
  const db = queueDb(env);
  await ensureQueueSchema(env);
  const a = normalized.attribution;
  await db.prepare(`
    INSERT INTO life_conversion_events (
      event_id, journey_id, event_name, occurred_at, landing_variant, creative_code,
      utm_source, utm_medium, utm_campaign, utm_content, campaign_id, campaign_variant
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    ON CONFLICT DO NOTHING
  `).bind(
    normalized.event_id, normalized.journey_id, normalized.event_name, new Date().toISOString(),
    a.landing_variant, a.creative_code, a.utm_source, a.utm_medium, a.utm_campaign,
    a.utm_content, a.campaign_id, a.campaign_variant
  ).run();
}

async function handleConversion(request, env) {
  if (request.method !== 'POST') return fail(405);
  if (!validOrigin(request, env)) return fail(403);
  if (String(request.headers.get('X-Life-Conversion-Version') || '') !== '1') return fail(400);
  if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers.get('Content-Type') || ''))) return fail(415);
  const lengthHeader = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(lengthHeader) && lengthHeader > OPS_MAX_BODY_BYTES) return fail(413);
  let raw;
  try { raw = await request.text(); } catch (_) { return fail(400); }
  if (encoder.encode(raw).byteLength > OPS_MAX_BODY_BYTES) return fail(413);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { raw = ''; return fail(400); }
  raw = '';
  const normalized = normalizeConversion(parsed);
  parsed = null;
  if (!normalized) return fail(400);
  try { await insertConversionEvent(normalized, env); } catch (_) { return fail(503); }
  return jsonResponse(202, { ok: true });
}

function funnelShape(rows) {
  const events = ['landing_view','start_clicked','quick_questions_complete','application_details_started','application_start_submitted'];
  const totals = Object.fromEntries(events.map((name) => [name, 0]));
  const creatives = {};
  for (const row of rows) {
    const event = text(row.event_name, 48);
    const code = text(row.creative_code, 8).toUpperCase() || 'A';
    const count = Number(row.event_count) || 0;
    if (Object.prototype.hasOwnProperty.call(totals, event)) totals[event] += count;
    if (!creatives[code]) creatives[code] = Object.fromEntries(events.map((name) => [name, 0]));
    if (Object.prototype.hasOwnProperty.call(creatives[code], event)) creatives[code][event] += count;
  }
  function rates(values) {
    const landing = values.landing_view || 0;
    const started = values.start_clicked || 0;
    const submitted = values.application_start_submitted || 0;
    return {
      landing_to_start: landing ? Number((started / landing).toFixed(4)) : 0,
      landing_to_submission: landing ? Number((submitted / landing).toFixed(4)) : 0,
      start_to_submission: started ? Number((submitted / started).toFixed(4)) : 0
    };
  }
  return {
    totals: Object.assign({}, totals, { rates: rates(totals) }),
    creatives: Object.fromEntries(Object.entries(creatives).sort().map(([code, values]) => [code, Object.assign({}, values, { rates: rates(values) })]))
  };
}

async function handleConversionSummary(request, env, producer) {
  if (request.method !== 'GET') return fail(405);
  const db = queueDb(env);
  await ensureQueueSchema(env);
  const result = await db.prepare(`
    SELECT event_name, creative_code, COUNT(*) AS event_count
    FROM life_conversion_events
    GROUP BY event_name, creative_code
    ORDER BY creative_code, event_name
  `).all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  return jsonResponse(200, { ok: true, build: BUILD, producer: producer.email, funnel: funnelShape(rows) });
}

async function productionReadiness(env) {
  const checks = {
    assets_binding: !!(env && env.ASSETS && typeof env.ASSETS.fetch === 'function'),
    queue_db_binding: false,
    queue_schema: false,
    encryption_key: false,
    sensitive_vault_key_derivation: false,
    allowed_origin: allowedOrigins(env).includes('https://408farmers.com'),
    access_team_domain: !!normalizeTeamDomain(env && env.LIFE_ACCESS_TEAM_DOMAIN),
    access_audience: !!text(env && env.LIFE_ACCESS_AUD, 200),
    producer_allowlist: producerAllowlist(env).length > 0
  };
  try { queueDb(env); checks.queue_db_binding = true; } catch (_) {}
  if (checks.queue_db_binding) {
    try { await ensureQueueSchema(env); checks.queue_schema = true; } catch (_) {}
  }
  try { await queueCryptoKey(env); checks.encryption_key = true; } catch (_) {}
  try { await sensitiveCryptoKey(env); checks.sensitive_vault_key_derivation = true; } catch (_) {}
  return { ready: Object.values(checks).every(Boolean), checks };
}

async function handleReadiness(request, env, producer) {
  if (request.method !== 'GET') return fail(405);
  const report = await productionReadiness(env);
  return jsonResponse(200, { ok: true, build: BUILD, producer: producer.email, ready: report.ready, checks: report.checks });
}

async function handleProducerApi(request, env, pathname) {
  let producer;
  try { producer = await authorizedProducer(request, env); } catch (_) { producer = null; }
  if (!producer) return fail(403);
  try {
    await purgeExpiredSensitive(env);
    if (pathname === OPS_QUEUE_PATH) return handleQueueList(request, env, producer);
    if (pathname === OPS_ITEM_PATH && request.method === 'DELETE') return handleQueueDelete(request, env, producer);
    if (pathname === OPS_ITEM_PATH) return handleQueueItemGet(request, env, producer);
    if (pathname === OPS_STATUS_PATH) return handleQueueStatus(request, env, producer);
    if (pathname === OPS_SENSITIVE_REVEAL_PATH) return handleSensitiveReveal(request, env, producer);
    if (pathname === OPS_CONVERSIONS_PATH) return handleConversionSummary(request, env, producer);
    if (pathname === OPS_READINESS_PATH) return handleReadiness(request, env, producer);
  } catch (_) {
    return fail(503);
  }
  return fail(404);
}

function validLeadOrigin(request) {
  const origin = String(request.headers.get('Origin') || '').replace(/\/$/, '');
  const requestOrigin = new URL(request.url).origin.replace(/\/$/, '');
  const fetchSite = String(request.headers.get('Sec-Fetch-Site') || '').toLowerCase();
  if (origin && origin !== requestOrigin) return false;
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
}

function validCallbackOrigin(request) {
  const origin = String(request.headers.get('Origin') || '').replace(/\/$/, '');
  const requestOrigin = new URL(request.url).origin.replace(/\/$/, '');
  const fetchSite = String(request.headers.get('Sec-Fetch-Site') || '').toLowerCase();
  return origin === requestOrigin && (!fetchSite || fetchSite === 'same-origin');
}

function leadField(fields, name, max) {
  const value = fields.get(name);
  return typeof value === 'string' ? text(value, max) : '';
}

function coverageFitLeadPayload(fields) {
  const allowed = [
    ['lead_checkpoint_id',120],['lead_stage',40],['first_name',80],['last_name',100],['phone',40],['mobile',40],['email',160],
    ['consent',20],['contact_consent',20],['contact_consent_state',30],['contact_consent_version',100],
    ['contact_consent_timestamp',40],['consent_at',40],['consent_version',100],
    ['contact_basis',60],['contact_basis_version',100],['contact_basis_timestamp',40],
    ['automated_marketing_sms_consent',20],['automated_marketing_sms_consent_state',30],
    ['automated_marketing_sms_consent_version',100],['automated_marketing_sms_consent_timestamp',40],
    ['professional_program',40],['professional_role',80],['professional_role_label',120],
    ['housing_context',40],['review_track',40],['product_track',40],
    ['source_key',80],['source',80],['campaign',160],['campaign_id',180],['campaign_variant',80],['creative',120],
    ['utm_source',120],['utm_medium',120],['utm_campaign',160],['utm_content',160],['utm_term',160],
    ['landing_page',1000],['route_path',500],['submitted_at',40]
  ];
  const result = { integration_build: LEAD_OPERATIONS_BUILD };
  for (const [name,max] of allowed) {
    const value = leadField(fields,name,max);
    if (value) result[name] = value;
  }
  result.lead_stage = result.lead_stage || 'started';
  return result;
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)].map(value => value.toString(16).padStart(2,'0')).join('');
}

function callbackBookingUrl(env) {
  const configured = String((env && env.COVERAGEFIT_CALLBACK_BOOKING_URL) || DEFAULT_COVERAGEFIT_CALLBACK_BOOKING_URL).trim();
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/api/callback/web-book' || !COVERAGEFIT_LEAD_INTAKE_ORIGINS.has(url.origin)) return null;
    return url.toString();
  } catch (_) { return null; }
}

function normalizeCallbackSchedule(value) {
  const keys = ['schema_version','request_id','correlation_id','first_name','phone','product_type','source_route','date','time','call_request','call_request_version','call_request_timestamp'];
  if (!exactKeys(value, keys) || value.schema_version !== CALLBACK_SCHEDULE_SCHEMA || !validUuid(value.request_id)) return null;
  const phone = text(value.phone, 40);
  const productType = text(value.product_type, 30).toLowerCase();
  const requestedDate = text(value.date, 10);
  const requestedTime = text(value.time, 5);
  const consentTimestamp = text(value.call_request_timestamp, 40);
  if (!validPhone(phone) || !phone || !new Set(['home','auto','life','business','general']).has(productType)) return null;
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(requestedDate) || !/^\d{2}:\d{2}$/.test(requestedTime)) return null;
  if (value.call_request !== true || text(value.call_request_version, 100) !== CALLBACK_SCHEDULE_SCHEMA || !Number.isFinite(Date.parse(consentTimestamp))) return null;
  return {
    schema_version: CALLBACK_SCHEDULE_SCHEMA,
    request_id: value.request_id.toLowerCase(),
    correlation_id: text(value.correlation_id, 120),
    first_name: text(value.first_name, 60),
    phone,
    product_type: productType,
    source_route: text(value.source_route, 80) || '/',
    date: requestedDate,
    time: requestedTime,
    call_request: true,
    call_request_version: CALLBACK_SCHEDULE_SCHEMA,
    call_request_timestamp: new Date(consentTimestamp).toISOString()
  };
}

async function handleCallbackSchedule(request, env) {
  if (request.method !== 'POST') return fail(405);
  if (!validCallbackOrigin(request)) return fail(403);
  if (String(request.headers.get('X-408-Callback-Version') || '') !== '1') return fail(400);
  if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers.get('Content-Type') || ''))) return fail(415);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(contentLength) && contentLength > CALLBACK_SCHEDULE_MAX_BODY_BYTES) return fail(413);
  let raw;
  try { raw = await request.text(); } catch (_) { return fail(400); }
  if (encoder.encode(raw).byteLength > CALLBACK_SCHEDULE_MAX_BODY_BYTES) return fail(413);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { return fail(400); }
  raw = '';
  const normalized = normalizeCallbackSchedule(parsed);
  parsed = null;
  if (!normalized) return fail(422);

  const endpoint = callbackBookingUrl(env);
  const secret = String((env && env.COVERAGEFIT_LEAD_SYNC_SECRET) || '');
  if (!endpoint || secret.length < 32) return jsonResponse(503, { ok:false, booked:false, error:'Callback booking is not configured.' });
  const body = JSON.stringify(normalized);
  const sentAt = String(Date.now());
  const signature = await hmacSha256Hex(secret, `${sentAt}.${body}`);
  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method:'POST', body, redirect:'manual',
      headers:{
        'Accept':'application/json',
        'Content-Type':'application/json',
        'X-CoverageFit-Sent-At':sentAt,
        'X-CoverageFit-Signature':signature,
        'X-CoverageFit-Contract':'coveragefit-callback-web-booking-v1'
      }
    });
  } catch (_) {
    return jsonResponse(502, { ok:false, booked:false, error:'The callback time could not be confirmed.' });
  }
  const result = await upstream.json().catch(() => null);
  if (!upstream.ok || !result || result.ok !== true) {
    return jsonResponse(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, { ok:false, booked:false, error:text(result && result.error && result.error.message, 180) || 'The callback time could not be confirmed.' });
  }
  if (result.available === false || result.booked !== true) return jsonResponse(200, { ok:true, booked:false, available:false, alternatives:Array.isArray(result.alternatives) ? result.alternatives.slice(0,2) : [], build:CALLBACK_SCHEDULE_BUILD });
  return jsonResponse(result.idempotent ? 200 : 201, {
    ok:true, booked:true, available:true, idempotent:result.idempotent === true, appointment:result.appointment, build:CALLBACK_SCHEDULE_BUILD
  });
}

function coverageFitLeadIntakeUrl(env) {
  const configured = String((env && env.COVERAGEFIT_LEAD_INTAKE_URL) || DEFAULT_COVERAGEFIT_LEAD_INTAKE_URL).trim();
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/api/lead/intake' || !COVERAGEFIT_LEAD_INTAKE_ORIGINS.has(url.origin)) return null;
    return url.toString();
  } catch (_) { return null; }
}

async function deliverCoverageFitLead(fields, env) {
  const endpoint = coverageFitLeadIntakeUrl(env);
  const secret = String((env && env.COVERAGEFIT_LEAD_SYNC_SECRET) || '');
  if (!endpoint || secret.length < 32) throw new Error('coveragefit_lead_sync_not_configured');
  const payload = coverageFitLeadPayload(fields);
  const body = JSON.stringify(payload);
  const sentAt = String(Date.now());
  const signature = await hmacSha256Hex(secret, `${sentAt}.${body}`);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 7000) : null;
  try {
    const response = await fetch(endpoint, {
      method:'POST', body, redirect:'manual',
      headers:{
        'Accept':'application/json',
        'Content-Type':'application/json',
        'X-CoverageFit-Sent-At':sentAt,
        'X-CoverageFit-Signature':signature,
        'X-CoverageFit-Contract':'coveragefit-durable-lead-intake-v1'
      },
      ...(controller ? { signal:controller.signal } : {})
    });
    if (!response.ok) throw new Error(`coveragefit_lead_sync_${response.status}`);
    const result = await response.json().catch(() => null);
    if (!result?.ok || result.durable !== true) throw new Error('coveragefit_lead_not_durable');
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function handleLeadProxy(request, env) {
  if (request.method !== 'POST') return fail(405);
  if (!validLeadOrigin(request)) return fail(403);

  const contentType = String(request.headers.get('Content-Type') || '');
  if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)(?:\s*;|$)/i.test(contentType)) return fail(415);

  const lengthHeader = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(lengthHeader) && lengthHeader > MAX_LEAD_BODY_BYTES) return fail(413);

  let fields;
  try { fields = await request.formData(); } catch (_) { return fail(400); }

  // CoverageFit D1 is the primary durable record. AgencyZoom projection runs
  // behind that boundary and can retry without delaying or blocking the user.
  // Formspree remains an independent fallback if durable delivery is unavailable.
  try {
    const durable = await deliverCoverageFitLead(fields, env);
    return jsonResponse(200, {
      ok:true, delivery:'coveragefit_d1', durable:true, build:LEAD_OPERATIONS_BUILD,
      checkpoint_id:durable.checkpointId, crm_state:durable.crm?.state || 'pending'
    });
  } catch (_) {}

  // Formspree's Restrict-to-Domain feature uses the Referer header. Rebuild a
  // conventional URL-encoded HTML-form request and supply the canonical site
  // referrer so Cloudflare's server-side relay behaves like the production form.
  const outbound = new URLSearchParams();
  for (const [key, value] of fields.entries()) {
    if (typeof value === 'string') outbound.append(key, value);
  }

  const endpoint = String((env && env.FORMSPREE_ENDPOINT) || DEFAULT_FORMSPREE_ENDPOINT).trim();
  if (!/^https:\/\/formspree\.io\/f\/[A-Za-z0-9_-]+$/.test(endpoint)) return fail(503);

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      body: outbound,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Referer': 'https://408farmers.com/'
      },
      redirect: 'manual'
    });
  } catch (_) { return fail(502); }

  if (!upstream.ok) {
    return jsonResponse(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, {
      ok: false,
      error: 'lead_delivery_failed'
    });
  }
  return jsonResponse(200, { ok: true, delivery: 'formspree_fallback', durable: false, build: LEAD_OPERATIONS_BUILD });
}


async function handleLocalMerchantApplication(request, env) {
  if (request.method !== 'POST') return fail(405);
  if (!validLeadOrigin(request)) return fail(403);

  const contentType = String(request.headers.get('Content-Type') || '');
  if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)(?:\s*;|$)/i.test(contentType)) return fail(415);

  const lengthHeader = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(lengthHeader) && lengthHeader > MAX_LOCAL_MERCHANT_BODY_BYTES) return fail(413);

  let fields;
  try { fields = await request.formData(); } catch (_) { return fail(400); }

  // Quiet honeypot. Legitimate users never see or fill this field.
  if (text(fields.get('_gotcha'), 80)) return fail(400);

  const application = {
    business_name: text(fields.get('business_name'), 120),
    category: text(fields.get('category'), 30),
    business_location: text(fields.get('business_location'), 180),
    website_social: text(fields.get('website_social'), 240),
    contact_name: text(fields.get('contact_name'), 120),
    email: text(fields.get('email'), 160),
    phone: text(fields.get('phone'), 30),
    proposed_perk: text(fields.get('proposed_perk'), 700),
    notes: text(fields.get('notes'), 1200),
    authorized_ack: text(fields.get('authorized_ack'), 10),
    separation_ack: text(fields.get('separation_ack'), 10),
    source: text(fields.get('source'), 120) || '408farmers.com/local/join',
    campaign: text(fields.get('campaign'), 120) || '408FARMERS Local Merchant Pilot',
    landing_page: text(fields.get('landing_page'), 500),
    submitted_at: text(fields.get('submitted_at'), 60),
    utm_source: text(fields.get('utm_source'), 120),
    utm_medium: text(fields.get('utm_medium'), 120),
    utm_campaign: text(fields.get('utm_campaign'), 120),
    utm_content: text(fields.get('utm_content'), 120),
    utm_term: text(fields.get('utm_term'), 160)
  };

  if (!application.business_name || !application.business_location || !application.contact_name || !application.email || !application.phone || !application.proposed_perk) return fail(400);
  if (!LOCAL_MERCHANT_CATEGORIES.has(application.category)) return fail(400);
  if (!validEmail(application.email) || !validPhone(application.phone)) return fail(400);
  if (application.authorized_ack !== 'yes' || application.separation_ack !== 'yes') return fail(400);
  if (application.website_social && !/^https?:\/\//i.test(application.website_social)) return fail(400);

  const outbound = new URLSearchParams();
  outbound.set('_subject', '408FARMERS Local Merchant Application');
  outbound.set('form_type', 'local_merchant_application');
  outbound.set('application_build', LOCAL_MERCHANT_BUILD);
  for (const [key, value] of Object.entries(application)) outbound.set(key, value);

  const endpoint = String(
    (env && env.LOCAL_MERCHANT_FORMSPREE_ENDPOINT) ||
    (env && env.FORMSPREE_ENDPOINT) ||
    DEFAULT_FORMSPREE_ENDPOINT
  ).trim();
  if (!/^https:\/\/formspree\.io\/f\/[A-Za-z0-9_-]+$/.test(endpoint)) return fail(503);

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      body: outbound,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Referer': 'https://408farmers.com/local/join/'
      },
      redirect: 'manual'
    });
  } catch (_) { return fail(502); }

  if (!upstream.ok) {
    return jsonResponse(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, {
      ok: false,
      error: 'merchant_application_delivery_failed'
    });
  }

  return jsonResponse(200, { ok: true, delivery: 'formspree', build: LOCAL_MERCHANT_BUILD });
}


function localToken(value, max) {
  const normalized = text(value, max || 120).toLowerCase();
  return /^[a-z0-9][a-z0-9._-]*$/.test(normalized) ? normalized : '';
}

function localRoute(value) {
  const normalized = text(value, 160);
  if (normalized === '/local' || normalized === '/local/') return '/local/';
  return /^\/local\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(normalized) ? normalized : '';
}

function normalizeLocalEvent(payload) {
  if (!exactKeys(payload, ['schema_version','event_id','session_id','event_name','occurred_at','context'])) return null;
  if (payload.schema_version !== LOCAL_EVENT_SCHEMA || !validUuid(payload.event_id) || !validUuid(payload.session_id)) return null;
  const eventName = localToken(payload.event_name, 48);
  if (!LOCAL_EVENT_NAMES.has(eventName)) return null;
  const occurredAt = text(payload.occurred_at, 40);
  const occurredMs = Date.parse(occurredAt);
  if (!Number.isFinite(occurredMs)) return null;
  const contextKeys = [
    'source','partner_id','perk_id','merchant_slug','surface','campaign','variant',
    'utm_source','utm_medium','utm_campaign','utm_content','utm_term',
    'origin_partner_id','origin_perk_id','origin_merchant_slug','origin_surface',
    'route','destination'
  ];
  if (!exactKeys(payload.context, contextKeys)) return null;
  const c = payload.context;
  const tokenLimits = {
    source:20, partner_id:64, perk_id:64, merchant_slug:80, surface:60, campaign:100, variant:80,
    utm_source:120, utm_medium:120, utm_campaign:120, utm_content:120, utm_term:160,
    origin_partner_id:64, origin_perk_id:64, origin_merchant_slug:80, origin_surface:60, destination:40
  };
  const normalized = {
    source: localToken(c.source, 20),
    partner_id: localToken(c.partner_id, 64),
    perk_id: localToken(c.perk_id, 64),
    merchant_slug: localToken(c.merchant_slug, 80),
    surface: localToken(c.surface, 60),
    campaign: localToken(c.campaign, 100),
    variant: localToken(c.variant, 80),
    utm_source: localToken(c.utm_source, 120),
    utm_medium: localToken(c.utm_medium, 120),
    utm_campaign: localToken(c.utm_campaign, 120),
    utm_content: localToken(c.utm_content, 120),
    utm_term: localToken(c.utm_term, 160),
    origin_partner_id: localToken(c.origin_partner_id, 64),
    origin_perk_id: localToken(c.origin_perk_id, 64),
    origin_merchant_slug: localToken(c.origin_merchant_slug, 80),
    origin_surface: localToken(c.origin_surface, 60),
    route: localRoute(c.route),
    destination: localToken(c.destination, 40)
  };
  for (const [key, limit] of Object.entries(tokenLimits)) {
    if (text(c[key], limit) && !normalized[key]) return null;
  }
  if (text(c.route, 160) && !normalized.route) return null;
  if (normalized.source !== 'local' || !normalized.surface || !normalized.campaign || !normalized.variant || !normalized.route) return null;
  if (!LOCAL_INSURANCE_DESTINATIONS.has(normalized.destination || 'other')) return null;
  if (eventName === 'insurance_cta_click' && normalized.destination === 'other') return null;
  return {
    event_id: payload.event_id,
    session_id: payload.session_id,
    event_name: eventName,
    occurred_at: new Date(occurredMs).toISOString(),
    context: normalized
  };
}

function localAnalyticsDb(env) {
  const db = env && (env.LOCAL_ANALYTICS_DB || env.LIFE_QUEUE_DB);
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') return null;
  return db;
}

async function ensureLocalEventSchema(env) {
  const db = localAnalyticsDb(env);
  if (!db) return false;
  await db.exec(LOCAL_EVENT_SCHEMA_SQL);
  return true;
}

async function insertLocalEvent(normalized, env) {
  const db = localAnalyticsDb(env);
  if (!db) return { persisted: false };
  await ensureLocalEventSchema(env);
  const c = normalized.context;
  const result = await db.prepare(`
    INSERT INTO local_attribution_events (
      event_id, session_id, event_name, occurred_at, received_at,
      source, partner_id, perk_id, merchant_slug, surface, campaign, variant,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      origin_partner_id, origin_perk_id, origin_merchant_slug, origin_surface,
      route, destination
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5,
      ?6, ?7, ?8, ?9, ?10, ?11, ?12,
      ?13, ?14, ?15, ?16, ?17,
      ?18, ?19, ?20, ?21,
      ?22, ?23
    ) ON CONFLICT(event_id) DO NOTHING
  `).bind(
    normalized.event_id, normalized.session_id, normalized.event_name, normalized.occurred_at, new Date().toISOString(),
    c.source, c.partner_id, c.perk_id, c.merchant_slug, c.surface, c.campaign, c.variant,
    c.utm_source, c.utm_medium, c.utm_campaign, c.utm_content, c.utm_term,
    c.origin_partner_id, c.origin_perk_id, c.origin_merchant_slug, c.origin_surface,
    c.route, c.destination
  ).run();
  const changes = Number(result && result.meta && result.meta.changes);
  return { persisted: !Number.isFinite(changes) || changes > 0 };
}

async function handleLocalEvent(request, env) {
  if (request.method !== 'POST') return fail(405);
  if (!validLeadOrigin(request)) return fail(403);
  if (String(request.headers.get('X-Local-Event-Version') || '') !== '1') return fail(400);
  if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers.get('Content-Type') || ''))) return fail(415);
  const lengthHeader = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(lengthHeader) && lengthHeader > MAX_LOCAL_EVENT_BODY_BYTES) return fail(413);
  let raw;
  try { raw = await request.text(); } catch (_) { return fail(400); }
  if (encoder.encode(raw).byteLength > MAX_LOCAL_EVENT_BODY_BYTES) return fail(413);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { return fail(400); }
  raw = '';
  const normalized = normalizeLocalEvent(parsed);
  parsed = null;
  if (!normalized) return fail(400);
  try {
    const result = await insertLocalEvent(normalized, env);
    return jsonResponse(202, { ok: true, build: LOCAL_ATTRIBUTION_BUILD, persisted: result.persisted });
  } catch (_) {
    // Analytics must never block Local discovery, perk use, or insurance navigation.
    return jsonResponse(202, { ok: true, build: LOCAL_ATTRIBUTION_BUILD, persisted: false });
  }
}

function lifeOperationalLeadFields(normalized) {
  const fields = new URLSearchParams();
  const applicant = normalized.applicant || {};
  const attribution = normalized.attribution || {};
  const checkpointId = `408d_${String(normalized.request_id || '').replace(/-/g, '')}`;
  fields.set('lead_checkpoint_id', checkpointId);
  fields.set('lead_stage', 'started');
  fields.set('first_name', applicant.first_name || '');
  fields.set('last_name', applicant.last_name || '');
  fields.set('email', applicant.email || '');
  if (applicant.phone) fields.set('phone', applicant.phone);
  fields.set('contact_basis', 'requested_transaction_follow_up');
  fields.set('contact_basis_version', '408farmers-life-application-follow-up-v1');
  fields.set('contact_basis_timestamp', normalized.received_at);
  fields.set('source_key', 'web_408_life');
  fields.set('source', '408farmers.com/life');
  fields.set('review_track', 'life');
  fields.set('campaign', attribution.utm_campaign || 'life_insurability');
  fields.set('campaign_id', attribution.campaign_id || 'life_application_start');
  fields.set('campaign_variant', attribution.campaign_variant || attribution.creative_code || '');
  fields.set('creative', attribution.creative_code || '');
  fields.set('utm_source', attribution.utm_source || 'direct');
  fields.set('utm_medium', attribution.utm_medium || 'direct');
  fields.set('utm_campaign', attribution.utm_campaign || 'life_insurability');
  fields.set('utm_content', attribution.utm_content || attribution.landing_variant || '');
  fields.set('utm_term', attribution.utm_term || '');
  fields.set('landing_page', 'https://408farmers.com/life/');
  fields.set('submitted_at', normalized.received_at);
  return fields;
}

async function handleApplicationInit(request, env, executionContext) {
  if (request.method !== 'POST') return fail(405);
  if (!validOrigin(request, env)) return fail(403);
  if (String(request.headers.get('X-Life-Request-Version') || '') !== '2') return fail(400);
  if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers.get('Content-Type') || ''))) return fail(415);

  const lengthHeader = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(lengthHeader) && lengthHeader > MAX_BODY_BYTES) return fail(413);

  let rawBody;
  try { rawBody = await request.text(); } catch (_) { return fail(400); }
  if (encoder.encode(rawBody).byteLength > MAX_BODY_BYTES) return fail(413);

  let parsed;
  try { parsed = JSON.parse(rawBody); } catch (_) { rawBody = ''; return fail(400); }
  rawBody = '';

  const normalized = normalize(parsed);
  parsed = null;
  if (!normalized) return fail(400);

  try {
    await queueInsert(normalized, env);
  } catch (_) {
    return fail(503);
  }
  // The encrypted D1 queue remains the system of record for the application.
  // This second handoff contains only identity, attribution, and transaction-
  // follow-up evidence; it never includes DOB, address, SSN, or life answers.
  const projectionTask = deliverCoverageFitLead(lifeOperationalLeadFields(normalized), env).catch(() => null);
  if (executionContext && typeof executionContext.waitUntil === 'function') executionContext.waitUntil(projectionTask);
  else await projectionTask;
  return jsonResponse(202, {
    ok:true,
    submission_mode:normalized.submission_mode,
    sensitive_status:normalized.submission_mode === 'carrier_application_start' ? 'ready' : 'not_collected'
  });
}


function pageAssetRoute(pathname) {
  const path = String(pathname || '');

  // Cloudflare Pages Advanced Mode (_worker.js) owns all requests. For
  // wildcard campaign/referral paths, serve the canonical *pretty* Pages
  // route through env.ASSETS.fetch(). Cloudflare explicitly requires pretty
  // paths here (for example /home/ rather than /home/index.html); requesting
  // index.html causes the asset layer to redirect back to the pretty path and
  // can create a Worker/asset redirect loop.
  if (path === '/home/Wowindex.html') {
    return { redirect: '/home/', status: 301 };
  }

  // Canonical no-trailing-slash entry points are normalized here rather than
  // through _redirects. This keeps all application routing in Advanced Mode
  // and prevents ASSETS.fetch() from reapplying index.html rewrite rules.
  const canonicalDirectories = new Set(['/home','/contact','/buyer','/life','/life-ops','/neighbor','/score','/auto-bundle','/healthcare','/teachers','/tech','/engineers','/local']);
  if (canonicalDirectories.has(path)) return { redirect: path + '/', status: 308 };

  if (path.startsWith('/neighbor/r/')) return { asset: '/neighbor/' };

  // 408-LOCAL-1.6 canonical Local routes. Merchant routing from 1.4 remains intact; the public URL remains
  // /local/{merchant-slug}/ while one reusable detail shell resolves the
  // validated catalog client-side. Reserved Local infrastructure paths are
  // never treated as merchant slugs.
  if (path === '/local/detail' || path === '/local/detail/') return { redirect: '/local/', status: 308 };
  if (path === '/local/join') return { redirect: '/local/join/', status: 308 };
  const localMerchantNoSlash = path.match(/^\/local\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (localMerchantNoSlash && !['data','detail','join'].includes(localMerchantNoSlash[1])) {
    return { redirect: path + '/', status: 308 };
  }
  const localMerchantRoute = path.match(/^\/local\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/);
  if (localMerchantRoute && !['data','detail','join'].includes(localMerchantRoute[1])) {
    return { asset: '/local/detail/' };
  }

  if (path.startsWith('/home/qr/') || path.startsWith('/home/campaign/')) return { asset: '/home/' };
  if (path.startsWith('/home/') && path !== '/home/' && path !== '/home/index.html') return { asset: '/home/' };

  if (path.startsWith('/auto-bundle/') && path !== '/auto-bundle/' && path !== '/auto-bundle/index.html') return { asset: '/auto-bundle/' };
  if (path.startsWith('/healthcare/') && path !== '/healthcare/' && path !== '/healthcare/index.html') return { asset: '/healthcare/' };
  if (path.startsWith('/teachers/') && path !== '/teachers/' && path !== '/teachers/index.html') return { asset: '/teachers/' };
  if (path.startsWith('/tech/') && path !== '/tech/' && path !== '/tech/index.html') return { asset: '/tech/' };
  if (path.startsWith('/engineers/') && path !== '/engineers/' && path !== '/engineers/index.html') return { asset: '/engineers/' };

  // Canonical routes such as /home/, /contact/, /buyer/, /life/, /score/
  // already are Pages pretty paths, so let the asset server handle them
  // directly without a second internal rewrite.
  return null;
}

function assetRequestFor(request, pathname) {
  const target = new URL(request.url);
  target.pathname = pathname;
  return new Request(target.toString(), request);
}

export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    const lifeTraffic = url.pathname === API_PATH || url.pathname.startsWith('/api/life/producer/') || url.pathname === '/life/' || url.pathname === '/life';
    if (lifeTraffic && Date.now() - lastSensitivePurgeAt >= SENSITIVE_PURGE_INTERVAL_MS && executionContext && typeof executionContext.waitUntil === 'function') {
      lastSensitivePurgeAt = Date.now();
      executionContext.waitUntil(purgeExpiredSensitive(env).catch(() => 0));
    }
    if (url.pathname === LEAD_PROXY_PATH) return handleLeadProxy(request, env);
    if (url.pathname === CALLBACK_SCHEDULE_PATH) return handleCallbackSchedule(request, env);
    if (url.pathname === LOCAL_MERCHANT_APPLICATION_PATH) return handleLocalMerchantApplication(request, env);
    if (url.pathname === LOCAL_EVENT_PATH) return handleLocalEvent(request, env);
    if (url.pathname === API_PATH) return handleApplicationInit(request, env, executionContext);
    if (url.pathname === CONVERSION_PATH) return handleConversion(request, env);
    if (url.pathname.startsWith('/api/life/producer/')) return handleProducerApi(request, env, url.pathname);

    if (request.method === 'GET' || request.method === 'HEAD') {
      const pageRoute = pageAssetRoute(url.pathname);
      if (pageRoute && pageRoute.redirect) {
        const destination = new URL(pageRoute.redirect, url);
        return Response.redirect(destination.toString(), pageRoute.status || 302);
      }
      if (pageRoute && pageRoute.asset) {
        return env.ASSETS.fetch(assetRequestFor(request, pageRoute.asset));
      }
    }

    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller, env, executionContext) {
    const task = purgeExpiredSensitive(env).catch(() => 0);
    if (executionContext && typeof executionContext.waitUntil === 'function') executionContext.waitUntil(task);
    else await task;
  }
};
