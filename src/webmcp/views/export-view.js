import { image } from '../core.js';
import { viewSchema, openSchema, settle, need, blobToDataURL, finish, runExport } from './helpers.js';

export default {
  name: 'export_view',
  title: 'Export view',
  description: 'Runs a view\'s own Export dialog: image formats (png, jpeg, webp, svg), data formats (csv, xlsx, json for tables and crosstab; Newick nwk for the tree; geojson for maps; fasta/mega for sequences; csv for the heatmap), as that view offers (call with no format to learn them: the result lists formats). With download true (default) the file is saved by the browser as filename + extension. With download false nothing is saved and the content is returned instead: text formats (svg, csv, json, nwk, geojson, fasta) as text, images as an image; XLSX and PDF cannot be returned. The view is brought to the front first.',
  inputSchema: {
    type: 'object',
    properties: {
      view: Object.assign({}, viewSchema, { description: 'The view to export (default: the active view)' }),
      open: openSchema,
      format: { type: 'string', description: 'A format the view offers, e.g. png, svg, csv, nwk (default: the first it offers)' },
      filename: { type: 'string', description: 'File name without extension' },
      download: { type: 'boolean', description: 'Save a file (default true), or return the content (false)' },
      scale: { type: 'number', minimum: 0.1, maximum: 8, description: 'Image scale (image formats; default 1)' },
      quality: { type: 'number', minimum: 0.1, maximum: 1, description: 'JPEG/WebP quality' },
      maxChars: { type: 'integer', minimum: 1000, description: 'With download false, the most text characters to return (default 200000)' },
      maxWidth: { type: 'integer', minimum: 100, description: 'With download false and an image format, scale down to this width (default 1200)' }
    },
    additionalProperties: false
  },
  annotations: { consequentialHint: true },
  confirm: ({ view, format, filename, download = true }) => download ?
    'Download an export of the ' + (view ? String(view).slice(0, 50) + ' view' : 'active view') + (format ? ' as ' + String(format).slice(0, 20) : '') +
    (filename ? ', named ' + JSON.stringify(String(filename).slice(0, 100)) : '') + ', to this computer.' : null,
  execute: async ({ view, open, format, filename, download = true, scale, quality, maxChars = 200000, maxWidth = 1200 }) => {
    const item = await need(view, { open, show: true });
    await settle(100);
    const result = await runExport(item, { format, filename, scale, quality, download });
    if (download) {
      return { view: item.componentType, downloaded: true, filename: result.name || result.filename, format: result.format, size: result.blob ? result.blob.size : null, note: result.note, formats: result.formats };
    }
    const blob = result.blob;
    const meta = { view: item.componentType, filename: result.name, format: result.format, mimeType: blob.type, size: blob.size, formats: result.formats };
    if (/^image\/(png|jpeg|webp)/.test(blob.type)) {
      const out = await finish(await blobToDataURL(blob), { maxWidth, format: blob.type == 'image/jpeg' ? 'jpeg' : 'png' });
      return image(out.dataURL, Object.assign(meta, { width: out.width, height: out.height }));
    }
    let body = await blob.text();
    const truncated = body.length > maxChars;
    if (truncated) body = body.slice(0, maxChars);
    return Object.assign(meta, { truncated, length: truncated ? undefined : body.length, content: body });
  }
};
