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
		document.getElementById('router-status').textContent = router.routes.length + ' routes parsed';
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
	var nodeList=[router.tree], nodeSeen={}, graphSrc='';
	nodeSeen[router.tree.nid] = true;
	var node;
	function add(target, label, style){
		graphSrc += '\te'+node.nid+' -> e'+target.nid+' [label='+JSON.stringify(label||'')+(style||'')+'];\n';
		if(!nodeSeen[target.nid]){
			nodeList.push(target);
			nodeSeen[target.nid] = true;
		}
	}
	graphSrc += 'digraph G {\n';
	while(nodeList.length){
		node = nodeList.shift();
		graphSrc += '\te'+node.nid+' [label='+JSON.stringify(node.nid+' '+node.range)+'];\n';
		for(const k in node.match_chr) add(node.match_chr[k]);
		for(const k in node.match_pfx) add(node.match_pfx[k], k);
		for(const k in node.list_set) add(node.list_set[k], k);
		if(node.match_eof) add(node.match_eof, 'EOF');
		if(node.match_range) add(node, node.range);
		if(node.list_next) add(node.list_next, '', ',style=dashed');
		if(node.template_match){
			graphSrc += '\tm'+node.nid+' [label='+JSON.stringify(node.template_match.uriTemplate)+',shape=rect];\n';
			graphSrc += '\te'+node.nid+' -> m'+node.nid+' [label=match];\n';
		}
	}
	graphSrc += '}\n';
	console.log(router.tree);
	document.getElementById('result-graph').textContent = graphSrc;
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
		router.addTemplate(template);
	});
	console.log('Added '+patterns.length+' templates');
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

