import { expect, test, describe } from 'vitest'

import {
  boolVar,
  boolNot,
  boolAnd,
  boolOr,
  conditionToExpression,
  conditionsToExpression,
  simplifyExpression,
  expressionsEqual,
  exprToString,
  exprToJS,
} from '@/lib/tailwind-matrix/boolean'

describe('boolVar', () => {
  test('creates a variable expression', () => {
    const expr = boolVar('intent', 'primary')

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })
})

describe('boolNot', () => {
  test('creates a NOT expression', () => {
    const expr = boolNot(boolVar('intent', 'primary'))

    expect(expr.type).toBe('not')
    if (expr.type === 'not') {
      expect(expr.operand).toEqual({
        type: 'var',
        variant: 'intent',
        value: 'primary',
      })
    }
  })

  test('simplifies double negation', () => {
    const expr = boolNot(boolNot(boolVar('intent', 'primary')))

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })

  test('simplifies NOT true = false', () => {
    const expr = boolNot({ type: 'literal', value: true })

    expect(expr).toEqual({ type: 'literal', value: false })
  })

  test('simplifies NOT false = true', () => {
    const expr = boolNot({ type: 'literal', value: false })

    expect(expr).toEqual({ type: 'literal', value: true })
  })
})

describe('boolAnd', () => {
  test('creates an AND expression', () => {
    const expr = boolAnd(
      boolVar('intent', 'primary'),
      boolVar('size', 'lg'),
    )

    expect(expr.type).toBe('and')
  })

  test('flattens nested ANDs', () => {
    const inner = boolAnd(boolVar('a', '1'), boolVar('b', '2'))
    const expr = boolAnd(inner, boolVar('c', '3'))

    expect(expr.type).toBe('and')
    if (expr.type === 'and') {
      expect(expr.operands).toHaveLength(3)
    }
  })

  test('removes true literals', () => {
    const expr = boolAnd(
      { type: 'literal', value: true },
      boolVar('intent', 'primary'),
    )

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })

  test('short-circuits on false literal', () => {
    const expr = boolAnd(
      { type: 'literal', value: false },
      boolVar('intent', 'primary'),
    )

    expect(expr).toEqual({ type: 'literal', value: false })
  })

  test('returns true for empty operands', () => {
    const expr = boolAnd()

    expect(expr).toEqual({ type: 'literal', value: true })
  })

  test('returns single operand when only one', () => {
    const expr = boolAnd(boolVar('intent', 'primary'))

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })
})

describe('boolOr', () => {
  test('creates an OR expression', () => {
    const expr = boolOr(
      boolVar('intent', 'primary'),
      boolVar('intent', 'secondary'),
    )

    expect(expr.type).toBe('or')
  })

  test('flattens nested ORs', () => {
    const inner = boolOr(boolVar('a', '1'), boolVar('b', '2'))
    const expr = boolOr(inner, boolVar('c', '3'))

    expect(expr.type).toBe('or')
    if (expr.type === 'or') {
      expect(expr.operands).toHaveLength(3)
    }
  })

  test('short-circuits on true literal', () => {
    const expr = boolOr(
      { type: 'literal', value: true },
      boolVar('intent', 'primary'),
    )

    expect(expr).toEqual({ type: 'literal', value: true })
  })

  test('removes false literals', () => {
    const expr = boolOr(
      { type: 'literal', value: false },
      boolVar('intent', 'primary'),
    )

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })

  test('returns false for empty operands', () => {
    const expr = boolOr()

    expect(expr).toEqual({ type: 'literal', value: false })
  })
})

describe('conditionToExpression', () => {
  test('empty condition becomes true literal', () => {
    const expr = conditionToExpression({})

    expect(expr).toEqual({ type: 'literal', value: true })
  })

  test('single key-value becomes variable', () => {
    const expr = conditionToExpression({ intent: 'primary' })

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })

  test('multiple key-values become AND', () => {
    const expr = conditionToExpression({ intent: 'primary', size: 'lg' })

    expect(expr.type).toBe('and')
    if (expr.type === 'and') {
      expect(expr.operands).toHaveLength(2)
    }
  })
})

describe('conditionsToExpression', () => {
  test('empty conditions becomes false literal', () => {
    const expr = conditionsToExpression([])

    expect(expr).toEqual({ type: 'literal', value: false })
  })

  test('single condition becomes its expression', () => {
    const expr = conditionsToExpression([{ intent: 'primary' }])

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })

  test('multiple conditions become OR', () => {
    const expr = conditionsToExpression([
      { intent: 'primary' },
      { intent: 'secondary' },
    ])

    expect(expr.type).toBe('or')
  })
})

