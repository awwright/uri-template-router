
module.exports.Router = Router;

function log(){
	if(process.argv && process.argv.indexOf('-v')>=0) console.log.apply(console, arguments);
}
function dir(){
	if(process.argv && process.argv.indexOf('-v')>=0) console.dir.apply(console, arguments);
}

function Router(){
	this.routes = [];
	this.tree = new Node;
}

function nid(){
	return 'nId'+(++nid.i);
}
nid.i = 0;

function Node(){
	this.nid = nid();
	this.chr_offset = null;
	// Automatically matches the given template
	// Expressions to decend into
	this.exp_match = [];
	// If we're currently in an expression
	this.exp_range = null;
	this.exp_repeat = null;
	this.exp_repeat_nid = null;
	this.exp_info = undefined;
	// If we reach this branch, declare a match for this template
	this.end = null;

	// Literal characters to match
	this.chr = {};
	// Expression prefixes to match
	this.exp_pfx = {};
	// Alternative sets to try matching at the same time
	this.exp_set = {};
	// Decend into this for more alternatives
	this.next = null;
	this.exp_skp = null;
	this.exp_skp_nid = null;
}
Node.prototype.toString = function toString(){
	return '[Node '+this.nid+']';
}

function Route(template, variables, arg){
	this.template = template;
	this.variables = variables;
	this.argument = arg;
}

function Result(template, arg, bindings){
	this.template = template;
	this.argument = arg;
	this.data = bindings;
}

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

function Modifier(prefix, prefixNext, range){
	this.prefix = prefix;
	this.prefixNext = prefixNext;
	this.range = range;
}

Router.modifiers = {
	'': new Modifier('', null, 'UNRESERVED'),
	'+': new Modifier('', null, 'RESERVED_UNRESERVED'),
	'#': new Modifier('#', null, 'RESERVED_UNRESERVED'),
	'.': new Modifier('.', null, 'UNRESERVED'),
	'/': new Modifier('/', '/', 'UNRESERVED'),
	';': new Modifier(';', ';', 'UNRESERVED'),
	'?': new Modifier('?', '&', 'UNRESERVED'),
	'&': new Modifier('&', '&', 'UNRESERVED'),
};

