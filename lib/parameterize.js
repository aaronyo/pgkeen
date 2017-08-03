const fp = require('lodash/fp');

// These regexps are applied only after the entire SQL string has been
// reversed because we have lookahead but not lookbehind in js
const ignoreCastsAndComments = '(?!:)(?!.*--)';
const paramRegExp = RegExp('([\\w\\.]+):' + ignoreCastsAndComments, 'g');

function extractParams(text) {
  // JS doesn't have lookbehind, but reverse + lookahead == lookbehind
  let reversed = fp.join('', fp.reverse(text));
  let names = [];
  let match = paramRegExp.exec(reversed);
  while (match) {
    names.push(match[1]);
    match = paramRegExp.exec(reversed);
  }
  names = fp.uniq(fp.reverse(names));
  for (let i = 1; i <= names.length; i += 1) {
    reversed = reversed.replace(
      RegExp(names[i - 1] + ':' + ignoreCastsAndComments, 'g'),
      (i > 9 ? fp.join('', fp.reverse('' + i)) : i) + '$',
    );
  }
  return {
    text: fp.join('', fp.reverse(reversed)),
    names: fp.map(n => fp.join('', fp.reverse(n)), names),
  };
}

function parameterize(inputText, inputParams) {
  const { text, names } = extractParams(inputText);
  console.log('THING', text);
  const partial = inParams => ({
    text,
    values: fp.map(name => fp.get(name, inParams), names),
  });
  return inputParams ? partial(inputParams) : partial;
}

module.exports = { parameterize, extractParams };
