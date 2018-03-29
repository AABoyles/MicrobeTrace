"use strict";

!function(a,b){if("function"==typeof define&&define.amd)define("timsort",["exports"],b);else if("undefined"!=typeof exports)b(exports);else{var c={exports:{}};b(c.exports),a.timsort=c.exports}}(this,function(a){"use strict";function b(a,b){if(!(a instanceof b))throw new TypeError("Cannot call a class as a function")}function c(a,b){if(a===b)return 0;var c=String(a),d=String(b);return c===d?0:d>c?-1:1}function d(a){for(var b=0;a>=k;)b|=1&a,a>>=1;return a+b}function e(a,b,c,d){var e=b+1;if(e===c)return 1;if(d(a[e++],a[b])<0){for(;c>e&&d(a[e],a[e-1])<0;)e++;f(a,b,e)}else for(;c>e&&d(a[e],a[e-1])>=0;)e++;return e-b}function f(a,b,c){for(c--;c>b;){var d=a[b];a[b++]=a[c],a[c--]=d}}function g(a,b,c,d,e){for(d===b&&d++;c>d;d++){for(var f=a[d],g=b,h=d;h>g;){var i=g+h>>>1;e(f,a[i])<0?h=i:g=i+1}var j=d-g;switch(j){case 3:a[g+3]=a[g+2];case 2:a[g+2]=a[g+1];case 1:a[g+1]=a[g];break;default:for(;j>0;)a[g+j]=a[g+j-1],j--}a[g]=f}}function h(a,b,c,d,e,f){var g=0,h=0,i=1;if(f(a,b[c+e])>0){for(h=d-e;h>i&&f(a,b[c+e+i])>0;)g=i,i=(i<<1)+1,0>=i&&(i=h);i>h&&(i=h),g+=e,i+=e}else{for(h=e+1;h>i&&f(a,b[c+e-i])<=0;)g=i,i=(i<<1)+1,0>=i&&(i=h);i>h&&(i=h);var j=g;g=e-i,i=e-j}for(g++;i>g;){var k=g+(i-g>>>1);f(a,b[c+k])>0?g=k+1:i=k}return i}function i(a,b,c,d,e,f){var g=0,h=0,i=1;if(f(a,b[c+e])<0){for(h=e+1;h>i&&f(a,b[c+e-i])<0;)g=i,i=(i<<1)+1,0>=i&&(i=h);i>h&&(i=h);var j=g;g=e-i,i=e-j}else{for(h=d-e;h>i&&f(a,b[c+e+i])>=0;)g=i,i=(i<<1)+1,0>=i&&(i=h);i>h&&(i=h),g+=e,i+=e}for(g++;i>g;){var k=g+(i-g>>>1);f(a,b[c+k])<0?i=k:g=k+1}return i}function j(a,b,f,h){if(!Array.isArray(a))throw new TypeError("Can only sort arrays");b?"function"!=typeof b&&(h=f,f=b,b=c):b=c,f||(f=0),h||(h=a.length);var i=h-f;if(!(2>i)){var j=0;if(k>i)return j=e(a,f,h,b),void g(a,f,h,f+j,b);var l=new n(a,b),m=d(i);do{if(j=e(a,f,h,b),m>j){var o=i;o>m&&(o=m),g(a,f,f+o,f+j,b),j=o}l.pushRun(f,j),l.mergeRuns(),i-=j,f+=j}while(0!==i);l.forceMergeRuns()}}a.__esModule=!0,a.sort=j;var k=32,l=7,m=256,n=function(){function a(c,d){b(this,a),this.array=null,this.compare=null,this.minGallop=l,this.length=0,this.tmpStorageLength=m,this.stackLength=0,this.runStart=null,this.runLength=null,this.stackSize=0,this.array=c,this.compare=d,this.length=c.length,this.length<2*m&&(this.tmpStorageLength=this.length>>>1),this.tmp=new Array(this.tmpStorageLength),this.stackLength=this.length<120?5:this.length<1542?10:this.length<119151?19:40,this.runStart=new Array(this.stackLength),this.runLength=new Array(this.stackLength)}return a.prototype.pushRun=function(a,b){this.runStart[this.stackSize]=a,this.runLength[this.stackSize]=b,this.stackSize+=1},a.prototype.mergeRuns=function(){for(;this.stackSize>1;){var a=this.stackSize-2;if(a>=1&&this.runLength[a-1]<=this.runLength[a]+this.runLength[a+1]||a>=2&&this.runLength[a-2]<=this.runLength[a]+this.runLength[a-1])this.runLength[a-1]<this.runLength[a+1]&&a--;else if(this.runLength[a]>this.runLength[a+1])break;this.mergeAt(a)}},a.prototype.forceMergeRuns=function(){for(;this.stackSize>1;){var a=this.stackSize-2;a>0&&this.runLength[a-1]<this.runLength[a+1]&&a--,this.mergeAt(a)}},a.prototype.mergeAt=function(a){var b=this.compare,c=this.array,d=this.runStart[a],e=this.runLength[a],f=this.runStart[a+1],g=this.runLength[a+1];this.runLength[a]=e+g,a===this.stackSize-3&&(this.runStart[a+1]=this.runStart[a+2],this.runLength[a+1]=this.runLength[a+2]),this.stackSize--;var j=i(c[f],c,d,e,0,b);d+=j,e-=j,0!==e&&(g=h(c[d+e-1],c,f,g,g-1,b),0!==g&&(g>=e?this.mergeLow(d,e,f,g):this.mergeHigh(d,e,f,g)))},a.prototype.mergeLow=function(a,b,c,d){var e=this.compare,f=this.array,g=this.tmp,j=0;for(j=0;b>j;j++)g[j]=f[a+j];var k=0,m=c,n=a;if(f[n++]=f[m++],0!==--d){if(1===b){for(j=0;d>j;j++)f[n+j]=f[m+j];return void(f[n+d]=g[k])}for(var o=this.minGallop;;){var p=0,q=0,r=!1;do if(e(f[m],g[k])<0){if(f[n++]=f[m++],q++,p=0,0===--d){r=!0;break}}else if(f[n++]=g[k++],p++,q=0,1===--b){r=!0;break}while(o>(p|q));if(r)break;do{if(p=i(f[m],g,k,b,0,e),0!==p){for(j=0;p>j;j++)f[n+j]=g[k+j];if(n+=p,k+=p,b-=p,1>=b){r=!0;break}}if(f[n++]=f[m++],0===--d){r=!0;break}if(q=h(g[k],f,m,d,0,e),0!==q){for(j=0;q>j;j++)f[n+j]=f[m+j];if(n+=q,m+=q,d-=q,0===d){r=!0;break}}if(f[n++]=g[k++],1===--b){r=!0;break}o--}while(p>=l||q>=l);if(r)break;0>o&&(o=0),o+=2}if(this.minGallop=o,1>o&&(this.minGallop=1),1===b){for(j=0;d>j;j++)f[n+j]=f[m+j];f[n+d]=g[k]}else{if(0===b)throw new Error("mergeLow preconditions were not respected");for(j=0;b>j;j++)f[n+j]=g[k+j]}}else for(j=0;b>j;j++)f[n+j]=g[k+j]},a.prototype.mergeHigh=function(a,b,c,d){var e=this.compare,f=this.array,g=this.tmp,j=0;for(j=0;d>j;j++)g[j]=f[c+j];var k=a+b-1,m=d-1,n=c+d-1,o=0,p=0;if(f[n--]=f[k--],0!==--b){if(1===d){for(n-=b,k-=b,p=n+1,o=k+1,j=b-1;j>=0;j--)f[p+j]=f[o+j];return void(f[n]=g[m])}for(var q=this.minGallop;;){var r=0,s=0,t=!1;do if(e(g[m],f[k])<0){if(f[n--]=f[k--],r++,s=0,0===--b){t=!0;break}}else if(f[n--]=g[m--],s++,r=0,1===--d){t=!0;break}while(q>(r|s));if(t)break;do{if(r=b-i(g[m],f,a,b,b-1,e),0!==r){for(n-=r,k-=r,b-=r,p=n+1,o=k+1,j=r-1;j>=0;j--)f[p+j]=f[o+j];if(0===b){t=!0;break}}if(f[n--]=g[m--],1===--d){t=!0;break}if(s=d-h(f[k],g,0,d,d-1,e),0!==s){for(n-=s,m-=s,d-=s,p=n+1,o=m+1,j=0;s>j;j++)f[p+j]=g[o+j];if(1>=d){t=!0;break}}if(f[n--]=f[k--],0===--b){t=!0;break}q--}while(r>=l||s>=l);if(t)break;0>q&&(q=0),q+=2}if(this.minGallop=q,1>q&&(this.minGallop=1),1===d){for(n-=b,k-=b,p=n+1,o=k+1,j=b-1;j>=0;j--)f[p+j]=f[o+j];f[n]=g[m]}else{if(0===d)throw new Error("mergeHigh preconditions were not respected");for(o=n-(d-1),j=0;d>j;j++)f[o+j]=g[j]}}else for(o=n-(d-1),j=0;d>j;j++)f[o+j]=g[j]},a}()});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function allocateSquareMatrix(n) {
    var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    var a = new Array(n);
    for (var i = 0; i < n; i++) {
        a[i] = new Array(n);
        if (value !== null) a[i].fill(value);
    }
    return a;
}

