"use strict";

module.exports.Router = Router;

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
function sortRanges(a, b){
	return RANGES_MAP[a].length - RANGES_MAP[b].length;
}

function encodeURIComponent_v(v){
	return encodeURIComponent(v).replace(/!/g, '%21');
}

function Operator(prefix, separator, delimiter, range, named, form){
	this.prefix = prefix;
	this.separator = separator;
	this.delimiter = delimiter;
	this.range = range;
	this.named = named;
	this.form = form;
}

const operators = {
	'': new Operator( '',  ',', null, 'UNRESERVED', false),
	'+': new Operator('',  ',', null, 'RESERVED_UNRESERVED', false),
	'#': new Operator('#', ',', null, 'RESERVED_UNRESERVED', false),
	'.': new Operator('.', '.', '.',  'UNRESERVED', false),
	'/': new Operator('/', '/', '/',  'UNRESERVED', false),
	';': new Operator(';', ';', ';',  'UNRESERVED', true, false),
	'?': new Operator('?', '&', '&',  'UNRESERVED', true, true),
	'&': new Operator('&', '&', '&',  'UNRESERVED', true, true),
};

function Router(){
	this.routes = [];
	this.nid = 0;
	this.tree = new Node(null, ++this.nid);
}

// A node on the tree is a list of various options to try to match against an input character.
// The "next" and "list_set" options specify another branch to also try and match against the current input character.
// The "template_match" option specifies the end of the template was reached, and to return a successful match result. This is usually only reachable immediately after matching an EOF.
function Node(range, nid){
	if(range && range.length>1 && !RANGES_MAP[range]) throw new Error('Unknown range '+range);
	this.range = range;
	this.nid = nid;
	this.chr_offset = null;
	// If we're currently in an expression
	this.match_range = null;
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
	// Descend into this for more alternatives
	this.list_next = null;
	this.list_skp = null;
	this.list_skp_nid = null;
}
Node.prototype.test = function test(chr){
	if(this.range===undefined){
		// Undefined matches everything
		return true;
	}else if(this.range===null || this.range.length===1){
		return chr===this.range;
	}else if(this.range.length > 1){
		if(!RANGES_MAP[this.range]) throw new Error('Unknown range '+this.range);
		return (chr in RANGES_MAP[this.range]);
	}

}
Node.prototype.toString = function toString(){
	return '[Node '+this.nid+']';
};

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
	var expressionList = [];
	for(var uri_i=0; uri_i<uriTemplate.length; uri_i++){
		var chr = uriTemplate[uri_i];
		if(chr==='%'){
			if(uriTemplate.substring(uri_i, uri_i+2).match(/^%[0-9A-F]{2}$/)){
				chr += uriTemplate[uri_i+1] + uriTemplate[uri_i+2];
				uri_i += 2;
			}else{
				throw new Error('Invalid pct-encoded sequence');
			}
		}
		if(chr=='{'){
			var endpos = uriTemplate.indexOf('}', uri_i+2);
			if(endpos<0) throw new Error('Unclosed expression: Expected "}" but found end of template');
			var patternBody = uriTemplate.substring(uri_i+1, endpos);
			uri_i = endpos;
			// If the first character is part of a valid variable name, assume the default operator
			// Else, assume the first character is a operator
			var operatorChar = patternBody[0].match(/[a-zA-Z0-9_%]/) ? '' : patternBody[0] ;
			var operator = operators[operatorChar];
			if(!operator){
				throw new Error('Unknown expression operator: '+JSON.stringify(operatorChar));
			}
			const expression = Expression.from(patternBody, expressionList.length);
			expression.variableList.forEach(function(varspec){
				varspec.index = Object.keys(varnames).length;
				varnames[varspec.varname] = varspec;
				variables[varspec.index] = varspec;
			});
			expressionList.push(expression);
			tokens.push(expression);
		}else if(chr.match(rule_literals)){
			if(typeof tokens[tokens.length-1]=='string') tokens[tokens.length-1] += chr;
			else tokens.push(chr);
		}else{
			throw new Error('Unexpected character '+JSON.stringify(chr));
		}
	}
}
Route.prototype.gen = function Route_gen(params){
	if(typeof params!='object') throw new Error('Expected arguments[0] `params` to be an object');
	return this.tokens.map( (v)=>v.toString(params) ).join('');
};
Route.prototype.toString = function toString(params){
	return this.tokens.map( (v)=>v.toString(params) ).join('');
}

