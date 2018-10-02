
# URI Template Router

Match a URI to a URI template from a set of templates.

* Specify a list of templates to test against using `{braces}` to specify variables
* Returns the best match, regardless of insertion order
* Scales to any number of templates/patterns to test against
* Supports repeating expressions using explode modifier
* Routes store an associated "name" argument for storing arbritrary values (including objects or functions)
* State machine evaluation can be resumed if the returned match isn't good (e.g. if first match wasn't in the database)

## Example

```javascript
var r = new Router;

r.addTemplate('http://example.com/', {}, 'index');
r.addTemplate('http://example.com/q{n}.html', {}, 'page_html');
r.addTemplate('http://example.com/q{n}.txt', {}, 'page_txt');
r.addTemplate('http://example.com/blog{/y,m,d,slug}', {}, 'blog_post');
r.addTemplate('http://example.com{/path*}', {}, 'path');

r.resolveURI('http://example.com/'); // returns:
{
  pattern: 'http://example.com/',
  name: 'index',
  data: undefined,
}

r.resolveURI('http://example.com/qfoo.txt'); // returns:
{
  pattern: 'http://example.com/q{n}.txt',
  name: 'page_txt',
  data: { n: 'foo' },
}

r.resolveURI('http://example.com/q123.html'); // returns:
{
  pattern: 'http://example.com/q{n}.html',
  name: 'page_html',
  data: { n: '123' },
}

r.resolveURI('http://example.com/blog/2010/01/02/inventing-the-wheel'); // returns:
{
  pattern: 'http://example.com/blog{/y,m,d,slug}',
  name: 'blog_post',
  data: { y: '2010', m: '01', d: '02', slug: 'inventing-the-wheel' },
}

r.resolveURI('http://example.com/first/second/third/'); // returns:
{
  pattern: 'http://example.com{/path*}',
  name: 'path',
  data: { path: [ 'first', 'second', 'third', '' ] },
}
```

## Features

### Router

The `Router` class maintains a list of routers


## API

### Router

Instances of `Router` store a tree of templates that can be searched for matches.

In the context of a Router, a template is stored in a _Route_ object.

### Router#addTemplate(pattern, options, name)

* pattern: string. Expects a valid URI Template.
* options: object. Currently reserved.
* name: any value. User-specified arbritrary value to be returned when this route is matched. Stored in `Router#name` and `Result#name`.
* returns: Route

Add a template to the set of templates. Mutates the instance.

Returns a `Route` object representing the particular route added.

### Router#resolveURI(uri, options)

Match a given URI against the set of templates and return the best match as a Result object.

### Result

Provides following properties:

* pattern: the pattern that was matched
* name: the value of the third argument provided to addTemplate
* data: matched values for each of the variables, if any

### Result#next()

Allows you to continue searching for a matching route. This is useful if you hit the database after the first match, but didn't find a record, so want to try the next match.

For example:

```javascript
var router = new Router;
router.addTemplate('http://localhost/other.txt');
router.addTemplate('http://localhost/{file}.txt');
router.addTemplate('http://localhost/{file}');
var route1 = router.resolveURI('http://localhost/index.txt');
// route1.template == 'http://localhost/{file}.txt'
var route2 = route1.next();
// route2.template == 'http://localhost/{file}'
var route3 = route2.next();
// route3 == undefined
```


## URI Template Format

URI Templates follow the RFC 6570 syntax. URI Template Router supports only the subset of syntax that can be reversed back into the original variables without data loss:

* Variables may not be re-used.
* The prefix modifier is treated as part of the variable name. The template `<{/x:1,x}>` will return values like `{"x:1":"a", "x":"abc"}`. Since they are separate variables, the values might not even match. For example, the URI `</a/ZZ/>` will return `{"x:1":"a", "x":"ZZ"}`.
* The explode modifier will always type that variable as an array, and can only be used with expression modifiers with certain separators.

URI Templates in URI Template Router constist of a sequence of literal characters and/or expressions. Literal characters must appear and must be matched exactly. URI Template Router does not normalize patterns or URIs, you should perform normalization before testing a URI against the router.

Expressions start with an opening curly brace `{` and continue until a closing curly brace `}`. Expressions cannot be nested.

Expressions constist of an optional modifier, which describes how to encode the variable, and a comma-seperated list of variables. Each variable may be undefined, a key-value map, an ordered array, or a string (including blank strings).

Expression modifiers:

* Blank modifier, indicates URL-encoding the variable
* `+` Raw modifier, indicates the variable is already a URI and to not encode the variable except for invalid characters
* `/` Path modifier, prefixes each variable and array item with a slash if the variable is defined
* `?` Query modifier, prefixes the first variable with `?` and the remaining with `&`, if the variable is defined
* `&` Query extension modifier, prefixes each variable and array item with `&` if the variable is defined

Variables are alphanumeric, and optionally end with a variable modifier:

* The explode modifier `*` indicates the variable will be an array
* The prefix modifier `:n` (for some positive integer `n`) indicates the variable is a string that has a maximum length.

## Evaluation order

URI Template Router returns a single, best matching template and the values that the expressions matched.

If one template is a strict subset of another, the router tries to return the route with the smaller matching set first. In the event two patterns are disjoint, superset/subsets are computed left-to-right.

The processor evaluates the URI left to right, preferring to match templates in the following order:

0. Matching a literal character
0. Matching an expression prefix
0. Matching an expression body
0. Repeating the current (if marked with the explode modifier)

For example, given the URI <`.../foo.html`>, the following templates would be preferred in the given order:

0. <`.../foo.html`>
0. <`.../foo.{ext}`>
0. <`.../{base}.html`>
0. <`.../{file}`>


### ToDo

* Configurable maximum URI length
* Blacklisted/rewrite patterns (ignore "../" segments)
* Cast variables to numbers
* Access to raw URI data
* Dump error on invalid URI
* Variable flags:
  - minimum/maximum length


## Index of Files

* README.md - you're looking at it
* example.html - Example usage in a Web browser
* index.js - entry point & entire code base
* node_modules/ - packages for running tests
* package.json - npm package metadata
* perf.js - performance testing script
* test/*.js - test suite hooks for mocha
* test/base.json - Data for uri-template-router tests
* test/uritemplate-test/ - the official URI Templates test suite
