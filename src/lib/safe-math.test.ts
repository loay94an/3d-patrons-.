import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateArithmeticExpression } from './safe-math';

describe('evaluateArithmeticExpression', () => {
  it('respects arithmetic precedence and parentheses', () => {
    assert.equal(evaluateArithmeticExpression('2 + 3 * (4 - 1)'), 11);
  });

  it('supports unary signs and decimal values', () => {
    assert.equal(evaluateArithmeticExpression('-(2.5 + .5) * +2'), -6);
  });

  it('supports scientific notation', () => {
    assert.equal(evaluateArithmeticExpression('1.5e2 / 3'), 50);
  });

  it('rejects executable JavaScript and unknown identifiers', () => {
    assert.equal(evaluateArithmeticExpression('globalThis.process.exit()'), null);
    assert.equal(evaluateArithmeticExpression('Math.max(1, 2)'), null);
    assert.equal(evaluateArithmeticExpression('width + 2'), null);
  });

  it('rejects division by zero and non-finite results', () => {
    assert.equal(evaluateArithmeticExpression('4 / 0'), null);
    assert.equal(evaluateArithmeticExpression('1e308 * 1e308'), null);
  });

  it('rejects malformed expressions and trailing tokens', () => {
    assert.equal(evaluateArithmeticExpression('1 +'), null);
    assert.equal(evaluateArithmeticExpression('(1 + 2'), null);
    assert.equal(evaluateArithmeticExpression('1 2'), null);
  });
});
