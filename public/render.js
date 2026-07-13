// Kramer Pro signature renderer.
//
// The entire visible 600 x 280 signature is rendered into one opaque PNG. That
// keeps every brand pixel out of reach of email-client dark-mode transforms and
// removes the HTML-background boxes seen in Outlook. Independent contact links
// are supplied by a standard HTML image map; this must still be validated after
// Gmail saves the pasted signature and in the real client matrix.

export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 280;
export const INNER_WIDTH = 536;
export const LOCKED_BRAND = { bg: '#2d2b2e', text: '#cac8bc' };

const SCALE = 2;
const CONTENT_X = 32;
const HEADER_TEXT_WIDTH = 468;
const HEADER_LOGO_WIDTH = 58;
// The approved reference leaves a 10px inset between the K mark and the
// 536px content edge (x=568), so the 58px logo begins at x=500.
const HEADER_LOGO_X = 500;
const HEADER_Y = 24;
const FIRST_DIVIDER_Y = 99;
const CONTACT_Y = 116;
const SECOND_DIVIDER_Y = 170;
const WORDMARK_Y = 189;
const WORDMARK_WIDTH = 520;

const CONTACTS = {
  email: { x: 32, width: 210, hitX1: 32, hitX2: 252, label: 'Email Address' },
  phone: { x: 252, width: 166, hitX1: 252, hitX2: 428, label: 'Phone Number' },
  website: { x: 428, width: 140, hitX1: 428, hitX2: 568, label: 'Website' }
};

function clean(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function normalizeUrl(value) {
  const url = clean(value);
  if (!url) return '';
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
}

function phoneHref(value) {
  const compact = clean(value).replace(/[^\d+]/g, '');
  return compact ? `tel:${compact}` : '';
}

export function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'signature';
}

function safeMapId(value) {
  const id = clean(value).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `kramer-${id || 'signature'}`;
}

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIGNATURE_WIDTH * SCALE;
  canvas.height = SIGNATURE_HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = LOCKED_BRAND.bg;
  ctx.fillRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
  ctx.fillStyle = LOCKED_BRAND.text;
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

function fitCanvasFont(ctx, text, maxWidth, startSize, minSize, weight, family) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.font = `${weight} ${size}px ${family}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load signature asset: ${src}`));
    image.src = src;
  });
}

function drawHeader(ctx, data, logo) {
  fitCanvasFont(ctx, data.fullName, HEADER_TEXT_WIDTH, 32, 20, '400', 'Arial, Helvetica, sans-serif');
  ctx.fillText(data.fullName, CONTENT_X, HEADER_Y + 26);
  fitCanvasFont(ctx, data.jobTitle, HEADER_TEXT_WIDTH, 17, 12, '400', "Georgia, 'Times New Roman', serif");
  ctx.fillText(data.jobTitle, CONTENT_X, HEADER_Y + 55);

  const logoHeight = HEADER_LOGO_WIDTH * (logo.naturalHeight / logo.naturalWidth);
  ctx.drawImage(logo, HEADER_LOGO_X, HEADER_Y, HEADER_LOGO_WIDTH, logoHeight);
}

function drawContact(ctx, contact, value) {
  ctx.font = '700 12px Arial, Helvetica, sans-serif';
  ctx.fillText(`${contact.label} :`, contact.x, CONTACT_Y + 11);
  fitCanvasFont(ctx, value, contact.width, 12, 8, '400', 'Arial, Helvetica, sans-serif');
  ctx.fillText(value, contact.x, CONTACT_Y + 31);
}

