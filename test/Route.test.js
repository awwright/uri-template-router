"use strict";

var assert = require('assert');

var Route = require('..').Route;

describe('Route', function(){
	it('Route#toString()', function(){
		const r = new Route('http://localhost/~{name}');
		assert.strictEqual(r.toString(), 'http://localhost/~{name}')
	});
});