function arrayCopy(a) {
    var b = new Array(a.length),
        i = a.length;
    while (i--) {
        b[i] = a[i];
    }
    return b;
}

function sumRows(a) {
    var sum = void 0,
        n = a.length,
        sums = new Array(n);

    for (var i = 0; i < n; i++) {
        sum = 0;
        for (var j = 0; j < n; j++) {
            if (a[i][j] === undefined) continue;
            sum += a[i][j];
        }
        sums[i] = sum;
    }

    return sums;
}

function sortWithIndices(toSort) {
    var skip = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;

    var n = toSort.length;
    var indexCopy = new Array(n);
    var valueCopy = new Array(n);
    var i2 = 0;

    for (var i = 0; i < n; i++) {
        if (toSort[i] === -1 || i === skip) continue;
        indexCopy[i2] = i;
        valueCopy[i2++] = toSort[i];
    }
    indexCopy.length = i2;
    valueCopy.length = i2;

    if (arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false) {
        timsort.sort(indexCopy, function (a, b) {
            return toSort[a] - toSort[b];
        });
    } else {
        indexCopy.sort(function (a, b) {
            return toSort[a] - toSort[b];
        });
    }

    timsort.sort(indexCopy, function (left, right) {
        return toSort[left] - toSort[right];
    });

    valueCopy.sortIndices = indexCopy;
    for (var j = 0; j < i2; j++) {
        valueCopy[j] = toSort[indexCopy[j]];
    }
    return valueCopy;
}

