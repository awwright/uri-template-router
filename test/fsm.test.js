'use strict';

const assert = require('assert').strict;
const { Node, union, concat, star, optional, reverse, reduce, fromString, compare } = require('../lib/fsm.js');
// const { toViz } = require('../index.js');

function accepts(fsm, string){
	var state = fsm[0];
	const history = [fsm[0]];
	for(var offset = 0; state && offset < string.length; offset++){
		if(!state) break;
		const symbol = string[offset];
		const nextStateId = state.get(symbol);
		if(nextStateId === undefined) return;
		state = fsm[nextStateId];
		history.push(state);
	}
	if(state.final){
		return history;
	}
}

describe('fsm.Node', function(){
	it('matching groups', function(){
		const fsm_foo = [
			new Node({f:1}, {a: 0}),
			new Node({o:2}, {a: 1}),
			new Node({o:3}, {a: 2}),
			new Node({}, {}, ['a']),
		];
		assert(accepts(fsm_foo, "foo"));
	});
});

describe('fsm.fromString', function(){
	it('fromString("")', function(){
		assert.deepEqual(fromString(''), [new Node({}, {}, true)]);
	});
	it('fromString("foo")', function(){
		assert.deepEqual(fromString('foo', v=>({offset: v})), [
			new Node({f:1}, {offset: 0}),
			new Node({o:2}, {offset: 1}),
			new Node({o:3}, {offset: 2}),
			new Node({}, {}, true),
		]);
	});
});

describe('fsm.union', function(){
	it('expects an array', function(){
		assert.throws(function(){
			union();
		}, err => (err.toString().indexOf('Expected `fsms` to be an array of arrays')>=0));
		assert.throws(function(){
			union([null]);
		}, err => err.toString().indexOf('Expected `fsm` to be an Array')>=0);
		assert.throws(function(){
			union([true]);
		}, err => err.toString().indexOf('Expected `fsm` to be an Array')>=0);
	});

	it('∅∪∅', function(){
		const fsm_a = [
			new Node({}),
		];
		const fsm_b = [
			new Node({}),
		];
		const fsm_ab = [
			new Node({}),
		];
		assert.deepEqual(union([fsm_a, fsm_b]), fsm_ab);
	});

	it('𝜀∪∅', function(){
		const fsm_a = [
			new Node({}, {}, true),
		];
		const fsm_b = [
			new Node({}),
		];
		const fsm_ab = [
			new Node({}, {}, true),
		];
		assert.deepEqual(union([fsm_a, fsm_b]), fsm_ab);
	});

	it('"a" union "b"', function(){
		const fsm_a = fromString('a');
		const fsm_b = fromString('b');
		const fsm_ab = [
			new Node({a:1, b:2}),
			new Node({}, {}, true),
			new Node({}, {}, true),
		];
		assert.deepEqual(union([fsm_a, fsm_b]), fsm_ab);
	});

	it('matching groups', function(){
		const fsm_a = fromString('a');
		const fsm_b = fromString('b');
	});

});

describe('fsm.concat', function(){
	it('expects an array', function(){
		assert.throws(function(){
			concat();
		}, err => (err.toString().indexOf('Expected `fsms` to be an array of arrays')>=0));
		assert.throws(function(){
			concat([null]);
		}, err => err.toString().indexOf('Expected `fsm` to be an Array')>=0);
		assert.throws(function(){
			concat([true]);
		}, err => err.toString().indexOf('Expected `fsm` to be an Array')>=0);
	});

	it('∅∅', function(){
		const fsm_a = [
			new Node({}),
		];
		const fsm_b = [
			new Node({}),
		];
		const fsm_ab = [
			new Node({}),
		];
		assert.deepEqual(concat([fsm_a, fsm_b]), fsm_ab);
	});

	it('𝜀∅', function(){
		const fsm_a = [
			new Node({}, {}, true),
		];
		const fsm_b = [
			new Node({}),
		];
		const fsm_ab = [
			new Node({}),
		];
		assert.deepEqual(concat([fsm_a, fsm_b]), fsm_ab);
	});

	it('"a" concat "b"', function(){
		const fsm_a = fromString('a', v=>({a:v}));
		const fsm_b = fromString('b', v=>({b:v}));
		const fsm_ab = [
			new Node({a:1}, {a:0}),
			new Node({b:2}, {b:0}),
			new Node({}, {}, true),
		];
		assert.deepEqual(concat([fsm_a, fsm_b]), fsm_ab);
	});

	it('(_[_a]+){2}', function(){
		const fsm_a = [
			new Node({"_": 1}, {}, true),
			new Node({"a": 1, "_":1}, {}, true),
		];
		const fsm_b = [
			new Node({"_": 1}, {}, true),
			new Node({"a": 1, "_":1}, {}, true),
		];
		const fsm_ab = [
			new Node({"_": 1}, {}, true),
			new Node({"a": 1, "_":1}, {}, true),
		];
		assert.deepEqual(concat([fsm_a, fsm_b]), fsm_ab);
	});

});

describe('fsm.optional', function(){
	it('optional', function(){
		const fsm_a = [
			new Node({a:1}),
			new Node({}, {}, true),
		];
		const fsm_optional = optional(fsm_a);
		assert(accepts(fsm_optional, ""));
		assert(accepts(fsm_optional, "a"));
		assert(!accepts(fsm_optional, "b"));
		assert(!accepts(fsm_optional, "aaaaaaaaa"));
	});
});

