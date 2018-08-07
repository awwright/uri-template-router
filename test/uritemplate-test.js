
var fs = require('fs');
var assert = require('assert');
var R = require('..');

var files = [
	'spec-examples.json',
	'spec-examples-by-section.json',
	'extended-tests.json',
	'negative-tests.json',
];

files.forEach(function(filename){
	var json = fs.readFileSync('test/uritemplate-test/'+filename);
	var data = JSON.parse(json);
	describe(filename, function(){
		Object.keys(data).forEach(function(sectionName){
			var section = data[sectionName];
			describe(sectionName, function(){
				section.testcases.forEach(function(test){
					it(test[0], function(){
						var uri = new R.Route(test[0]).gen(section.variables);
						if(Array.isArray(test[1])){
							assert(test[1].indexOf(uri) >= 0);
						}else{
							assert.equal(uri, test[1]);
						}
					});
				});
			});
		});
	});
});