module.exports.Expression = Expression;
function Expression(operatorChar, variableList, index){
	if(typeof operatorChar !== 'string') throw new Error('Expected `operatorChar` to be a string');
	if(!operators[operatorChar]) throw new Error('Unknown operator: '+JSON.stringify(operatorChar));
	variableList.forEach(function(v){
		if(!(v instanceof Variable)) throw new Error('Expected `variableList` to be array of Variable instances');
	});
	this.operatorChar = operatorChar;
	this.prefix = operators[operatorChar].prefix;
	this.separator = operators[operatorChar].separator;
	this.range = operators[operatorChar].range;
	this.variableList = variableList;
	this.index = index;
}
Expression.from = function(patternBody, index){
	// If the first character is part of a valid variable name, assume the default operator
	// Else, assume the first character is a operator
	var operatorChar = patternBody[0].match(/[a-zA-Z0-9_%]/) ? '' : patternBody[0] ;
	var operator = operators[operatorChar];
	if(!operator){
		throw new Error('Unknown expression operator: '+JSON.stringify(operator));
	}
	const variableList = patternBody
		.substring(operatorChar.length)
		.split(/,/g)
		.map( Variable.from.bind(null, operatorChar) );
	return new Expression(operatorChar, variableList, index);
};
Expression.prototype.toString = function toString(params){
	const operator = operators[this.operatorChar];
	if(params){
		const values = this.variableList.map( (v)=>v.expand(params) ).filter( (v)=>(typeof v==='string') );
		if(values.length){
			return operator.prefix + values.join(operator.separator);
		}else{
			return '';
		}
	}else{
		// toString will join the Variable#toString() values with commas
		return '{' + this.operatorChar + this.variableList.toString() + '}';
	}
};