describe('fsm.star', function(){
	it('star(a)', function(){
		const fsm_a = [
			new Node({a: 1}),
			new Node({}, {}, true),
		];
		const fsm_star = star(fsm_a);
		assert(accepts(fsm_star, ""));
		assert(accepts(fsm_star, "a"));
		assert(!accepts(fsm_star, "b"));
		assert(accepts(fsm_star, "aaaaaaaaa"));
	});
	it('star(ab*)', function(){
		const fsm_abstar = [
			new Node({a:1}),
			new Node({b:1}, {}, true),
		];
		assert(accepts(fsm_abstar, "a"));
		assert(!accepts(fsm_abstar, "b"));
		assert(accepts(fsm_abstar, "ab"));
		assert(accepts(fsm_abstar, "abb"));
		const fsm_abstarstar = star(fsm_abstar);
		assert(accepts(fsm_abstarstar, "a"));
		assert(!accepts(fsm_abstarstar, "b"));
		assert(accepts(fsm_abstarstar, "ab"));
		assert(accepts(fsm_abstarstar, "abb"));
		assert(!accepts(fsm_abstarstar, "bb"));
		assert(accepts(fsm_abstarstar, "aa"));
	});
});

describe('fsm.reverse', function(){
	it('ab', function(){
		const fsm_ab = [
			new Node({a:1}),
			new Node({b:2}, {}),
			new Node({}, {}, true),
		];
		const fsm_ba = [
			new Node({b:1}),
			new Node({a:2}, {}),
			new Node({}, {}, true),
		];
		assert.deepEqual(reverse(fsm_ab), fsm_ba);
	});
	it('a?b', function(){
		const fsm_ab = [
			new Node({a:1, b:2}, {optional_a: 1}, false),
			new Node({b:2}, {a: true}),
			new Node({}, {b: true}, true),
		];
		const fsm_ba = [
			new Node({b:1}),
			new Node({a:2}, {}, true),
			new Node({}, {}, true),
		];
		assert.deepEqual(reverse(fsm_ab), fsm_ba);
	});
});

describe('fsm.reduce', function(){
	it('eliminates extra states (1)', function(){
		const fsm_abc = [
			new Node({}),
			new Node({}),
			new Node({}),
		];
		assert.equal(fsm_abc.length, 3);
		assert.equal(reduce(fsm_abc).length, 1);
	});
	it('eliminates extra states (2)', function(){
		const fsm_abc = [
			new Node({"a": 1, "b": 3}),
			new Node({"a": 2, "b": 3}),
			new Node({"a": 2, "b": 3}),
			new Node({}, {}, true),
			new Node({}),
		];
		assert.equal(fsm_abc.length, 5);
		assert.equal(reduce(fsm_abc).length, 2);
	});
	it('eliminates shadowed transitions (a)', function(){
		const fsm_a = [
			new Node({a:1, b:1, c:1}),
			new Node({}, {}, true),
		];
		const fsm_a0 = [
			new Node({a:1, b:1, c:1}),
			new Node({}, {}, true),
		];
		assert.deepEqual(reduce(fsm_a), fsm_a0);
	});
	it('eliminates shadowed transitions (b)', function(){
		const fsm_a = [
			new Node({'a-c':1}),
			new Node({}, {}, true),
		];
		const fsm_a0 = [
			new Node({'a-c':1}),
			new Node({}, {}, true),
		];
		assert.deepEqual(reduce(fsm_a), fsm_a0);
	});
});

describe('fsm.compare', function(){
	it('disjoint', function(){
		const fsm_a = [
			new Node({'a':1, 'b':2}),
			new Node({}, {}, true),
			new Node({}, {}, false),
		];
		const fsm_b = [
			new Node({'a':1, 'b':2}),
			new Node({}, {}, false),
			new Node({}, {}, true),
		];
		assert.deepEqual(compare([fsm_a, fsm_b]), [false, false, true]);
	});
	it('superset', function(){
		const fsm_a = [
			new Node({'a':1, 'b':2}),
			new Node({}, {}, true),
			new Node({}, {}, true),
		];
		const fsm_b = [
			new Node({'a':1, 'b':2}),
			new Node({}, {}, false),
			new Node({}, {}, true),
		];
		assert.deepEqual(compare([fsm_a, fsm_b]), [true, false, false]);
	});
	it('subset', function(){
		const fsm_a = [
			new Node({'a':1, 'b':2}),
			new Node({}, {}, true),
			new Node({}, {}, false),
		];
		const fsm_b = [
			new Node({'a':1, 'b':2}),
			new Node({}, {}, true),
			new Node({}, {}, true),
		];
		assert.deepEqual(compare([fsm_a, fsm_b]), [false, true, false]);
	});
	it('equal', function(){
		const fsm_a = [
			new Node({'a':1, 'b':2}),
			new Node({}, {}, true),
			new Node({}, {}, false),
		];
		const fsm_b = [
			new Node({'a':1, 'b':2}),
			new Node({}, {}, true),
			new Node({}, {}, false),
		];
		assert.deepEqual(compare([fsm_a, fsm_b]), [true, true, false]);
	});
	it('partial overlap', function(){
		const fsm_a = [
			new Node({'a':1, 'b':2, 'c':3}),
			new Node({}, {}, true),
			new Node({}, {}, false),
			new Node({}, {}, true),
		];
		const fsm_b = [
			new Node({'a':1, 'b':2, 'c':3}),
			new Node({}, {}, true),
			new Node({}, {}, true),
			new Node({}, {}, false),
		];
		assert.deepEqual(compare([fsm_a, fsm_b]), [false, false, false]);
	});
});
