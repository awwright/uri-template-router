"use strict";

module.exports.Router = Router;

const { Node, union, concat, optional, star, fromString, compare } = require('./lib/fsm.js');

// Export a function that docs/demo.js uses
// FIXME this might be relocated later
module.exports.compare = require('./lib/fsm.js').compare;

const RANGE = {};
RANGE.UNRES = ['-', '.', '0-9', 'A-Z', '_', 'a-z', '~'].join('');
RANGE.GEN_D = [':', '/', '?', '#', '[', ']', '@'].join('');
RANGE.SUB_D = ['!', '$', '&', "'", '(', ')', '*', '+', ',', ';', '='].join('');
RANGE.RESER = [RANGE.GEN_D, RANGE.SUB_D].join('');
RANGE.URI = [RANGE.UNRES, RANGE.RESER].join('');

const regex_sc = /[.*+?^${}()|[\]\\]/g;
function regex_escape(str){
	return str.replace(regex_sc, '\\$&');
}

const regex_rangesc = /[\\\]]/g;
function range_regex(str){
	return '(?:['+str.replace(regex_rangesc, '\\$&')+']|%[0-9A-Fa-f]{2})';
}

function range_fsm(str, uriTemplate, offset){
	return optional([
		new Node({[str]: 0, '%': 1}, {[uriTemplate]: new PartialMatch(offset, Value)}, true),
		new Node({'0-9A-Fa-f': 2}, {[uriTemplate]: new PartialMatch(offset, Value)}, false),
		new Node({'0-9A-Fa-f': 0}, {[uriTemplate]: new PartialMatch(offset, Value)}, false),
	]);
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
	this.encode = (range===RANGE.URI) ? encodeURI_literal : encodeURIComponent_v;
}

const operators = {
	'': new Operator( '',  ',', null, RANGE.UNRES, false),
	'+': new Operator('',  ',', null, RANGE.URI, false),
	'#': new Operator('#', ',', null, RANGE.URI, false),
	'.': new Operator('.', '.', '.',  RANGE.UNRES, false),
	'/': new Operator('/', '/', '/',  RANGE.UNRES, false),
	';': new Operator(';', ';', ';',  RANGE.UNRES, true, false),
	'?': new Operator('?', '&', '&',  RANGE.UNRES, true, true),
	'&': new Operator('&', '&', '&',  RANGE.UNRES, true, true),
};

// This technique works only because the 2-3rd characters in pct-encoding are also legal characters by themselves
encodeURI_literal.pattern = new RegExp('[^'+RANGE.URI.replace(regex_rangesc, '\\$&')+'%'+']|%(?![0-9A-Fa-f]{2})', 'ug');
function encodeURI_literal(v){
	return v.replace(encodeURI_literal.pattern, function(a){
		return encodeURIComponent(a);
	});
}

function Operator(prefix, separator, delimiter, range, named, form){
	this.prefix = prefix;
	this.separator = separator;
	this.delimiter = delimiter;
	this.range = range;
	this.named = named;
	this.form = form;
	this.encode = (range===RANGE.URI) ? encodeURI_literal : encodeURIComponent_v;
}

function Router(){
	this.clear();
}

Router.prototype.clear = function clear(){
	this.nid = 0;
	this.states = [];
	this.routeSet = new Set;
	this.templateRouteMap = new Map;
	this.valueRouteMap = new Map;
	this.hierarchy = {children: []};
};

Router.prototype.hasRoute = function hasRoute(route){
	return this.routeSet.has(route);
};

Object.defineProperty(Router.prototype, "size", {
	get: function sizeGet(){ return this.routeSet.size; },
});

Object.defineProperty(Router.prototype, "routes", {
	get: function routesGet(){ return Array.from(this.routeSet); },
});

Router.prototype.getTemplate = function getTemplate(uriTemplate){
	if(typeof uriTemplate !== 'string') throw new Error('Expected string `uriTemplate`');
	return this.templateRouteMap.get(uriTemplate);
};

Router.prototype.hasTemplate = function hasTemplate(uriTemplate){
	if(typeof uriTemplate !== 'string') throw new Error('Expected string `uriTemplate`');
	return this.templateRouteMap.has(uriTemplate);
};

Router.prototype.getValue = function getValue(matchValue){
	return this.valueRouteMap.get(matchValue);
};

