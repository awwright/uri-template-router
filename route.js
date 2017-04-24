

module.exports.Router = Router;

function Router(){
	this.routes = [];
	this.tree = {};
}

var T_END = ' ^';
var T_EXPR = ' $';

Router.prototype.addTemplate = function addTemplate(uri, variables, arg){
	var node = this.tree;
	var varnames = {};
	for(var uri_i=0; uri_i<uri.length; uri_i++){
		var chr = uri[uri_i];
		if(chr=='{'){
			var endpos = uri.indexOf('}', uri_i+2);
			if(endpos<0) throw new Error('Unclosed expression: Expected "}" but found end of template');
			var patternBody = uri.substring(uri_i+1, endpos);
			uri_i = endpos;
			// If the first character is part of a valid variable name, assume the default modifier
			// Else, assume the first character is a modifier
			var modifier = patternBody[0].match(/[a-zA-Z0-9_%]/) ? '' : patternBody[0] ;
			if(modifier==''){
				var prefix = '';
				// unreserved
				var regexFirst = /^([A-Za-z0-9\_\.\~\-]|%[0-9A-Z]{2})*/;
			}else if(modifier=='+'){
				var prefix = '';
				// ( unreserved / reserved / pct-encoded )
				// unreserved: ALPHA / DIGIT / "-" / "." / "_" / "~"
				// reserved: :/?#[]@!$&'()*+,;=
				var regexFirst = /^([a-zA-Z0-9\-\.\_\~\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=]|%[0-9A-Z]{2})*/;
			}else if(modifier=='#'){
				var prefix = '#';
				// ( unreserved / reserved / pct-encoded )
				var regexFirst = /^#([a-zA-Z0-9\-\.\_\~\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=]|%[0-9A-Z]{2})*/;
			}else if(modifier=='.'){
				var prefix = '.';
				// unreserved
				var regexFirst = /^\.([A-Za-z0-9_\.\~\-\/]|%[0-9A-Z]{2})*/;
			}else if(modifier=='/'){
				var prefix = '/';
				// unreserved
				var regexFirst = /^\/([A-Za-z0-9_\.\~\-]|%[0-9A-Z]{2})*/;
				var regexNext = regexFirst;
			}else if(modifier==';'){
				var prefix = ';';
				// Go through each variable 
				var regexFirst = /^;([A-Za-z0-9_\.\~\-]|%[0-9A-Z]{2})*/;
				var regexNext = regexFirst;
			}else if(modifier=='?'){
				var prefix = '?';
				// Go through each variable 
				var regexFirst = /^\?([A-Za-z0-9_\.\~\-=]|%[0-9A-Z]{2})*/;
				var regexNext = /^&([A-Za-z0-9_\.\~\-=]|%[0-9A-Z]{2})*/;
			}else if(modifier=='&'){
				var prefix = '&';
				// Go through each variable 
				var regexFirst = /^&([A-Za-z0-9_\.\~\-=]|%[0-9A-Z]{2})*/;
				var regexNext = regexFirst;
			}else{
				throw new Error('Unknown expression operator: '+JSON.stringify(modifier));
			}
			var variableList = patternBody.substring(modifier.length).split(/,/g);
			var variableInfo = {};
			variableList.forEach(function(varspec){
				if(varspec.match(/\*$/)){
					if(!regexNext){
						throw new Error('Variable modifier '+JSON.stringify(modifier)+' does not work with explode modifier');
					}
					var varname = varspec.substring(0, varspec.length-1);
					var explode = regexNext;
				}else{
					var varname = varspec;
				}
				if(varnames[varname]){
					throw new Error('Variable '+JSON.stringify(vn)+' is already used');
				}
				var exprinfo = { expr:patternBody, name:varname, modifier:modifier, prefix:prefix, regexp:regexFirst, itemRegex:explode, end:{} };
				var branches = node[T_EXPR] = node[T_EXPR] || [];
				branches.push(exprinfo);
				node = exprinfo.end;
			});
		}else{
			// Decend node into the branch, creating it if it doesn't exist
			node = (node[chr] = node[chr] || {});
		}
	}
	node[T_END] = node[T_END] || [];
	node[T_END].push({ pattern:uri, arg:arg });
}

Router.prototype.resolveURI = function resolve(uri, flags){
	var alternatives = [];
	function check(node, i, bindings){
		var chr = uri[i];
		if(chr==undefined && node[T_END]){
			node[T_END].forEach(function(alt){
				alternatives.push({pattern:alt.pattern, arg:alt.arg, bindings:bindings});
			});
			return;
		}
		if(node[chr]){
			var leaf = node[chr];
			check(leaf, i+1, bindings);
		}
		if(node[T_EXPR]){
			node[T_EXPR].forEach(function(alt){
				// Search for pattern
				var match = uri.substring(i).match(alt.regexp);
				if(!match){
					check(alt.end, i, bindings);
					return;
				}
				var endpos = i + match[0].length;
				var encoded = match[0].substring(alt.prefix.length);
				var value = decodeURIComponent(encoded);
				// Explode flag indicates we search for multiple items in an array
				if(alt.itemRegex){
					value = [value];
					// Search for additional items
					for(var match; match=uri.substring(endpos).match(alt.itemRegex); ){
						endpos += match[0].length;
						var encoded = match[0].substring(alt.prefix.length);
						value.push(decodeURIComponent(encoded));
					}
				}
				// Copy variable bindings object
				var nb = {};
				for(var n in bindings) nb[n]=bindings[n];
				nb[alt.name] = value;
				check(alt.end, endpos, nb);
			});
		}
	}
	check(this.tree, 0);
	return alternatives;
}