var RapidNeighborJoining = function () {
    /* phylogenetic tree as object */
    /* set of removed indices from D */
    /* taxa array */
    /* number of taxa */
    /* sorted distance matrix */
    function RapidNeighborJoining(D, taxa) {
        var copyDistanceMatrix = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        var taxonIdAccessor = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : function (d) {
            return d.name;
        };

        _classCallCheck(this, RapidNeighborJoining);

        if (taxa.length != D.length) {
            console.error("Row/column size of the distance matrix does not agree with the size of taxa matrix");
            return;
        }
        var N = this.N = taxa.length;
        this.cN = this.N;
        if (copyDistanceMatrix) {
            this.D = new Array(N);
            for (var i = 0; i < N; i++) {
                this.D[i] = arrayCopy(D[i]);
            }
        } else {
            this.D = D;
        }
        this.taxa = taxa;
        this.labelToTaxon = {};
        this.currIndexToLabel = new Array(N);
        this.rowChange = new Array(N);
        this.newRow = new Array(N);
        this.labelToNode = new Array(2 * N);
        this.nextIndex = N;
        this.initializeSI();
        this.removedIndices = new Set();
        this.indicesLeft = new Set();
        for (var _i = 0; _i < N; _i++) {
            this.currIndexToLabel[_i] = _i;
            this.indicesLeft.add(_i);
        }
        this.rowSumMax = 0;
        this.PNewick = "";
        this.taxonIdAccessor = taxonIdAccessor;
        return this;
    } /* phylogenetic tree in Newick format */
    /* set of yet not processed indices */
    /* number of taxa left */
    /* index map from S to D */
    /* distance matrix */


    _createClass(RapidNeighborJoining, [{
        key: "initializeSI",
        value: function initializeSI() {
            var N = this.N;

            this.I = new Array(N);
            this.S = new Array(N);

            for (var i = 0; i < N; i++) {
                var sortedRow = sortWithIndices(this.D[i], i, true);
                this.S[i] = sortedRow;
                this.I[i] = sortedRow.sortIndices;
            }
        }
    }, {
        key: "search",
        value: function search() {

            var qMin = Infinity,
                D = this.D,
                cN = this.cN,
                n2 = cN - 2,
                S = this.S,
                I = this.I,
                rowSums = this.rowSums,
                removedColumns = this.removedIndices,
                uMax = this.rowSumMax,
                q = void 0,
                minI = -1,
                minJ = -1,
                c2 = void 0;

            // initial guess for qMin
            for (var r = 0; r < this.N; r++) {
                if (removedColumns.has(r)) continue;
                c2 = I[r][0];
                if (removedColumns.has(c2)) continue;
                q = D[r][c2] * n2 - rowSums[r] - rowSums[c2];
                if (q < qMin) {
                    qMin = q;
                    minI = r;
                    minJ = c2;
                }
            }

            for (var _r = 0; _r < this.N; _r++) {
                if (removedColumns.has(_r)) continue;
                for (var c = 0; c < S[_r].length; c++) {
                    c2 = I[_r][c];
                    if (removedColumns.has(c2)) continue;
                    if (S[_r][c] * n2 - rowSums[_r] - uMax > qMin) break;
                    q = D[_r][c2] * n2 - rowSums[_r] - rowSums[c2];
                    if (q < qMin) {
                        qMin = q;
                        minI = _r;
                        minJ = c2;
                    }
                }
            }

            return { minI: minI, minJ: minJ };
        }
    }, {
        key: "run",
        value: function run() {
            var minI = void 0,
                minJ = void 0,
                d1 = void 0,
                d2 = void 0,
                l1 = void 0,
                l2 = void 0,
                node1 = void 0,
                node2 = void 0,
                node3 = void 0,
                self = this;

            function setUpNode(label, distance) {
                var node = void 0;
                if (label < self.N) {
                    node = new PhyloNode(self.taxa[label], distance);
                    self.labelToNode[label] = node;
                } else {
                    node = self.labelToNode[label];
                    node.setLength(distance);
                }
                return node;
            }

            this.rowSums = sumRows(this.D);
            for (var i = 0; i < this.cN; i++) {
                if (this.rowSums[i] > this.rowSumMax) this.rowSumMax = this.rowSums[i];
            }

            while (this.cN > 2) {
                var _search = this.search();
                //if (this.cN % 100 == 0 ) console.log(this.cN);


                minI = _search.minI;
                minJ = _search.minJ;


                d1 = 0.5 * this.D[minI][minJ] + (this.rowSums[minI] - this.rowSums[minJ]) / (2 * this.cN - 4);
                d2 = this.D[minI][minJ] - d1;

                l1 = this.currIndexToLabel[minI];
                l2 = this.currIndexToLabel[minJ];

                node1 = setUpNode(l1, d1);
                node2 = setUpNode(l2, d2);
                node3 = new PhyloNode(null, null, node1, node2);

                this.recalculateDistanceMatrix(minI, minJ);
                var sorted = sortWithIndices(this.D[minJ], minJ, true);
                this.S[minJ] = sorted;
                this.I[minJ] = sorted.sortIndices;
                this.S[minI] = this.I[minI] = [];
                this.cN--;

                this.labelToNode[this.nextIndex] = node3;
                this.currIndexToLabel[minI] = -1;
                this.currIndexToLabel[minJ] = this.nextIndex++;
            }

            var left = this.indicesLeft.values();
            minI = left.next().value;
            minJ = left.next().value;

            l1 = this.currIndexToLabel[minI];
            l2 = this.currIndexToLabel[minJ];
            d1 = d2 = this.D[minI][minJ] / 2;

            node1 = setUpNode(l1, d1);
            node2 = setUpNode(l2, d2);

            this.P = new PhyloNode(null, null, node1, node2);
        }
    }, {
        key: "recalculateDistanceMatrix",
        value: function recalculateDistanceMatrix(joinedIndex1, joinedIndex2) {
            var D = this.D,
                n = D.length,
                sum = 0,
                aux = void 0,
                aux2 = void 0,
                removedIndices = this.removedIndices,
                rowSums = this.rowSums,
                newRow = this.newRow,
                rowChange = this.rowChange,
                newMax = 0;

            removedIndices.add(joinedIndex1);
            for (var i = 0; i < n; i++) {
                if (removedIndices.has(i)) continue;
                aux = D[joinedIndex1][i] + D[joinedIndex2][i];
                aux2 = D[joinedIndex1][joinedIndex2];
                newRow[i] = 0.5 * (aux - aux2);
                sum += newRow[i];
                rowChange[i] = -0.5 * (aux + aux2);
            }
            for (var _i2 = 0; _i2 < n; _i2++) {
                D[joinedIndex1][_i2] = -1;
                D[_i2][joinedIndex1] = -1;
                if (removedIndices.has(_i2)) continue;
                D[joinedIndex2][_i2] = newRow[_i2];
                D[_i2][joinedIndex2] = newRow[_i2];
                rowSums[_i2] += rowChange[_i2];
                if (rowSums[_i2] > newMax) newMax = rowSums[_i2];
            }
            rowSums[joinedIndex1] = 0;
            rowSums[joinedIndex2] = sum;
            if (sum > newMax) newMax = sum;
            this.rowSumMax = newMax;
            this.indicesLeft.delete(joinedIndex1);
        }
    }, {
        key: "createNewickTree",
        value: function createNewickTree(node) {
            if (node.taxon) {
                // leaf node
                this.PNewick += this.taxonIdAccessor(node.taxon);
            } else {
                // node with children
                this.PNewick += "(";
                for (var i = 0; i < node.children.length; i++) {
                    this.createNewickTree(node.children[i]);
                    if (i < node.children.length - 1) this.PNewick += ",";
                }
                this.PNewick += ")";
            }
            if (node.length) {
                this.PNewick += ":" + node.length;
            }
        }
    }, {
        key: "getAsObject",
        value: function getAsObject() {
            return this.P;
        }
    }, {
        key: "getAsNewick",
        value: function getAsNewick() {
            this.PNewick = "";
            this.createNewickTree(this.P);
            this.PNewick += ";";
            return this.PNewick;
        }
    }]);

    return RapidNeighborJoining;
}();

var PhyloNode = function () {
    function PhyloNode() {
        var taxon = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
        var length = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
        var child1 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
        var child2 = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

        _classCallCheck(this, PhyloNode);

        this.taxon = taxon;
        this.length = length;
        this.children = [];
        if (child1 !== null) this.children.push(child1);
        if (child2 !== null) this.children.push(child2);
    }

    _createClass(PhyloNode, [{
        key: "setLength",
        value: function setLength(length) {
            this.length = length;
        }
    }]);

    return PhyloNode;
}();
