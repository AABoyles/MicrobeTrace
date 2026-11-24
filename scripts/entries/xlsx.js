// Spreadsheets and zip files, loaded the first time one is read or written
// (MT.loadLibrary('xlsx') in src/export.js; #324).
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

globalThis.JSZip = JSZip;
globalThis.XLSX = XLSX;
