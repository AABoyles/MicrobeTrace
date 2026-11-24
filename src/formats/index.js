// @ts-check
import * as fasta from './fasta.js';
import * as newick from './newick.js';
import * as matrix from './matrix.js';
import * as nodes from './nodes.js';
import * as links from './links.js';
import { delimiterNames, isSheet, sheetText, tableSample } from './shared.js';

// The file formats MicrobeTrace reads, one module each (#337). To add a format, write
// its module and list it here; the Files view finds it by name and by contents.
//
// A format module exports:
//   name        what the Files view calls the kind ('fasta', 'link', ...)
//   label       its human name in messages ('a link list')
//   extensions  the file extensions it usually has
//   matchName(extension, fileName)  whether the file's name says it is this kind
//   detect(text, fileName, table)   (optional) whether the contents are this kind;
//                                   `table()` gives the sample of the text's rows
//   parse(contents, options)        (optional) the file as plain data, with no reads or
//                                   writes of the session, `temp` or the page
// Detection tries the formats in this order, so a more particular one comes first; the
// last, the link list, is what a file is when no other fits.
/** @type {{ name: string, matchName?: (extension: string, fileName?: string) => boolean, detect?: (text: string, fileName: string, table: () => any) => boolean }[]} */
export const formats = [fasta, newick, matrix, nodes, links];

export const formatByName = name => formats.find(format => format.name === name);

// What a file is, from what it holds rather than what it is called (#267): FASTA starts
// with ">", a Newick tree is parenthesised, a distance matrix is a square or triangular
// table whose header row repeats its first column, a node list has an ID column and no
// Source and Target. Returns { kind, delimiter }: the delimiter of a table (a comma, tab,
// semicolon or bar) and the format's name, or no kind when the contents say none (the
// name of the file then decides, see guessByName). The kind is a guess.
// `contents` is text, or the bytes of a spreadsheet when the extension says so.
export function detectFormat(contents, fileName = '') {
  const extension = fileName.split('.').pop().toLowerCase();
  let text = contents;
  if (isSheet(extension)) {
    try {
      text = sheetText(contents);
    } catch {
      return { delimiter: ',' };
    }
  }
  if (typeof text !== 'string') return { delimiter: ',' };
  text = text.replace(/^﻿/, '');
  let sample = null;
  const table = () => sample || (sample = tableSample(text));
  for (const format of formats) {
    if (!format.detect || !format.detect(text, fileName, table)) continue;
    // FASTA and trees are not tables, so they have no delimiter of their own
    return { kind: format.name, delimiter: format === fasta || format === newick ? ',' : table().delimiter };
  }
  return { delimiter: table().delimiter };
}

// What a file's name says it is, when its contents say nothing: the first format that
// matches its name, or a link list.
export function guessByName(fileName, extension = fileName.split('.').pop().toLowerCase()) {
  return (formats.find(format => format.matchName(extension, fileName)) || links).name;
}

export { delimiterNames };

// For the Files view, a classic script
globalThis.MTFormats = { formats, formatByName, detectFormat, guessByName, delimiterNames };
