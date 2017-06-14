
module.exports.Router = Router;

function log(){
//	console.log.apply(console, arguments);
}
function dir(){
//	console.dir.apply(console, arguments);
}

function Router(){
	this.routes = [];
	this.tree = new Node();
}

function Node(){
	// Automatically matches the given template
	this.end = null;
	// The characters we can reach next
	// If in an expression, this is potentially the end of the expression
	this.chr = {};
	// Expressions to decend into
	this.exp_match = [];
	// If we're currently in an expression
	this.exp_info = null;
	this.exp_range = null;
	this.exp_chr = {};
}

function Route(template, arg){
	this.template = template;
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
	var varnames = {};
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
				var varname = varspec.varname;
				var explode = varspec.explode;
				if(varnames[varname]){
					throw new Error('Variable '+JSON.stringify(varname)+' is already used');
				}
				var expressionInfo = {};
				varspec.index = Object.keys(varnames).length;
				varnames[varspec.varname] = varspec;

				var end = new Node;
				if(prefix){
					node.exp_chr[prefix] = node.exp_chr[prefix] || new Node;
					node = node.exp_chr[prefix];
				}
				node.exp_info = {type:'EXP', index:varspec.index};
				node.exp_range = node.exp_range || {};
				node.exp_range[range] = node.exp_range[range] || new Node;
				node = node.exp_range[range];
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
	node.end = new Route(uri, arg);
}

function StateSet(offset, tier, alternatives){
	this.offset = offset;
	this.tier = tier;
	// A list of equal alternative candidates for processing this input character
	this.alts = alternatives;
}

var S = {
	EOF: 10,
	CHR: 20,
	PCT1: 31,
	PCT2: 32,
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
	log('Decend', offset, data);
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
		log('branch', chr, offset, branch);
		if(branch.end){
			return finish(state.end, state.push(offset, branch.end, S.EOF, 'end'));
		}
		if(branch.chr[chr]){
			log('chr', chr);
			parse_chr.alts.push(state.push(offset, branch.chr[chr], S.CHR, 'chr'));
		}
		if(branch.exp_chr[chr]){
			log('prefix', chr);
			parse_chr.alts.push(state.push(offset, branch.exp_chr[chr], S.CHR, 'exp_chr'));
		}
		for(var rangeName in branch.exp_range){
			log('exp_match', rangeName);
			var validRange = RANGES_MAP[rangeName];
			var exprInfo = branch.exp_range[rangeName];
			if(chr in validRange){
				parse_exp.alts.push(state.push(offset, exprInfo, S.CHR, branch.exp_info));
			}else{
				log('exp_end');
				consumeInputCharacter(offset, chr, state, exprInfo.end);
			}
		}
	}
	for(var offset=0; offset<=uri.length; offset++){
//		log('Offset=%d Stack=%d', offset, parse_backtrack.length);
		var stateset_this = parse_backtrack.pop();
		//log(stateset_this);
		if(!stateset_this) break;
		offset = stateset_this.offset;
		var parse_chr = new StateSet(offset+1, 3, []);
		var parse_pfx = new StateSet(offset+1, 2, []);
		var parse_exp = new StateSet(offset+1, 1, []);
		var chr = uri[offset];
		log('Parse('+offset+') '+chr);
		for(var alt_i=0; alt_i<stateset_this.alts.length; alt_i++){
			var alt = stateset_this.alts[alt_i];
			consumeInputCharacter(offset, chr, alt, alt.branch);
		}
		// Push expressions onto the stack, below (before) matched characters however
		if(parse_exp.alts.length){
			parse_backtrack.push(parse_exp);
		}
		if(parse_pfx.alts.length){
			parse_backtrack.push(parse_pfx);
		}
		// Push highest priority stuff to top of stack (i.e. last)
		if(parse_chr.alts.length){
			parse_backtrack.push(parse_chr);
		}
//		log(offset, parse_backtrack);
	}
	// If there's no match
	if(!parse_backtrack.length) return null;
	var stateset_this = parse_backtrack.pop();
	var solution_list = stateset_this.alts.filter(function(v){
		return !!v.branch.end;
	})
	var solution = solution_list[0];
	if(solution_list.length<1) return null;
	if(solution_list.length>1){
		//throw new Error('Solution with more than one result');
	}
	return finish(solution.branch.end, solution);

	function finish(route, match){
		var history = [];
		for(var item=solution; item.prev; item=item.prev){
			history.unshift({offset:item.offset, mode:item.mode, data:item.data, chr:uri[item.offset]});
		}
		log('history');
		log(history);
		var var_list = [];
		var current_var = {};
		for(var item_i=0; item_i<history.length; item_i++){
			var item = history[item_i];
			if(current_var.name!==item.data.name){
				if(current_var.end===undefined){
					current_var.end = item.offset;
					current_var = {};
				}
				if(item.data.prefix && current_var.start===undefined){
					current_var = { start:item.offset+1, end:undefined, name:item.data.name, array:item.data.explode };
					var_list.push(current_var);
				}
				if(item.data.name && current_var.start===undefined){
					current_var = { start:item.offset, end:undefined, name:item.data.name, array:item.data.explode };
					var_list.push(current_var);
				}
			}
		}
		var bindings = {};
		var_list.forEach(function(v){
			var varname = v.name;
			var value = uri.substring(v.start, v.end);
			if(v.array){
				bindings[varname] = bindings[varname] || [];
				bindings[varname].push(value);
			}else{
				bindings[varname] = value;
			}
		});
		return new Result(route.template, route.arg, bindings);
	}
}
