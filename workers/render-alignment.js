// Draws the alignment of the sequences (uppercase strings, all of them rows of
// one alignment) as one canvas image, which it returns as an ImageBitmap. Each
// base has its color; the other characters are the "ambig" color; with showChar,
// each cell has its character too. The drawing is the one alignment-viewer makes,
// but this runs off the page's thread, so a large alignment can be cancelled and
// report its progress (by rows).
onmessage = function(e){
 const start = Date.now();
 const seqs = e.data.seqs, cw = e.data.width, ch = e.data.height;
 const colors = e.data.colors, showChar = e.data.showChar;
 const n = seqs.length;
 // Nothing to draw: no image (a browser won't make one of no size)
 if (!n) return postMessage({image: null, start: start});
 let longest = 0;
 for (let i = 0; i < n; i++) if (seqs[i].length > longest) longest = seqs[i].length;
 const canvas = new OffscreenCanvas(longest * cw, n * ch);
 const context = canvas.getContext('2d', { alpha: false });
 const bases = Object.keys(colors).filter(base => base != 'ambig');
 const every = Math.max(1, Math.floor(n / 100));
 const total = n * (bases.length + (showChar ? 1 : 0));
 let done = 0;
 const step = row => { done++; if (row % every == 0) postMessage({progress: done / total}); };

 context.fillStyle = colors.ambig;
 context.fillRect(0, 0, canvas.width, canvas.height);
 bases.forEach(base => {
  context.fillStyle = colors[base];
  for (let row = 0; row < n; row++) {
   const seq = seqs[row], y = Math.floor(row * ch);
   for (let col = 0; col < longest; col++) {
    const c = seq[col];
    if (!c) break;
    if (c == base) context.fillRect(Math.floor(col * cw), y, cw, ch);
   }
   step(row);
  }
 });
 if (showChar) {
  context.font = (ch - 2) + 'px mono';
  context.textAlign = 'left';
  context.textBaseline = 'bottom';
  context.fillStyle = 'black';
  for (let row = 0; row < n; row++) {
   const seq = seqs[row], y = row * ch + ch;
   for (let col = 0; col < longest; col++) {
    const c = seq[col];
    if (!c) break;
    context.fillText(c, col * cw + cw / 3, y, cw);
   }
   step(row);
  }
 }
 const image = canvas.transferToImageBitmap();
 postMessage({image: image, start: start}, [image]);
};
