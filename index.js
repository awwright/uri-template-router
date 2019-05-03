
"use strict";

module.exports.Router = Router;

var routeDebug = process.argv && process.argv.indexOf('-v')>=0;
function log(){
	if(routeDebug) console.log.apply(console, arguments);
}
function dir(){
	if(routeDebug) console.dir.apply(console, arguments);
}

function Router(){
	this.routes = [];
	this.tree = new Node;
}

function nid(){
	return 'N'+(nid.i++);
}
nid.i = 0;

// A node on the tree is a list of various options to try to match against an input character.
// The "next" and "list_set" options specify another branch to also try and match against the current input character.
// The "template_match" option specifies the end of the template was reached, and to return a successful match result. This is usually only reachable immediately after matching an EOF.
function Node(){
	this.nid = nid();
	this.chr_offset = null;
	// If we're currently in an expression
	this.match_range = null;
	this.list_repeat = null;
	this.list_repeat_nid = null;
	// If we reach this branch, declare a match for this template
	this.template_match = null;

	// Literal characters to match
	this.match_chr = {};
	// Expression prefixes to match
	this.match_pfx = {};
	// Alternative sets to try matching at the same time
	this.list_set = {};
	// The keys have an order, keep track of the order here
	this.list_set_keys = [];
	// Decend into this for more alternatives
	this.list_next = null;
	this.list_skp = null;
	this.list_skp_nid = null;
}
Node.prototype.toString = function toString(){
	return '[Node '+this.nid+']';
}

