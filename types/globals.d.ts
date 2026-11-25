// Library globals that the bundles (dist/, vendor/) set on `self`. The type-checked modules
// (those starting with // @ts-check) use them without importing; none is typed beyond `any`,
// since the libraries ship no declarations the app loads (#346).
declare const Papa: any;
declare const XLSX: any;
declare const patristic: any;
declare const d3: any;