function buildAreas(data, websiteLabel) {
  const areas = [];
  if (data.email) {
    areas.push({
      key: 'email',
      coords: [CONTACTS.email.hitX1, CONTACT_Y - 5, CONTACTS.email.hitX2, CONTACT_Y + 42],
      href: `mailto:${clean(data.email)}`,
      alt: `Email ${clean(data.email)}`
    });
  }
  if (data.phone) {
    areas.push({
      key: 'phone',
      coords: [CONTACTS.phone.hitX1, CONTACT_Y - 5, CONTACTS.phone.hitX2, CONTACT_Y + 42],
      href: phoneHref(data.phone),
      alt: `Call ${clean(data.phone)}`
    });
  }
  const websiteHref = normalizeUrl(data.website);
  if (websiteHref) {
    areas.push({
      key: 'website',
      coords: [CONTACTS.website.hitX1, CONTACT_Y - 5, CONTACTS.website.hitX2, CONTACT_Y + 42],
      href: websiteHref,
      alt: `Visit ${websiteLabel}`
    });
  }
  return areas.filter((area) => area.href);
}

// data: { fullName, jobTitle, email, phone, website, websiteLabel, mapId }
// assets: { logoSrc, wordmarkSrc }
export async function buildCompositeSignature(data, assets) {
  const [logo, wordmark] = await Promise.all([
    loadImage(assets.logoSrc),
    loadImage(assets.wordmarkSrc)
  ]);
  const { canvas, ctx } = createCanvas();
  const websiteLabel = clean(data.websiteLabel)
    || clean(data.website).replace(/^https?:\/\//i, '').replace(/\/$/g, '');

  drawHeader(ctx, data, logo);

  ctx.fillStyle = LOCKED_BRAND.text;
  ctx.fillRect(CONTENT_X, FIRST_DIVIDER_Y, INNER_WIDTH, 1);
  drawContact(ctx, CONTACTS.email, clean(data.email));
  drawContact(ctx, CONTACTS.phone, clean(data.phone));
  drawContact(ctx, CONTACTS.website, websiteLabel);
  ctx.fillRect(CONTENT_X, SECOND_DIVIDER_Y, INNER_WIDTH, 1);

  const wordmarkHeight = WORDMARK_WIDTH * (wordmark.naturalHeight / wordmark.naturalWidth);
  ctx.drawImage(wordmark, CONTENT_X, WORDMARK_Y, WORDMARK_WIDTH, wordmarkHeight);

  return {
    key: 'signature',
    filename: 'signature.png',
    width: SIGNATURE_WIDTH,
    height: SIGNATURE_HEIGHT,
    canvas,
    mapId: safeMapId(data.mapId || slugify(data.fullName)),
    areas: buildAreas(data, websiteLabel),
    alt: `${clean(data.fullName)} — ${clean(data.jobTitle)}. Email: ${clean(data.email)}. Phone: ${clean(data.phone)}. Website: ${websiteLabel}.`
  };
}

function areaHtml(area) {
  const coords = area.coords.join(',');
  const target = /^https?:/i.test(area.href) ? ' target="_blank"' : '';
  return `<area shape="rect" coords="${coords}" href="${escapeAttr(area.href)}" alt="${escapeAttr(area.alt)}" title="${escapeAttr(area.alt)}"${target}>`;
}

// Builds the exact HTML copied into Gmail. The PNG is the only visible layer;
// no HTML background or live brand text remains for a dark-mode engine to alter.
export function buildHostedSignature(image, src) {
  const mapHtml = image.areas.map(areaHtml).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${image.width}" style="width:${image.width}px;border-collapse:collapse;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tbody>
    <tr>
      <td width="${image.width}" style="width:${image.width}px;padding:0;margin:0;font-size:0;line-height:0;">
        <img src="${escapeAttr(src)}" usemap="#${escapeAttr(image.mapId)}" width="${image.width}" height="${image.height}" alt="${escapeAttr(image.alt)}" style="display:block;width:${image.width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">
        <map name="${escapeAttr(image.mapId)}" id="${escapeAttr(image.mapId)}">${mapHtml}</map>
      </td>
    </tr>
  </tbody>
</table>`;
}

export function signatureToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the signature PNG.'));
    }, 'image/png');
  });
}
