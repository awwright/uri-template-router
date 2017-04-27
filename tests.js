
var Router = require('./route-loop.js').Router;
var r = new Router;

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

var tests = require('./t/data.json');
tests.forEach(function(testPage){
	var router = new Router;
	testPage.templates.forEach(function(template, i){
		router.addTemplate(template, {}, i);
	});
	Object.keys(testPage.uris).forEach(function(uri){
		var route = router.resolveURI(uri)[0];
		var expected = testPage.uris[uri];
		if(!compareJSONParsedObject(route.bindings, expected)){
			console.log('Fail:', route.pattern, uri, route.bindings, expected);
		}
	});
});
