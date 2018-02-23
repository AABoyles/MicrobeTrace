// Bioseq.js - To Align Genome Sequences
"use strict";(function(){var bioseq={};bioseq.makeIntArray=function(length,bitSize,fill){var a=bitSize<=16?new Int16Array(length):new Int32Array(length);var b=bitSize<=8?new Int8Array(length):a;var cani8=typeof Int8Array!=="undefined";var arr=cani8?b:[];if(!cani8||fill!==0&&fill!==undefined){for(var n=0;n<length;n++){arr[n]=fill}}return arr};bioseq.makeAlphabetMap=function(str,defaultVal){var aMap=bioseq.makeIntArray(256,8,defaultVal);var lstr=str.toLowerCase();for(var n=0;n<str.length;n++){aMap[str.charCodeAt(n)]=n;aMap[lstr.charCodeAt(n)]=n}return aMap};bioseq.nt5=bioseq.makeAlphabetMap("ACGT",4);bioseq.nac=bioseq.makeAlphabetMap("ACGTURYMKWSBDHVN",16);bioseq.aac=bioseq.makeAlphabetMap("ARNDCQEGHILKMFPSTWYVBZX",32);bioseq.align=function(target,query,is_local,matrix,gapsc,w,table){if(typeof is_local==="undefined")is_local=true;if(typeof matrix==="undefined")matrix=[1,-1];if(typeof gapsc==="undefined")gapsc=[-1,-1];if(table==null)table=bioseq.nt5;var t=bioseq.bsg_enc_seq(target,table);var qp=bioseq.gen_query_profile(query,matrix,table);var qlen=qp[0].length;var max_len=qlen>t.length?qlen:t.length;w=w==null||w<0?max_len:w;var len_diff=t.target>qlen?t.target-qlen:qlen-t.target;w=w>len_diff?w:len_diff;var gapo,gape;if(typeof gapsc=="number"){gapo=0;gape=gapsc>0?gapsc:-gapsc}else{gapo=gapsc[0]>0?gapsc[0]:-gapsc[0];gape=gapsc[1]>0?gapsc[1]:-gapsc[1]}var gapoe=gapo+gape;var H=[],E=[],z=[],score,max=0,end_i=-1,end_j=-1;if(is_local){for(var j=0;j<=qlen;++j){H[j]=E[j]=0}}else{H[0]=0;E[0]=-gapoe-gapo;for(var j=1;j<=qlen;++j){if(j>=w){H[j]=E[j]=Number.NEGATIVE_INFINITY}else{H[j]=-(gapoe+gape*(j-1));E[j]=-(gapoe+gapoe+gape*j)}}}for(var i=0;i<t.length;++i){var h1=0,f=0,m=0,mj=-1;var zi,qpi=qp[t[i]];zi=z[i]=[];var beg=i>w?i-w:0;var end=i+w+1<qlen?i+w+1:qlen;if(!is_local){h1=beg>0?Number.NEGATIVE_INFINITY:-(gapoe+gape*i);f=beg>0?Number.NEGATIVE_INFINITY:-(gapoe+gapoe+gape*i)}for(var j=beg;j<end;++j){var e=E[j],h=H[j],d;H[j]=h1;h+=qpi[j];d=h>e?0:1;h=h>e?h:e;d=h>f?d:2;h=h>f?h:f;d=!is_local||h>0?d:1<<6;h1=h;mj=m>h?mj:j;m=m>h?m:h;h-=gapoe;h=!is_local||h>0?h:0;e-=gape;d|=e>h?1<<2:0;e=e>h?e:h;E[j]=e;f-=gape;d|=f>h?2<<4:0;f=f>h?f:h;zi[j]=d}H[end]=h1,E[end]=is_local?0:Number.NEGATIVE_INFINITY;if(m>max){max=m;end_i=i;end_j=mj}}if(is_local&&max==0){return null}score=is_local?max:H[qlen];function push_cigar(ci,op,len){if(ci.length==0||op!=(ci[ci.length-1]&15))ci.push(len<<4|op);else ci[ci.length-1]+=len<<4}var cigar=[],tmp,which=0,i,k,start_i=0;if(is_local){i=end_i,k=end_j;if(end_j!=qlen-1){push_cigar(cigar,4,qlen-1-end_j)}}else{i=t.length-1;k=(i+w+1<qlen?i+w+1:qlen)-1}while(i>=0&&k>=0){tmp=z[i][k-(i>w?i-w:0)];which=tmp>>(which<<1)&3;if(which==0&&tmp>>6){break}if(which==0){which=tmp&3}if(which==0){push_cigar(cigar,0,1);--i,--k}else if(which==1){push_cigar(cigar,2,1);--i}else{push_cigar(cigar,1,1),--k}}if(is_local){if(k>=0){push_cigar(cigar,4,k+1)}start_i=i+1}else{if(i>=0){push_cigar(cigar,2,i+1)}if(k>=0){push_cigar(cigar,1,k+1)}}for(var i=0;i<cigar.length>>1;++i){tmp=cigar[i];cigar[i]=cigar[cigar.length-1-i],cigar[cigar.length-1-i]=tmp}return{score:score,position:start_i,CIGAR:cigar}};bioseq.gen_score_matrix=function(n,a,b){var m=[];if(b>0){b=-b}for(var i=0;i<n-1;++i){m[i]=[];for(var j=0;j<n-1;++j){m[i][j]=i==j?a:b}m[i][j]=0}m[n-1]=[];for(var j=0;j<n;++j){m[n-1][j]=0}return m};bioseq.gen_query_profile=function(_s,_m,table){var s=typeof _s=="string"?bioseq.bsg_enc_seq(_s,table):_s;var qp=[],matrix;if(_m.length>=2&&typeof _m[0]=="number"&&typeof _m[1]=="number"){if(table==null)return null;var n=typeof table=="number"?table:table[table.length-1]+1;matrix=bioseq.gen_score_matrix(n,_m[0],_m[1])}else{matrix=_m}for(var j=0;j<matrix.length;++j){var qpj,mj=matrix[j];qpj=qp[j]=[];for(var i=0;i<s.length;++i){qpj[i]=mj[s[i]]}}return qp};bioseq.bsg_enc_seq=function(seq,table){if(table==null)table=bioseq.nt5;var s=new Array(seq.length);for(var i=0;i<seq.length;++i){s[i]=table[seq.charCodeAt(i)]}return s};bioseq.cigar2str=function(cigar){var s=[];for(var k=0;k<cigar.length;++k){s.push((cigar[k]>>4).toString()+"MIDNSHP=XB".charAt(cigar[k]&15))}return s.join()};bioseq.cigar2gaps=function(target,query,start,cigar){var oq="",ot="",lq=0,lt=start;for(var k=0;k<cigar.length;++k){var op=cigar[k]&15,len=cigar[k]>>4;if(op==0){oq+=query.substr(lq,len);ot+=target.substr(lt,len);lq+=len,lt+=len}else if(op==1){oq+=query.substr(lq,len);ot+=Array(len+1).join("-");lq+=len}else if(op==2){oq+=Array(len+1).join("-");ot+=target.substr(lt,len);lt+=len}else if(op==4){lq+=len}}return[ot,oq]};if(typeof exports!=="undefined"){if(typeof module!=="undefined"&&module.exports){exports=module.exports=bioseq}exports.bioseq=bioseq}else{window.bioseq=bioseq}})();

