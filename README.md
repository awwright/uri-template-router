
# URI Template Router

Match a URI to a URI template from a set of templates.

* Specify a list of templates to test against using `{braces}` to specify variables
* Returns the best match, regardless of insertion order
* Scales to any number of templates/patterns to test against

## Example

```javascript
var r = new Router;

r.addTemplate('http://example.com/', {}, 'index');
r.addTemplate('http://example.com/q{n}.html', {}, 'page_html');
r.addTemplate('http://example.com/q{n}.txt', {}, 'page_txt');
r.addTemplate('http://example.com/blog{/y,m,d,slug}', {}, 'blog_post');

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
  pattern: 'http://example.com/q{n}.txt',
  name: 'page_html',
  data: { n: '123' },
}

r.resolveURI('http://example.com/blog/2010/01/02/inventing-the-wheel'); // returns:
{
  pattern: 'http://example.com/blog{/y,m,d,slug}',
  name: 'blog_post',
  data: { y: '2010', m: '01', d: '02', slug: 'inventing-the-wheel' },
}
```


## API

### new module.Router()

Create an instance of Router.

### Router#addTemplate(pattern, options, name)

Add a template to the set of templates. Mutates the instance.

### Router#resolveURI(uri, options)

Match a given URI against the set of templates and return the best match as a Result object with the following properties:

* pattern: the pattern that was matched
* name: the value of the third argument provided to addTemplate
* data: matched values for each of the variables, if any


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
* return next() call to continue evaluating state tree
* Variable flags
