"use strict";

const assert = require('assert');

const { Router, Route } = require('..');

describe('Router', function(){
	var r;
	this.beforeEach(function(){
		r = new Router;
	});
	it('Router#addTemplate()', function(){
		assert(typeof r.addTemplate === 'function');
	});
	it('Router#addTemplate() error on overlap', function(){
		r.addTemplate('{+path}.html');
		assert.throws(function(){
			r.addTemplate('{path}');
		}, err => err instanceof Error);
	});
	it('Router#addTemplate() overlap with parent option', function(){
		const parent = r.addTemplate('{+path}.html');
		const child = r.addTemplate('f{path}', {parent});
		assert.strictEqual(r.resolveURI('foo.html').uriTemplate, child.uriTemplate);
		assert.strictEqual(r.resolveURI('bar.html').uriTemplate, parent.uriTemplate);
		assert.strictEqual(r.resolveURI('foo'), undefined);
		assert.strictEqual(r.resolveURI('bar'), undefined);
	});
	it('Router#addTemplate() errors on duplicate variables', function(){
		assert.throws(function(){
			r.addTemplate('{+path}{path}');
		}, err => err instanceof Error);
		// URI Templates with repeated variables are cool though
		new Route('{+path}{path}');
	});
	it('Router#addTemplate() errors on duplicate routes', function(){
		r.addTemplate('/foo');
		r.addTemplate('/{bar}');
		assert.throws(function(){
			r.addTemplate('/foo');
		}, err => err instanceof Error);
		assert.throws(function(){
			r.addTemplate('/{baz}');
		}, err => err instanceof Error);
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
	it('Router#resolveURI() with zero routes', function(){
		r.resolveURI('http://example.com/foo');
	});
});