module.exports.Variable = Variable;
function Variable(operatorChar, varname, explode, maxLength){
	if(typeof varname !== 'string') throw new Error('Expected `varname` to be a string');
	if(typeof operatorChar !== 'string') throw new Error('Expected `operatorChar` to be a string');
	const operator = operators[operatorChar];
	if(!operators[operatorChar]) throw new Error('Expected `operator` to be a valid operator');
	if(typeof explode !== 'boolean') throw new Error('Expected `explode` to be a boolean');
	if(maxLength!==null && typeof maxLength !== 'number') throw new Error('Expected `maxLength` to be a number');
	this.operatorChar = operatorChar;
	this.varname = varname;
	this.explode = explode;
	this.maxLength = maxLength;
	this.optional = true;
	this.prefix = operator.prefix;
	this.separator = operator.separator;
	this.delimiter = operator.delimiter;
	this.range = operator.range;
	this.named = operator.named;
}
Variable.from = function(operatorChar, varspec){
	if(!varspec.match(rule_varspec)){
		throw new Error('Malformed variable '+JSON.stringify(varspec));
	}
	const separator = operators[operatorChar];
	// Test for explode operator
	const explode = !!varspec.match(/\*$/);
	const varnameMaxLength = explode ? varspec.substring(0, varspec.length-1) : varspec;
	if(explode && !separator){
		throw new Error('Variable operator '+JSON.stringify(operatorChar)+' does not work with explode modifier');
	}
	// Test for substring modifier
	const varnameMaxLength_i = varnameMaxLength.indexOf(':');
	const varname = varnameMaxLength_i<0 ? varnameMaxLength : varnameMaxLength.substring(0, varnameMaxLength_i);
	const maxLengthStr = varnameMaxLength_i<0 ? null : varnameMaxLength.substring(varnameMaxLength_i+1);
	const maxLength = maxLengthStr ? parseInt(maxLengthStr, 10) : null;
	return new Variable(
		operatorChar,
		varname,
		explode,
		maxLength,
	);
};
Variable.prototype.toString = function(params){
	if(params) return this.expand(params);
	return this.varname +
		(this.explode ? '*' : '') +
		(typeof this.maxLength==='number' ? ':'+this.maxLength : '');
};
Variable.prototype.expand = function(params){
	const t = this;
	const op = operators[t.operatorChar];
	var varvalue = params[t.varname];
	var encode = (op.range==='RESERVED_UNRESERVED') ? encodeURI : encodeURIComponent_v ;
	if(typeof varvalue=='string' || typeof varvalue=='number'){
		var value = varvalue;
		if(t.maxLength) value = value.substring(0, t.maxLength);
		if(op.named){
			if(op.form || value) return t.varname + '=' + encode(value);
			else return t.varname;
		}else{
			return encode(value);
		}
	}else if(Array.isArray(varvalue) && varvalue.length>0){
		if(t.explode){
			const items = varvalue.map(function(value){
				if(t.maxLength) value = value.toString().substring(0, t.maxLength);
				if(op.named){
					if(op.form || value) return t.varname + '=' + encode(value);
					else return t.varname;
				}else{
					return encode(value);
				}
			});
			return items.length ? items.join(t.separator) : null;
		}else{
			var value = varvalue;
			if(t.maxLength) value = value.substring(0, t.maxLength);
			if(value.length===0) return null;
			if(op.named){
				return t.varname + '=' + value.map(function(v){ return encode(v); }).join(',');
			}else{
				return value.map(function(v){ return encode(v); }).join(',');
			}
		}
	}else if(typeof varvalue == 'object' && varvalue){
		if(t.maxLength){
			throw new Error('Cannot substring object');
		}
		if(t.explode){
			// Apparently op.named doesn't matter in this case
			const items = Object.keys(varvalue).map(function(key){
				if(op.form || varvalue[key]) return encode(key) + '=' + encode(varvalue[key]);
				else return key;
			});
			return items.length ? items.join(t.separator) : null;
		}else{
			if(op.named){
				const items = Object.keys(varvalue).map(function(key){
					return encode(key) + ',' + encode(varvalue[key]);
				});
				return items.length ? t.varname + '=' + items.join(',') : null;
			}else{
				const items = Object.keys(varvalue).map(function(key){
					return encode(key) + ',' + encode(varvalue[key]);
				});
				return items.length ? items.join(',') : null;
			}
		}
	}
	return null;
};

module.exports.Result = Result;
function Result(router, uri, options, route, params, remaining_state, history){
	this.router = router;
	this.uri = uri;
	this.options = options;
	this.route = route;
	this.uriTemplate = route.uriTemplate;
	this.matchValue = route.matchValue;
	this.params = params;
	this.remaining_state = remaining_state;
	this.history = history;
}

Result.prototype.rewrite = function rewrite(uriTemplate, options, name){
	if(typeof uriTemplate==='string'){
		uriTemplate = new Route(uriTemplate, options, name);
	}
	var uri = uriTemplate.gen(this.params);

	return new Result(this.router, uri, options, uriTemplate, this.params);
};

Result.prototype.next = function next(){
	return this.router.resolveURI(this.uri, this.options, this.remaining_state);
};

Object.defineProperty(Result.prototype, "template", {
	get: function templateGet(){ return this.uriTemplate; },
	set: function templateSet(v){ this.uriTemplate = v; },
});

Object.defineProperty(Result.prototype, "name", {
	get: function templateGet(){ return this.matchValue; },
});

