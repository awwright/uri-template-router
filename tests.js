
var file = './route.js';
console.log(file);
var Router = require(file).Router;
var r = new Router;

function rpad(str, padlen){
	// FIXME this returns unexpected results for objects (it returns the object untouched)
	var padded = str;
	while(padded.length<padlen) padded+=' ';
	return padded;
}

function compareJSONParsedObject(a, b){
	if(a===b) return true;
	if((typeof a)!==(typeof b)) return false;
	if(Array.isArray(a)){
		if(a.length!==b.length) return false;
		return a.every(function(k,i){ return compareJSONParsedObject(a[i], b[i]); });
	}else if(typeof a=='object'){
		if(Object.keys(a).length != Object.keys(b).length) return false;
		return Object.keys(a).every(function(k){ return compareJSONParsedObject(a[k], b[k]); });
	}
}

var cols = {
	template: function(s){ return rpad(s, 40); },
	uri: function(s){ return rpad(s, 30); },
	expected: function(s){ return rpad(s, 60); },
	actual: function(s){ return s },
}

var tests = require('./t/base.json');
tests.forEach(function(testPage){
	var router = new Router;
	testPage.templates.forEach(function(template, i){
		router.addTemplate(template, {}, i);
	});
	//console.log(JSON.stringify(router,null," "));
	Object.keys(testPage.uris).forEach(function(uri){
		//console.log('Test: '+uri);
		try {
			var route = router.resolveURI(uri);
		}catch(e){
			console.log('error', uri, expected, route);
			return;
		}
		//console.log(route);
		//route=route[0];
		var expected = testPage.uris[uri];
		if(expected && !route){
			console.log('Missing: ', cols.uri(uri), cols.template(' (expected match)'), cols.expected(expected));
		}else if(!expected && !route){
			console.log('Pass:    ', cols.uri(uri), cols.template(' (none)'), cols.expected(' (none)'));
		}else if(!compareJSONParsedObject(route.data, expected)){
			console.log('Mismatch:', cols.uri(uri), cols.template(route.template), cols.expected(expected), cols.actual(route.data));
		}else{
			console.log('Pass:    ', cols.uri(uri), cols.template(route.template), route.data);
		}
	});
});
