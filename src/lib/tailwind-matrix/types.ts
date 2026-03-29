/**
 * Tailwind Matrix Type Definitions
 *
 * @remarks
 * This module defines the core types for the 2D Attribute-State matrix system.
 * The matrix separates styling categories (Columns) from component states (Rows).
 */

/**
 * Defines variant keys and their possible values.
 * @example { intent: ['primary', 'secondary'], size: ['sm', 'md', 'lg'] }
 */
export type VariantDef = Record<string, readonly string[]>

/**
 * Represents a condition for when classes should be applied.
 * Each key maps to a specific variant value.
 */
export type VariantCondition<V extends VariantDef> = Partial<{
  [K in keyof V]: V[K][number]
}>

/**
 * A row in the style matrix consisting of a condition and column values.
 */
export type MatrixRow<V extends VariantDef, Columns extends readonly string[]> = [
  condition: VariantCondition<V>,
  ...columnValues: { [K in keyof Columns]: string }
]

/**
 * The core 2D style matrix definition.
 *
 * @remarks
 * - `variants`: The variant keys and their possible values
 * - `columns`: The styling domains (e.g., layout, surface, typography)
 * - `rows`: Each row defines classes for a specific variant permutation
 */
export interface StyleMatrix<
  V extends VariantDef = VariantDef,
  Columns extends readonly string[] = readonly string[],
> {
  /** The variant keys and their possible values */
  readonly variants: V
  /** The styling column names (e.g., 'layout', 'surface', 'typography') */
  readonly columns: Columns
  /** The 2D grid of conditions and class values */
  readonly rows: ReadonlyArray<MatrixRow<V, Columns>>
}

/**
 * Props type generated from a variant definition.
 */
export type VariantProps<V extends VariantDef> = Partial<{
  [K in keyof V]: V[K][number]
}>

/**
 * A compiled style function that takes variant props and returns class names.
 */
export type CompiledStyleFn<V extends VariantDef> = (props: VariantProps<V>) => string

/**
 * Result of logic minimization for a single class.
 */
export interface MinimizedClassRule {
  /** The class name(s) to apply */
  readonly classes: string
  /** The simplified boolean expression */
  readonly expression: BooleanExpression
}

/**
 * A boolean expression tree for logic minimization.
 */
export type BooleanExpression =
  | { readonly type: 'literal'; readonly value: boolean }
  | { readonly type: 'var'; readonly variant: string; readonly value: string }
  | { readonly type: 'not'; readonly operand: BooleanExpression }
  | { readonly type: 'and'; readonly operands: readonly BooleanExpression[] }
  | { readonly type: 'or'; readonly operands: readonly BooleanExpression[] }

/**
 * Intermediate representation of class-to-condition mappings.
 */
export interface ClassConditionMap {
  /** Maps each class to the conditions under which it applies */
  readonly classes: Map<string, ReadonlyArray<VariantCondition<VariantDef>>>
}

/**
 * Configuration options for the matrix compiler.
 */
export interface CompilerOptions {
  /** Whether to extract common base classes */
  readonly extractBaseClasses?: boolean
  /** Whether to optimize the generated code for V8 */
  readonly optimizeForV8?: boolean
  /** Whether to include debug comments in output */
  readonly debug?: boolean
}

/**
 * Result of the compilation process.
 */
export interface CompilationResult<V extends VariantDef> {
  /** The compiled function */
  readonly fn: CompiledStyleFn<V>
  /** The generated source code (for debugging/inspection) */
  readonly source: string
  /** Base classes extracted from all rows */
  readonly baseClasses: string
  /** Statistics about the optimization */
  readonly stats: CompilationStats
}

/**
 * Statistics about the compilation optimization.
 */
export interface CompilationStats {
  /** Total number of unique classes */
  readonly totalClasses: number
  /** Number of classes in the base (always applied) */
  readonly baseClassCount: number
  /** Number of conditional class rules after minimization */
  readonly conditionalRules: number
  /** Number of rules merged due to identical conditions */
  readonly mergedRules: number
}
