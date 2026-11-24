import { fail } from '../core.js';
import { obj, str, num, bool } from '../schema.js';
import { dataLoaded, unique, STRATEGIES, viewNames, readOptions } from './helpers.js';

const LINK_STORAGE = ['auto', 'all', 'threshold'];

export default {
  name: 'set_loading_options',
  title: 'Set loading options',
  description: 'Changes the settings that control how files become a network (see get_loading_options for what each means and its valid values). Only the options you pass change. They apply to the next launch. ' +
    'Changing distanceMetric also resets linkThreshold to that metric\'s default (pass linkThreshold too to override it). ' +
    'referenceSequence (a nucleotide string) sets the alignment reference used with referenceSource "file". ' +
    'Returns the options as set.',
  inputSchema: obj({
    distanceMetric: { type: 'string', enum: Object.keys((self.MT && self.MT.distanceMetrics) || { tn93: 1, tn92: 1, k2p: 1, jc69: 1, snps: 1, hamming: 1, p_distance: 1, transitions: 1, transversions: 1, ts_tv_ratio: 1 }), description: 'The genetic distance metric' },
    distanceMetricsAlso: { type: 'array', items: { type: 'string' }, description: 'Other metric ids to compute as well (not the distance metric itself)' },
    linkThreshold: num('Largest distance considered a link', { minimum: 0 }),
    ambiguityStrategy: { type: 'string', enum: Object.keys(STRATEGIES), description: 'How ambiguous bases are handled' },
    ambiguityThreshold: num('For HIVTRACE-G: the largest distance at which ambiguities are resolved', { minimum: 0 }),
    linkStorage: { type: 'string', enum: LINK_STORAGE, description: 'Which pairs become links' },
    defaultView: str('The view shown after launch (e.g. network, bubbles, table)'),
    inferDirectionality: bool('Try to infer link directions (experimental)'),
    alignment: { type: 'string', enum: ['none', 'smith-waterman'], description: 'Whether to align sequences (Smith-Waterman) before computing distances' },
    referenceSource: { type: 'string', enum: ['file', 'first', 'consensus'], description: 'What sequences are aligned against: consensus (the default; derived from the loaded sequences), first (the first sequence), or file (a reference you supply with referenceSequence)' },
    referenceSequence: str('A nucleotide sequence to use as the reference'),
    aligner: obj({
      match: num('Reward for matching bases', { minimum: 0 }),
      mismatch: num('Cost of a mismatch', { minimum: 0 }),
      gapOpen: num('Cost of opening a gap', { minimum: 0 }),
      gapExtend: num('Cost of extending a gap', { minimum: 0 }),
      band: { type: 'integer', minimum: 0, description: 'How many bases a gap may shift a sequence beyond its difference in length from the reference. The default is 100; 0 is fastest, and wider is slower but places more gaps correctly, and one as long as the reference is no limit. Reads back null when the Files view has it blank (no limit)' }
    })
  }),
  execute: async (args) => {
    const MT = self.MT, settings = MT.settings, widgets = self.session.style.widgets;
    const metrics = MT.distanceMetrics;
    if (args.distanceMetric !== undefined && !metrics[args.distanceMetric]) fail('Unknown distance metric ' + JSON.stringify(args.distanceMetric) + '. Use one of ' + Object.keys(metrics).join(', '));
    if (args.ambiguityStrategy !== undefined && !STRATEGIES[args.ambiguityStrategy]) fail('Unknown ambiguityStrategy. Use one of ' + Object.keys(STRATEGIES).join(', '));
    if (args.linkStorage !== undefined && !LINK_STORAGE.includes(args.linkStorage)) fail('linkStorage must be one of ' + LINK_STORAGE.join(', '));
    if (args.defaultView !== undefined && !viewNames().includes(MT.viewName(args.defaultView))) fail('Unknown view ' + JSON.stringify(args.defaultView) + '. Use one of ' + viewNames().join(', '));
    const metric = args.distanceMetric || widgets['default-distance-metric'];
    if (args.distanceMetricsAlso !== undefined) {
      const bad = args.distanceMetricsAlso.filter(m => !metrics[m]);
      if (bad.length) fail('Unknown metrics in distanceMetricsAlso: ' + bad.join(', '));
    }
    const view = MT.filesView;
    const idle = !view && !dataLoaded(); // no view to react to settings: do what it would

    if (args.distanceMetric !== undefined) {
      settings.set('default-distance-metric', metric);
      // (As the Files view does: the metric brings its own threshold)
      if (idle) {
        settings.set('link-sort-variable', metric);
        settings.set('link-threshold', metrics[metric].threshold);
      }
      self.db.setItem('default-distance-metric', metric);
    }
    if (args.ambiguityStrategy !== undefined) settings.set('ambiguity-resolution-strategy', args.ambiguityStrategy);
    if (args.linkThreshold !== undefined) settings.set('link-threshold', args.linkThreshold);
    if (args.ambiguityThreshold !== undefined) settings.set('ambiguity-threshold', args.ambiguityThreshold);
    if (args.linkStorage !== undefined) settings.set('link-storage', args.linkStorage);
    if (args.defaultView !== undefined) {
      const v = MT.viewName(args.defaultView);
      settings.set('default-view', v);
      self.db.setItem('default-view', v);
      if (idle && self.session.layout.content && self.session.layout.content[0]) self.session.layout.content[0].type = v;
    }
    if (args.inferDirectionality !== undefined) settings.set('infer-directionality-false', !args.inferDirectionality);
    if (args.alignment !== undefined) {
      settings.set('align-sw', args.alignment === 'smith-waterman');
      settings.set('align-none', args.alignment !== 'smith-waterman');
    }
    if (args.referenceSource !== undefined) ['file', 'first', 'consensus'].forEach(s => settings.set('reference-source-' + s, s === args.referenceSource));
    if (args.referenceSequence !== undefined) {
      const seq = String(args.referenceSequence).replace(/\s+/g, '').toUpperCase();
      if (!/^[ACGTURYMKWSBDHVN-]+$/.test(seq)) fail('referenceSequence must be nucleotides (ACGT and ambiguity codes)');
      self.MT.session.setReference(seq);
    }
    if (args.distanceMetricsAlso !== undefined) {
      const also = unique(args.distanceMetricsAlso.filter(m => m !== metric));
      settings.set('distance-metrics-also', also);
      self.db.setItem('distance-metrics-also', also);
    }
    if (args.aligner) {
      if (view) view.aligner(args.aligner);
      else fail('The alignment scores are set in the Files view; call add_file (which opens it) first, then set aligner');
    }
    if (view) view.refresh();
    return readOptions();
  }
};
