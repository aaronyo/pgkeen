const fp = require('lodash/fp');

// These regexps are applied only after the entire SQL string has been
// reversed because we have lookahead but not lookbehind in js
const ignoreCastsAndComments = '(?!:)(?!.*--)';
const paramRegExp = RegExp('([\\w\\.]+):' + ignoreCastsAndComments, 'g');

function extractNamedParams(text) {
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
      RegExp(
        '(^|[^\\w\\.])(' + names[i - 1] + ':)' + ignoreCastsAndComments,
        'g',
      ),
      (matchingPart, precedingChar) =>
        precedingChar + (i > 9 ? fp.join('', fp.reverse('' + i)) : i) + '$',
    );
  }
  names = fp.map(n => fp.join('', fp.reverse(n)), names);
  return {
    text: fp.join('', fp.reverse(reversed)),
    names,
    propsToArgs: props => fp.map(name => fp.get(name, props), names),
  };
}

function namedParamsToBindVars(inputText, inputParams) {
  // 1. Parse out the names. This is the expensive step and
  //    could be done only once on a query as a performance optimization
  const { text, propsToArgs } = extractNamedParams(inputText);

  // 2. Map the names to the keys of the input params
  return [text, propsToArgs(inputParams)];
}

module.exports = {
  namedParamsToBindVars,
  parameterized: namedParamsToBindVars,
  extractNamedParams,
};
