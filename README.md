
# URI Template Router

Match a URI to a URI template from a set of templates.

## Usage

```javascript
var r = new Router;

r.addTemplate('http://example.com/', {}, 'index');
r.addTemplate('http://example.com/root{/base}{/a*}{?b*}{#c}', {}, 'complex');
r.addTemplate('http://example.com/blog{/y,m,d,slug}', {}, 'blog_post');

r.resolveURI('http://example.com/'); // returns:
[ { pattern: 'http://example.com/',
    arg: 'index',
    bindings: undefined } ]

r.resolveURI('http://example.com/root/q/1/2/3?key1=one&key2=2'); // returns:
[ { pattern: 'http://example.com/root{/base}{/a*}{?b*}{#c}',
    arg: 'some-argument',
    bindings: {
       base: 'q',
       a: [ '1', '2', '3' ],
       b: [ 'key1=one', 'key2=2' ],
} } ]

r.resolveURI('http://example.com/blog/2010/01/02/inventing-the-wheel'); // returns:
[ { pattern: 'http://example.com/blog{/y,m,d,slug}',
    arg: 'blog_post',
    bindings: { y: '2010', m: '01', d: '02', slug: 'inventing-the-wheel' } } ]
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
