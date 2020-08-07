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
	}, [''])
	patterns.forEach(function(template){
		router.addTemplate(template);
	});
	console.log('Added '+patterns.length+' templates');
}

window.onload = function(){
	document.getElementById('templates').onchange = refreshRouter;
	document.getElementById('test').onchange = refreshResults;
	document.getElementById('test').onkeyup = refreshResults;
	refreshResults();
}

