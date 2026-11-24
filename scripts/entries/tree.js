// TidyTree, loaded when the phylogenetic tree view first opens (#324). It also
// brings the `patristic` global, which reading and building a tree needs.
import TidyTree from 'tidytree/src/main.ts';

globalThis.TidyTree = TidyTree;
