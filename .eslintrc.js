module.exports = {
	"env": {
		"node": true,
		"es6": true,
	},
	"extends": "eslint:recommended",
	"parserOptions": {
		"ecmaVersion": 8,
	},
	"rules": {
		"indent": [ "error", "tab", { SwitchCase: 1 } ],
		"strict": ["error", "global"],
		"no-unused-vars": [ "warn", { "args": "none" } ],
		"no-unreachable": [ "error" ],
		"linebreak-style": [  "error", "unix" ],
		"semi": [ "error", "always" ],
		"no-extra-semi": [ "error" ],
		"comma-dangle": [ "error", "always-multiline" ],
		"no-console": [ "error" ],
	}
};
