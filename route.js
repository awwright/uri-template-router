
module.exports.Router = Router;

function log(){
	console.log.apply(console, arguments);
}
function dir(){
	console.dir.apply(console, arguments);
}

function Router(){
	this.routes = [];
	this.tree = new Node(nid());
}

function nid(){
	return 'nId'+(++nid.i);
}
nid.i = 0;

function Node(nid){
	this.nid = nid;
	// Automatically matches the given template
	this.end = null;
	// The characters we can reach next
	// If in an expression, this is potentially the end of the expression
	this.chr = {};
	// Expressions to decend into
	this.exp_match = [];
	// If we're currently in an expression
	this.exp_chr = {};
	this.exp_chr_info = null;
	this.exp_range = null;
	this.exp_range_info = null;
	this.exp_set = null;
	this.exp_next = null;
	this.exp_repeat = null;
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
			var range = modifier.range;
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
					range: modifier.range,
					explode: explode,
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

				var beginning = node;
				if(varspec.prefix){
					node.exp_chr[varspec.prefix] = node.exp_chr[varspec.prefix] || new Node(nid());
					node = node.exp_chr[varspec.prefix];
					node.exp_chr_info = {type:'PFX', push:varspec.explode?varspec.index:undefined};
				}
				node.exp_set = node.exp_set || {};
				node.exp_set[range] = node.exp_set[range] || new Node(nid());
				node = node.exp_set[range];
				node.exp_range = range;
				node.exp_range_info = {type:'EXP', index:varspec.index};
				if(varspec.explode){
					if(node.exp_repeat && node.exp_repeat!==beginning) throw new Error('Identical consecutive expressions');
					node.exp_repeat = beginning;
				}
				// Using this enforces an order for expressions
				node.exp_next = node.exp_next || new Node(nid());
				node = node.exp_next;
			});
		}else{
			// Decend node into the branch, creating it if it doesn't exist
			// if chr is undefined, this will set the key "undefined"
			node.chr[chr] = node.chr[chr] || new Node(nid());
			node = node.chr[chr];
			node.chr_offset = uri_i;
		}
	}
	if(node.end){
		throw new Error('Route already defined');
	}
	node.end = new Route(uri, variables, arg);
}

function StateSet(offset, tier, alternatives){
	this.offset = offset;
	this.tier = tier;
	// A list of equal alternative candidates for processing this input character
	this.alts = alternatives;
}

var S = {
	EOF: 10, // Expending end of input
	CHR: 20, // Expecting a character, or "%" to begin a pct-encoded sequence
	PCT1: 31, // Expecting first hex char of a pct-encoded sequence
	PCT2: 32, // Expecting the second hex char of a pct-encoded sequence
};
// Enable for testing
for(var n in S) S[n]=n;

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

function withChange(bindings, name, value){
	var nb = {};
	for(var n in bindings) nb[n]=bindings[n];
	nb[name] = value;
	return nb;
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
		new StateSet(0, 0, [new State(null, 0, this.tree, S.CHR)]),
	];
	function consumeInputCharacter(offset, chr, state, branch){
		if(!(branch instanceof Node)) throw new Error('branch not instanceof Node');
		var mode = state.mode;
		log(' branch', mode, branch.nid);
		if(branch.chr[chr]){
			log(' -chr', chr);
			parse_chr.alts.push(state.push(offset, branch.chr[chr], S.CHR, 'chr'));
		}
		if(branch.exp_chr[chr]){
			log(' -exp_chr', chr, branch.exp_chr[chr].nid);
			parse_chr.alts.push(state.push(offset, branch.exp_chr[chr], S.CHR, branch.exp_chr[chr].exp_chr_info));
		}
		if(branch.exp_range){
			var validRange = RANGES_MAP[branch.exp_range];
			if(chr in validRange){
				log(' -exp_range', branch.exp_range);
				parse_exp.alts.push(state.push(offset, branch, S.CHR, branch.exp_range_info));
				return;
			}
		}else if(branch.exp_next){
			log(' -exp_next');
			// If this expression does not match the current character, advance to the next input pattern that might
			consumeInputCharacter(offset, chr, state, branch.exp_next);
		}
		for(var rangeName in branch.exp_set){
			var validRange = RANGES_MAP[rangeName];
			var exprInfo = branch.exp_set[rangeName];
			log(' -exp_set', rangeName);
			consumeInputCharacter(offset, chr, state, exprInfo);
		}

		if(branch.exp_repeat){
			log(' -exp_repeat');
			consumeInputCharacter(offset, chr, state, branch.exp_repeat);
		}
	}
	for(var offset = 0;;){
		var stateset_this = parse_backtrack.pop();
		//log(stateset_this);
		if(!stateset_this) break;
		offset = stateset_this.offset;
		var parse_chr = new StateSet(offset+1, 3, []);
		var parse_pfx = new StateSet(offset+1, 2, []);
		var parse_exp = new StateSet(offset+1, 1, []);
		// This will set chr===undefined for the EOF position
		// We could also use another value like "\0" or similar to represent EOF
		var chr = uri[offset];
		log('Parse('+offset+') '+chr);
		for(var alt_i=0; alt_i<stateset_this.alts.length; alt_i++){
			var alt = stateset_this.alts[alt_i];
			consumeInputCharacter(offset, chr, alt, alt.branch);
		}
		// Push expressions onto the stack, top (highest priority) of stack is last
		if(parse_exp.alts.length) parse_backtrack.push(parse_exp);
		if(parse_pfx.alts.length) parse_backtrack.push(parse_pfx);
		if(parse_chr.alts.length) parse_backtrack.push(parse_chr);
		//log(' parse_backtrack', parse_backtrack);

		var solutions = parse_chr.alts
			.filter(function(v){ return v.branch && v.branch.end; })
			.map(function(v){ return finish(v); });
		if(solutions[0]) return solutions[0];
	}


	function finish(solution){
		var route = solution.branch.end;
		var history = [];
		for(var item=solution; item.prev; item=item.prev){
			history.unshift({chr:uri[item.offset], offset:item.offset, var_index:item.data.index, var_push:item.data.push});
		}
		log('history', history);
		var var_list = [];
		for(var item_i=0; item_i<history.length; item_i++){
			var item = history[item_i];
			if(item.var_push!==undefined){
				var_list[item.var_push] = var_list[item.var_push] || [];
				var_list[item.var_push].push('');
			}else if(item.var_index!==undefined){
				var varv = var_list[item.var_index];
				if(Array.isArray(varv)){
					varv[varv.length-1] = varv[varv.length-1] + item.chr;
				}else{
					var_list[item.var_index] = (varv||'') + item.chr;
				}
			}
		}
		log('var_list', var_list);
		var bindings = {};
		route.variables.forEach(function(v){
			bindings[v.varname] = var_list[v.index];
		});
		return new Result(route.template, route.arg, bindings);
	}
}