// TN93.js - To Compute Genetic Distances
!function(){function o(o,t,e){e||(e="RESOLVE");var r=Math.min(o.length,t.length),f=Array(256).fill(16);f[45]=17,f[65]=0,f[66]=11,f[67]=1,f[68]=12,f[71]=2,f[72]=13,f[75]=9,f[77]=10,f[78]=15,f[82]=5,f[83]=7,f[84]=3,f[85]=4,f[86]=14,f[87]=8,f[89]=6,f[97]=0,f[98]=11,f[99]=1,f[100]=12,f[103]=2,f[104]=13,f[107]=9,f[109]=10,f[110]=15,f[114]=5,f[115]=7,f[116]=3,f[117]=4,f[118]=14,f[119]=8,f[121]=6;for(var i=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1],[0,0,0,1],[1,0,1,0],[0,1,0,1],[0,1,1,0],[1,0,0,1],[0,0,1,1],[1,1,0,0],[0,1,1,1],[1,0,1,1],[1,1,0,1],[1,1,1,0],[1,1,1,1],[1,1,1,1],[0,0,0,0]],n=[1,1,1,1,1,.5,.5,.5,.5,.5,.5,.5,1/3,1/3,1/3,1/3,.25,.25,0],a=0,c=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],h=0;h<4;h++)for(var u=0;u<r;u++){var l=f[o.charCodeAt(u)],m=f[t.charCodeAt(u)];if(l<4&&m<4)c[l][m]+=1;else{if(17==l||17==m){if("GAPMM"!=e)continue;if(17==l&&17==m)continue;17==l?l=15:m=15}if(l<4){if("SKIP"!=e&&n[m]>0){if("RESOLVE"==e&&i[m][l]){0,c[l][l]+=1;continue}for(var d=0;d<4;d++)i[m][d]&&(c[l][d]+=n[m])}}else if("SKIP"!=e)if(m<4){if(n[l]>0){if("RESOLVE"==e&&i[l][m]){0,c[m][m]+=1;continue}for(d=0;d<4;d++)i[l][d]&&(c[d][m]+=n[l])}}else if(norm=n[l]*n[m],norm>0){if("RESOLVE"==e){0,matched_count=0,positive_match=[!1,!1,!1,!1];for(d=0;d<4;d++)i[l][d]&&i[m][d]&&(matched_count++,positive_match[d]=!0);if(matched_count>0){norm2=1/matched_count;for(d=0;d<4;d++)positive_match[d]&&(c[d][d]+=norm2);continue}}for(d=0;d<4;d++)if(i[l][d])for(var v=0;v<4;v++)i[m][v]&&(c[d][v]+=norm)}}}var s=[0,0,0,0];for(l=0;l<4;l++)for(m=0;m<4;m++)s[l]+=c[l][m],s[m]+=c[l][m];var p=2/(s[0]+s[1]+s[2]+s[3]),E=(c[0][2]+c[2][0])*p,M=(c[1][3]+c[3][1])*p,g=1-((c[0][0]+c[1][1]+c[2][2]+c[3][3])*p+E+M);if(0==s[0]||0==s[1]||0==s[2]||0==s[3])E=1-2*(E+M)-g,M=1-2*g,a=E>0&&M>0?-.5*Math.log(E)-.25*Math.log(M):1;else{for(var _=1/(s[0]+s[1]+s[2]+s[3]),S=[0,0,0,0],x=0;x<4;x++)S[x]=s[x]*_;var A=S[0]+S[2],L=S[1]+S[3],O=2*S[0]*S[2]/A,R=2*S[1]*S[3]/L,V=2*(A*L-S[0]*S[2]*L/A-S[1]*S[3]*A/L);E=1-E/O-.5*g/A,M=1-M/R-.5*g/L,g=1-.5*g/L/A,a=-O*Math.log(E)-R*Math.log(M)-V*Math.log(g)}return a}"undefined"!=typeof exports?("undefined"!=typeof module&&module.exports&&(exports=module.exports=o),exports.tn93=o):window.tn93=o}();

