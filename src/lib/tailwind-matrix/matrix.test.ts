import { expect, test, describe } from 'vitest'

import {
  styleMatrix,
  validateMatrix,
  conditionMatches,
  getMatchingRows,
  collectClasses,
  extractBaseClasses,
  buildClassConditionMap,
} from '@/lib/tailwind-matrix/matrix'

describe('styleMatrix', () => {
  test('creates a valid style matrix', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
        size: ['sm', 'lg'] as const,
      },
      columns: ['layout', 'surface'] as const,
      rows: [
        [{}, 'flex', 'rounded'],
        [{ intent: 'primary' }, 'p-4', 'bg-blue'],
      ],
    })

    expect(matrix.variants.intent).toEqual(['primary', 'secondary'])
    expect(matrix.columns).toEqual(['layout', 'surface'])
    expect(matrix.rows).toHaveLength(2)
  })

  test('throws on invalid variants', () => {
    expect(() =>
      styleMatrix({
        variants: {
          intent: [] as const,
        },
        columns: ['layout'] as const,
        rows: [],
      }),
    ).toThrow('Variant "intent" must have at least one value')
  })

  test('throws on missing columns', () => {
    expect(() =>
      styleMatrix({
        variants: { intent: ['primary'] as const },
        columns: [] as const,
        rows: [],
      }),
    ).toThrow('Matrix must have at least one column')
  })

  test('throws on wrong row length', () => {
    expect(() =>
      // Test runtime validation by calling validateMatrix directly with wrong data
      validateMatrix({
        variants: { intent: ['primary'] as const },
        columns: ['layout', 'surface'] as const,
        rows: [
          [{}, 'flex'] as unknown as [Record<string, never>, string, string], // force wrong length
        ],
      }),
    ).toThrow('Row 0 has 1 column values, expected 2')
  })

  test('throws on unknown variant key in condition', () => {
    expect(() =>
      validateMatrix({
        variants: { intent: ['primary'] as const },
        columns: ['layout'] as const,
        rows: [
          // @ts-expect-error testing unknown key
          [{ unknown: 'value' }, 'flex'],
        ],
      }),
    ).toThrow('Row 0 has unknown variant key "unknown"')
  })

  test('throws on invalid variant value in condition', () => {
    expect(() =>
      validateMatrix({
        variants: { intent: ['primary', 'secondary'] as const },
        columns: ['layout'] as const,
        rows: [
          // @ts-expect-error testing invalid value
          [{ intent: 'invalid' }, 'flex'],
        ],
      }),
    ).toThrow('Row 0 has invalid value "invalid" for variant "intent"')
  })
})

describe('conditionMatches', () => {
  test('empty condition matches any props', () => {
    expect(conditionMatches({}, {})).toBe(true)
    expect(conditionMatches({}, { intent: 'primary' })).toBe(true)
  })

  test('condition matches when props have the specified values', () => {
    expect(
      conditionMatches(
        { intent: 'primary' },
        { intent: 'primary', size: 'sm' },
      ),
    ).toBe(true)
  })

  test('condition does not match when props have different values', () => {
    expect(
      conditionMatches(
        { intent: 'primary' },
        { intent: 'secondary' },
      ),
    ).toBe(false)
  })

  test('condition does not match when props are missing keys', () => {
    expect(
      conditionMatches(
        { intent: 'primary' },
        {},
      ),
    ).toBe(false)
  })
})

