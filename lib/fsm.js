'use strict';

module.exports.range = range;
function *range(str){
	for(var i=0; i<str.length; i++){
		const chr = str[i];
		if(chr !== '-' && str[i+1]==='-' && str[i+2]){
			for(var j=str.charCodeAt(i), end=str.charCodeAt(i+2); j<=end; j++){
				yield String.fromCharCode(j);
			}
			i += 2;
		}else{
			yield chr;
		}
	}
}

const rangeSets = new Map;

// A node on the tree is a list of various options to try to match against an input character.
// The "next" and "list_set" options specify another branch to also try and match against the current input character.
// The "template_match" option specifies the end of the template was reached, and to return a successful match result. This is usually only reachable immediately after matching an EOF.
module.exports.Node = Node;
function Node(transitions, partials, final){
	if(typeof partials === 'number') throw new Error;
	partials = partials || {};
	this.transitions = transitions || {};
	// if(Object.keys(partials).length===0){
	// 	throw new Error('Expected partial match info');
	// }
	// Maps final state -> information about the meaning of this transition given the final state
	this.partials = partials || {};
	// If we reach this branch, declare a match for this template
	this.final = final || false;
	this.classes = Object.keys(transitions).filter(v => v.length>1).sort((a,b) => a.length-b.length);
}

Node.prototype.get = function get(chr){
	if(this.transitions[chr] !== undefined){
		return this.transitions[chr];
	}
	// If the chr is a pct-encoded sequence and there's no individual transition,
	// then it matches a character class transition if defined
	if(chr[0]==='%' && chr.length===3){
		if(this.transitions["-.0-9A-Z_a-z~"] !== undefined){
			return this.transitions["-.0-9A-Z_a-z~"];
		}else if(this.transitions["-.0-9A-Z_a-z~:/?#[]@!$&'()*+,;="] !== undefined){
			return this.transitions["-.0-9A-Z_a-z~:/?#[]@!$&'()*+,;="];
		}
	}
	for(const tr of this.classes){
		if(!rangeSets.has(tr)){
			rangeSets.set(tr, new Set(range(tr)));
		}
		if(rangeSets.get(tr).has(chr)){
			return this.transitions[tr];
		}
	}
	// FIXME this is a huge hack that does not scale to multiple character classes
	if(chr === "-.0-9A-Z_a-z~" && this.transitions["-.0-9A-Z_a-z~:/?#[]@!$&'()*+,;="]!==undefined){
		return this.transitions["-.0-9A-Z_a-z~:/?#[]@!$&'()*+,;="];
	}
};

module.exports.verify = verify;
function verify(fsm){
	if(!Array.isArray(fsm)){
		throw new Error('Expected `fsm` to be an Array');
	}
	fsm.forEach(function(st, i){
		if(typeof st !== 'object'){
			throw new Error('Expected fsm[i] to be an object');
		}
		for(var symbol in st.transitions){
			if(typeof st.transitions[symbol] !== 'number'){
				throw new Error('Expected fsm['+JSON.stringify(i)+']['+JSON.stringify(symbol)+'] to be a number, got '+typeof st[symbol]);
			}
			if(st.transitions[symbol] >= fsm.length){
				throw new Error('Expected fsm['+JSON.stringify(i)+']['+JSON.stringify(symbol)+'] to be a state in `fsm`');
			}
		}
	});
}

module.exports.union = union;
function union(fsms, ordering){
	function partial_union(states){
		const map = {};
		for(var i=0; i<states.length; i++){
			if(states[i]===undefined) continue;
			for(var k in states[i].partials){
				map[k] = states[i].partials[k];
			}
		}
		return map;
	}
	function final_union(states){
		function sort_final(a, b){
			return ordering.get(a.route) - ordering.get(b.route);
		}
		if(states.some(final => final && (Array.isArray(final) ? final.length : final))){
			const items = states.flatMap(final => (final && Array.isArray(final)) ? final : []);
			if(ordering) items.sort(sort_final);
			return items.length ? items : true;
		}else{
			return false;
		}
	}
	return parallel(fsms, partial_union, final_union);
}


