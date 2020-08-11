"use strict";

const assert = require('assert');

const { Router } = require('..');

describe('Router', function(){
	it('Router#addTemplate()', function(){
		const r = new Router;
		assert(typeof r.addTemplate === 'function');
	});
	it('Router#resolveURI()', function(){
		const r = new Router;
		const route = r.addTemplate('http://localhost/~{name}', {}, 'foo');
		const m = r.resolveURI('http://localhost/~root');
		assert.strictEqual(m.route, route)
	});
	it('Router#getValue()', function(){
		const r = new Router;
		const foo = r.addTemplate('http://localhost/~{name}', {}, 'foo');
		assert.strictEqual(r.getValue('foo'), foo);
		assert.strictEqual(r.toString(), 'http://localhost/~{name}')
	});
	it('Router#hasValue()', function(){
		const r = new Router;
		r.addTemplate('http://localhost/~{name}', {}, 'foo');
		assert(r.hasValue('foo'));
	});
});
