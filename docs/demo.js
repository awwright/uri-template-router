const { Router } = uriTemplateRouter;

var router;

function refreshRouter(){
	router = new Router;
	var errors = [];
	document.getElementById('templates').value.split('\n').forEach(function(v){
		const uriTemplate = v.trim();
		if(!uriTemplate) return;
		try {
			router.addTemplate(uriTemplate);
		}catch(err){
			errors.push(err);
		}
	});
	if(errors.length){
		document.getElementById('router-status').textContent = errors.map(function(err){
			return err.toString();
		}).join('\n');
	}else{
		document.getElementById('router-status').textContent = router.size + ' routes parsed';
	}
}

function refreshResults(){
	if(!router) refreshRouter();
	var input = document.getElementById('test').value;
	var outTemplate = document.getElementById('result-template');
	var outParams = document.getElementById('result-params');
	var results = router.resolveURI(input);
	var result = results;
	if(result){
		outTemplate.textContent = '<'+result.template+'>'+(result.argument||'');
		outParams.textContent = Object.keys(result.params).map(function(v){
			return v + " = " + JSON.stringify(result.params[v], null, '\t');
		}).join("\n");
	}else{
		outTemplate.textContent = '';
		outParams.textContent = 'Not Found';
	}
	var resultList = document.getElementById('result-list');
	resultList.textContent = '';
	for(var resultItem = result; resultItem; resultItem=resultItem.next()){
		var li = document.createElement('li');
		li.textContent = resultItem.template + ' ⟵ ' + JSON.stringify(resultItem.params);
		resultList.appendChild(li);
	}
	document.getElementById('result-graph').textContent = toViz(router.states);

	const header = document.getElementById('sort-header');
	const tbody = document.getElementById('sort-tbody');
	if(header){
		header.innerHTML = '<th>×</th>';
		tbody.innerHTML = '';
		router.routes.forEach(function(left){
			const right_th = document.createElement('th');
			right_th.textContent = left.uriTemplate;
			header.appendChild(right_th);

			const left_tr = document.createElement('tr');
			tbody.appendChild(left_tr);
			const left_th = document.createElement('th');
			left_th.textContent = left.uriTemplate;
			tbody.appendChild(left_th);

			router.routes.forEach(function(right){
				const compare_res = left.compare(right);
				const td = document.createElement('th');
				if(compare_res[0]===true && compare_res[1]===true){
					// Equal
					td.textContent = '=';
				}else if(compare_res[0]===true && compare_res[1]===false){
					// Strict superset
					td.textContent = '⊃';
				}else if(compare_res[0]===false && compare_res[1]===true){
					// Strict subset
					td.textContent = '⊂';
				}else if(compare_res[0]===false && compare_res[1]===false && compare_res[2]===true){
					// No items in common
					td.textContent = '≠';
				}else if(compare_res[0]===false && compare_res[1]===false && compare_res[2]===false){
					// There is an overlap
					td.textContent = '∩';
				}else{
					td.textContent = compare_res;
				}
				tbody.appendChild(td);
			});
		});
	}

	document.getElementById('hierarchy-tree').innerHTML = '';
	const parents = [ {element: document.getElementById('hierarchy-tree'), children:router.hierarchy.children} ];
	for(var i=0; i<parents.length; i++){
		const trunk = document.createElement('ul');
		for(var j=0; j<parents[i].children.length; j++){
			const item = document.createElement('li');
			item.textContent = parents[i].children[j].uriTemplate;
			trunk.appendChild(item);
			if(parents[i].children[j].children.length){
				parents.push({ element: item, children: parents[i].children[j].children });
			}
		}
		parents[i].element.appendChild(trunk);
	}
}

function alot(){
	router = new Router;
	var pieces = [
		['http://', 'https://'],
		['', 'www.', 'subdomain.', 'users.', 'status.', 'about.', 'news.'],
		['google','youtube', 'facebook', 'bidau', 'wikipedia', 'yahoo', 'qq',
			'taobao', 'twitter', 'amazon', 'tmall', 'souhu', 'live', 'vk', 'instagram',
			'linkedin', 'gmail', 'netflix', 't', 'ebay', 'pornhub', 'bing',
			'msn', 'imgur', 'reddit', 'microsoft', 'twitch', 'tumblr', 'slashdot', 'ycombinator',
			'github', 'cnn', 'foxnews', 'deviantart', 'example',
		],
		['.'],
		['com', 'org', 'net', 'co', 'io', 'xyz', 'luxury', 'jp', 'cn', 'tv'],
		['/', '/index', '/page/{id}', '/user/{id}', '/blog{/yyyy,mm,dd,slug}', '/~{user}', '/listing/{id}',
			'/cart', '/status','/path{/path*}', '/{?x,y}'
		],
		['', '.html', '.json', '.txt', '.xml'],
	];
	var patterns = pieces.reduce(function(state, list){
		var copy = [];
		state.forEach(function(base){
			list.forEach(function(segment){
				copy.push(base+segment);
			})
		});
		return copy;
	}, ['']);
	patterns.forEach(function(template){
		console.log(template);
		router.addTemplate(template);
	});
	console.log('Added '+patterns.length+' templates');
}

function toViz(transitions, history){
	var highlight = new Set();
	if(history){
		var start = 0;
		history.forEach(function(node){
			highlight.add(`${start} ${node.symbol} ${node.nextStateId}`);
			start = node.nextStateId;
		});
	}
	var str = '';
	str += 'digraph G {\n';
	str += '\t_initial [shape=point];\n';
	str += '\t_initial -> 0;\n';
	transitions.forEach(function(state, id){
		const final = state.final ? ' [shape=doublecircle]' : '';
		str += '\t'+id+final+';\n';
		for(const symbol in state.transitions){
			const target = state.transitions[symbol];
			const penwidth = highlight.has(`${id} ${symbol} ${target}`) ? ',penwidth=3' : '' ;
			str += '\t'+id+' -> '+target+' [label='+JSON.stringify(symbol)+penwidth+'];\n';
		}
		if(state.final && Array.isArray(state.final)) state.final.forEach(function(final){
			str += '\t'+JSON.stringify('final_'+final)+' [shape='+JSON.stringify('doublebox')+',label='+JSON.stringify(final.toString())+'];\n';
			str += '\t'+id+' -> '+JSON.stringify('final_'+final)+' [dir=both,arrowtail=odot,arrowhead=o];\n';
		});
		// if(state.partials) for(const k in state.partials){
		// 	const partial = state.partials[k];
		// 	str += '\t'+JSON.stringify('final_'+k)+' [shape='+JSON.stringify('doublebox')+',label='+JSON.stringify(k+JSON.stringify(partial))+'];\n';
		// 	str += '\t'+id+' -> '+JSON.stringify('final_'+k)+' [dir=both,arrowtail=odot,arrowhead=o,style=dashed];\n';
		// };
	});
	str += '}\n';
	return str;
}

window.onload = function(){
	document.getElementById('templates').onchange = function(){
		refreshRouter();
		refreshResults();
	};
	document.getElementById('test').onchange = refreshResults;
	document.getElementById('test').onkeyup = refreshResults;
	refreshRouter();
	refreshResults();
}

