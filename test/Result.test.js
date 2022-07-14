"use strict";

var assert = require('assert');
//var util = require('util');
//util.inspect.defaultOptions.depth = 40;
//util.inspect.defaultOptions.colors = true;

var Router = require('..').Router;
var Route = require('..').Route;
var r = new Router;

describe('Result', function(){
	it('Result#next', function(){
		var router = new Router;
		router.addTemplate('http://localhost/123.txt');
		router.addTemplate('http://localhost/{file}.txt');
		router.addTemplate('http://localhost/{file}');
		router.addTemplate('{+any}');
		var route1 = router.resolveURI('http://localhost/123.txt');
		assert.equal(route1.template, 'http://localhost/123.txt');
		var route2 = route1.next();
		assert.equal(route2.template, 'http://localhost/{file}.txt');
		var route3 = route2.next();
		assert.equal(route3.template, 'http://localhost/{file}');
		var route4 = route3.next();
		assert.equal(route4.template, '{+any}');
		var route5 = route4.next();
		assert.equal(route5, undefined);
	});
	it('Result#rewrite', function(){
		var router = new Router;
		router.addTemplate('http://localhost/{file}.txt');
		var route1 = router.resolveURI('http://localhost/123.txt');
		var route2i = new Route('http://localhost/{file}.html');
		var route2 = route1.rewrite(route2i);
		assert.strictEqual(route2.uri, 'http://localhost/123.html');
		assert.strictEqual(route2.template, 'http://localhost/{file}.html');
		assert.strictEqual(route2.params.file, '123');
	});
});