Router.prototype.addTemplate = function addTemplate(uri, variables, arg){
	var node = this.tree;
	this.routes.push(uri);
	var varnames = {};
	var variables = [];
	for(var uri_i=0; uri_i<=uri.length; uri_i++){
		var chr = uri[uri_i];
		if(chr=='{'){
			var endpos = uri.indexOf('}', uri_i+2);
			if(endpos<0) throw new Error('Unclosed expression: Expected "}" but found end of template');
			var patternBody = uri.substring(uri_i+1, endpos);
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
				return {
					varname: varname,
					prefix: index ? prefixNext : prefix,
					prefixNext: prefixNext,
					range: modifier.range,
					explode: explode,
					optional: true,
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

				var setNext = [];
				if(varspec.optional){
					setNext.push(node);
				}
				if(varspec.prefix){
					node.exp_pfx[varspec.prefix] = node.exp_pfx[varspec.prefix] || new Node;
					node = node.exp_pfx[varspec.prefix];
					node.exp_info = {type:'PFX', push:varspec.explode?varspec.index:undefined};
				}
				node.exp_set = node.exp_set || {};
				node.exp_set[varspec.range] = node.exp_set[varspec.range] || new Node;
				node = node.exp_set[varspec.range];
				node.exp_range = varspec.range;
				node.exp_info = {type:'EXP', index:varspec.index};
				node.next = node.next || new Node;
				node = node.next;
				node.exp_info = {type:'EXP', index:varspec.index};
				if(varspec.explode){
					// The optional stuff
					// Second expression prefix
					setNext.push(node);
					node.exp_pfx[varspec.prefixNext] = node.exp_pfx[varspec.prefixNext] || new Node;
					node = node.exp_pfx[varspec.prefixNext];
					node.exp_info = {type:'PFX', push:varspec.explode?varspec.index:undefined};
					// Second expression body
					node.exp_set = node.exp_set || {};
					node.exp_set[varspec.range] = node.exp_set[varspec.range] || new Node;
					node = node.exp_set[varspec.range];
					node.exp_range = varspec.range;
					node.exp_info = {type:'EXP', index:varspec.index};
					node.next = node.next || new Node;
					node = node.next;
					node.exp_info = {type:'EXP', index:varspec.index};

					for(var e_i=0; e_i<6; e_i++){
					// 3rd expression prefix
					setNext.push(node);
					node.exp_pfx[varspec.prefixNext] = node.exp_pfx[varspec.prefixNext] || new Node;
					node = node.exp_pfx[varspec.prefixNext];
					node.exp_info = {type:'PFX', push:varspec.explode?varspec.index:undefined};
					// 3rd expression body
					node.exp_set = node.exp_set || {};
					node.exp_set[varspec.range] = node.exp_set[varspec.range] || new Node;
					node = node.exp_set[varspec.range];
					node.exp_range = varspec.range;
					node.exp_info = {type:'EXP', index:varspec.index};
					node.next = node.next || new Node;
					node = node.next;
					node.exp_info = {type:'EXP', index:varspec.index};
					}
				}
				setNext.forEach(function(n){
					if(n.exp_skp && n.exp_skp!==node){
						throw new Error('Diverging end');
					}else{
						n.exp_skp = node;
					}
				});
			});
		}else{
			// Decend node into the branch, creating it if it doesn't exist
			// if chr is undefined, this will set the key "undefined"
			node.chr[chr] = node.chr[chr] || new Node;
			node = node.chr[chr];
			node.chr_offset = uri_i;
		}
	}
	if(node.end){
		throw new Error('Route already defined');
	}
	node.end = new Route(uri, variables, arg);
}

var S = {
	EOF: 10, // Expending end of input
	CHR: 20, // Expecting a character, or "%" to begin a pct-encoded sequence
	PCT1: 31, // Expecting first hex char of a pct-encoded sequence
	PCT2: 32, // Expecting the second hex char of a pct-encoded sequence
};
// Enable for testing
for(var n in S) S[n]=n;

// The StateSet tells us the character we're going to parse and the possible ways we could process it
function StateSet(offset, tier, alternatives){
	this.offset = offset;
	this.tier = tier;
	// A list of equal alternative candidates for processing this input character
	this.alts = alternatives;
}

