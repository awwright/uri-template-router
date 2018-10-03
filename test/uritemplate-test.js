
var fs = require('fs');
var assert = require('assert');
var inspect = require('util').inspect;
var R = require('..');

var files = [
	'spec-examples.json',
	'spec-examples-by-section.json',
	'extended-tests.json',
];

files.forEach(function(filename){
	var json = fs.readFileSync('test/uritemplate-test/'+filename);
	var data = JSON.parse(json);
	describe(filename, function(){
		Object.keys(data).forEach(function(sectionName){
			var section = data[sectionName];
			describe(sectionName, function(){
				section.testcases.forEach(function(test){
//					it(test[0]+' <- '+inspect(section.variables).replace(/\s+/g,' '), function(){
					it(test[0], function(){
						var expected = test[1];
						var actual = new R.Route(test[0]).gen(section.variables);
						if(Array.isArray(expected)){
							for(var i=0; i<expected.length && actual!=expected[i]; i++);
							if(i==expected.length) i=0;
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