function dataSkeleton(){
  return {
    files: [],
    data: {
      nodes: [],
      links: [],
      clusters: [],
      distance_matrix: {},
      nodeFields: [],
      linkFields: []
    },
    state: {
      visible_clusters: [],
      alpha: 0.3
    },
    messages: []
  };
}

function defaultNode(){
  return {
    id: '',
    padding: 0,
    selected: false,
    cluster: 1,
    visible: true,
    degree: 0,
    seq: '',
    origin: ''
  }
}

function addNode(newNode){
  let oldNode = session.data.nodes.find(d => d.id === newNode.id);
  if(oldNode){
    Object.assign(oldNode, newNode);
    return 0;
  } else {
    session.data.nodes.push(Object.assign(defaultNode(), newNode));
    return 1;
  }
}

function defaultLink(){
  return {
    source: '',
    target: '',
    tn93: 1,
    snps: Number.INFINITY,
    visible: false,
    cluster: 1,
    origin: 'Genetic Distance'
  }
}

function addLink(newLink){
  let oldLink = session.data.links.find(l => l.source === newLink.source & l.target === newLink.target);
  if(oldLink){
    Object.assign(oldLink, newLink);
    return 0;
  } else {
    session.data.links.push(Object.assign(defaultLink(), newLink));
    return 1;
  }
}

