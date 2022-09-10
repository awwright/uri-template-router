(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.uriTemplateRouter = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

module.exports.Router = Router;

const { Node, reduce, parallel, union, concat, optional, star, fromString, compare } = require('./lib/fsm.js');

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
		new Node({[str]: 0}, {[uriTemplate]: new PartialMatch(offset, Value)}, true),
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
	this.fsm = [];
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
	this.options = options || {};
	this.matchValue = this.options.matchValue!==undefined ? this.options.matchValue : matchValue;

	// Parse the URI template
	var varnames = this.varnames = {};
	var variables = this.variables = [];
	var tokens = this.tokens = [];
	var expressionList = [];
	for(var uri_i=0; uri_i<uriTemplate.length; uri_i++){
		var chr = uriTemplate[uri_i];
		if(chr==='%'){
			// A pct-encoded sequence is treated as a single character for efficiency
			// (this more than halves the size of the tree)
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
			const expression = Expression.from(patternBody);
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

	this.finalMatch = new FinalMatch(this);
	this.fsm = reduce(this.toFSM());

	function partial_intersect(states){
		if(states[0]) return states[0].partials;
	}
	function final_intersect(states){
		if(states.every(final => final && (Array.isArray(final) ? final.length : final))){
			const items = states.flatMap(final => (final && Array.isArray(final)) ? final : []);
			return items.length ? items : true;
		}else{
			return false;
		}
	}

	if(options && options.parent){
		var parent = options.parent;
		if(typeof options.parent=='object'){
			parent = options.parent;
		}else if(typeof options.parent==='string'){
			parent = new Route(options.parent);
		}else{
			throw new Error('Unknown type for parent');
		}
		this.fsm = parallel([this.fsm, parent.fsm], partial_intersect, final_intersect);
	}
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

// This is slightly different than Router#resolveURI
// Route does not store detailed final state data, only a boolean
Route.prototype.resolveURI = function resolveString(uri, flags){
	if(typeof uri!=='string') throw new Error('Expected arguments[0] `uri` to be a string');
	const self = this;
	// 0 is the initial state
	var state = this.fsm[0];
	if(!state) return;
	const history = [{state}];
	const pctenc = /^%[0-9A-F]{2}$/;

	for(var offset = 0; state && offset < uri.length; offset++){
		const symbol = uri[offset]==='%' ? uri.slice(offset, offset+3) : uri[offset];
		// Double-check that pct-encoded sequences are valid (in addition to what the FSM should prohibit)
		if(symbol.length===3){
			if(!pctenc.test(symbol)){
				return;
			}
			offset += 2;
		}
		const nextStateId = state.get(symbol);
		if(nextStateId === undefined) return;
		state = this.fsm[nextStateId];
		if(!state) return;
		history.push({symbol, nextStateId, state});
	}

	// With all of the characters parsed, the current "state" contains the solution
	const solution = state.final;
	if(!solution) return;
	return new Result(self, uri, flags, history, [self.finalMatch]);
};

module.exports.Expression = Expression;
function Expression(operatorChar, variableList){
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
}
Expression.from = function(patternBody){
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
	return new Expression(operatorChar, variableList);
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

Result.prototype.rewrite = function rewrite(uriTemplate, options){
	if(!(uriTemplate instanceof Route)){
		throw new Error('Expected argument `uriTemplate` to be a Route');
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

	// Verify the template doesn't re-use a variable name
	const varnames = new Set;
	route.tokens.forEach(function(token){
		if(typeof token === 'string') return;
		token.variableList.forEach(function(varspec){
			if(varnames.has(varspec.varname)){
				throw new Error('Duplicate variable name '+varspec.varname);
			}
			varnames.add(varspec.varname);
		});
	});

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
				if(compares[i][1]===true){
					// This is the same as an existing route
					throw new Error('Inserted route '+uriTemplate+' is the same as other route '+current.children[i].uriTemplate);
				}else{
					// Move subsets into this route
					route_children.push(current.children[i]);
				}
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

	this.fsm = union(this.routes.map(r => r.fsm), order_map);
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
	var state = this.fsm[0];
	if(!state) return;
	const history = [{state}];
	const pctenc = /^%[0-9A-F]{2}$/;

	for(var offset = 0; state && offset < uri.length; offset++){
		const symbol = uri[offset]==='%' ? uri.slice(offset, offset+3) : uri[offset];
		// Double-check that pct-encoded sequences are valid (in addition to what the FSM should prohibit)
		if(symbol.length===3){
			if(!pctenc.test(symbol)){
				return;
			}
			offset += 2;
		}
		const nextStateId = state.get(symbol);
		if(nextStateId === undefined) return;
		state = this.fsm[nextStateId];
		if(!state) return;
		history.push({symbol, nextStateId, state});
	}

	// With all of the characters parsed, the current "state" contains the solution 
	const solution = state.final[0];
	if(!solution) return;
	return new Result(self, uri, flags, history, state.final);
};

},{"./lib/fsm.js":2}],2:[function(require,module,exports){
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

},{}]},{},[1])(1)
});
