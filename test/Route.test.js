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
	it('Created URIs are reversable', function(){
		const r = new Route('http://example.com/{name}/%F0%9F%90%B2');
		for(let i=0; i<=0x1FFFF; i++){
				if(i >= 0xD000 && i<0xE000) continue; // Skip surrogate code points
			let name = String.fromCodePoint(i);
			let uri = r.toString({name});
			const m = r.resolveURI(uri);
			assert(m, "Could not reverse <"+uri+">");
			assert.equal(m.uriTemplate, 'http://example.com/{name}/%F0%9F%90%B2');
			assert.equal(m.params.name, name);
		}
	});
	// describe('Created URIs are reversable', function(){
	// 	const r = new Route('http://example.com/{name}/%F0%9F%90%B2');
	// 	for(let i=0; i<=0x1FFFF; i++){
	// 		if(i >= 0xD000 && i<0xE000) continue; // Skip surrogate code points
	// 		let name = i.toString(16).padStart(2, '0') + "-" + String.fromCodePoint(i);
	// 		it(name, function(){
	// 			let uri = r.toString({name});
	// 			const m = r.resolveURI(uri);
	// 			assert(m, "Could not reverse <"+uri+">");
	// 			assert.equal(m.uriTemplate, 'http://example.com/{name}/%F0%9F%90%B2');
	// 			assert.equal(m.params.name, name);
	// 		});
	// 	}
	// });
});
