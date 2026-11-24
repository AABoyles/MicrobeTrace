// pdfmake and its fonts, fetched the first time a PDF is made (MT.loadPDF in
// src/export.js; #342). bundle.js builds this into dist/bundle.pdf.js.
import pdfMake from 'pdfmake/build/pdfmake.js';
import vfs from 'pdfmake/build/vfs_fonts.js';

// vfs_fonts.js registers itself with a global pdfMake, which it can't see here
pdfMake.addVirtualFileSystem(vfs);
globalThis.pdfMake = pdfMake;
