import { fail } from '../core.js';
import { obj } from '../schema.js';
import { filesView, checksSchema, pendingSequences } from './helpers.js';

export default {
  name: 'audit_sequences',
  title: 'Audit sequences',
  description: 'Checks the sequences about to be loaded (FASTA files and node files with a sequence column that are pending, or the loaded nodes\' sequences when nothing is pending) for ones that look wrong: empty, all gaps, RNA, amino acids, CIGAR strings, or illegal characters (each check is on by default). Returns the findings [{id, type}] and the sequences already excluded. Follow with exclude_sequences to keep them out of the network.',
  inputSchema: obj({ checks: checksSchema }),
  annotations: { readOnlyHint: true },
  execute: async (args) => {
    const view = await filesView();
    const data = await pendingSequences();
    if (!data.length) fail('There are no sequences to audit. Add a FASTA file or a node file with a sequence column first.');
    const findings = view.auditSequences(data, args.checks || {});
    return { sequences: data.length, findings: findings.length, problems: findings, excluded: self.session.data.nodeExclusions.slice() };
  }
};
