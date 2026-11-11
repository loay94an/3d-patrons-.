/**
 * Evaluate a deliberately small arithmetic language for drafting rules.
 * Supported syntax: finite decimal/scientific numbers, + - * /, unary signs,
 * and parentheses. Identifiers, calls, property access and all other syntax
 * are rejected; this module never evaluates JavaScript.
 */
export function evaluateArithmeticExpression(source: string): number | null {
  const tokens: Array<number | string> = [];
  let offset = 0;

  while (offset < source.length) {
    const rest = source.slice(offset);
    const whitespace = rest.match(/^\\s+/);
    if (whitespace) {
      offset += whitespace[0].length;
      continue;
    }

    const numeric = rest.match(/^(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?/);
    if (numeric) {
      const value = Number(numeric[0]);
      if (!Number.isFinite(value)) return null;
      tokens.push(value);
      offset += numeric[0].length;
      continue;
    }

    const operator = rest[0];
    if ('+-*/()'.includes(operator)) {
      tokens.push(operator);
      offset += 1;
      continue;
    }

    return null;
  }

  if (tokens.length === 0) return null;
  let cursor = 0;

  const parsePrimary = (): number => {
    const token = tokens[cursor];
    if (typeof token === 'number') {
      cursor += 1;
      return token;
    }
    if (token === '(') {
      cursor += 1;
      const value = parseExpression();
      if (tokens[cursor] !== ')') throw new Error('Missing closing parenthesis');
      cursor += 1;
      return value;
    }
    throw new Error('Expected a number or parenthesized expression');
  };

  const parseUnary = (): number => {
    const token = tokens[cursor];
    if (token === '+') {
      cursor += 1;
      return parseUnary();
    }
    if (token === '-') {
      cursor += 1;
      return -parseUnary();
    }
    return parsePrimary();
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const operator = tokens[cursor++];
      const right = parseUnary();
      if (operator === '/' && right === 0) throw new Error('Division by zero');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const operator = tokens[cursor++];
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  try {
    const result = parseExpression();
    if (cursor !== tokens.length || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}