Router.prototype.hasValue = function hasValue(matchValue){
	return this.valueRouteMap.has(matchValue);
};

const Literal = ('Literal');
// const Prefix = ('Prefix');
const Value = ('Value');

module.exports.PartialMatch = PartialMatch;
function PartialMatch(position, type, open, close){
	if(!type) throw new Error('Expected a Type');
	this.position = position;
	this.type = type;
	this.open = open || []; // list of groups that open
	this.close = close || []; // list of groups that open
}

module.exports.FinalMatch = FinalMatch;
function FinalMatch(route, close){
	this.route = route;
	this.close = close;
}
FinalMatch.prototype.toString = function toString(){
	return '<'+this.route.uriTemplate+'>';
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
			if(uriTemplate.substring(uri_i, uri_i+3).match(/^%[0-9A-F]{2}$/)){
				chr += uriTemplate[uri_i+1] + uriTemplate[uri_i+2];
				uri_i += 2;
			}else{
				throw new Error('Invalid pct-encoded sequence '+JSON.stringify(uriTemplate.substring(uri_i, uri_i+3)));
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

	this.fsm = this.toFSM();
}
Route.prototype.gen = function Route_gen(params){
	if(typeof params!='object') throw new Error('Expected arguments[0] `params` to be an object');
	return this.tokens.map( (v)=>v.toString(params) ).join('');
};
Route.prototype.toString = function toString(params){
	return this.tokens.map( (v)=>v.toString(params) ).join('');
};
Route.prototype.compare = function routecompare(other){
	return compare([this.fsm || this.toFSM(), other.fsm || other.toFSM()]);
}
Route.prototype.toJSON = function toJSON(){
	return this.uriTemplate;
};
Route.prototype.toFSM = function toFSM(){
	const route = this;
	var template_i = 0;

	// Get the FSM of each of the tokens, and concatenate them together
	const fsms = route.tokens.map(function addExpression(expression){
		// If a string, treat as literal characters
		if(typeof expression=='string'){
			const offset = template_i;
			template_i += expression.length;
			return fromString(expression, v=>({[route.uriTemplate]:new PartialMatch((offset+v), Literal)}));
		}
		return expression.toFSM(route.uriTemplate, template_i);
	});
	return concat(fsms);
	// return reduce(concat(fsms));
};
Route.prototype.toRegex = function toRegex(){
	const regex_str = this.tokens.map(function(segment){
		if(typeof segment==='string'){
			return regex_escape(segment);
		}else{
			return segment.toRegex().source;
		}
	}).join('');
	return new RegExp('^'+regex_str+'$', 'u');
};
Route.prototype.decode = function decode(uri){
	const regex = this.toRegex();
	const match = uri.match(regex);
	if(!match) return;

	var offset = 1;
	const result = {};
	for(var i=0; i<this.tokens.length; i++){
		const segment = this.tokens[i];
		// This segment is not an expression, there's nothing to parse here
		if(typeof segment === 'string') continue;
		for(var j=0; j<segment.variableList.length; j++){
			const varname = segment.variableList[j].varname;
			const value = match[offset++];
			if(typeof value === 'string'){
				if(segment.variableList[j].explode){
					// If the variable is exploded, split it apart by the separator since toRegex matched it as a single string
					if(segment.variableList[j].named){
						// Also if this is a named variable, the string includes "varname=" in each segment
						result[varname] = value.split(segment.separator).map(decodeURIComponent).map( v => v.replace(new RegExp('^'+regex_escape(segment.variableList[j].varname)+'=', 'ug'), '') );
					}else{
						result[varname] = value.split(segment.separator).map(decodeURIComponent);
					}
				}else if(value){
					result[varname] = decodeURI(value);
				}
			}
		}
	}
	return result;
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
Expression.prototype.toFSM = function toFSM(uriTemplate, offset){
	var offset_i = offset;
	const fsm_0 = [];
	for(var i=0; i<this.variableList.length; i++){
		if(i==0 && this.prefix){
			fsm_0.push(concat([ fromString(this.prefix), this.variableList[i].toFSM(uriTemplate, offset_i) ]));
			offset_i += 1;
		}else if(i>0 && this.separator){
			fsm_0.push(concat([ fromString(this.separator), this.variableList[i].toFSM(uriTemplate, offset_i) ]));
			offset_i += 1;
		}else{
			fsm_0.push(this.variableList[i].toFSM(uriTemplate, offset_i));
		}
		offset_i += this.variableList[i].varname.length;
	}
	return optional(concat(fsm_0));
};
Expression.prototype.toRegex = function toRegex(){
	var fsm_0 = '';
	if(this.prefix){
		fsm_0 += regex_escape(this.prefix);
	}
	for(var i=0; i<this.variableList.length; i++){
		if(i>0 && this.separator){
			fsm_0 += '(?:' + regex_escape(this.separator) + this.variableList[i].toRegex().source + ')?';
		}else{
			fsm_0 += this.variableList[i].toRegex().source;
		}
	}
	// The entire expression is optional
	return new RegExp('(?:'+fsm_0+')?', 'u');
}

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
	const varvalue = params[t.varname];
	const encode = op.encode;
	if(typeof varvalue=='string' || typeof varvalue=='number'){
		let value = varvalue;
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
			let value = varvalue;
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
Variable.prototype.toFSM = function toFSM(uriTemplate, offset){
	const op = operators[this.operatorChar];
	const fsm = range_fsm(this.range, uriTemplate, offset);
	if(this.explode){
		if(op.named){
			return optional(concat([concat([fromString(this.varname), optional(concat([fromString('='), fsm]))]), star(concat([fromString(this.separator), fromString(this.varname), optional(concat([fromString('='), fsm]))]))]));
		}else{
			return optional(concat([fsm, star(concat([fromString(this.separator), fsm]))]));
		}
	}else if(op.named){
		return optional(concat([fromString(this.varname), optional(concat([fromString('='), fsm]))]));
	}else{
		return fsm;
	}
}
Variable.prototype.toRegex = function toRegex(){
	const op = operators[this.operatorChar];
	if(this.explode){
		if(op.named){
			return new RegExp('((?:'+regex_escape(this.varname)+'(?:=('+range_regex(this.range)+'*)))(?:'+this.separator+'(?:'+regex_escape(this.varname)+'(='+range_regex(this.range)+'*)))*)?', 'u');
		}else{
			// Include the separator in the range, we will split() it later
			return new RegExp('('+range_regex(this.range+this.separator)+'*)', 'u');
		}
	}else if(op.named){
		return new RegExp('(?:'+regex_escape(this.varname)+'(?:=('+range_regex(this.range)+'*))?)?', 'u');
	}else{
		return new RegExp('('+range_regex(this.range)+'*)', 'u');
	}
}

module.exports.Result = Result;
function Result(router, uri, options, history, final_states){
	const final_match = final_states[0];
	if(!final_match) throw new Error();
	const route = final_match.route;
	this.router = router;
	this.uri = uri;
	this.options = options;
	this.route = route;
	this.uriTemplate = route.uriTemplate;
	this.matchValue = route.matchValue;
	this.params = route.decode(this.uri);
	this.history = history;
	this.final_states = final_states;
}

Result.prototype.rewrite = function rewrite(uriTemplate, options, name){
	if(typeof uriTemplate==='string'){
		uriTemplate = new Route(uriTemplate, options, name);
	}
	var uri = uriTemplate.gen(this.params);
	return new Result(this.router, uri, options, [], [ { route: uriTemplate } ]);
};

Result.prototype.next = function next(){
	// return this.router.resolveURI(this.uri, this.options, this.remaining_state);
	// With all of the characters parsed, the current "state" contains the solution
	const remaining_states = this.final_states.slice(1);
	// ... If it lists one
	if(!remaining_states.length) return;
	return new Result(this.router, this.uri, this.options, this.history, remaining_states);
};

Object.defineProperty(Result.prototype, "template", {
	get: function templateGet(){ return this.uriTemplate; },
	set: function templateSet(v){ this.uriTemplate = v; },
});

Object.defineProperty(Result.prototype, "name", {
	get: function templateGet(){ return this.matchValue; },
});

Router.prototype.addTemplate = function addTemplate(uriTemplate, options, matchValue){
	if(typeof uriTemplate=='object' && options===undefined && matchValue===undefined){
		var route = uriTemplate;
		uriTemplate = route.uriTemplate;
		options = route.options;
		matchValue = route.matchValue;
	}else{
		route = new Route(uriTemplate, options, matchValue);
	}

	const fsm = route.fsm;

	fsm.forEach(function(state){
		if(!state.partials[uriTemplate]){
			// state.partials[uriTemplate] = new PartialMatch(0, 9);
		}
		if(state.final){
			state.final = [new FinalMatch(route)];
		}
	});

	this.routeSet.add(route);
	this.templateRouteMap.set(uriTemplate, route);
	if(!this.valueRouteMap.has(matchValue)){
		this.valueRouteMap.set(matchValue, route);
	}

	// Update the route tree that maintains ordering
	// For every node, all of its children must be disjoint
	// Scan through each of the children:
	children: for(var current=this.hierarchy; current;){
		const compares = current.children.map(v => compare([fsm, v.node.fsm]));

		// 1. if new route is a subset of exactly one of them, then descend into that child.
		for(var i=0; i<compares.length; i++){
			if(compares[i][0]===false && compares[i][1]===true){
				current = current.children[i];
				continue children;
			}
		}

		// 2. if the new route is a superset of any number of them (and disjoint with all others), then insert new route as a child and move all matching children underneath it.
		const route_siblings = [], route_children = [];
		for(var i=0; i<compares.length; i++){
			if(compares[i][0]===true){
				// Move subsets into this route
				route_children.push(current.children[i]);
			}else if(compares[i][2]===true){
				// Record disjoint nodes and make them siblings
				route_siblings.push(current.children[i]);
			}else{
				throw new Error('Inserted route '+uriTemplate+' partially overlaps with other routes '+current.children[i].uriTemplate);
			}
		}
		route_siblings.push({node: route, uriTemplate, children: route_children});
		current.children = route_siblings;
		break;
	}

	this.reindex();

	return route;
};

Router.prototype.reindex = function reindex(){
	// Update the sort index based on the hierarchy
	const order_map = new Map;
	var order = 0;
	function visit(hierarchy){
		hierarchy.children.forEach(visit);
		if(hierarchy.node) order_map.set(hierarchy.node, order++);
	}
	visit(this.hierarchy);

	this.states = union(this.routes.map(r => r.fsm), order_map);
};

// like resolveString, but additionally verify that the URI matches the legal HTTP form
// userinfo and fragment components are not allowed
// Router.prototype.resolveRequest = function resolveRequest(scheme, host, target, flags, initial_state){
// };

// like resolveString, but additionally verify that the URI matches the legal HTTP form
// userinfo and fragment components are not allowed

Router.prototype.resolveRequestURI = function resolveRequestURI(uri, flags, initial_state){
	if(typeof uri!=='string') throw new Error('Expected arguments[0] `uri` to be a string');
	// First verify the URI looks OK, save the components, then parse it normally
	// scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
	const scheme_m = uri.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
	if(!scheme_m) throw new Error('parseURI: `uri` missing valid scheme');
	// const hierpart_m = uri.substring(scheme_m[0].length).match(/^\/\/(?:\x5b(?:[\x2e0-:a-f]*|v[0-9a-f]+\x2e[!\x24&-\x2e0-;=_a-z~]+)\x5d|(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\x2e(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\x2e(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\x2e(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])|(?:[\x2d\x2e0-9_a-z~]|%[0-9a-f][0-9a-f]|[!\x24&-,;=])*)(?::\d*)?/);
	// URI appears to be valid, now resolve it normally
	return this.resolveURI(uri, flags, initial_state);
};

// TODO rename this to `resolveString`
Router.prototype.resolveURI = function resolveString(uri, flags){
	if(typeof uri!=='string') throw new Error('Expected arguments[0] `uri` to be a string');
	const self = this;
	// 0 is the initial state
	var state = this.states[0];
	const history = [{state}];
	const pctenc = /^%[0-9A-F]{2}$/;

	for(var offset = 0; state && offset < uri.length; offset++){
		if(!state) break;
		const symbol = uri[offset];
		// Double-check that pct-encoded sequences are valid (in addition to what the FSM should prohibit)
		if(symbol==='%'){
			if(!pctenc.test(uri.substring(offset, offset+3))){
				return;
			}
		}
		const nextStateId = state.get(symbol);
		if(nextStateId === undefined) return;
		state = this.states[nextStateId];
		history.push({symbol, nextStateId, state});
	}

	// With all of the characters parsed, the current "state" contains the solution 
	const solution = state.final[0];
	if(!solution) return;
	return new Result(self, uri, flags, history, state.final);
};
