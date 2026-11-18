// Stands in for Node's "buffer" when bundling Plotly's scattergl for the
// browser: typedarray-pool only asks it whether something is a Buffer, and
// nothing in a browser is.
module.exports = { Buffer: { isBuffer: () => false } };