module.exports.parallel = parallel;
function parallel(fsms, partial, final){
	if(!Array.isArray(fsms)) throw new Error('Expected `fsms` to be an array of arrays');
	fsms.forEach(verify);

	// By convention, start on the 0 state
	const cross_product_list = [ fsms.map(v=>0) ];
	// A handy mapping of each cross-product state to its new state
	const cross_product_map = new Map([[fsms.map(v=>0).join(','), 0]]);
	// The new states
	const combination_states = [];

	// iterate over a growing list
	for(var i=0; i<cross_product_list.length; i++){
		const state_i = cross_product_list[i];
		const state = state_i.map( (i,j) => fsms[j][i] );
		
		// Compute the symbols used by each state
		// const alphabet = new Set(fsms.flatMap(v => [...v.transitions.keys()]));
		const alphabet = new Set(state.flatMap(fsm_st => fsm_st ? Object.keys(fsm_st.transitions) : []));

		// compute map for this state
		const transitions = {};
		for(const symbol of alphabet){
			const next = state.map(function(fsm_st){
				// Returning undefined is OK
				return fsm_st && fsm_st.get(symbol);
			});
			// Generate a key name for this cross-product
			const nextKey = next.join(',');
			const nextId = cross_product_map.get(nextKey);
			if(nextId !== undefined){
				// If there is already a state representing this cross-product, point to that
				transitions[symbol] = nextId;
			}else{
				// Create a new state
				transitions[symbol] = cross_product_list.length;
				cross_product_map.set(nextKey, cross_product_list.length);
				cross_product_list.push(next);
			}
		}

		combination_states[i] = new Node(transitions, partial(state), final(state.map(v => v && v.final)));
	}

	return combination_states;
}

module.exports.concat = concat;
function concat(fsms){
	if(!Array.isArray(fsms)) throw new Error('Expected `fsms` to be an array of arrays');
	fsms.forEach(verify);

	function connect_all(fsm_i, substate){
		/*
			Take a state in the numbered FSM and return a set containing it, plus
			(if it's final) the first state from the next FSM, plus (if that's
			final) the first state from the next but one FSM, plus...
		*/
		const result = [ [fsm_i, substate] ];
		for(var i=fsm_i; i<fsms.length-1 && fsms[i][substate].final; i++){
			result.push([i+1, 0]);
			substate = 0;
		}
		// TODO Ignore states that have no outgoing transitions
		return result.sort();
	}
	
	// Maps new state ids to one of the items in the powerset
	// Start with the first fsm's (0) initial state (0)
	const powerset_list = [ connect_all(0, 0) ];
	// A handy mapping of each cross-product state to its new state
	const powetset_id_map = new Map([['0,0', 0]]);
	// The new fsm after concatenation
	const concat_states = [];


	// iterate over a growing list
	for(var i=0; i<powerset_list.length; i++){
		const powetset_item = powerset_list[i];
		const state = powetset_item.map( ([j,i])=>[j, fsms[j][i]] );
		
		// Compute the symbols used by each state
		const alphabet = new Set(state.flatMap(fsm_st => Object.keys(fsm_st[1].transitions)));
		// compute map for this state
		const transitions = {};
		for(const symbol of alphabet){
			const next_all = state.flatMap(function(fsm_st){
				const [fsm_i, fsm_node] = fsm_st;
				// returning undefined is OK
				if(fsm_node.get(symbol) !== undefined){
					return connect_all(fsm_i, fsm_node.get(symbol));
				}
				return [];
			}).sort();
			// Remove duplicates
			var previous='', next = next_all.filter(function(v){ return (previous.toString()!==(previous=v).toString()); });
			if(!next.length) continue;
			// Generate a key name for this cross-product
			const nextKey = next.join(',');
			const nextId = powetset_id_map.get(nextKey);
			if(nextId !== undefined){
				// Use an existing state representing this cross-product, if available
				transitions[symbol] = nextId;
			}else{
				// Create a state for a new cross-product combination
				transitions[symbol] = powerset_list.length;
				powetset_id_map.set(nextKey, powerset_list.length);
				powerset_list.push(next);
			}
		}
		const partial_matches = Object.fromEntries(state.flatMap(function(v){
			const [_, part] = v;
			return part ? Object.entries(part.partials) : [];
		}));
		const final = powetset_item.some(function(state_val){
			const [fsm_i, substate] = state_val;
			if(fsms[fsm_i][substate].final.length===0) throw new Error('Zero-length final');
			return fsm_i==fsms.length-1 && fsms[fsm_i][substate].final;
		});
		concat_states[i] = new Node(transitions, partial_matches, final);
	}
	return concat_states;
}


module.exports.fromString = fromString;
function fromString(expression, partial){
	const fsm = [];
	for(var i=0; i<expression.length; i++){
		var chr = expression[i];
		if(chr==='%'){
			chr += expression[i+1] + expression[i+2];
			i += 2;
		}
		fsm.push(new Node({[chr]:fsm.length+1}, partial && partial(i)));
	}
	fsm.push(new Node({}, {}, true));
	return fsm;
}

