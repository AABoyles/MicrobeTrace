import { claimId } from './shared.js';

// FASTA: sequences, each under a ">" line (#337).
export const name = 'fasta';
export const label = 'FASTA';
export const extensions = ['fasta', 'fas', 'fa'];

// What the file is called, when its contents do not say: "fas" anywhere in the extension
export const matchName = extension => extension.indexOf('fas') > -1;

// FASTA starts with ">"
export const detect = text => text.trimStart().startsWith('>');

// The nodes of a FASTA file. `sequences` are its records, [{ id, seq }], read by the
// FASTA worker (workers/parse-fasta.js), which this module does not duplicate; the
// rest is plain logic. Returns { nodes, ids, total, blanks, duplicates, problem }:
// `problem` says why the file holds nothing, and `ids` is the IDs the file gave.
export function parse(contents, { sequences, origin }) {
  const result = { nodes: [], ids: new Set(), total: sequences.length, blanks: 0, duplicates: 0 };
  if (!sequences.length) {
    result.problem = 'it holds no sequences (a sequence starts with a ">" line)';
    return result;
  }
  for (const record of sequences) {
    if (!record) continue;
    const id = claimId(record.id, result.ids, result);
    if (id === null) continue;
    result.nodes.push({ _id: id, seq: record.seq, origin });
  }
  return result;
}
