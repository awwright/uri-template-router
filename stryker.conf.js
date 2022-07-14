/**
 * @type {import('@stryker-mutator/api/core').StrykerOptions}
 */
module.exports = {
	mutator: "javascript",
	packageManager: "yarn",
	reporters: ["html", "clear-text", "progress"],
	testRunner: "mocha",
	testFramework: "mocha",
	coverageAnalysis: "perTest",
	files: ['index.js', 'lib/**', 'test/**' ],
	mutate: ['index.js', 'lib/**.js'],
};
