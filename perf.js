
function us(v){
	var s = '' + (v[0]*1e9 + v[1]);
	if(s.length > 9) return s;
	return ('         ' + s).substr(-9) + 'us';
}
var padlen = 5;
function pus(n, start){
	var pad = n;
	while(pad.length<padlen) pad+=' ';
	console.log( pad + ' ' + us(process.hrtime(start)) );
}

function compareJSONParsedObject(a, b){
	if(a===b) return true;
	if(typeof a != typeof b) return false;
	if(Array.isArray(a)){
		if(a.length!=b.length) return false;
		return a.every(function(k,i){ return compareJSONParsedObject(a[i], b[i]); });
	}else{
		if(Object.keys(a).length != Object.keys(b).length) return false;
		return Object.keys(a).every(function(k){ return compareJSONParsedObject(a[k], b[k]); });
	}
}

var testRouters = {
	range: require('./route-range.js').Router,
//	range2: require('./route-range2.js').Router,
//	range3: require('./route-range3.js').Router,
	range4: require('./route-range4.js').Router,
	control: require('./route.js').Router,
};
padlen = Math.max.apply(null, Object.keys(testRouters).map(function(v){ return v.length; }));

var testData = require('./t/data.json');
var cycles = 100000;

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
