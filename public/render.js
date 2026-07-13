// Kramer Pro signature renderer.
//
// The entire visible 600 x 280 signature is rendered into one opaque canvas,
// then cropped into three full-height, edge-to-edge PNG tiles. Each tile uses a
// normal <a><img></a> link. This keeps every brand pixel out of reach of email-
// client dark-mode transforms while avoiding image maps, which Gmail removes
// when a pasted signature is saved.

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
  email: { x: 32, width: 210, label: 'Email Address' },
  phone: { x: 252, width: 166, label: 'Phone Number' },
  website: { x: 428, width: 140, label: 'Website' }
};

// Full-height crops meet exactly at the contact-column boundaries. There are
// no transparent pixels and no HTML background between them.
const TILE_SPECS = [
  { key: 'email', filename: 'signature-email.png', x: 0, width: 252 },
  { key: 'phone', filename: 'signature-phone.png', x: 252, width: 176 },
  { key: 'website', filename: 'signature-website.png', x: 428, width: 172 }
];

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

function cropTile(source, spec) {
  const canvas = document.createElement('canvas');
  canvas.width = spec.width * SCALE;
  canvas.height = SIGNATURE_HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    source,
    spec.x * SCALE,
    0,
    spec.width * SCALE,
    SIGNATURE_HEIGHT * SCALE,
    0,
    0,
    spec.width * SCALE,
    SIGNATURE_HEIGHT * SCALE
  );
  return canvas;
}

function buildLinkedTiles(source, data, websiteLabel) {
  const links = {
    email: `mailto:${clean(data.email)}`,
    phone: phoneHref(data.phone),
    website: normalizeUrl(data.website)
  };
  const alts = {
    email: `${clean(data.fullName)} - ${clean(data.jobTitle)}. Email ${clean(data.email)}.`,
    phone: `Phone ${clean(data.phone)}.`,
    website: `Website ${websiteLabel}.`
  };
  return TILE_SPECS.map((spec) => ({
    ...spec,
    height: SIGNATURE_HEIGHT,
    canvas: cropTile(source, spec),
    href: links[spec.key],
    alt: alts[spec.key]
  }));
}

// data: { fullName, jobTitle, email, phone, website, websiteLabel }
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
    tiles: buildLinkedTiles(canvas, data, websiteLabel),
    alt: `${clean(data.fullName)} - ${clean(data.jobTitle)}. Email: ${clean(data.email)}. Phone: ${clean(data.phone)}. Website: ${websiteLabel}.`
  };
}

function linkedTileHtml(tile, src) {
  const target = /^https?:/i.test(tile.href) ? ' target="_blank"' : '';
  return `<td width="${tile.width}" height="${tile.height}" valign="top" style="width:${tile.width}px;height:${tile.height}px;padding:0;margin:0;border:0;font-size:0;line-height:0;mso-line-height-rule:exactly;vertical-align:top;"><a href="${escapeAttr(tile.href)}" title="${escapeAttr(tile.alt)}"${target} style="display:block;width:${tile.width}px;height:${tile.height}px;margin:0;padding:0;border:0;line-height:0;text-decoration:none;"><img src="${escapeAttr(src)}" width="${tile.width}" height="${tile.height}" border="0" alt="${escapeAttr(tile.alt)}" style="display:block;width:${tile.width}px;height:${tile.height}px;margin:0;padding:0;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;"></a></td>`;
}

// Builds the exact HTML copied into email clients. The three ordinary linked
// images are the only visible layer; no live brand text or HTML background is
// available for a dark-mode engine to alter.
export function buildHostedSignature(image, sources) {
  const cells = image.tiles.map((tile) => linkedTileHtml(tile, sources[tile.key])).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${image.width}" style="width:${image.width}px;border-collapse:collapse;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tbody>
    <tr>${cells}</tr>
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