var rule_literals = /([\x21\x23-\x24\x26\x28-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E\xA0-\uD7FF\uE000-\uFDCF\uFDF0-\uFFEF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|%[0-9A-Fa-f][0-9A-Fa-f])/;
var rule_varspec = /^([0-9A-Za-z_]|%[0-9A-Fa-f]{2})(\.?([0-9A-Za-z_]|%[0-9A-Fa-f]{2}))*(:[0-9]{0,3}|\*)?$/;

module.exports.Route = Route;
function Route(uriTemplate, options, matchValue){
	if(typeof uriTemplate!=='string') throw new Error('Expected `uriTemplate` to be a string');
	this.uriTemplate = uriTemplate;
	this.options = options;
	this.matchValue = matchValue;

	// Parse the URI template
	var varnames = this.varnames = {};
	var variables = this.variables = [];
	var tokens = this.tokens = [];
	for(var uri_i=0; uri_i<uriTemplate.length; uri_i++){
		var chr = uriTemplate[uri_i];
		if(chr=='{'){
			var endpos = uriTemplate.indexOf('}', uri_i+2);
			if(endpos<0) throw new Error('Unclosed expression: Expected "}" but found end of template');
			var patternBody = uriTemplate.substring(uri_i+1, endpos);
			uri_i = endpos;
			// If the first character is part of a valid variable name, assume the default modifier
			// Else, assume the first character is a modifier
			var modifierChar = patternBody[0].match(/[a-zA-Z0-9_%]/) ? '' : patternBody[0] ;
			var modifier = Router.modifiers[modifierChar];
			if(!modifier){
				throw new Error('Unknown expression operator: '+JSON.stringify(modifier));
			}
			var prefix = modifier.prefix;
			var prefixNext = modifier.prefixNext;
			patternBody
			.substring(modifierChar.length)
			.split(/,/g)
			.map(function(varspec, index){
				if(!varspec.match(rule_varspec)){
					throw new Error('Malformed expression '+JSON.stringify(varspec));
				}
				// Test for explode modifier
				if(varspec.match(/\*$/)){
					if(!prefixNext){
						throw new Error('Variable modifier '+JSON.stringify(modifier)+' does not work with explode modifier');
					}
					var varname = varspec.substring(0, varspec.length-1);
					var explode = true;
				}else{
					var varname = varspec;
					var explode = false;
				}
				// Test for substring modifier
				if(varname.indexOf(':')>=0){
					var [varname, len] = varname.split(':');
				}
				return {
					varname: varname,
					modifier: modifierChar,
					prefix: index ? prefixNext : prefix,
					prefixNext: prefixNext,
					range: modifier.range,
					withName: modifier.withName,
					explode: explode,
					optional: true,
					length: len || null,
				};
			})
			.forEach(function(varspec, index){
				if(varnames[varspec.varname]){
					throw new Error('Variable '+JSON.stringify(varspec.varname)+' is already used');
				}
				var expressionInfo = {};
				varspec.index = Object.keys(varnames).length;
				varnames[varspec.varname] = varspec;
				variables[varspec.index] = varspec;
				var range = varspec.range + (varspec.explode?'*':'');

				tokens.push(varspec);
			});
		}else if(chr.match(rule_literals)){
			// Decend node into the branch, creating it if it doesn't exist
			// if chr is undefined, this will set the key "undefined"
			if(typeof tokens[tokens.length-1]=='string') tokens[tokens.length-1] += chr;
			else tokens.push(chr);
		}else{
			throw new Error('Unexpected character '+JSON.stringify(chr));
		}
	}
}
Route.prototype.gen = function Route_gen(data){
	if(typeof data!='object') throw new Error('Expected arguments[0] `data` to be an object');
	var out = "";
	function encodeURIComponent_v(v){
		return encodeURIComponent(v).replace(/!/g, '%21');
	}
	this.tokens.forEach(function(t){
		var varvalue = data[t.varname];
		if(typeof t=='string') out += t;
		else if(typeof t=='object'){
			var encode = (t.range==='RESERVED_UNRESERVED') ? encodeURI : encodeURIComponent_v ;
			if(typeof varvalue=='string' || typeof varvalue=='number'){
				out += t.prefix || '';
				var value = varvalue;
				if(t.length) value = value.substring(0, t.length);
				if(t.withName) out += t.varname + '=';
				out += encode(value);
			}else if(Array.isArray(varvalue) && varvalue.length>0){
				out += t.prefix || '';
				if(t.explode){
					out += varvalue.map(function(value){
						if(t.length) value = value.toString().substring(0, t.length);
						if(t.withName) return t.varname + '=' + encode(value);
						else return encode(value);
					}).join(t.prefixNext);
				}else{
					var value = varvalue;
					if(t.length) value = value.substring(0, t.length);
					if(t.withName) out += t.varname + '=';
					out += value.map(function(v){ return encode(v); }).join(',');
				}
			}else if(typeof varvalue == 'object' && varvalue){
				if(t.length){
					throw new Error('Cannot substring object');
				}
				out += t.prefix || '';
				if(t.explode){
					out += Object.keys(varvalue).map(function(key){
						if(t.withName) return key + '=' + encode(varvalue[key]);
						else return encode(varvalue[key]);
					}).join(t.prefixNext);
				}else{
					out += Object.keys(varvalue).map(function(key){
						return key + ',' + encode(varvalue[key]);
					}).join(',');
				}
			}
		}
	});
	return out;
}
Object.defineProperty(Route.prototype, "name", {
	get: function templateGet(){ return this.matchValue; },
});

function Result(router, uri, options, route, data, remaining_state){
	this.router = router;
	this.uri = uri;
	this.options = options;
	this.route = route;
	this.uriTemplate = route.uriTemplate;
	this.matchValue = route.matchValue;
	this.data = data;
	this.remaining_state = remaining_state;
}

Result.prototype.rewrite = function rewrite(uriTemplate, options, name){
	if(typeof uriTemplate==='string'){
		uriTemplate = new Route(uriTemplate, options, name);
	}
	var uri = uriTemplate.gen(this.data);

	return new Result(this.router, uri, options, uriTemplate, this.data);
}

Result.prototype.next = function next(){
	return this.router.resolveURI(this.uri, this.options, this.remaining_state);
}

Object.defineProperty(Result.prototype, "template", {
	get: function templateGet(){ return this.uriTemplate; },
	set: function templateSet(v){ return this.uriTemplate = v; },
})

Object.defineProperty(Result.prototype, "name", {
	get: function templateGet(){ return this.matchValue; },
});


var RANGES = {
	UNRESERVED: ['-.', '09', 'AZ', '_', 'az', '~'],
	RESERVED_UNRESERVED: ['#', '&', '()', '*;', '=', '?[', ']', '_', 'az', '~'],
	QUERY: [
		'AZ', 'az', '09', "-", ".", "_", "~", // unreserved (from pchar)
		"!", "$", "&", "'", "(", ")", "*", "+", ",", ";", "=", // sub-delims (from pchar)
		':', '@', // colon and at-sign (from pchar)
		'/', '?', // and slash and question-mark
	],
};
function getRangeMap(range){
	var validMap = {};
	range.forEach(function(chr){
		if(chr.length==1){
			validMap[chr] = null;
		}else if(chr.length==2){
			for(var i=chr.charCodeAt(0), end=chr.charCodeAt(1); i<=end; i++){
				validMap[String.fromCharCode(i)] = null;
			}
		}
	});
	return validMap;
}
var RANGES_MAP = {};
Object.keys(RANGES).forEach(function(name){ RANGES_MAP[name] = getRangeMap(RANGES[name]); });

function Modifier(prefix, prefixNext, range, withName){
	this.prefix = prefix;
	this.prefixNext = prefixNext;
	this.range = range;
	this.withName = withName;
}

Router.modifiers = {
	'': new Modifier('', ',', 'UNRESERVED', false),
	'+': new Modifier('', ',', 'RESERVED_UNRESERVED', false),
	'#': new Modifier('#', ',', 'RESERVED_UNRESERVED', false),
	'.': new Modifier('.', '.', 'UNRESERVED', false),
	'/': new Modifier('/', '/', 'UNRESERVED', false),
	';': new Modifier(';', ';', 'UNRESERVED', true),
	'?': new Modifier('?', '&', 'UNRESERVED', true),
	'&': new Modifier('&', '&', 'UNRESERVED', true),
};

Router.prototype.addTemplate = function addTemplate(uriTemplate, options, matchValue){
	if(typeof uriTemplate=='object' && options===undefined && matchValue===undefined){
		var route = uriTemplate;
		uriTemplate = route.uriTemplate;
		options = route.options;
		matchValue = route.matchValue;
	}else{
		var route = new Route(uriTemplate, options, matchValue);
	}
	this.routes.push(route);

	// Iterate over tokens in route to add the route to the tree
	var node = this.tree;
	var template_i = 0;
	function addPath(varspec){
		if(typeof varspec=='string'){
			for(var i=0; i<varspec.length; i++){
				var chr = varspec[i];
				// Decend node into the branch, creating it if it doesn't exist
				node.match_chr[chr] = node.match_chr[chr] || new Node;
				node = node.match_chr[chr];
				node.chr_offset = template_i;
				template_i++;
			}
		}else if(varspec===undefined){
			// EOF condition
			var chr = 'undefined';
			node.match_chr[chr] = node.match_chr[chr] || new Node;
			node = node.match_chr[chr];
			node.chr_offset = template_i;
			template_i++;
		}else if(typeof varspec=='object'){
			var setNext = [];
			if(varspec.optional){
				setNext.push(node);
			}
			if(varspec.prefix){
				node.match_pfx[varspec.prefix] = node.match_pfx[varspec.prefix] || new Node;
				node.match_pfx_vpush = varspec.explode?varspec.index:undefined;
				node = node.match_pfx[varspec.prefix];
			}
			node.list_set = node.list_set || {};
			node.list_set[varspec.range] = node.list_set[varspec.range] || new Node;
			// Cache the ranges in use and sort them based on set size
			node.list_set_keys = Object.keys(node.list_set);
			node.list_set_keys.sort(function(a, b){ return RANGES_MAP[a].length - RANGES_MAP[b].length; });
			node = node.list_set[varspec.range];
			node.match_range = varspec.range;
			node.match_range_vindex = varspec.index;
			node.list_next = node.list_next || new Node;
			node = node.list_next;
			if(varspec.explode){
				// The optional stuff
				var nodeStart = node;
				// nth expression prefix
				setNext.push(node);
				node.match_pfx[varspec.prefixNext] = node.match_pfx[varspec.prefixNext] || new Node;
				node.match_pfx_vpush = varspec.explode?varspec.index:undefined;
				node = node.match_pfx[varspec.prefixNext];
				// nth expression body
				node.list_set = node.list_set || {};
				node.list_set[varspec.range] = node.list_set[varspec.range] || new Node;
				// Don't forget to sort!
				node.list_set_keys = Object.keys(node.list_set);
				node.list_set_keys.sort(function(a, b){ return RANGES_MAP[a].length - RANGES_MAP[b].length; });
				node = node.list_set[varspec.range];
				node.match_range = varspec.range;
				node.match_range_vindex = varspec.index;
				node.list_repeat = node.list_repeat || new Node;
				node.list_repeat.match_pfx[varspec.prefixNext] = node;
				node.list_repeat.match_pfx_vpush = varspec.explode?varspec.index:undefined;
				node.list_next = node.list_next || new Node;
				node = node.list_next;
			}
			setNext.forEach(function(n){
				n.list_next = node;
			});
			template_i++;
		}
	}
	route.tokens.forEach(addPath);
	addPath(undefined);
	if(node.template_match){
		throw new Error('Route already defined');
	}
	node.template_match = route;
	return route;
}

var S = {
	EOF: 10, // Expending end of input
	CHR: 20, // Expecting a character, or "%" to begin a pct-encoded sequence
	PCT1: 31, // Expecting first hex char of a pct-encoded sequence
	PCT2: 32, // Expecting the second hex char of a pct-encoded sequence
};
// Enable for testing
for(var n in S) S[n]=n;

// Some constants
var MATCH_CHR = 'match_chr';
var MATCH_PFX = 'match_pfx';
var MATCH_RANGE = 'match_range';

var MATCH_SORT = {
	INIT: 0,
	MATCH_CHR: 10,
	MATCH_PFX: 20,
	MATCH_RANGE: {
		UNRESERVED: 30,
		RESERVED_UNRESERVED: 31,
		QUERY: 32,
	},
};

function State(prev, offset, branch, mode, type, sort, vpush, vindex){
	if(prev && !(prev instanceof State)) throw new Error('prev not instanceof State');
	if(prev && (offset !== prev.offset+1)) throw new Error('out-of-order state history, expected '+(prev.offset+1)+' got '+offset);
	if(!(branch instanceof Node)) throw new Error('branch not instanceof Node');
	if(typeof sort!=='number') throw new Error('Expected `sort` to be a number');
	// The state at the previous character
	this.prev = prev;
	// The current character position
	this.offset = offset;
	// Branch of the tree the match made found on
	this.branch = branch;
	// The type of character being consumed (CHR, PCT1, etc.)
	this.mode = mode;
	// The type of match that was made (match_pfx, etc.)
	this.type = type;
	// The sort order of the match that was made
	this.sort = sort;
	// The order the match was inserted into the tree, e.g. in case an expression is skipped, prefer the earlier matched one
	this.weight = 0;
	// If an expression prefix is being matched, and needs to be pushed onto an array, which expression
	this.vpush = vpush;
	// If a variable is being matched, which expression
	this.vindex = vindex;
}
State.prototype.match = function match(branch, mode, type, sort, vpush, vindex){
	return new State(this, this.offset+1, branch, mode, type, sort, vpush, vindex);
}

// Let StateSet = ( int offset, pointer tier, Set<Branch> equal_alternatives )
// Process:
// Let parse_backtrack be a queue of sets of branches
// Let parse_next and stateset_this be a set of branches
// For each character in input:
// Set stateset_this = parse_next, and re-initialize parse_next
// For each state in stateset_this:
//   If there's expressions to potentially match, push the set of them as a single item front of parse_backtrack
//   Try to match next character of input to next literal in template. Push all matches onto parse_next queue.
//   If parse_next is empty, set it to the next item popped off of parse_backtrack

Router.prototype.resolveURI = function resolve(uri, flags, initial_state){
	if(typeof uri!=='string') throw new Error('Expected arguments[0] `uri` to be a string');
	var self = this;
	if(initial_state){
		var parse_backtrack = initial_state.slice();
	}else{
		var parse_backtrack = [new State(null, 0, this.tree, S.CHR, MATCH_CHR, MATCH_SORT.INIT, null)];
	}
	function consumeInputCharacter(offset, chr, state, branch){
		if(!(branch instanceof Node)) throw new Error('branch not instanceof Node');
		const stack = [];
		function append(v){
			stack.push(v);
		}

		// First try patterns with exact character matches
		if(branch.match_chr[chr]){
			append(state.match(branch.match_chr[chr], S.CHR, MATCH_CHR, MATCH_SORT.MATCH_CHR));
		}

		// If the match_pfx isn't matched, then skip over the following match_range too...
		if(branch.match_pfx[chr]){
			append(state.match(branch.match_pfx[chr], S.CHR, MATCH_PFX, MATCH_SORT.MATCH_PFX, branch.match_pfx_vpush, undefined));
		}

		// Then try patterns with range matches
		for(var i=0; i<branch.list_set_keys.length; i++){
			var rangeName = branch.list_set_keys[i];
			var validRange = RANGES_MAP[rangeName];
			consumeInputCharacter(offset, chr, state, branch.list_set[rangeName]).forEach(append);
		}

		if(branch.match_range){
			var validRange = RANGES_MAP[branch.match_range];
			if(chr in validRange){
				var sort = MATCH_SORT.MATCH_RANGE[branch.match_range];
				append(state.match(branch, S.CHR, MATCH_RANGE, sort, undefined, branch.match_range_vindex));
			}
		}
		// If the expression is optional, try skipping over it, too
		if(branch.list_next){
			log(' list_next', branch.list_next.nid);
			consumeInputCharacter(offset, chr, state, branch.list_next).forEach(append);
		}
		if(branch.list_repeat){
			log(' +list_repeat', branch.list_repeat.nid);
			// Push repeat parsing first before everything else (lowest priority)
			consumeInputCharacter(offset, chr, state, branch.list_repeat).forEach(append);
		}
		return stack;
	}
	for(var offset = 0;;){
		var state = parse_backtrack.shift();
		//log(stateset_this);
		if(!state) break;
		offset = state.offset;
		if(offset > uri.length) continue;
		//if(offset > uri.length) throw new Error('Overgrew offset');
		// This will set chr===undefined for the EOF position
		// We could also use another value like "\0" or similar to represent EOF
		var chr = uri[offset];
		var stack = consumeInputCharacter(offset, chr, state, state.branch);
		// Take all the equal alternatives that matched the EOF and if there's exactly one, return it.
		if(offset==uri.length){
			var solutions = stack
				.filter(function(v){ return v.branch && v.branch.template_match; })
				.map(function(v){ return finish(v); });
			if(solutions.length>1){
				return solutions[0];
				//log(solutions);
				//throw new Error('Multiple equal templates matched');
			}else if(solutions.length==1){
				return solutions[0];
			}
		}
		// Force the order of matches to prefer single-character matches (the `sort`)
		// Otherwise, preserve insertion order (the `weight`)
//		stack.forEach(function(v, i){ v.weight = i; });
//		stack.sort(function(a, b){ return (a.sort - b.sort) || (a.weight - b.weight); });
//		stack.forEach(function(v){ parse_backtrack.push(v); });
		stack.forEach(function(v){ if(v.type==MATCH_CHR) parse_backtrack.push(v); });
		stack.forEach(function(v){ if(v.type==MATCH_PFX) parse_backtrack.push(v); });
		stack.forEach(function(v){ if(v.type==MATCH_RANGE) parse_backtrack.push(v); });
	}

	function matchedExpressions(solution){
		var history = [];
		for(var item=solution; item.prev; item=item.prev){
			//log(item.offset);
			//dir(item, {depth:2});
			var branch = item.branch;
			history.unshift({
				chr: uri[item.prev.offset],
				offset: item.prev.offset,
				type: item.type,
				vindex: item.vindex,
				vpush: item.vpush,
				nid: branch.nid,
			});
		}
		dir(history);
		var var_list = [];
		for(var item_i=0; item_i<history.length; item_i++){
			var item = history[item_i];
			var chr = item.chr || '';
			if(item.vpush!==undefined){
				var_list[item.vpush] = var_list[item.vpush] || [];
				var_list[item.vpush].push('');
			}else if(item.vindex!==undefined){
				var varv = var_list[item.vindex];
				if(Array.isArray(varv)){
					if(chr) varv[varv.length-1] = varv[varv.length-1] + chr;
				}else{
					if(chr) var_list[item.vindex] = (varv||'') + chr;
				}
			}
		}
		return var_list;
	}

	function finish(solution){
		var var_list = matchedExpressions(solution);
		var route = solution.branch.template_match;
		var bindings = {};
		route.variables.forEach(function(v){
			if(var_list[v.index]!==undefined) bindings[v.varname] = var_list[v.index];
		});
		return new Result(self, uri, flags, route, bindings, parse_backtrack);
	}
}
