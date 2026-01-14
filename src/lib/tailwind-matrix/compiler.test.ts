import { expect, test, describe } from 'vitest'

import {
  compileMatrix,
  interpretMatrix,
} from '@/lib/tailwind-matrix/compiler'
import { styleMatrix } from '@/lib/tailwind-matrix/matrix'

describe('compileMatrix', () => {
  test('compiles a simple matrix', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
      },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'bg-blue-600'],
        [{ intent: 'secondary' }, 'bg-gray-200'],
      ],
    })

    const result = compileMatrix(matrix)

    expect(result.fn).toBeTypeOf('function')
    expect(result.source).toContain('function')
    expect(result.stats.totalClasses).toBe(3)
  })

  test('extracts base classes correctly', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
      },
      columns: ['layout', 'surface'] as const,
      rows: [
        [{}, 'flex', 'rounded'],
        [{ intent: 'primary' }, 'flex p-4', 'rounded bg-blue'],
        [{ intent: 'secondary' }, 'flex p-3', 'rounded bg-gray'],
      ],
    })

    const result = compileMatrix(matrix)

    expect(result.baseClasses).toContain('flex')
    expect(result.baseClasses).toContain('rounded')
    expect(result.stats.baseClassCount).toBe(2)
  })

  test('compiled function returns correct classes for primary', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
      },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'bg-blue-600'],
        [{ intent: 'secondary' }, 'bg-gray-200'],
      ],
    })

    const { fn } = compileMatrix(matrix)
    const classes = fn({ intent: 'primary' })

    expect(classes).toContain('rounded')
    expect(classes).toContain('bg-blue-600')
    expect(classes).not.toContain('bg-gray-200')
  })

  test('compiled function returns correct classes for secondary', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
      },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'bg-blue-600'],
        [{ intent: 'secondary' }, 'bg-gray-200'],
      ],
    })

    const { fn } = compileMatrix(matrix)
    const classes = fn({ intent: 'secondary' })

    expect(classes).toContain('rounded')
    expect(classes).toContain('bg-gray-200')
    expect(classes).not.toContain('bg-blue-600')
  })

  test('compiled function returns only base classes for empty props', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
      },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'bg-blue-600'],
        [{ intent: 'secondary' }, 'bg-gray-200'],
      ],
    })

    const { fn } = compileMatrix(matrix)
    const classes = fn({})

    expect(classes).toContain('rounded')
    expect(classes).not.toContain('bg-blue-600')
    expect(classes).not.toContain('bg-gray-200')
  })

  test('handles multiple variants', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
        size: ['sm', 'lg'] as const,
      },
      columns: ['layout', 'surface'] as const,
      rows: [
        [{}, 'flex', 'rounded'],
        [{ intent: 'primary' }, '', 'bg-blue'],
        [{ intent: 'secondary' }, '', 'bg-gray'],
        [{ size: 'sm' }, 'p-2', ''],
        [{ size: 'lg' }, 'p-4', ''],
      ],
    })

    const { fn } = compileMatrix(matrix)

    const primaryLg = fn({ intent: 'primary', size: 'lg' })
    expect(primaryLg).toContain('flex')
    expect(primaryLg).toContain('rounded')
    expect(primaryLg).toContain('bg-blue')
    expect(primaryLg).toContain('p-4')

    const secondarySm = fn({ intent: 'secondary', size: 'sm' })
    expect(secondarySm).toContain('flex')
    expect(secondarySm).toContain('rounded')
    expect(secondarySm).toContain('bg-gray')
    expect(secondarySm).toContain('p-2')
  })

  test('handles combined variant conditions', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
        hover: ['true', 'false'] as const,
      },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary', hover: 'false' }, 'bg-blue-600'],
        [{ intent: 'primary', hover: 'true' }, 'bg-blue-700'],
        [{ intent: 'secondary', hover: 'false' }, 'bg-gray-200'],
        [{ intent: 'secondary', hover: 'true' }, 'bg-gray-300'],
      ],
    })

    const { fn } = compileMatrix(matrix)

    expect(fn({ intent: 'primary', hover: 'false' })).toContain('bg-blue-600')
    expect(fn({ intent: 'primary', hover: 'true' })).toContain('bg-blue-700')
    expect(fn({ intent: 'secondary', hover: 'false' })).toContain('bg-gray-200')
    expect(fn({ intent: 'secondary', hover: 'true' })).toContain('bg-gray-300')
  })

  test('optimizes boolean logic for shared classes', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
        hover: ['true', 'false'] as const,
      },
      columns: ['typography'] as const,
      rows: [
        [{}, 'font-sans'],
        [{ intent: 'primary', hover: 'false' }, 'text-white'],
        [{ intent: 'primary', hover: 'true' }, 'text-white'],
      ],
    })

    const { fn, source } = compileMatrix(matrix)

    // text-white should be optimized to just check intent === 'primary'
    // (since it appears for both hover states)
    expect(fn({ intent: 'primary', hover: 'false' })).toContain('text-white')
    expect(fn({ intent: 'primary', hover: 'true' })).toContain('text-white')
    expect(fn({ intent: 'secondary', hover: 'false' })).not.toContain('text-white')

    // The source should show optimized logic
    expect(source).toBeDefined()
  })

  test('includes debug comments when requested', () => {
    const matrix = styleMatrix({
      variants: { intent: ['primary'] as const },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'bg-blue'],
      ],
    })

    const { source } = compileMatrix(matrix, { debug: true })

    expect(source).toContain('Auto-generated')
  })

  test('can disable base class extraction', () => {
    const matrix = styleMatrix({
      variants: { intent: ['primary', 'secondary'] as const },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'rounded bg-blue'],
        [{ intent: 'secondary' }, 'rounded bg-gray'],
      ],
    })

    const result = compileMatrix(matrix, { extractBaseClasses: false })

    expect(result.baseClasses).toBe('')
    expect(result.stats.baseClassCount).toBe(0)
  })
})

