"use strict";

const assert = require('assert');

const { Router } = require('..');

describe('Router', function(){
	var r;
	this.beforeEach(function(){
		r = new Router;
	});
	it('Router#addTemplate()', function(){
		assert(typeof r.addTemplate === 'function');
	});
	it('Router#resolveURI()', function(){
		const route = r.addTemplate('http://localhost/~{name}', {}, 'foo');
		const m = r.resolveURI('http://localhost/~root');
		assert.strictEqual(m.route, route);
	});
	it('Router#size', function(){
		assert.strictEqual(r.size, 0);
	});
	it('Router#clear()', function(){
		assert.strictEqual(r.size, 0);
		r.addTemplate('http://localhost/~{name}', {}, 'foo');
		assert.strictEqual(r.size, 1);
		r.clear();
		assert.strictEqual(r.size, 0);
	});
	it('Router#getTemplate()', function(){
		const foo = r.addTemplate('http://localhost/~{name}', {}, 'foo');
		assert.strictEqual(r.getTemplate('http://localhost/~{name}'), foo);
	});
	it('Router#hasTemplate()', function(){
		r.addTemplate('http://localhost/~{name}', {}, 'foo');
		assert(r.hasTemplate('http://localhost/~{name}'));
	});
	it('Router#getValue()', function(){
		const foo = r.addTemplate('http://localhost/~{name}', {}, 'foo');
		assert.strictEqual(r.getValue('foo'), foo);
	});
	it('Router#hasValue()', function(){
		r.addTemplate('http://localhost/~{name}', {}, 'foo');
		assert(r.hasValue('foo'));
	});
});
