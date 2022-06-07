
docs/uri-template-router.bundle.js: index.js lib/fsm.js
	browserify -e ./index.js -s 'uriTemplateRouter' -o $@

clean:
	rm -f docs/uri-template-router.bundle.js

.PHONY: clean