function parseFASTA(text){
  if(!text || text.length === 0) return []
  let seqs = [], currentSeq = {};
  text.split(/[\r\n]+/g).forEach((line, i) => {
    if(/^\s*$/.test(line)) return;
    if(line[0] == ">" || line[0] == ";"){
      if(i > 0) seqs.push(currentSeq);
      currentSeq = {
        id: line.slice(1),
        seq: ''
      };
    } else {
      currentSeq.seq += line;
    }
  });
  seqs.push(currentSeq);
  return seqs;
}

function hamming(s1, s2){
  let i = s1.length;
  let sum = 0;
  while(--i > 0){
    if(s1[i] !== s2[i]) sum++;
  }
  return sum;
}

function align(subset, reference){
  subset.forEach(node => {
    let rst = bioseq.align(reference, node.seq, true, [1, -1], [-5, -1.7]);
    let fmt = bioseq.cigar2gaps(reference, node.seq, rst.position, rst.CIGAR);
    node.padding = rst.position;
    node.seq = fmt[1];
  });

  //Final step in alignment: left- and right- padding with hyphens
  let minPadding = Math.min.apply(null, subset.map(d => d.padding));
  subset.forEach(d => d.seq = '-'.repeat(d.padding - minPadding) + d.seq);

  let maxLength = Math.min.apply(null, subset.map(d => d.seq.length));
  subset.forEach(d => d.seq = d.seq + '-'.repeat(maxLength - d.seq.length));
}

function computeDistanceMatrices(subset){
  let n = subset.length;
  let k = 0;
  session.data.distance_matrix.tn93 = Array(n);
  session.data.distance_matrix.snps = Array(n);
  session.data.distance_matrix.labels = subset.map(d => d.id);
  for(let i = 0; i < n; i++){
    session.data.distance_matrix.tn93[i] = Array(n);
    session.data.distance_matrix.snps[i] = Array(n);
    session.data.distance_matrix.tn93[i][i] = session.data.distance_matrix.snps[i][i] = 0;
    for(let j = 0; j < i; j++){
      let newLink = {
        source: subset[j].id,
        target: subset[i].id,
        tn93: tn93(subset[j]['seq'], subset[i]['seq'], 'AVERAGE'),
        snps: hamming(subset[j]['seq'], subset[i]['seq'])
      };
      session.data.distance_matrix.tn93[i][j] = newLink.tn93;
      session.data.distance_matrix.tn93[j][i] = newLink.tn93;
      session.data.distance_matrix.snps[i][j] = newLink.snps;
      session.data.distance_matrix.snps[j][i] = newLink.snps;
      k += addLink(newLink);
    }
  }
  return k;
}

function message(msg){
  self.postMessage(msg);
}

const hierarchy = ['distmat', 'link', 'node', 'fasta'];
var anySequences = false;

