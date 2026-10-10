let wasm_bindgen = (function(exports) {
    let script_src;
    if (typeof document !== 'undefined' && document.currentScript !== null) {
        script_src = new URL(document.currentScript.src, location.href).toString();
    }

    /**
     * Pairs within a distance threshold, as parallel arrays: `source[k] < target[k]` are sequence
     * indices and `distance[k]` their distance. Each getter returns a fresh copy; read it once.
     */
    class Links {
        static __wrap(ptr) {
            ptr = ptr >>> 0;
            const obj = Object.create(Links.prototype);
            obj.__wbg_ptr = ptr;
            LinksFinalization.register(obj, obj.__wbg_ptr, obj);
            return obj;
        }
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            LinksFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_links_free(ptr, 0);
        }
        /**
         * @returns {Float64Array}
         */
        get distance() {
            const ret = wasm.links_distance(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {number}
         */
        get length() {
            const ret = wasm.links_length(this.__wbg_ptr);
            return ret >>> 0;
        }
        /**
         * @returns {Uint32Array}
         */
        get source() {
            const ret = wasm.links_source(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {Uint32Array}
         */
        get target() {
            const ret = wasm.links_target(this.__wbg_ptr);
            return ret;
        }
    }
    if (Symbol.dispose) Links.prototype[Symbol.dispose] = Links.prototype.free;
    exports.Links = Links;

    /**
     * A set of aligned nucleotide sequences, encoded once for fast pairwise comparison.
     *
     * Pairs are ordered like the upper triangle of the distance matrix, row by row:
     * (0,1), (0,2), …, (0,n-1), (1,2), …. Every method can be limited to a range of rows, so the
     * work can be split into chunks (progress, cancellation) or across Web Workers.
     */
    class SequenceSet {
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            SequenceSetFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_sequenceset_free(ptr, 0);
        }
        /**
         * Number of sequences that contain ambiguity codes and use the fallback kernel
         * (always 0 in `"skip"` mode).
         * @returns {number}
         */
        ambiguous_count() {
            const ret = wasm.sequenceset_ambiguous_count(this.__wbg_ptr);
            return ret >>> 0;
        }
        /**
         * Distance between sequences `i` and `j`.
         * @param {string} metric
         * @param {number} i
         * @param {number} j
         * @returns {number}
         */
        distance(metric, i, j) {
            const ptr0 = passStringToWasm0(metric, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.sequenceset_distance(this.__wbg_ptr, ptr0, len0, i, j);
            if (ret[2]) {
                throw takeFromExternrefTable0(ret[1]);
            }
            return ret[0];
        }
        /**
         * Dense upper-triangle distances for rows `[row_start, row_end)` (default: all rows),
         * in pair order. Concatenating the results for consecutive row ranges gives the full
         * triangle; `get_distance_index(i, j, n)` maps a pair to its position in it.
         * @param {string} metric
         * @param {number | null} [row_start]
         * @param {number | null} [row_end]
         * @returns {Float64Array}
         */
        distances(metric, row_start, row_end) {
            const ptr0 = passStringToWasm0(metric, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.sequenceset_distances(this.__wbg_ptr, ptr0, len0, isLikeNone(row_start) ? 0x100000001 : (row_start) >>> 0, isLikeNone(row_end) ? 0x100000001 : (row_end) >>> 0);
            if (ret[2]) {
                throw takeFromExternrefTable0(ret[1]);
            }
            return takeFromExternrefTable0(ret[0]);
        }
        /**
         * Number of sequences.
         * @returns {number}
         */
        get length() {
            const ret = wasm.sequenceset_length(this.__wbg_ptr);
            return ret >>> 0;
        }
        /**
         * Pairs in rows `[row_start, row_end)` whose distance is `<= threshold`.
         *
         * For `snps`, `hamming`, `p_distance`, `jc69`, `k2p` and `tn93`, a pair stops being scanned
         * as soon as it can no longer pass, which makes sparse output much faster than
         * `distances()` when most pairs are far apart.
         * @param {string} metric
         * @param {number} threshold
         * @param {number | null} [row_start]
         * @param {number | null} [row_end]
         * @returns {Links}
         */
        links(metric, threshold, row_start, row_end) {
            const ptr0 = passStringToWasm0(metric, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.sequenceset_links(this.__wbg_ptr, ptr0, len0, threshold, isLikeNone(row_start) ? 0x100000001 : (row_start) >>> 0, isLikeNone(row_end) ? 0x100000001 : (row_end) >>> 0);
            if (ret[2]) {
                throw takeFromExternrefTable0(ret[1]);
            }
            return Links.__wrap(ret[0]);
        }
        /**
         * Encodes `seqs` once. `ambiguity` decides how sites holding IUPAC ambiguity codes
         * (R, Y, S, W, K, M, B, D, H, V) are compared:
         * - `"skip"` (default): ignore them. Every pair uses the fast bit-plane kernel.
         * - `"resolve"`: count a site as a match if the two codes share a base, otherwise average.
         * - `"average"`: average over every pair of bases the two codes allow.
         *
         * With `"resolve"` or `"average"`, only pairs involving a sequence that actually contains
         * ambiguity codes pay for the slower fallback. `N`, gaps and other characters are always
         * skipped.
         * @param {string[]} seqs
         * @param {string | null} [ambiguity]
         */
        constructor(seqs, ambiguity) {
            const ptr0 = passArrayJsValueToWasm0(seqs, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            var ptr1 = isLikeNone(ambiguity) ? 0 : passStringToWasm0(ambiguity, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            const ret = wasm.sequenceset_new(ptr0, len0, ptr1, len1);
            if (ret[2]) {
                throw takeFromExternrefTable0(ret[1]);
            }
            this.__wbg_ptr = ret[0] >>> 0;
            SequenceSetFinalization.register(this, this.__wbg_ptr, this);
            return this;
        }
        /**
         * `parts + 1` row boundaries that split the pairs into `parts` chunks of nearly equal
         * size: chunk `k` covers rows `[splits[k], splits[k + 1])`.
         * @param {number} parts
         * @returns {Uint32Array}
         */
        row_splits(parts) {
            const ret = wasm.sequenceset_row_splits(this.__wbg_ptr, parts);
            return ret;
        }
    }
    if (Symbol.dispose) SequenceSet.prototype[Symbol.dispose] = SequenceSet.prototype.free;
    exports.SequenceSet = SequenceSet;

    /**
     * Compute all pairwise distances for a list of sequences.
     * Takes an array of {id: string, seq: string} objects and returns
     * an array of {source: string, target: string, distance: number} objects.
     *
     * Creating one JS object per pair costs far more than the distance itself;
     * `SequenceSet.distances()` or `SequenceSet.links()` avoid it.
     * @param {Array<any>} nodes
     * @param {string} metric
     * @returns {Array<any>}
     */
    function compute_pairwise_distances(nodes, metric) {
        const ptr0 = passStringToWasm0(metric, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.compute_pairwise_distances(nodes, ptr0, len0);
        return ret;
    }
    exports.compute_pairwise_distances = compute_pairwise_distances;

    /**
     * Compute pairwise distances using flat arrays for maximum performance.
     * Takes:
     * - _ids: Array of node ID strings (unused, provided for consistency)
     * - seqs: Array of sequence strings
     * - metric: any metric name accepted by `SequenceSet` (unknown names use "hamming")
     *
     * Returns a Float64Array with distances in row-major upper triangular order.
     * For n nodes, returns n*(n-1)/2 distances.
     * @param {Array<any>} _ids
     * @param {Array<any>} seqs
     * @param {string} metric
     * @returns {Float64Array}
     */
    function compute_pairwise_distances_flat(_ids, seqs, metric) {
        const ptr0 = passStringToWasm0(metric, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.compute_pairwise_distances_flat(_ids, seqs, ptr0, len0);
        return ret;
    }
    exports.compute_pairwise_distances_flat = compute_pairwise_distances_flat;

    /**
     * Compute all pairwise distances (hamming, tn93, and snps) using flat arrays.
     * Takes:
     * - _ids: Array of node ID strings (unused, provided for consistency)
     * - seqs: Array of sequence strings
     *
     * Returns three Float64Arrays in sequence:
     * - hammingDistances[0..num_pairs)
     * - tn93Distances[num_pairs..2*num_pairs)
     * - snpsDistances[2*num_pairs..3*num_pairs)
     *
     * Each pair is scanned once for all three metrics.
     * @param {Array<any>} _ids
     * @param {Array<any>} seqs
     * @returns {Float64Array}
     */
    function compute_pairwise_distances_flat_all(_ids, seqs) {
        const ret = wasm.compute_pairwise_distances_flat_all(_ids, seqs);
        return ret;
    }
    exports.compute_pairwise_distances_flat_all = compute_pairwise_distances_flat_all;

    /**
     * Get the index into the flat distance array for a given (i, j) pair.
     * Assumes i < j and n is the total number of nodes.
     * @param {number} i
     * @param {number} j
     * @param {number} n
     * @returns {number}
     */
    function get_distance_index(i, j, n) {
        const ret = wasm.get_distance_index(i, j, n);
        return ret >>> 0;
    }
    exports.get_distance_index = get_distance_index;

    /**
     * Compute Hamming distance between two aligned sequences.
     * Returns the proportion of differing positions (0 to 1) among compared sites,
     * or 1.0 if there are none.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function hamming_distance(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.hamming_distance(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.hamming_distance = hamming_distance;

    /**
     * Initialize panic hook for better error messages in browser console
     */
    function init() {
        wasm.init();
    }
    exports.init = init;

    /**
     * Compute Jukes-Cantor (JC69) distance between two aligned sequences.
     * A simple evolutionary model assuming all substitutions are equally likely.
     * This is a basic but fundamental model used in phylogenetics.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function jc69_distance(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.jc69_distance(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.jc69_distance = jc69_distance;

    /**
     * Compute Kimura 2-Parameter (K2P) distance between two aligned sequences.
     * Accounts for different rates of transitions and transversions.
     * Simpler than TN93 but more accurate than Hamming or JC69.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function k2p_distance(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.k2p_distance(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.k2p_distance = k2p_distance;

    /**
     * Compute p-distance (simple proportion of differences).
     * Identical to `hamming_distance`: both compare only sites where both sequences hold a base.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function p_distance(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.hamming_distance(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.p_distance = p_distance;

    /**
     * Count the number of nucleotide mismatches (SNPs) between two aligned sequences.
     * Only sites where both sequences hold A, C, G or T (any case, U = T) are compared.
     * Returns the absolute count of differences.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function snps_distance(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.snps_distance(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.snps_distance = snps_distance;

    /**
     * Compute Tajima-Nei 92 (TN92) distance between two aligned sequences.
     * Similar to TN93 but with a slightly different parameterization.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function tn92_distance(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.tn92_distance(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.tn92_distance = tn92_distance;

    /**
     * Compute Tamura-Nei 93 (TN93) distance between two aligned sequences.
     * This is a more sophisticated nucleotide substitution model that accounts
     * for different rates of transitions and transversions.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function tn93_distance(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.tn93_distance(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.tn93_distance = tn93_distance;

    /**
     * Count the number of transitions between two aligned sequences.
     * Transitions are purine-to-purine (A<->G) or pyrimidine-to-pyrimidine (C<->T) changes.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function transitions_count(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.transitions_count(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.transitions_count = transitions_count;

    /**
     * Count the number of transversions between two aligned sequences.
     * Transversions are purine-to-pyrimidine or pyrimidine-to-purine changes.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function transversions_count(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.transversions_count(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.transversions_count = transversions_count;

    /**
     * Compute the transition/transversion ratio (Ts/Tv) for two sequences.
     * Returns the ratio of transitions to transversions; 0 if there are neither,
     * infinity if there are transitions but no transversions.
     * @param {string} seq1
     * @param {string} seq2
     * @returns {number}
     */
    function ts_tv_ratio(seq1, seq2) {
        const ptr0 = passStringToWasm0(seq1, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(seq2, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.ts_tv_ratio(ptr0, len0, ptr1, len1);
        return ret;
    }
    exports.ts_tv_ratio = ts_tv_ratio;

    function __wbg_get_imports() {
        const import0 = {
            __proto__: null,
            __wbg_Error_8c4e43fe74559d73: function(arg0, arg1) {
                const ret = Error(getStringFromWasm0(arg0, arg1));
                return ret;
            },
            __wbg___wbindgen_is_string_cd444516edc5b180: function(arg0) {
                const ret = typeof(arg0) === 'string';
                return ret;
            },
            __wbg___wbindgen_string_get_72fb696202c56729: function(arg0, arg1) {
                const obj = arg1;
                const ret = typeof(obj) === 'string' ? obj : undefined;
                var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
                var len1 = WASM_VECTOR_LEN;
                getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
                getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
            },
            __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
                throw new Error(getStringFromWasm0(arg0, arg1));
            },
            __wbg_error_7534b8e9a36f1ab4: function(arg0, arg1) {
                let deferred0_0;
                let deferred0_1;
                try {
                    deferred0_0 = arg0;
                    deferred0_1 = arg1;
                    console.error(getStringFromWasm0(arg0, arg1));
                } finally {
                    wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
                }
            },
            __wbg_get_9b94d73e6221f75c: function(arg0, arg1) {
                const ret = arg0[arg1 >>> 0];
                return ret;
            },
            __wbg_get_b3ed3ad4be2bc8ac: function() { return handleError(function (arg0, arg1) {
                const ret = Reflect.get(arg0, arg1);
                return ret;
            }, arguments); },
            __wbg_length_35a7bace40f36eac: function(arg0) {
                const ret = arg0.length;
                return ret;
            },
            __wbg_length_f7386240689107f3: function(arg0) {
                const ret = arg0.length;
                return ret;
            },
            __wbg_new_361308b2356cecd0: function() {
                const ret = new Object();
                return ret;
            },
            __wbg_new_3eb36ae241fe6f44: function() {
                const ret = new Array();
                return ret;
            },
            __wbg_new_8a6f238a6ece86ea: function() {
                const ret = new Error();
                return ret;
            },
            __wbg_new_from_slice_19d21922ff3c0ae6: function(arg0, arg1) {
                const ret = new Uint32Array(getArrayU32FromWasm0(arg0, arg1));
                return ret;
            },
            __wbg_new_from_slice_38c66b2d6c31f4b7: function(arg0, arg1) {
                const ret = new Float64Array(getArrayF64FromWasm0(arg0, arg1));
                return ret;
            },
            __wbg_new_with_length_6523745c0bd32809: function(arg0) {
                const ret = new Float64Array(arg0 >>> 0);
                return ret;
            },
            __wbg_push_8ffdcb2063340ba5: function(arg0, arg1) {
                const ret = arg0.push(arg1);
                return ret;
            },
            __wbg_set_6cb8631f80447a67: function() { return handleError(function (arg0, arg1, arg2) {
                const ret = Reflect.set(arg0, arg1, arg2);
                return ret;
            }, arguments); },
            __wbg_set_a7e6b10165583fc4: function(arg0, arg1, arg2) {
                arg0.set(getArrayF64FromWasm0(arg1, arg2));
            },
            __wbg_stack_0ed75d68575b0f3c: function(arg0, arg1) {
                const ret = arg1.stack;
                const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
                const len1 = WASM_VECTOR_LEN;
                getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
                getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
            },
            __wbg_subarray_62280e6422a4aa0d: function(arg0, arg1, arg2) {
                const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
                return ret;
            },
            __wbindgen_cast_0000000000000001: function(arg0) {
                // Cast intrinsic for `F64 -> Externref`.
                const ret = arg0;
                return ret;
            },
            __wbindgen_cast_0000000000000002: function(arg0, arg1) {
                // Cast intrinsic for `Ref(String) -> Externref`.
                const ret = getStringFromWasm0(arg0, arg1);
                return ret;
            },
            __wbindgen_init_externref_table: function() {
                const table = wasm.__wbindgen_externrefs;
                const offset = table.grow(4);
                table.set(0, undefined);
                table.set(offset + 0, undefined);
                table.set(offset + 1, null);
                table.set(offset + 2, true);
                table.set(offset + 3, false);
            },
        };
        return {
            __proto__: null,
            "./bx_distance_models_bg.js": import0,
        };
    }

    const LinksFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_links_free(ptr >>> 0, 1));
    const SequenceSetFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_sequenceset_free(ptr >>> 0, 1));

    function addToExternrefTable0(obj) {
        const idx = wasm.__externref_table_alloc();
        wasm.__wbindgen_externrefs.set(idx, obj);
        return idx;
    }

    function getArrayF64FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
    }

    function getArrayU32FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
    }

    let cachedDataViewMemory0 = null;
    function getDataViewMemory0() {
        if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
            cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
        }
        return cachedDataViewMemory0;
    }

    let cachedFloat64ArrayMemory0 = null;
    function getFloat64ArrayMemory0() {
        if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
            cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
        }
        return cachedFloat64ArrayMemory0;
    }

    function getStringFromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return decodeText(ptr, len);
    }

    let cachedUint32ArrayMemory0 = null;
    function getUint32ArrayMemory0() {
        if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
            cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
        }
        return cachedUint32ArrayMemory0;
    }

    let cachedUint8ArrayMemory0 = null;
    function getUint8ArrayMemory0() {
        if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
            cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8ArrayMemory0;
    }

    function handleError(f, args) {
        try {
            return f.apply(this, args);
        } catch (e) {
            const idx = addToExternrefTable0(e);
            wasm.__wbindgen_exn_store(idx);
        }
    }

    function isLikeNone(x) {
        return x === undefined || x === null;
    }

    function passArrayJsValueToWasm0(array, malloc) {
        const ptr = malloc(array.length * 4, 4) >>> 0;
        for (let i = 0; i < array.length; i++) {
            const add = addToExternrefTable0(array[i]);
            getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
        }
        WASM_VECTOR_LEN = array.length;
        return ptr;
    }

    function passStringToWasm0(arg, malloc, realloc) {
        if (realloc === undefined) {
            const buf = cachedTextEncoder.encode(arg);
            const ptr = malloc(buf.length, 1) >>> 0;
            getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
            WASM_VECTOR_LEN = buf.length;
            return ptr;
        }

        let len = arg.length;
        let ptr = malloc(len, 1) >>> 0;

        const mem = getUint8ArrayMemory0();

        let offset = 0;

        for (; offset < len; offset++) {
            const code = arg.charCodeAt(offset);
            if (code > 0x7F) break;
            mem[ptr + offset] = code;
        }
        if (offset !== len) {
            if (offset !== 0) {
                arg = arg.slice(offset);
            }
            ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
            const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
            const ret = cachedTextEncoder.encodeInto(arg, view);

            offset += ret.written;
            ptr = realloc(ptr, len, offset, 1) >>> 0;
        }

        WASM_VECTOR_LEN = offset;
        return ptr;
    }

    function takeFromExternrefTable0(idx) {
        const value = wasm.__wbindgen_externrefs.get(idx);
        wasm.__externref_table_dealloc(idx);
        return value;
    }

    let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    function decodeText(ptr, len) {
        return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
    }

    const cachedTextEncoder = new TextEncoder();

    if (!('encodeInto' in cachedTextEncoder)) {
        cachedTextEncoder.encodeInto = function (arg, view) {
            const buf = cachedTextEncoder.encode(arg);
            view.set(buf);
            return {
                read: arg.length,
                written: buf.length
            };
        };
    }

    let WASM_VECTOR_LEN = 0;

    let wasmModule, wasm;
    function __wbg_finalize_init(instance, module) {
        wasm = instance.exports;
        wasmModule = module;
        cachedDataViewMemory0 = null;
        cachedFloat64ArrayMemory0 = null;
        cachedUint32ArrayMemory0 = null;
        cachedUint8ArrayMemory0 = null;
        wasm.__wbindgen_start();
        return wasm;
    }

    async function __wbg_load(module, imports) {
        if (typeof Response === 'function' && module instanceof Response) {
            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    return await WebAssembly.instantiateStreaming(module, imports);
                } catch (e) {
                    const validResponse = module.ok && expectedResponseType(module.type);

                    if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                        console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                    } else { throw e; }
                }
            }

            const bytes = await module.arrayBuffer();
            return await WebAssembly.instantiate(bytes, imports);
        } else {
            const instance = await WebAssembly.instantiate(module, imports);

            if (instance instanceof WebAssembly.Instance) {
                return { instance, module };
            } else {
                return instance;
            }
        }

        function expectedResponseType(type) {
            switch (type) {
                case 'basic': case 'cors': case 'default': return true;
            }
            return false;
        }
    }

    function initSync(module) {
        if (wasm !== undefined) return wasm;


        if (module !== undefined) {
            if (Object.getPrototypeOf(module) === Object.prototype) {
                ({module} = module)
            } else {
                console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
            }
        }

        const imports = __wbg_get_imports();
        if (!(module instanceof WebAssembly.Module)) {
            module = new WebAssembly.Module(module);
        }
        const instance = new WebAssembly.Instance(module, imports);
        return __wbg_finalize_init(instance, module);
    }

    async function __wbg_init(module_or_path) {
        if (wasm !== undefined) return wasm;


        if (module_or_path !== undefined) {
            if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
                ({module_or_path} = module_or_path)
            } else {
                console.warn('using deprecated parameters for the initialization function; pass a single object instead')
            }
        }

        if (module_or_path === undefined && script_src !== undefined) {
            module_or_path = script_src.replace(/\.js$/, "_bg.wasm");
        }
        const imports = __wbg_get_imports();

        if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
            module_or_path = fetch(module_or_path);
        }

        const { instance, module } = await __wbg_load(await module_or_path, imports);

        return __wbg_finalize_init(instance, module);
    }

    return Object.assign(__wbg_init, { initSync }, exports);
})({ __proto__: null });
