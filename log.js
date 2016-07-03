function zip(a, b) {
  const result = [];

  for (let i = 0; i < b.length; i++) {
    result.push(a[i], String(b[i]));
  }

  result.push(a[b.length]);

  return result.join('');
}

function wrapConsoleFunction(fn) {
  return function (strings, ...variables) {
    console[fn](zip(strings, variables));
  }
}

export const error = wrapConsoleFunction('error');
export const info = wrapConsoleFunction('info');
export const log = wrapConsoleFunction('log');
