
function us(v){
	var s = '' + (v[0]*10e9 + v[1]);
	if(s.length > 9) return s;
	return ('         ' + s).substr(-9) + 'us';
}
var padlen = 5;
function pus(n, start){
	var pad = n;
	while(pad.length<padlen) pad+=' ';
	console.log( pad + ' ' + us(process.hrtime(start)) );
}

var testRouters = {
	control: require('./route.js').Router,
};
padlen = Math.max.apply(null, Object.keys(testRouters).map(function(v){ return v.length; }));

function test(uri){
	var a = r.resolveURI(uri);
	if(!a.length){
		return;
	}
	a.forEach(function(v, i){
		return;
	});
}

function test2(uri){
	//return uri.match(/^http:\/\/example.com\/blog\/$/);
	var a = r2.resolveURI(uri);
	if(!a.length){
		return;
	}
	a.forEach(function(v, i){
		return;
	});
}

var testData = require('./t/data.json');
var cycles = 60000;

testData.forEach(function(testPage, pg){
	console.log('\nTesting page '+pg);
	for(var rn in testRouters){
		var Router = testRouters[rn];
		var router = new Router;
		testPage.templates.forEach(function(template, i){
			router.addTemplate(template, {}, i);
		});
		var uris = Object.keys(testPage.uris);
		var start = process.hrtime();
		for(var i=0; i<uris.length; i++){
			var uri = uris[i];
			for(var j=0; j<cycles; j++){
				var route = router.resolveURI(uri);
			}
		}
		pus(rn, start);
		Object.keys(testPage.uris).forEach(function(uri){
		});
	}
});
