"use strict";

var fs = require('fs');
var assert = require('assert');
var inspect = require('util').inspect;
var R = require('..');

var files = [
	'uritemplate-test/spec-examples.json',
	// 'uritemplate-test/extended-tests.json',
];


describe('Reverse', function(){
	files.forEach(function(filename){
		var json = fs.readFileSync(__dirname+'/'+filename);
		var data = JSON.parse(json);
		describe(filename, function(){
			Object.keys(data).forEach(function(sectionName){
				var section = data[sectionName];
				describe(sectionName, function(){
					section.testcases.forEach(function(test){
						const tpl = test[0];
						const uris = Array.isArray(test[1]) ? test[1] : [test[1]];
						// Make a list of only the used variables
						// (Empty variables are the same as undefined)
						const expected = {};
						Object.keys(section.variables).forEach(function(k){
							if(tpl.match(new RegExp('[^a-z]'+k+'[^a-z]')) && section.variables[k] !== ""){
								expected[k] = section.variables[k];
							}
						});

						// Don't support reversing into maps, non-exploded lists, or truncated strings
						if(tpl.match(/keys/)) return;
						if(tpl.match(/list(?!\*)/)) return;
						if(tpl.match(/:\d+/)) return;
						// Also don't support reversing into some ambiguous template formats
						if(tpl.match(/{\./)) return;
						if(tpl.match(/{+/) && tpl.match(/,/)) return;
						if(tpl.match(/{#/) && tpl.match(/,/)) return;


						describe(`<${tpl}>`, function(){
							it(`${inspect(expected).replace(/\s+/g,' ')} => <${uris[0]}>`, function(){
								const router = new R.Router();
								const uriTemplate = router.addTemplate(tpl);
								const res = uriTemplate.toString(expected);
								assert(uris.indexOf(res) >= 0);
							});
							uris.forEach(function(uri){
								it(`<${uri}> -> ${inspect(expected).replace(/\s+/g,' ')}`, function(){
									const router = new R.Router();
									const uriTemplate = router.addTemplate(tpl);
									// console.log(router.toViz());
									var actual = router.resolveURI(uri);
									assert(actual);
									// Empty string is the same as undefined
									assert.deepStrictEqual(actual.params, expected);
								});
							});
						});
					});
				});
			});
		});
	});
});
