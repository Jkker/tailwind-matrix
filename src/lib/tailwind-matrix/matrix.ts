/**
 * Matrix Definition and Validation
 *
 * @remarks
 * Provides factory functions for creating and validating style matrices.
 */

import type {
  StyleMatrix,
  VariantDef,
  VariantCondition,
  MatrixRow,
} from './types'

/**
 * Extracts column values from a matrix row (skipping the condition).
 */
function getColumnValues<V extends VariantDef, Columns extends readonly string[]>(
  row: MatrixRow<V, Columns>,
): string[] {
  const result: string[] = []
  for (let i = 1; i < row.length; i++) {
    result.push(String(row[i]))
  }
  return result
}

/**
 * Creates a style matrix definition with type safety.
 *
 * @param config - The matrix configuration
 * @returns A validated StyleMatrix
 *
 * @example
 * ```ts
 * const buttonMatrix = styleMatrix({
 *   variants: {
 *     intent: ['primary', 'secondary'],
 *     size: ['sm', 'md', 'lg'],
 *   },
 *   columns: ['layout', 'surface', 'typography'],
 *   rows: [
 *     [{}, 'flex items-center', 'rounded-md', 'font-sans'],
 *     [{ intent: 'primary' }, 'p-4', 'bg-blue-600', 'text-white'],
 *   ],
 * })
 * ```
 */
export function styleMatrix<
  V extends VariantDef,
  const Columns extends readonly string[],
>(config: StyleMatrix<V, Columns>): StyleMatrix<V, Columns> {
  validateMatrix(config)
  return config
}

/**
 * Validates a style matrix definition.
 *
 * @throws Error if the matrix is invalid
 */
export function validateMatrix<V extends VariantDef, Columns extends readonly string[]>(
  matrix: StyleMatrix<V, Columns>,
): void {
  const { variants, columns, rows } = matrix

  // Validate variants
  if (!variants || typeof variants !== 'object') {
    throw new Error('Matrix must have a variants object')
  }

  for (const [key, values] of Object.entries(variants)) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`Variant "${key}" must have at least one value`)
    }
    for (const value of values) {
      if (typeof value !== 'string') {
        throw new Error(`Variant "${key}" values must be strings`)
      }
    }
  }

  // Validate columns
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('Matrix must have at least one column')
  }

  for (const col of columns) {
    if (typeof col !== 'string' || col.length === 0) {
      throw new Error('Column names must be non-empty strings')
    }
  }

  // Validate rows
  if (!Array.isArray(rows)) {
    throw new Error('Matrix must have a rows array')
  }

  const variantKeys = new Set(Object.keys(variants))
  const expectedLength = columns.length + 1 // condition + column values

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (!Array.isArray(row)) {
      throw new Error(`Row ${i} must be an array`)
    }

    if (row.length !== expectedLength) {
      throw new Error(
        `Row ${i} has ${row.length - 1} column values, expected ${columns.length}`,
      )
    }

    const condition = row[0] as VariantCondition<V>
    if (typeof condition !== 'object' || condition === null) {
      throw new Error(`Row ${i} condition must be an object`)
    }

    // Validate condition keys and values
    for (const [key, value] of Object.entries(condition) as [string, string][]) {
      if (!variantKeys.has(key)) {
        throw new Error(`Row ${i} has unknown variant key "${key}"`)
      }
      const allowedValues = variants[key as keyof V]
      if (!allowedValues.includes(value)) {
        throw new Error(
          `Row ${i} has invalid value "${value}" for variant "${key}". Allowed: ${allowedValues.join(', ')}`,
        )
      }
    }

    // Validate column values are strings
    for (let j = 1; j < row.length; j++) {
      if (typeof row[j] !== 'string') {
        throw new Error(`Row ${i}, column ${j - 1} must be a string`)
      }
    }
  }
}

/**
 * Checks if a condition matches a set of props.
 *
 * @remarks
 * A condition matches if all specified variant values match the props.
 * An empty condition always matches (base case).
 */
export function conditionMatches<V extends VariantDef>(
  condition: VariantCondition<V>,
  props: VariantCondition<V>,
): boolean {
  for (const [key, value] of Object.entries(condition)) {
    if (props[key as keyof V] !== value) {
      return false
    }
  }
  return true
}

/**
 * Gets all matching rows for a given set of props.
 *
 * @remarks
 * Returns rows in definition order. More specific conditions
 * (with more keys) are considered overrides of less specific ones.
 */
export function getMatchingRows<V extends VariantDef, Columns extends readonly string[]>(
  matrix: StyleMatrix<V, Columns>,
  props: VariantCondition<V>,
): ReadonlyArray<MatrixRow<V, Columns>> {
  return matrix.rows.filter((row) => conditionMatches(row[0], props))
}

/**
 * Collects classes from a matrix for given props.
 *
 * @remarks
 * This is a naive O(n) implementation for reference.
 * The compiler generates optimized code with O(1) lookups.
 */
export function collectClasses<V extends VariantDef, Columns extends readonly string[]>(
  matrix: StyleMatrix<V, Columns>,
  props: VariantCondition<V>,
): string {
  const matchingRows = getMatchingRows(matrix, props)
  const classSet = new Set<string>()

  for (const row of matchingRows) {
    for (const columnClasses of getColumnValues(row)) {
      for (const cls of columnClasses.split(/\s+/)) {
        if (cls) classSet.add(cls)
      }
    }
  }

  return [...classSet].join(' ')
}

/**
 * Extracts unique classes that are always applied (from base row with empty condition).
 *
 * @remarks
 * These "base classes" can be safely extracted and always applied.
 * They come from rows with empty conditions ({}).
 */
export function extractBaseClasses<V extends VariantDef, Columns extends readonly string[]>(
  matrix: StyleMatrix<V, Columns>,
): Set<string> {
  if (matrix.rows.length === 0) return new Set()

  const baseClasses = new Set<string>()

  // Find rows with empty conditions (base rows)
  for (const row of matrix.rows) {
    const condition = row[0]
    if (Object.keys(condition).length === 0) {
      // This is a base row - collect all its classes
      for (const columnClasses of getColumnValues(row)) {
        for (const cls of columnClasses.split(/\s+/)) {
          if (cls) baseClasses.add(cls)
        }
      }
    }
  }

  return baseClasses
}

/**
 * Builds a map from each unique class to the conditions that require it.
 *
 * @remarks
 * This is the first step in the boolean minimization algorithm.
 */
export function buildClassConditionMap<V extends VariantDef, Columns extends readonly string[]>(
  matrix: StyleMatrix<V, Columns>,
): Map<string, Array<VariantCondition<V>>> {
  const classMap = new Map<string, Array<VariantCondition<V>>>()

  for (const row of matrix.rows) {
    const condition = row[0]

    for (const columnClasses of getColumnValues(row)) {
      for (const cls of columnClasses.split(/\s+/)) {
        if (!cls) continue

        if (!classMap.has(cls)) {
          classMap.set(cls, [])
        }
        classMap.get(cls)!.push(condition)
      }
    }
  }

  return classMap
}
