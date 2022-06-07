"use strict";

var fs = require('fs');
var assert = require('assert');
var R = require('..');

var files = [
	'uritemplate-test/negative-tests.json',
];

files.forEach(function(filename){
	var json = fs.readFileSync('test/'+filename);
	var data = JSON.parse(json);
	describe(filename, function(){
		Object.keys(data).forEach(function(sectionName){
			var section = data[sectionName];
			describe(sectionName, function(){
				section.testcases.forEach(function(test){
					it(test[0], function(){
						assert.throws(function(){
							var route = new R.Route(test[0]);
							route.gen(section.variables);
						});
					});
				});
			});
		});
	});
});
