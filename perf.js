
var padlen = 0; // To be updated later as necessary
var ratelen = 9;
function pus(name, start, cyc){
	var end = process.hrtime(start);
	var rate = (cyc / (end[0] + end[1]*1e-9)).toFixed(0) + 'Hz';
	var pad = name;
	while(pad.length<padlen) pad += ' ';
	var rate = ' ' + rate;
	while(rate.length<ratelen) rate = ' ' + rate;
	console.log( pad + ' ' + rate );
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
	control: require('./route.js').Router,
//	range: require('./route-range.js').Router,
//	range2: require('./route-range2.js').Router,
//	range3: require('./route-range3.js').Router,
//	range4: require('./route-range4.js').Router,
};
padlen = Math.max.apply(null, Object.keys(testRouters).map(function(v){ return v.length; }));

var testData = require('./t/base.json');
var cycles = 10000;

testData.forEach(function(testPage, pg){
	console.log('\nTesting page '+pg+': '+testPage.label);
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
		pus(rn, start, cycles*uris.length);
		Object.keys(testPage.uris).forEach(function(uri){
		});
	}
});