describe('interpretMatrix', () => {
  test('interprets a simple matrix correctly', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
      },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded'],
        [{ intent: 'primary' }, 'bg-blue-600'],
        [{ intent: 'secondary' }, 'bg-gray-200'],
      ],
    })

    const fn = interpretMatrix(matrix)

    expect(fn({ intent: 'primary' })).toContain('rounded')
    expect(fn({ intent: 'primary' })).toContain('bg-blue-600')
    expect(fn({ intent: 'secondary' })).toContain('bg-gray-200')
  })

  test('interpret and compile produce consistent results', () => {
    const matrix = styleMatrix({
      variants: {
        intent: ['primary', 'secondary'] as const,
        size: ['sm', 'lg'] as const,
      },
      columns: ['layout', 'surface'] as const,
      rows: [
        [{}, 'flex', 'rounded'],
        [{ intent: 'primary' }, 'p-4', 'bg-blue'],
        [{ intent: 'secondary' }, 'p-3', 'bg-gray'],
        [{ size: 'lg' }, 'text-lg', ''],
        [{ intent: 'primary', size: 'lg' }, '', 'shadow-lg'],
      ],
    })

    const interpretFn = interpretMatrix(matrix)
    const { fn: compileFn } = compileMatrix(matrix)

    const testCases = [
      {},
      { intent: 'primary' as const },
      { intent: 'secondary' as const },
      { size: 'sm' as const },
      { size: 'lg' as const },
      { intent: 'primary' as const, size: 'sm' as const },
      { intent: 'primary' as const, size: 'lg' as const },
      { intent: 'secondary' as const, size: 'lg' as const },
    ]

    for (const props of testCases) {
      const interpretedClasses = new Set(interpretFn(props).split(' ').filter(Boolean))
      const compiledClasses = new Set(compileFn(props).split(' ').filter(Boolean))

      expect(compiledClasses).toEqual(interpretedClasses)
    }
  })
})

