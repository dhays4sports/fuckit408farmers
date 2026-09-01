(function (root, factory) {
  'use strict';
  var api = factory();
  root.Farmers408BuyerReferral = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var VERSION = '1.1.0';
  var BUILD = '408-RC-SMS-1.6';
  var DEFAULT_PHONE = '+14083276377';

  function text(value) {
    return value === undefined || value === null ? '' : String(value).replace(/\s+/g, ' ').trim();
  }

  function normalizePartnerId(value) {
    var candidate = text(value).toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '');
    return candidate.slice(0, 64);
  }

  function normalizePartnerName(value) {
    return text(value)
      .replace(/[^a-zA-Z0-9À-ž .,'&()\-]/g, '')
      .slice(0, 80)
      .trim();
  }


  function normalizePartnerCode(value) {
    var candidate = text(value).toUpperCase().replace(/[^A-Z0-9_-]+/g, '').slice(0, 16);
    return /^[A-Z0-9][A-Z0-9_-]{1,15}$/.test(candidate) ? candidate : '';
  }

  function normalizeCampaignId(value) {
    return text(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 96);
  }

  function first(params, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var values = params.getAll(keys[i]);
      if (values.length === 1 && text(values[0])) return text(values[0]);
    }
    return '';
  }

  function resolve(search) {
    var params;
    try { params = new URLSearchParams(text(search)); } catch (_) { params = new URLSearchParams(''); }

    var partnerId = normalizePartnerId(first(params, ['partner_id', 'partner', 'realtor_id']));
    var partnerName = normalizePartnerName(first(params, ['partner_name', 'referred_by', 'realtor_name']));
    var partnerCode = normalizePartnerCode(first(params, ['partner_code', 'sms_code', 'ref_code']));
    var explicitCampaign = normalizeCampaignId(first(params, ['campaign_id', 'campaign']));
    var isPartnerReferral = Boolean(partnerId || partnerName);
    var campaignId = explicitCampaign || (partnerId ? 'buyer_partner_' + partnerId + '_web' : 'buyer_direct_web');

    return {
      active: isPartnerReferral,
      partnerId: partnerId,
      partnerName: partnerName,
      partnerCode: partnerCode,
      referralSource: isPartnerReferral ? 'realtor_partner' : 'buyer_direct',
      campaignId: campaignId,
      utmSource: first(params, ['utm_source']) || (isPartnerReferral ? 'realtor_partner' : '408farmers'),
      utmMedium: first(params, ['utm_medium']) || (isPartnerReferral ? 'partner_card' : 'website'),
      utmCampaign: first(params, ['utm_campaign']) || 'buyer_referral',
      utmContent: first(params, ['utm_content']) || (partnerId || 'buyer_direct'),
      utmTerm: first(params, ['utm_term'])
    };
  }

  function buildSmsBody(context) {
    var ctx = context && typeof context === 'object' ? context : {};
    var intro = ctx.partnerName ? ctx.partnerName + ' referred me. ' : '';
    var ref = normalizePartnerCode(ctx.partnerCode) ? ' Ref: ' + normalizePartnerCode(ctx.partnerCode) : '';
    return 'Hi Dylan, ' + intro + 'I’m buying a home and would like help reviewing coverage for my purchase.' + ref;
  }

  function buildSmsHref(context, phone) {
    return 'sms:' + (text(phone) || DEFAULT_PHONE) + '?body=' + encodeURIComponent(buildSmsBody(context));
  }

  return {
    version: VERSION,
    build: BUILD,
    defaultPhone: DEFAULT_PHONE,
    normalizePartnerId: normalizePartnerId,
    normalizePartnerName: normalizePartnerName,
    normalizePartnerCode: normalizePartnerCode,
    normalizeCampaignId: normalizeCampaignId,
    resolve: resolve,
    buildSmsBody: buildSmsBody,
    buildSmsHref: buildSmsHref
  };
});