describe('simplifyExpression', () => {
  test('passes through literals', () => {
    const expr = simplifyExpression({ type: 'literal', value: true })

    expect(expr).toEqual({ type: 'literal', value: true })
  })

  test('passes through variables', () => {
    const expr = simplifyExpression(boolVar('intent', 'primary'))

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })

  test('simplifies A AND !A = false', () => {
    const a = boolVar('intent', 'primary')
    const expr = simplifyExpression(boolAnd(a, boolNot(a)))

    expect(expr).toEqual({ type: 'literal', value: false })
  })

  test('simplifies A OR !A = true', () => {
    const a = boolVar('intent', 'primary')
    const expr = simplifyExpression(boolOr(a, boolNot(a)))

    expect(expr).toEqual({ type: 'literal', value: true })
  })

  test('removes duplicate AND terms', () => {
    const a = boolVar('intent', 'primary')
    const expr = simplifyExpression(boolAnd(a, a))

    expect(expr).toEqual({ type: 'var', variant: 'intent', value: 'primary' })
  })

  test('applies consensus theorem', () => {
    // (A AND B) OR (!A AND B) = B
    const a = boolVar('intent', 'primary')
    const b = boolVar('size', 'lg')
    const expr = simplifyExpression(
      boolOr(boolAnd(a, b), boolAnd(boolNot(a), b)),
    )

    expect(expr).toEqual({ type: 'var', variant: 'size', value: 'lg' })
  })
})

describe('expressionsEqual', () => {
  test('compares literals', () => {
    expect(
      expressionsEqual({ type: 'literal', value: true }, { type: 'literal', value: true }),
    ).toBe(true)
    expect(
      expressionsEqual({ type: 'literal', value: true }, { type: 'literal', value: false }),
    ).toBe(false)
  })

  test('compares variables', () => {
    expect(
      expressionsEqual(boolVar('a', '1'), boolVar('a', '1')),
    ).toBe(true)
    expect(
      expressionsEqual(boolVar('a', '1'), boolVar('a', '2')),
    ).toBe(false)
    expect(
      expressionsEqual(boolVar('a', '1'), boolVar('b', '1')),
    ).toBe(false)
  })

  test('compares NOT expressions', () => {
    expect(
      expressionsEqual(boolNot(boolVar('a', '1')), boolNot(boolVar('a', '1'))),
    ).toBe(true)
    expect(
      expressionsEqual(boolNot(boolVar('a', '1')), boolNot(boolVar('b', '1'))),
    ).toBe(false)
  })

  test('compares AND expressions (order-independent)', () => {
    expect(
      expressionsEqual(
        boolAnd(boolVar('a', '1'), boolVar('b', '2')),
        boolAnd(boolVar('b', '2'), boolVar('a', '1')),
      ),
    ).toBe(true)
  })

  test('returns false for different types', () => {
    expect(
      expressionsEqual({ type: 'literal', value: true }, boolVar('a', '1')),
    ).toBe(false)
  })
})

describe('exprToString', () => {
  test('converts literal to string', () => {
    expect(exprToString({ type: 'literal', value: true })).toBe('true')
    expect(exprToString({ type: 'literal', value: false })).toBe('false')
  })

  test('converts variable to string', () => {
    expect(exprToString(boolVar('intent', 'primary'))).toBe('intent==primary')
  })

  test('converts NOT to string', () => {
    expect(exprToString(boolNot(boolVar('intent', 'primary')))).toBe('!(intent==primary)')
  })

  test('converts AND to string', () => {
    const expr = boolAnd(boolVar('a', '1'), boolVar('b', '2'))
    expect(exprToString(expr)).toBe('(a==1 && b==2)')
  })

  test('converts OR to string', () => {
    const expr = boolOr(boolVar('a', '1'), boolVar('b', '2'))
    expect(exprToString(expr)).toBe('(a==1 || b==2)')
  })
})

describe('exprToJS', () => {
  test('converts literal to JS', () => {
    expect(exprToJS({ type: 'literal', value: true })).toBe('true')
    expect(exprToJS({ type: 'literal', value: false })).toBe('false')
  })

  test('converts variable to JS', () => {
    expect(exprToJS(boolVar('intent', 'primary'))).toBe("props.intent === 'primary'")
  })

  test('converts variable with custom props name', () => {
    expect(exprToJS(boolVar('intent', 'primary'), 'p')).toBe("p.intent === 'primary'")
  })

  test('converts NOT to JS', () => {
    expect(exprToJS(boolNot(boolVar('intent', 'primary')))).toBe("!(props.intent === 'primary')")
  })

  test('converts AND to JS', () => {
    const expr = boolAnd(boolVar('a', '1'), boolVar('b', '2'))
    expect(exprToJS(expr)).toBe("props.a === '1' && props.b === '2'")
  })

  test('converts OR to JS', () => {
    const expr = boolOr(boolVar('a', '1'), boolVar('b', '2'))
    expect(exprToJS(expr)).toBe("(props.a === '1' || props.b === '2')")
  })
})