function State(prev, offset, branch, mode, data){
	if(prev && !(prev instanceof State)) throw new Error('prev not instanceof State');
	if(!(branch instanceof Node)) throw new Error('branch not instanceof Node');
	this.prev = prev;
	this.offset = offset;
	this.branch = branch;
	this.mode = mode;
	this.data = data;
}
State.prototype.push = function push(offset, branch, mode, data){
	return new State(this, offset, branch, mode, data);
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

Router.prototype.resolveURI = function resolve(uri, flags){
	var parse_backtrack = [
		new StateSet(0, 0, [new State(null, 0, this.tree, S.CHR, null)]),
	];
	function consumeInputCharacter(offset, chr, state, branch){
		if(!(branch instanceof Node)) throw new Error('branch not instanceof Node');
		var mode = state.mode;
		if(branch.chr[chr]){
			log(' +parse_chr', parse_chr.offset, branch.chr[chr].nid);
			parse_chr.alts.push(state.push(offset, branch.chr[chr], S.CHR, 'chr'));
		}
		// If the exp_pfx isn't matched, then skip over the following exp_range too...
		if(branch.exp_pfx[chr]){
			log(' +parse_pfx', parse_pfx.offset, branch.exp_pfx[chr].nid);
			parse_pfx.alts.push(state.push(offset, branch.exp_pfx[chr], S.CHR, 'exp_pfx'));
		}
		for(var rangeName in branch.exp_set){
			var validRange = RANGES_MAP[rangeName];
			var exprInfo = branch.exp_set[rangeName];
			log(' exp_set', exprInfo.nid, rangeName);
			consumeInputCharacter(offset, chr, state, exprInfo);
		}
		if(branch.exp_range){
			var validRange = RANGES_MAP[branch.exp_range];
			if(chr in validRange){
				log(' +parse_exp', parse_exp.offset, branch.nid, branch.exp_range);
				parse_exp.alts.push(state.push(offset, branch, S.CHR, 'exp_range'));
				//return;
			}
		}
		if(branch.exp_skp){
			log(' +parse_skp', parse_skp.offset, branch.exp_skp.nid);
			// If this expression does not match the current character, advance to the next input pattern that might
			//consumeInputCharacter(offset, chr, state, branch.exp_skp);
			parse_skp.alts.push(new State(state, state.offset+1, branch.exp_skp, S.CHR, 'exp_skp'));
		}
		if(branch.exp_repeat){
			log(' +parse_backtrack', branch.exp_repeat.nid);
			// Push repeat parsing first before everything else (lowest priority)
			parse_backtrack.push(new StateSet(offset, 4, [
				state.push(offset, branch.exp_repeat, S.CHR, 'exp_repeat')
			]));
		}
		if(branch.next){
			log(' next', branch.next.nid);
			consumeInputCharacter(offset, chr, state, branch.next);
		}
	}
	for(var offset = 0;;){
		var stateset_this = parse_backtrack.pop();
		//log(stateset_this);
		if(!stateset_this) break;
		offset = stateset_this.offset;
		if(offset > uri.length) continue;
		//if(offset > uri.length) throw new Error('Overgrew offset');
		var parse_chr = new StateSet(offset+1, 4, []);
		var parse_pfx = new StateSet(offset+1, 3, []);
		var parse_exp = new StateSet(offset+1, 2, []);
		var parse_skp = new StateSet(offset, 5, []);
		// This will set chr===undefined for the EOF position
		// We could also use another value like "\0" or similar to represent EOF
		var chr = uri[offset];
		log('Parse('+offset+')', chr);
		for(var alt_i=0; alt_i<stateset_this.alts.length; alt_i++){
			var alt = stateset_this.alts[alt_i];
			log(' branch'+alt_i, alt.branch.nid, matchedExpressions(alt));
			consumeInputCharacter(offset, chr, alt, alt.branch);
		}
		if(parse_skp.alts.length) parse_backtrack.push(parse_skp); // Lowest priority
		if(parse_exp.alts.length) parse_backtrack.push(parse_exp);
		if(parse_pfx.alts.length) parse_backtrack.push(parse_pfx);
		if(parse_chr.alts.length) parse_backtrack.push(parse_chr); // Highest priority
		//log(' parse_backtrack', parse_backtrack);

		var solutions = parse_chr.alts
			.filter(function(v){ return v.branch && v.branch.end; })
			.map(function(v){ return finish(v); });
		if(solutions.length>1){
			log(solutions);
			throw new Error('Multiple equal templates matched');
		}else if(solutions.length==1){
			return solutions[0];
		}
	}

	function matchedExpressions(solution){
		var history = [];
		for(var item=solution; item.prev; item=item.prev){
			//log(item.offset);
			//dir(item, {depth:2});
			var branch = item.branch;
			history.unshift({
				chr: uri[item.offset],
				offset: branch.exp_info && branch.exp_info.offset,
				vindex: branch.exp_info && branch.exp_info.index,
				vpush: branch.exp_info && branch.exp_info.push,
				nid: branch.nid,
			});
		}
		//dir(history);
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
		var route = solution.branch.end;
		var bindings = {};
		route.variables.forEach(function(v){
			if(var_list[v.index]!==undefined) bindings[v.varname] = var_list[v.index];
		});
		return new Result(route.template, route.arg, bindings);
	}
}
