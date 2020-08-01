
var fs = require('fs');
var assert = require('assert');
var inspect = require('util').inspect;
var R = require('..');

var files = [
	'uritemplate-test/spec-examples.json',
	// 'uritemplate-test/spec-examples-by-section.json',
	'uritemplate-test/extended-tests.json',
];

files.forEach(function(filename){
	var json = fs.readFileSync(__dirname+'/'+filename);
	var data = JSON.parse(json);
	describe(filename, function(){
		Object.keys(data).forEach(function(sectionName){
			var section = data[sectionName];
			describe(sectionName, function(){
				section.testcases.forEach(function(test){
					const variables = {};
					{
						Object.keys(section.variables).forEach(function(k){
							if(test[0].match(new RegExp('[^a-z]'+k))) variables[k] = section.variables[k];
						});
					}
					it(test[0]+' ↢ '+inspect(variables).replace(/\s+/g,' '), function(){
					// it(test[0], function(){
						var expected = test[1];
						const uriTemplate = new R.Route(test[0]);
						// assert.strictEqual(test[0], uriTemplate.toString());
						var actual = uriTemplate.gen(section.variables);
						if(Array.isArray(expected)){
							// If "expected" is an array, multiple values are legal because maps are unordered.
							for(var i=0; i<expected.length && actual!=expected[i]; i++);
							if(i==expected.length) i=0;
							// If none match, assume the first is the normal/best presentation
							assert.equal(actual, expected[i]);
						}else{
							assert.equal(actual, expected);
						}
					});
				});
			});
		});
	});
});
