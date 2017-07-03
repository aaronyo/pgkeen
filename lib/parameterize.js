const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const fp = require('lodash/fp');

// These regexps are applied only after the entire SQL string has been
// reversed because we have lookahead but not lookbehind in js
const ignoreCastsAndComments = '(?!:)(?!.*--)';
const paramRegExp = RegExp('(\\w+):' + ignoreCastsAndComments, 'g');

function extractParams(text) {
  // JS doesn't have lookbehind, but reverse + lookahead == lookbehind
  let reversed = fp.join('', fp.reverse(text));
  let names = [];
  let match;
  while ((match = paramRegExp.exec(reversed))) {
    names.push(match[1]);
  }
  names = fp.uniq(names);
  for (let i = 0; i < names.length; i++) {
    reversed = reversed.replace(
      RegExp(names[i] + ':' + ignoreCastsAndComments, 'g'),
      i + 1 + '$',
    );
  }
  return {
    text: fp.join('', fp.reverse(reversed)),
    names: fp.map(n => fp.join('', fp.reverse(n)), names),
  };
}

function parameterize(inputText, inputParams) {
  const { text, names } = extractParams(inputText);
  const partial = inParams => ({
    text,
    values: fp.map(name => inParams[name], names),
  });
  return inputParams ? partial(inputParams) : partial;
}

module.exports = { parameterize, extractParams };