describe('real-world button example', () => {
  const buttonMatrix = styleMatrix({
    variants: {
      intent: ['primary', 'secondary', 'ghost'] as const,
      size: ['sm', 'md', 'lg'] as const,
    },
    columns: ['layout', 'surface', 'typography', 'effect'] as const,
    rows: [
      // Base styles (always applied)
      [{}, 'flex items-center', 'rounded-md', 'font-sans', 'transition-colors'],

      // Intent variants
      [{ intent: 'primary' }, '', 'bg-blue-600 text-white', '', 'hover:bg-blue-700'],
      [{ intent: 'secondary' }, '', 'bg-gray-200 text-gray-900', '', 'hover:bg-gray-300'],
      [{ intent: 'ghost' }, '', 'bg-transparent text-gray-700', '', 'hover:bg-gray-100'],

      // Size variants
      [{ size: 'sm' }, 'px-2 py-1', '', 'text-sm', ''],
      [{ size: 'md' }, 'px-4 py-2', '', 'text-base', ''],
      [{ size: 'lg' }, 'px-6 py-3', '', 'text-lg', ''],
    ],
  })

  test('compiles the button matrix', () => {
    const { fn, stats, baseClasses } = compileMatrix(buttonMatrix)

    expect(fn).toBeTypeOf('function')
    expect(stats.totalClasses).toBeGreaterThan(0)
    expect(baseClasses).toContain('flex')
    expect(baseClasses).toContain('items-center')
    expect(baseClasses).toContain('rounded-md')
    expect(baseClasses).toContain('font-sans')
    expect(baseClasses).toContain('transition-colors')
  })

  test('generates correct classes for primary md button', () => {
    const { fn } = compileMatrix(buttonMatrix)
    const classes = fn({ intent: 'primary', size: 'md' })

    expect(classes).toContain('flex')
    expect(classes).toContain('items-center')
    expect(classes).toContain('rounded-md')
    expect(classes).toContain('bg-blue-600')
    expect(classes).toContain('text-white')
    expect(classes).toContain('px-4')
    expect(classes).toContain('py-2')
    expect(classes).toContain('text-base')
    expect(classes).toContain('hover:bg-blue-700')
  })

  test('generates correct classes for ghost lg button', () => {
    const { fn } = compileMatrix(buttonMatrix)
    const classes = fn({ intent: 'ghost', size: 'lg' })

    expect(classes).toContain('flex')
    expect(classes).toContain('bg-transparent')
    expect(classes).toContain('text-gray-700')
    expect(classes).toContain('px-6')
    expect(classes).toContain('py-3')
    expect(classes).toContain('text-lg')
    expect(classes).toContain('hover:bg-gray-100')
  })
})

describe('edge cases', () => {
  test('handles empty rows gracefully', () => {
    const matrix = styleMatrix({
      variants: { intent: ['primary'] as const },
      columns: ['surface'] as const,
      rows: [],
    })

    const { fn, stats, baseClasses } = compileMatrix(matrix)

    expect(fn({})).toBe('')
    expect(stats.totalClasses).toBe(0)
    expect(baseClasses).toBe('')
  })

  test('handles matrix with only base row', () => {
    const matrix = styleMatrix({
      variants: { intent: ['primary'] as const },
      columns: ['surface'] as const,
      rows: [
        [{}, 'rounded bg-white'],
      ],
    })

    const { fn, baseClasses } = compileMatrix(matrix)

    expect(baseClasses).toContain('rounded')
    expect(baseClasses).toContain('bg-white')
    expect(fn({})).toBe('rounded bg-white')
    expect(fn({ intent: 'primary' })).toBe('rounded bg-white')
  })

  test('handles classes with special characters', () => {
    const matrix = styleMatrix({
      variants: { state: ['hover', 'focus'] as const },
      columns: ['effect'] as const,
      rows: [
        [{}, 'ring-offset-2'],
        [{ state: 'hover' }, 'hover:ring-2'],
        [{ state: 'focus' }, 'focus:ring-2 focus-visible:outline-none'],
      ],
    })

    const { fn } = compileMatrix(matrix)

    expect(fn({ state: 'hover' })).toContain('hover:ring-2')
    expect(fn({ state: 'focus' })).toContain('focus:ring-2')
    expect(fn({ state: 'focus' })).toContain('focus-visible:outline-none')
  })
})
