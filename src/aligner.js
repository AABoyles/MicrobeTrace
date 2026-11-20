(function(self){
  'use strict';

  // MTAlignerScoring: the scores the Smith-Waterman aligner (bioseq.align, run
  // in workers/align-sw.js) is given, built from the four "costs" on the files
  // page, and the band. The preview, the consensus and the real run all build
  // them here, so they align the same way.
  //
  // bioseq takes a positive match score and a negative mismatch score (it
  // negates a positive mismatch), and since 0.2 ignores the signs of the gap
  // penalties (its default is gap [1, 1]). So the signs below are convention
  // rather than a requirement; the match score is the one it uses as given.
  // The inputs are costs, so a negative one is read as its magnitude.
  //
  // The band limits how far from the diagonal the aligner looks: how many
  // bases a gap may shift a sequence beyond the difference in the two
  // lengths (bioseq widens it to that difference itself). A narrow band is
  // much faster but can't place indels that shift a sequence further, so 0,
  // the default on the files page, is the fastest and the least forgiving.
  // No band (blank, or not a number) compares every pair of positions.
  function MTAlignerScoring({ match, mismatch, gapOpen, gapExtend, band }) {
    return {
      match: [Math.abs(match), -Math.abs(mismatch)],
      gap: [-Math.abs(gapOpen), -Math.abs(gapExtend)],
      band: Number.isFinite(band) ? Math.floor(Math.abs(band)) : null
    };
  }

  self.MTAlignerScoring = MTAlignerScoring;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTAlignerScoring;
})(typeof self !== 'undefined' ? self : this);