Router.prototype.addTemplate = function addTemplate(uriTemplate, options, matchValue){
	const self = this;
	const nodeMap = {};
	if(typeof uriTemplate=='object' && options===undefined && matchValue===undefined){
		var route = uriTemplate;
		uriTemplate = route.uriTemplate;
		options = route.options;
		matchValue = route.matchValue;
	}else{
		route = new Route(uriTemplate, options, matchValue);
	}
	this.routes.push(route);

	// Iterate over tokens in route to add the route to the tree
	var node = this.tree;
	var template_i = 0;
	route.tokens.forEach(function addExpression(expression){
		if(typeof expression=='string'){
			for(var i=0; i<expression.length; i++){
				var chr = expression[i];
				if(chr==='%' && expression[i+1] && expression[i+2]){
					chr += expression[i+1] + expression[i+2];
					if(!chr.match(/^%[0-9A-F]{2}$/)) throw new Error('Assert: Invalid pct-encoded character');
					i += 2;
				}
				// Descend node into the branch, creating it if it doesn't exist
				node.match_chr[chr] = node.match_chr[chr] || new Node(chr, ++self.nid);
				node = node.match_chr[chr];
				nodeMap[node.nid] = {};
				node.chr_offset = template_i;
				template_i++;
			}
			return;
		}
		expression.variableList.forEach(function addPath(varspec){
			if(typeof varspec!=='object') throw new Error('Unknown type');
			var setNext = [];
			if(varspec.optional){
				setNext.push(node);
			}
			if(varspec.prefix){
				node.match_pfx[varspec.prefix] = node.match_pfx[varspec.prefix] || new Node(varspec.prefix, ++self.nid);
				node = node.match_pfx[varspec.prefix];
				nodeMap[node.nid] = {
					expression: expression,
					varspec: varspec,
					vpush: varspec.explode && varspec.index,
				};
				var prefixNode = node;
			}
			node.list_set = node.list_set || {};
			node.list_set[varspec.range] = node.list_set[varspec.range] || new Node(varspec.range, ++self.nid);
			node.list_set_keys = Object.keys(node.list_set).sort(sortRanges);
			node = node.list_set[varspec.range];
			var rangeNode = node;
			nodeMap[node.nid] = {
				expression: expression,
				varspec: varspec,
				vindex: varspec.index,
			};
			node.match_range = varspec.range;
			node.match_range_vindex = varspec.index;
			if(varspec.explode){
				node.match_pfx[varspec.delimiter] = node.match_pfx[varspec.delimiter] || new Node(varspec.delimiter, ++self.nid);
				var delimiterNode = node.match_pfx[varspec.delimiter];
				nodeMap[delimiterNode.nid] = {
					expression: expression,
					varspec: varspec,
					vpush: varspec.explode && varspec.index,
				};
				delimiterNode.list_set = delimiterNode.list_set || {};
				delimiterNode.list_set[varspec.range] = rangeNode;
				delimiterNode.list_set_keys = Object.keys(delimiterNode.list_set).sort(sortRanges);
				setNext.push(delimiterNode);
			}
			node.list_next = node.list_next || new Node(undefined, ++self.nid);
			node = node.list_next;
			setNext.forEach(function(n){
				n.list_next = node;
			});
			template_i++;
		});
	});
	// Add EOF condition
	{
		node.match_eof = node.match_eof || new Node(null, ++self.nid);
		node = node.match_eof;
		node.chr_offset = template_i;
		template_i++;
	}
	if(node.template_match){
		throw new Error('Route already defined');
	}
	node.template_match = route;
	node.template_nodes = nodeMap;
	return route;
};

var S = {
	EOF: 10, // Expending end of input
	CHR: 20, // Expecting a character, or "%" to begin a pct-encoded sequence
	PCT1: 31, // Expecting first hex char of a pct-encoded sequence
	PCT2: 32, // Expecting the second hex char of a pct-encoded sequence
};
// Enable for testing
for(var n in S) S[n]=n;

// Some constants
var MATCH_EOF = 'match_eof';
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

