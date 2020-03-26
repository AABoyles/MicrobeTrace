onmessage = function(e){
    const start = Date.now();
    const links = e.data.links;
    const dm = e.data.matrix;
    const labels = Object.keys(dm);
    const epsilon = Math.pow(10, e.data.epsilon);
    const metric = e.data.metric;
    const n = labels.length
    const m = links.length;
    let output = new Uint8Array(m);
    let matrix = [];
    let map = [];
    for (let i = 0; i < n; i++) {
        let minDist = Number.MAX_VALUE;
        let targets = [];
        const nodeid = labels[i];
        const row = dm[nodeid];
        for (let j = 0; j < n; j++) {
          let cell = row[labels[j]];
          if(!cell) {
            targets.push(0);
            continue;
          };
          let value = cell[metric];
          targets.push(value);
        }
        matrix.push(targets);
        map.push(nodeid);
    }
    const mst =  primMST(matrix);
    for (let i = 0; i < n; i++) {
      const source = map[i];
      const target = map[mst[i]];
      for(let k = 0; k < m; k++){
        let l = links[k];
        if((l.source == source && l.target == target) || (l.source == target && l.target == source)){
          output[k] = 1;
        }
      }
    }
    console.log('MST Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
    postMessage({links: output.buffer, start: Date.now()}, [output.buffer]);
    close();
};
const minKey = (key, mstSet, V) => {
    let min = Number.MAX_VALUE;
    let min_index = -1;
    for (let v = 0; v < V; v++)
        if (!mstSet[v] && key[v] < min) {
            min = key[v];
            min_index = v;
        }
    return min_index;
}
const primMST = (graph) => {
    const V = graph.length;
    let parent = [];
    let key = [];
    let mstSet = [];
    for (let i = 0; i < V; i++) {
        key[i] = Number.MAX_VALUE;
        mstSet[i] = false;
    }
    key[0] = 0.0; 
    parent[0] = -1;
    for (let count = 0; count < V-1; count++) {
        let u = minKey(key, mstSet, V);
        mstSet[u] = true;
        for (let v = 0; v < V; v++) {
            if (graph[u][v] >= 0 && !mstSet[v] && graph[u][v] <  key[v]) {
                parent[v]  = u;
                key[v] = graph[u][v];
            }
        }
    }
    return parent;
}
