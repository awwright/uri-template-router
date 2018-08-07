
var assert = require('assert');
//var util = require('util');
//util.inspect.defaultOptions.depth = 40;
//util.inspect.defaultOptions.colors = true;

var Router = require('..').Router;
var r = new Router;

function rpad(str, padlen){
	if(typeof str!='string') str = util.inspect(str);
	// FIXME this returns unexpected results for objects (it returns the object untouched)
	var padded = str;
	while(padded.length<padlen) padded+=' ';
	return padded;
}

function compareJSONParsedObject(a, b){
	if(a===b) return true;
	if(a===null || b===null) return false;
	if((typeof a)!==(typeof b)) return false;
	if(Array.isArray(a)){
		if(a.length!==b.length) return false;
		return a.every(function(k,i){ return compareJSONParsedObject(a[i], b[i]); });
	}else if(typeof a=='object'){
		if(Object.keys(a).length != Object.keys(b).length) return false;
		return Object.keys(a).every(function(k){ return compareJSONParsedObject(a[k], b[k]); });
	}
}

var cols = {
	uri: function(s){ return rpad(s, 34); },
	template: function(s){ return rpad(s, 40); },
	expected: function(s){ return rpad(s, 50); },
	actual: function(s){ return s },
}

var tests = require('./base.json');
tests.forEach(function(testPage){
	describe(testPage.label, function(){
		var router = new Router;
		testPage.templates.forEach(function(template, i){
			router.addTemplate(template, {}, i);
		});
		Object.keys(testPage.uris).forEach(function(uri){
			it(uri, function(){
				try {
					var route = router.resolveURI(uri);
				}catch(e){
					console.log('error', uri, expected, route, e.stack);
					return;
				}
				var expected = testPage.uris[uri];
				if(route && route.data){
					assert.deepEqual(expected, route.data);
				}else{
					assert(!expected);
				}
			});
		});
	});
});