module.exports.optional = optional;
function optional(f){
	const epsilon = [ new Node({}, {}, true) ];
	return union([f, epsilon]);
}

module.exports.star = star;
function star(f){
	const alphabet = f.flatMap(state => Object.keys(state.transitions));
	const initial = [0];

	function follow(current, symbol){
		const next = new Set();
		current.forEach(function(substate){
			if(f[substate] && f[substate].get(symbol)){
				next.add(f[substate].get(symbol));
			}

			// If one of our substates is final, then we can also consider
			// transitions from the initial state of the original FSM.
			if(f[substate].final && f[0].get(symbol)){
				next.add(f[0].get(symbol));
			}
		});
		if(next.size === 0) return;
		return [...next].sort();
	}

	function final(state){
		return state.some( (substate)=> f[substate].final );
	}

	const states_list = [initial];
	const states_map = new Map([[initial.toString(), 0]]);
	const states = [];

	// iterate over a growing list
	for(var i=0; i<states_list.length; i++){
		const state = states_list[i];
		
		// compute map for this state
		const transitions = {};
		for(const symbol of alphabet){
			const next = follow(state, symbol);
			if(next===undefined) continue;
			const nextKey = next.join(',');
			const nextId = states_map.get(nextKey);
			if(nextId !== undefined){
				// If there is already a state representing this cross-product, point to that
				transitions[symbol] = nextId;
			}else{
				// Create a new state
				transitions[symbol] = states_list.length;
				states_map.set(nextKey, states_list.length);
				states_list.push(next);
			}
		}
		states[i] = new Node(transitions, {}, final(state));
	}

	return optional(states);
}

// This probably isn't needed
module.exports.reverse = reverse;
function reverse(f){
	const alphabet = f.flatMap(state => Object.keys(state.transitions));
	const initial = f.map((v, i) => v.final ? i : undefined).filter(v => v!==undefined);
	const powerset_list = [initial];
	const powerset_stateid_map = new Map([[initial.join(','), 0]]);
	const states = []; // states[0] will be filled in by the first iteration of this loop

	// iterate over a growing list
	for(var i=0; i<powerset_list.length; i++){
		const powerset_combination = powerset_list[i];

		// compute map for this state
		const transitions = {};
		for(const symbol of alphabet){
			const next = f.map(function(state, i){
				return powerset_combination.some(function(state0){
					return state.get(symbol)===state0;
				}) ? i : undefined;
			}).filter(v => (v!==undefined)).sort();
			if(next.length===0) continue;
			const nextKey = next.join(',');
			const nextIdx = powerset_stateid_map.get(nextKey);
			if(nextIdx !== undefined){
				// If there is already a state with identical transitions, point to that
				transitions[symbol] = nextIdx;
			}else{
				// Create a new state
				transitions[symbol] = powerset_list.length;
				powerset_stateid_map.set(nextKey, powerset_list.length);
				powerset_list.push(next);
			}
		}

		// Trim character transitions that are the same as the group transition
		for(const tr in transitions){
			if(tr.length <= 1 || tr[0]==='%') continue;
			var shadowed = true;
			// TODO trim pct-encoded sequences that are the same as the character class
			// And trim character classes that are the same as larger character classes
			for(const chr of range(tr)){
				if(transitions[chr]===transitions[tr]){
					delete transitions[chr];
				}
				if(!transitions[chr]){
					shadowed = false;
				}
			}
			if(shadowed){
				delete transitions[tr];
			}
		}
		states[i] = new Node(transitions, {}, powerset_combination.indexOf(0) >= 0);
	}

	return states;
}

module.exports.reduce = reduce;
function reduce(f){
	return reverse(reverse(f));
}

module.exports.compare = compare;
function compare(fsms){
	if(fsms.length !== 2){
		throw new Error('Expected 2 fsms to compare');
	}
	var isSuperset = true, isSubset = true, isDisjoint = true;
	function partial_union(states){
	}
	function final_union(states){
		const a = Array.isArray(states[0]) ? states[0].length : states[0];
		const b = Array.isArray(states[1]) ? states[1].length : states[1];
		if(!a && b) isSuperset = false;
		if(a && !b) isSubset = false;
		if(!!a && !!b) isDisjoint = false; // set to false when there are some final elements in common
	}
	parallel(fsms, partial_union, final_union);
	return [isSuperset, isSubset, isDisjoint];
}
