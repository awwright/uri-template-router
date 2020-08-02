
var assert = require('assert');
//var util = require('util');
//util.inspect.defaultOptions.depth = 40;
//util.inspect.defaultOptions.colors = true;

var Router = require('..').Router;
var r = new Router;

var tests = require('./base.json');
tests.forEach(function(testPage){
	describe(testPage.label, function(){
		var router = new Router;
		testPage.templates.forEach(function(template, i){
			router.addTemplate(template, {}, i);
		});
		Object.keys(testPage.uris).forEach(function(uri){
			it(uri, function(){
				var route = router.resolveURI(uri);
				var expected = testPage.uris[uri];
				if(route && route.data){
					assert.deepEqual(route.data, expected);
				}else{
					assert(!expected);
				}
			});
		});
	});
});
