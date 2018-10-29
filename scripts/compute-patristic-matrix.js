pare

// var tree = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);";
// var matrix = derivePatristicMatrix(tree);
// console.log(matrix);

// Adapted from https://www.biostars.org/p/6661/#142113
function computePatristicMatrix(tree){
  "use strict";

  //record the distance of parentheses
  var dis = {};
  var par = -1;
  var current = [];
  var i = 0, n = tree.length;
  while(i++ < n){
    var char = tree[i];
    if(char === '('){
      if(++par === 0) continue;
      current.push(par);
    } else if(char === ')'){
      if(current.length === -1) continue;
      dis['node_' + current.pop()] = 'foo';//:(\d+\.\d+|\d+)/;
    }
  }

  //record the distance of leaves
  var order = [];
  while(tree =~ /([^\(\):,]+):(\d+\.\d+|\d+)/g){
    dis[$1] = $2;
    order.push($1);
  }

  //record parents of leaves
  var pare = {};
  current = [];
  par = -1;
  while(tree =~ /(\(|\)|([^\(\):,]+):)/g){
    if($& == '('){
      if(++par == 0) continue;
      current.push(par);
    } else if($& == ')'){
      current.pop();
    } else {
      map {pare{$2}{$_} = 1} @current;
      pare{$2} = [@current];
    }
  }

  //Distance matrix
  var dis2 = [];
  for(var i = 0; i < order.length; i++){
    dis2[i] = [];
    for(var j = i; j < order.length; j++){
      if(i == j){
        dis2[order[i]][order[j]] = 0;
      } else {
        var $tem = dis[order[i]] + dis[order[j]];
        var $tem2 = -1;
        foreach var $k (0..$#{pare{order[i]}}){
          last if($k > $#{pare{order[j]}});
          if(pare{order[i]}[$k] == pare{order[j]}[$k]){
            $tem2 = $k;
          }
        }
        if($#{pare{order[i]}} != -1){
          map {$tem += dis['node_'.$_]} map {pare{order[i]}[$_]} ($tem2+1)..$#{pare{order[i]}};
        }
        if($#{pare{order[j]}} != -1){
          map {$tem += dis['node_'.$_]} map {pare{order[j]}[$_]} ($tem2+1)..$#{pare{order[j]}};
        }
        dis2[order[i]][order[j]] = dis2[order[j]][order[i]] = $tem;
      }
    }
  }

  //output
  return dis2;
}
