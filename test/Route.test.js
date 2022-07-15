"use strict";

var assert = require('assert').strict;

var Route = require('..').Route;

describe('Route', function(){
	it('Route#toString()', function(){
		const r = new Route('http://localhost/~{name}');
		assert.strictEqual(r.toString(), 'http://localhost/~{name}')
	});
	it('Route with pct-encoding', function(){
		const r = new Route('http://example.com/{name}/%F0%9F%90%B2');
		const m = r.resolveURI('http://example.com/foo/%F0%9F%90%B2');
		assert.equal(m.uriTemplate, 'http://example.com/{name}/%F0%9F%90%B2');
		assert.equal(m.params.name, 'foo');
	});
});
