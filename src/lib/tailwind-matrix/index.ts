/**
 * Tailwind Matrix
 *
 * A 2D Attribute-State matrix styling engine that replaces 1-dimensional
 * variant definitions (like cva) with a relational table approach.
 *
 * @remarks
 * The matrix separates styling categories (Columns) from component states (Rows),
 * enabling better readability and centralized refactoring.
 *
 * @example
 * ```ts
 * import { styleMatrix, compileMatrix } from '@/lib/tailwind-matrix'
 *
 * const buttonMatrix = styleMatrix({
 *   variants: {
 *     intent: ['primary', 'secondary'] as const,
 *     size: ['sm', 'md', 'lg'] as const,
 *   },
 *   columns: ['layout', 'surface', 'typography'] as const,
 *   rows: [
 *     [{}, 'flex items-center', 'rounded-md', 'font-sans'],
 *     [{ intent: 'primary' }, 'p-4', 'bg-blue-600', 'text-white'],
 *     [{ intent: 'secondary' }, 'p-3', 'bg-gray-200', 'text-gray-900'],
 *   ],
 * })
 *
 * const { fn: button } = compileMatrix(buttonMatrix)
 * const className = button({ intent: 'primary', size: 'md' })
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  VariantDef,
  VariantCondition,
  MatrixRow,
  StyleMatrix,
  VariantProps,
  CompiledStyleFn,
  MinimizedClassRule,
  BooleanExpression,
  ClassConditionMap,
  CompilerOptions,
  CompilationResult,
  CompilationStats,
} from './types'

// Matrix definition
export {
  styleMatrix,
  validateMatrix,
  conditionMatches,
  getMatchingRows,
  collectClasses,
  extractBaseClasses,
  buildClassConditionMap,
} from './matrix'

// Boolean expression utilities
export {
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
} from './boolean'

// Compiler
export {
  compileMatrix,
  interpretMatrix,
} from './compiler'
