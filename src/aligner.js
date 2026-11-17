(function(self){
  'use strict';

  // MTAlignerScoring: the scores the Smith-Waterman aligner (bioseq.align, run
  // in workers/align-sw.js) is given, built from the four "costs" on the files
  // page. The preview and the real run both build them here, so they align the
  // same way.
  //
  // bioseq's own convention (its defaults are match [1, -1], gap [-1, -1]) is a
  // positive match score and negative mismatch and gap scores. It also takes
  // the magnitude of the gap scores and negates a positive mismatch, so the
  // signs below are its convention rather than a requirement; the match score
  // is the one it uses as given. The inputs are costs, so a negative one is
  // read as its magnitude.
  function MTAlignerScoring({ match, mismatch, gapOpen, gapExtend }) {
    return {
      match: [Math.abs(match), -Math.abs(mismatch)],
      gap: [-Math.abs(gapOpen), -Math.abs(gapExtend)]
    };
  }

  self.MTAlignerScoring = MTAlignerScoring;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTAlignerScoring;
})(typeof self !== 'undefined' ? self : this);
