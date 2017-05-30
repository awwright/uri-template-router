
var file = './route-range4.js';
console.log(file);
var Router = require(file).Router;
var r = new Router;

function compareJSONParsedObject(a, b){
	if(a===b) return true;
	if((typeof a)!==(typeof b)) return false;
	if(Array.isArray(a)){
		if(a.length!==b.length) return false;
		return a.every(function(k,i){ return compareJSONParsedObject(a[i], b[i]); });
	}else if(typeof a=='object'){
		if(Object.keys(a).length != Object.keys(b).length) return false;
		return Object.keys(a).every(function(k){ return compareJSONParsedObject(a[k], b[k]); });
	}
}

var tests = require('./t/data.json');
tests.forEach(function(testPage){
	var router = new Router;
	testPage.templates.forEach(function(template, i){
		router.addTemplate(template, {}, i);
	});
	//console.log(JSON.stringify(router,null," "));
	Object.keys(testPage.uris).forEach(function(uri){
		//console.log('Test: '+uri);
		var route = router.resolveURI(uri);
		//console.log(route);
		//route=route[0];
		var expected = testPage.uris[uri];
		if(expected && !route){
			console.log('Fail:', uri, expected, route);
		}else if(!route || !compareJSONParsedObject(route.data, expected)){
			console.log('Fail:', route.template, uri, expected, route.data);
		}else{
			console.log(' pass', route.template, uri, route.data);
		}
	});
});
