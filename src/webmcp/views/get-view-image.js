import { fail, image } from '../core.js';
import { idOf, viewSchema, openSchema, settle, rootOf, need, blobToDataURL, finish, exporterOf, runExport } from './helpers.js';

const IMAGE_TYPES = ['png', 'jpeg', 'webp'];

// A view's pixels without an export dialog: its canvases, or its DOM
async function rasterize(root, scale) {
  const w = root.clientWidth, h = root.clientHeight;
  if (!w || !h) fail('The view has no size (it is in a background tab); focus_view it first.');
  const box = root.getBoundingClientRect();
  const background = (self.MT.settings && self.MT.settings.get('background-color')) || getComputedStyle(root).backgroundColor || '#ffffff';
  const copy = root.cloneNode(true);
  const src = [root, ...root.querySelectorAll('*')], dst = [copy, ...copy.querySelectorAll('*')];
  src.forEach((s, i) => {
    const d = dst[i];
    if (!d) return;
    if (s.tagName === 'SCRIPT' || s.matches('.modal, .left-pane')) { d.remove(); return; }
    const cs = getComputedStyle(s);
    let css = '';
    for (let k = 0; k < cs.length; k++) css += cs[k] + ':' + cs.getPropertyValue(cs[k]) + ';';
    d.setAttribute('style', css);
    d.removeAttribute('class');
    if (s.tagName === 'CANVAS') {
      let url = null;
      try { if (s.width && s.height) url = s.toDataURL('image/png'); } catch { /* tainted */ }
      if (url) {
        const img = document.createElement('img');
        img.setAttribute('src', url);
        img.setAttribute('style', css);
        d.replaceWith(img);
      }
    }
  });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  const fo = document.createElementNS(ns, 'foreignObject');
  fo.setAttribute('width', '100%'); fo.setAttribute('height', '100%');
  copy.style.margin = '0';
  fo.appendChild(copy);
  svg.appendChild(fo);
  void box;
  const blob = await self.MT.svgImage(svg, { scale, backgroundColor: background, type: 'image/png' });
  if (!blob) fail('The view could not be drawn.');
  return blobToDataURL(blob);
}

export default {
  name: 'get_view_image',
  title: 'Get view image',
  description: 'Renders a view as an image that you can see, to check what it actually draws (network layout and colors, chart shapes, map, tree, table). Uses the view\'s own export (the same picture its Export dialog saves, with legends) where it has one, and otherwise a snapshot of its canvases/DOM. Nothing is downloaded. The view is brought to the front first. Large images are scaled down to maxWidth (default 1200 px) to keep them small. Returns the image plus its size and how it was made.',
  inputSchema: {
    type: 'object',
    properties: {
      view: Object.assign({}, viewSchema, { description: 'The view to draw (default: the active view)' }),
      open: openSchema,
      scale: { type: 'number', minimum: 0.1, maximum: 4, description: 'Render scale (default 1: one pixel per screen pixel)' },
      maxWidth: { type: 'integer', minimum: 100, maximum: 4000, description: 'Scale the image down to at most this width (default 1200)' },
      format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format (default png; jpeg is smaller)' },
      quality: { type: 'number', minimum: 0.1, maximum: 1, description: 'JPEG quality (default 0.85)' },
      method: { type: 'string', enum: ['auto', 'export', 'dom'], description: 'auto (default): the view\'s export, else a DOM/canvas snapshot' }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  execute: async ({ view, open, scale = 1, maxWidth = 1200, format = 'png', quality = 0.85, method = 'auto' }) => {
    const item = await need(view, { open, show: true });
    const root = rootOf(item);
    await settle(150);
    let dataURL, used;
    const exporter = exporterOf(item);
    if (method !== 'dom' && exporter && IMAGE_TYPES.some(t => exporter.types.some(o => o.value === t))) {
      try {
        const result = await runExport(item, { format: 'png', scale, download: false });
        dataURL = await blobToDataURL(result.blob);
        used = 'export';
      } catch (e) {
        if (method === 'export') throw e;
      }
    } else if (method === 'export') {
      fail('The ' + idOf(item) + ' view has no image export; use method auto or dom.');
    }
    if (!dataURL) {
      dataURL = await rasterize(root, scale);
      used = 'dom';
    }
    const out = await finish(dataURL, { maxWidth, format, quality, background: self.MT.settings.get('background-color') });
    return image(out.dataURL, { view: idOf(item), width: out.width, height: out.height, format, method: used, viewSize: { width: root.clientWidth, height: root.clientHeight } });
  }
};