describe('getMatchingRows', () => {
  const matrix = styleMatrix({
    variants: {
      intent: ['primary', 'secondary'] as const,
      size: ['sm', 'lg'] as const,
    },
    columns: ['layout', 'surface'] as const,
    rows: [
      [{}, 'base-layout', 'base-surface'],
      [{ intent: 'primary' }, 'primary-layout', 'primary-surface'],
      [{ intent: 'secondary' }, 'secondary-layout', 'secondary-surface'],
      [{ size: 'lg' }, 'lg-layout', 'lg-surface'],
    ],
  })

  test('returns all matching rows', () => {
    const matches = getMatchingRows(matrix, { intent: 'primary', size: 'lg' })

    expect(matches).toHaveLength(3)
    expect(matches[0][0]).toEqual({})
    expect(matches[1][0]).toEqual({ intent: 'primary' })
    expect(matches[2][0]).toEqual({ size: 'lg' })
  })

  test('returns only base row when no variants match', () => {
    const matches = getMatchingRows(matrix, {})

    expect(matches).toHaveLength(1)
    expect(matches[0][0]).toEqual({})
  })
})

describe('collectClasses', () => {
  const matrix = styleMatrix({
    variants: {
      intent: ['primary', 'secondary'] as const,
    },
    columns: ['layout', 'surface'] as const,
    rows: [
      [{}, 'flex items-center', 'rounded'],
      [{ intent: 'primary' }, 'p-4', 'bg-blue-600'],
      [{ intent: 'secondary' }, 'p-3', 'bg-gray-200'],
    ],
  })

  test('collects classes for base case', () => {
    const classes = collectClasses(matrix, {})

    expect(classes).toContain('flex')
    expect(classes).toContain('items-center')
    expect(classes).toContain('rounded')
    expect(classes).not.toContain('p-4')
    expect(classes).not.toContain('bg-blue-600')
  })

  test('collects classes for primary intent', () => {
    const classes = collectClasses(matrix, { intent: 'primary' })

    expect(classes).toContain('flex')
    expect(classes).toContain('rounded')
    expect(classes).toContain('p-4')
    expect(classes).toContain('bg-blue-600')
    expect(classes).not.toContain('p-3')
    expect(classes).not.toContain('bg-gray-200')
  })
})

describe('extractBaseClasses', () => {
  test('extracts classes from base row (empty condition)', () => {
    const matrix = styleMatrix({
      variants: { intent: ['primary', 'secondary'] as const },
      columns: ['layout', 'surface'] as const,
      rows: [
        [{}, 'flex rounded', 'shadow'],
        [{ intent: 'primary' }, 'flex p-4', 'shadow bg-blue'],
        [{ intent: 'secondary' }, 'flex p-3', 'shadow bg-gray'],
      ],
    })

    const baseClasses = extractBaseClasses(matrix)

    // Base classes come from the empty condition row
    expect(baseClasses.has('flex')).toBe(true)
    expect(baseClasses.has('rounded')).toBe(true)
    expect(baseClasses.has('shadow')).toBe(true)
    // Classes from variant rows should not be in base
    expect(baseClasses.has('p-4')).toBe(false)
    expect(baseClasses.has('bg-blue')).toBe(false)
  })

  test('returns empty set for empty matrix', () => {
    const matrix = styleMatrix({
      variants: { intent: ['primary'] as const },
      columns: ['layout'] as const,
      rows: [],
    })

    const baseClasses = extractBaseClasses(matrix)

    expect(baseClasses.size).toBe(0)
  })
})

describe('buildClassConditionMap', () => {
  test('builds map from classes to conditions', () => {
    const matrix = styleMatrix({
      variants: { intent: ['primary', 'secondary'] as const },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'bg-blue'],
        [{ intent: 'secondary' }, 'bg-gray'],
      ],
    })

    const classMap = buildClassConditionMap(matrix)

    expect(classMap.get('rounded')).toEqual([{}])
    expect(classMap.get('bg-blue')).toEqual([{ intent: 'primary' }])
    expect(classMap.get('bg-gray')).toEqual([{ intent: 'secondary' }])
  })

  test('maps class to multiple conditions when reused', () => {
    const matrix = styleMatrix({
      variants: { intent: ['primary', 'secondary'] as const },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'rounded bg-blue'],
        [{ intent: 'secondary' }, 'bg-gray'],
      ],
    })

    const classMap = buildClassConditionMap(matrix)

    expect(classMap.get('rounded')).toEqual([{}, { intent: 'primary' }])
  })
})