function State(prev, offset, branch, mode, type, sort){
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
}
State.prototype.match = function match(branch, mode, type, sort){
	return new State(this, this.offset+1, branch, mode, type, sort);
};

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
		parse_backtrack = [new State(null, 0, this.tree, S.CHR, MATCH_CHR, MATCH_SORT.INIT, null)];
	}
	function consumeInputCharacter(offset, chr, state, branch){
		if(!(branch instanceof Node)) throw new Error('branch not instanceof Node');
		const stack = [];
		function append(v){
			stack.push(v);
		}

		// EOF always matches first
		if(chr===null && branch.match_eof){
			append(state.match(branch.match_eof, S.CHR, MATCH_EOF, MATCH_SORT.MATCH_CHR));
		}

		// First try patterns with exact character matches
		if(branch.match_chr[chr]){
			append(state.match(branch.match_chr[chr], S.CHR, MATCH_CHR, MATCH_SORT.MATCH_CHR));
		}

		// If the match_pfx isn't matched, then skip over the following match_range too...
		if(branch.match_pfx[chr]){
			append(state.match(branch.match_pfx[chr], S.CHR, MATCH_PFX, MATCH_SORT.MATCH_PFX));
		}

		// Then try patterns with range matches
		for(var i=0; i<branch.list_set_keys.length; i++){
			const rangeName = branch.list_set_keys[i];
			consumeInputCharacter(offset, chr, state, branch.list_set[rangeName]).forEach(append);
		}

		if(branch.match_range){
			const validRange = RANGES_MAP[branch.match_range];
			if(chr in validRange || chr==='%'){
				const sort = MATCH_SORT.MATCH_RANGE[branch.match_range];
				append(state.match(branch, S.CHR, MATCH_RANGE, sort));
			}
		}
		// If the expression is optional, try skipping over it, too
		if(branch.list_next){
			consumeInputCharacter(offset, chr, state, branch.list_next).forEach(append);
		}
		return stack;
	}
	for(var offset = 0;;){
		var state = parse_backtrack.shift();
		if(!state) break;
		offset = state.offset;
		if(offset > uri.length) throw new Error('Overgrew offset');
		// This will set chr===undefined for the EOF position
		// We could also use another value like "\0" or similar to represent EOF
		var chr = (offset<uri.length) ? uri[offset] : null;
		if(chr=='%' && uri[offset+1] && uri[offset+2]){
			chr += uri[offset+1] + uri[offset+2];
			if(!chr.match(/^%[0-9A-F]{2}$/)) throw new Error('Invalid pct-encoded character');
			offset += 2;
		}
		var stack = consumeInputCharacter(offset, chr, state, state.branch);
		// Take all the equal alternatives that matched the EOF and if there's exactly one, return it.
		if(offset==uri.length){
			var solutions = stack
				.filter(function(v){ return v.branch && v.branch.template_match; })
				.map(function(v){ return finish(v); });
			if(solutions.length>1){
				return solutions[0];
				//throw new Error('Multiple equal templates matched');
			}else if(solutions.length==1){
				return solutions[0];
			}
		}
		// Force the order of matches to prefer single-character matches (the `sort`)
		// Otherwise, preserve insertion order (the `weight`)
		// stack.forEach(function(v, i){ v.weight = i; });
		// stack.sort(function(a, b){ return (a.sort - b.sort) || (a.weight - b.weight); });
		// stack.forEach(function(v){ parse_backtrack.push(v); });
		stack.forEach(function(v){ if(v.type==MATCH_CHR) parse_backtrack.push(v); });
		stack.forEach(function(v){ if(v.type==MATCH_PFX) parse_backtrack.push(v); });
		stack.forEach(function(v){ if(v.type==MATCH_RANGE) parse_backtrack.push(v); });
	}

	function finish(solution){
		var history = [];
		var route = solution.branch.template_match;
		var nodeMap = solution.branch.template_nodes;
		for(var item=solution; item.prev; item=item.prev){
			var branch = item.branch;
			history.unshift({
				chr: uri[item.prev.offset],
				offset: item.prev.offset,
				type: item.type,
				vindex: nodeMap[branch.nid] && nodeMap[branch.nid].vindex,
				vpush: nodeMap[branch.nid] && nodeMap[branch.nid].vpush,
				node: branch,
				nid: branch.nid,
				transition: nodeMap[branch.nid],
			});
		}
		var var_list = [];
		for(var item_i=0; item_i<history.length; item_i++){
			var item = history[item_i];
			if(item.chr && !item.node.test(item.chr)){
				throw new Error('Assert: Node range '+item.node.range+' mismatches character['+item_i+'] '+item.chr);
			}
			var chr = item.chr || null;
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
		var bindings = {};
		route.variables.forEach(function(v){
			if(var_list[v.index]!==undefined) bindings[v.varname] = var_list[v.index];
		});
		return new Result(self, uri, flags, route, bindings, parse_backtrack, history);
	}
};