instructions.files.sort((a, b) => hierarchy.indexOf(a.type) - hierarchy.indexOf(b.type));
instructions.files.forEach((file, fileNum) => {
  let filename = file.file;

  if(file.type === 'fasta'){

    message(`Parsing ${filename} as FASTA...`);
    let reader = new FileReader();
    reader.onloadend = function(e){
      anySequences = true;
      let n = 0;
      let seqs = parseFASTA(e.target.result);
      seqs.forEach(node => {
        node['origin'] = filename;
        n += addNode(node);
      });
      message(` - Parsed ${n} New, ${seqs.length} Total Nodes from FASTA.`);
      if(fileNum == instructions.files.length - 1) nextStuff();
    };
    reader.readAsText(session.files[fileNum], 'UTF-8');

  } else if(file.type === 'link'){

    message(`Parsing ${filename} as Link CSV...`);
    let l = 0;
    Papa.parse(file.file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      step: row => {
        let link = row.data;
        l += addLink(Object.assign({
          source: link[file.field1],
          target: link[file.field2],
          distance: (file.field3 === "None") ? 1 : link[file.field3],
          origin: filename,
          visible: true
        }, link));
      },
      complete: results => {
        message(` - Parsed ${n} New, ${results.data.length} Total Links from Link CSV.`);
        Object.keys(results.data[0]).forEach(key => session.data.linkFields.push(key));
        let n = 0;
        let nodeIDs = _.union(_.map(results.data, file.field1), _.map(results.data, file.field2));
        let t = nodeIDs.length;
        nodeIDs.forEach(d => n += addNode({
          'id': d,
          'origin': filename
        }));
        message(` - Parsed ${n} New, ${t} Total Nodes from Link CSV.`);
        if(fileNum == instructions.files.length - 1) nextStuff();
      }
    });

  } else if(file.type === 'node'){

    message(`Parsing ${filename} as Node CSV...`);

    let n = 0;
    Papa.parse(file.file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      step: row => {
        let node = row.data;
        node.id = node[file.field1];
        if(file.field2 !== 'None') node.seq = node[file.field2];
        node['origin'] = filename;
        n += addNode(node);
      },
      complete: results => {
        Object.keys(results.data[0]).forEach(key => session.data.nodeFields.push(key));
        if(data.nodeFields.has('seq')) anySequences = true;
        if(fileNum == instructions.files.length - 1) nextStuff();
      }
    });

    message(` - Parsed ${n} New, ${results.data.length} Total Nodes from Node CSV.`);

  } else { //Distance Matrix

    message(`Parsing ${filename} as Distance Matrix...`);

    Papa.parse(file.file, {
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: results => {
        let nodeIDs = [];
        let nn = 0, nl = 0;
        results.data.forEach((row, i) => {
          if(i == 0){
            nodeIDs = row;
            nodeIDs.forEach((cell, k) => {
              if(k > 0){
                nn += addNode({
                  id: cell,
                  origin: filename
                });
              }
            });
          } else {
            row.forEach((cell, j) => {
              if(j > i){
                nl += addLink({
                  source: nodeIDs[i],
                  target: nodeIDs[j],
                  distance: cell,
                  origin: filename
                });
              }
            });
          }
        });
        if(fileNum == instructions.files.length - 1) nextStuff();
      }
    });
    message(` - Parsed ${nn} New, ${results.data.length - 1} Total Nodes from Distance Matrix.`);
    message(` - Parsed ${nl} New, ${(Math.pow(results.data.length-1, 2) - results.data.length + 1)/2} Total Links from Distance Matrix.`);
  }
});

function nextStuff(){
  if(anySequences){
    const allDashes = /^-*$/;
    let subset = session.data.nodes.filter(d => !allDashes.test(d.seq));
    if(instructions.align){
      message('Aligning Sequences...');
      align(subset, instructions.reference);
    }
    message('Computing New Distance Matrices...');
    let k = computeDistanceMatrices(subset);
    message(` - Found ${k} New Links while computing Distance Matrices`);
  }
}
