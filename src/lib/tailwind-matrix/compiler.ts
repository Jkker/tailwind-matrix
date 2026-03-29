/**
 * Tailwind Matrix Compiler
 *
 * @remarks
 * Transforms the readable 2D matrix into a highly optimized decision tree.
 * Uses boolean function minimization to generate O(1) lookup code.
 */

import type {
  StyleMatrix,
  VariantDef,
  CompilerOptions,
  CompilationResult,
  CompiledStyleFn,
  CompilationStats,
  VariantCondition,
  BooleanExpression,
  MinimizedClassRule,
} from './types'
import {
  buildClassConditionMap,
  extractBaseClasses,
} from './matrix'
import {
  conditionsToExpression,
  simplifyExpression,
  exprToJS,
  exprToString,
} from './boolean'

/**
 * Compiles a style matrix into an optimized function.
 *
 * @param matrix - The style matrix to compile
 * @param options - Compiler options
 * @returns The compilation result with function and metadata
 *
 * @example
 * ```ts
 * const result = compileMatrix(buttonMatrix)
 * const className = result.fn({ intent: 'primary', size: 'md' })
 * ```
 */
export function compileMatrix<V extends VariantDef, Columns extends readonly string[]>(
  matrix: StyleMatrix<V, Columns>,
  options: CompilerOptions = {},
): CompilationResult<V> {
  const { extractBaseClasses: shouldExtract = true, debug = false } = options

  // Step 1: Extract base classes (classes that appear in ALL rows)
  const baseClasses = shouldExtract ? extractBaseClasses(matrix) : new Set<string>()

  // Step 2: Build class-to-condition map
  const classConditionMap = buildClassConditionMap(matrix)

  // Step 3: Remove base classes from conditional logic
  const conditionalClasses = new Map<string, Array<VariantCondition<V>>>()
  for (const [cls, conditions] of classConditionMap) {
    if (!baseClasses.has(cls)) {
      conditionalClasses.set(cls, conditions as Array<VariantCondition<V>>)
    }
  }

  // Step 4: Convert conditions to boolean expressions and simplify
  const minimizedRules = minimizeClassRules(conditionalClasses, matrix)

  // Step 5: Group classes with identical conditions
  const groupedRules = groupByCondition(minimizedRules)

  // Step 6: Generate optimized code
  const source = generateCode(
    [...baseClasses].join(' '),
    groupedRules,
    debug,
  )

  // Step 7: Create the function
  const fn = createFunction<V>(source)

  // Compile statistics
  const stats: CompilationStats = {
    totalClasses: classConditionMap.size,
    baseClassCount: baseClasses.size,
    conditionalRules: groupedRules.length,
    mergedRules: minimizedRules.length - groupedRules.length,
  }

  return {
    fn,
    source,
    baseClasses: [...baseClasses].join(' '),
    stats,
  }
}

/**
 * Minimizes class rules using boolean logic reduction.
 */
function minimizeClassRules<V extends VariantDef, Columns extends readonly string[]>(
  classConditionMap: Map<string, Array<VariantCondition<V>>>,
  matrix: StyleMatrix<V, Columns>,
): MinimizedClassRule[] {
  const rules: MinimizedClassRule[] = []
  const allVariants = Object.keys(matrix.variants)

  for (const [cls, conditions] of classConditionMap) {
    // Convert conditions to a boolean expression
    let expr = conditionsToExpression(conditions)

    // Check if this class appears in all possible combinations for any variant
    expr = trySimplifyToVariant(expr, matrix, conditions, allVariants)

    // Simplify the expression
    expr = simplifyExpression(expr)

    // Skip if always false (shouldn't happen in valid matrices)
    if (expr.type === 'literal' && !expr.value) continue

    rules.push({ classes: cls, expression: expr })
  }

  return rules
}

/**
 * Tries to simplify an expression when a class appears for all values of other variants.
 *
 * @remarks
 * This implements the core insight: if `bg-blue-600` appears in all hover states
 * for `primary`, the condition simplifies from `(primary && hover) || (primary && !hover)`
 * to just `primary`.
 */
function trySimplifyToVariant<V extends VariantDef, Columns extends readonly string[]>(
  expr: BooleanExpression,
  matrix: StyleMatrix<V, Columns>,
  conditions: Array<VariantCondition<V>>,
  allVariants: string[],
): BooleanExpression {
  // Find which variants are consistently specified across all conditions
  const variantValueSets = new Map<string, Set<string>>()

  for (const cond of conditions) {
    for (const variant of allVariants) {
      if (!variantValueSets.has(variant)) {
        variantValueSets.set(variant, new Set())
      }
      const value = cond[variant as keyof V]
      if (value !== undefined) {
        variantValueSets.get(variant)!.add(value)
      }
    }
  }

  // Check if any variant has all its values covered
  for (const [variant, usedValues] of variantValueSets) {
    const allValues = new Set(matrix.variants[variant as keyof V])
    const isFullyCovered = allValues.size === usedValues.size &&
      [...allValues].every((v) => usedValues.has(v))

    if (isFullyCovered && usedValues.size > 1) {
      // This variant is fully covered, so we can simplify
      // Check if other variants are consistent
      const otherVariants = allVariants.filter((v) => v !== variant)

      if (otherVariants.length === 0) {
        // No other variants, this is always true
        return { type: 'literal', value: true }
      }

      // Check if conditions group by other variants
      const groupedByOther = new Map<string, Set<string>>()
      for (const cond of conditions) {
        const conditionKey = otherVariants
          .map((v) => `${v}=${cond[v as keyof V] ?? ''}`)
          .join(',')
        if (!groupedByOther.has(conditionKey)) {
          groupedByOther.set(conditionKey, new Set())
        }
        const value = cond[variant as keyof V]
        if (value !== undefined) {
          groupedByOther.get(conditionKey)!.add(String(value))
        }
      }

      // Check if each group covers all values of the variant
      let canSimplify = true
      for (const values of groupedByOther.values()) {
        if (values.size !== allValues.size) {
          canSimplify = false
          break
        }
      }

      if (canSimplify) {
        // Rebuild expression without this variant
        const seen = new Set<string>()
        const newConditions: VariantCondition<V>[] = []
        for (const cond of conditions) {
          const newCond: VariantCondition<V> = {}
          for (const v of otherVariants) {
            const value = cond[v as keyof V]
            if (value !== undefined) {
              (newCond as Record<string, unknown>)[v] = value
            }
          }
          const condKey = JSON.stringify(newCond)
          if (!seen.has(condKey)) {
            seen.add(condKey)
            newConditions.push(newCond)
          }
        }

        return conditionsToExpression(newConditions)
      }
    }
  }

  return expr
}

/**
 * Groups rules with identical conditions together.
 */
function groupByCondition(rules: MinimizedClassRule[]): MinimizedClassRule[] {
  const groups = new Map<string, MinimizedClassRule>()

  for (const rule of rules) {
    const key = exprToString(rule.expression)

    if (groups.has(key)) {
      const existing = groups.get(key)!
      groups.set(key, {
        classes: `${existing.classes} ${rule.classes}`,
        expression: rule.expression,
      })
    } else {
      groups.set(key, rule)
    }
  }

  return [...groups.values()]
}

/**
 * Generates optimized JavaScript code for the style function.
 */
function generateCode(
  baseClasses: string,
  rules: MinimizedClassRule[],
  debug: boolean,
): string {
  const lines: string[] = []

  if (debug) {
    lines.push('// Auto-generated by Tailwind Matrix Compiler')
  }

  lines.push('(function(props) {')
  lines.push(`  let c = ${JSON.stringify(baseClasses ? baseClasses + ' ' : '')};`)

  // Group rules by structure for potential decision tree optimization
  const rulesByFirstVar = groupRulesByFirstVar(rules)

  if (rulesByFirstVar.size > 0) {
    lines.push('')

    // Generate optimized decision tree
    for (const [variantKey, variantRules] of rulesByFirstVar) {
      if (variantKey === '') {
        // Rules with literal true or complex conditions
        for (const rule of variantRules) {
          if (rule.expression.type === 'literal' && rule.expression.value) {
            lines.push(`  c += ${JSON.stringify(rule.classes + ' ')};`)
          } else {
            const condition = exprToJS(rule.expression)
            lines.push(`  if (${condition}) c += ${JSON.stringify(rule.classes + ' ')};`)
          }
        }
      } else {
        // Rules grouped by variant
        const byValue = new Map<string, MinimizedClassRule[]>()
        const otherRules: MinimizedClassRule[] = []

        for (const rule of variantRules) {
          const firstValue = getFirstVarValue(rule.expression, variantKey)
          if (firstValue) {
            if (!byValue.has(firstValue)) {
              byValue.set(firstValue, [])
            }
            byValue.get(firstValue)!.push(rule)
          } else {
            otherRules.push(rule)
          }
        }

        // Generate switch-like structure for single-variant checks
        if (byValue.size > 1 && otherRules.length === 0) {
          const entries = [...byValue.entries()]
          let isFirst = true

          for (const [value, valueRules] of entries) {
            const condition = `props.${variantKey} === '${value}'`
            const prefix = isFirst ? 'if' : 'else if'
            isFirst = false

            if (valueRules.length === 1 && valueRules[0].expression.type === 'var') {
              // Simple case: just one class for this value
              lines.push(`  ${prefix} (${condition}) c += ${JSON.stringify(valueRules[0].classes + ' ')};`)
            } else {
              // Complex case: multiple rules or nested conditions
              lines.push(`  ${prefix} (${condition}) {`)
              for (const rule of valueRules) {
                const innerExpr = removeFirstVar(rule.expression, variantKey)
                if (innerExpr.type === 'literal' && innerExpr.value) {
                  lines.push(`    c += ${JSON.stringify(rule.classes + ' ')};`)
                } else {
                  const innerCondition = exprToJS(innerExpr)
                  lines.push(`    if (${innerCondition}) c += ${JSON.stringify(rule.classes + ' ')};`)
                }
              }
              lines.push('  }')
            }
          }
        } else {
          // Fall back to individual if statements
          for (const rule of variantRules) {
            const condition = exprToJS(rule.expression)
            lines.push(`  if (${condition}) c += ${JSON.stringify(rule.classes + ' ')};`)
          }
        }
      }
    }
  }

  lines.push('')
  lines.push('  return c.trim();')
  lines.push('})')

  return lines.join('\n')
}

/**
 * Groups rules by their first variant variable.
 */
function groupRulesByFirstVar(rules: MinimizedClassRule[]): Map<string, MinimizedClassRule[]> {
  const groups = new Map<string, MinimizedClassRule[]>()

  for (const rule of rules) {
    const firstVar = getFirstVar(rule.expression)
    const key = firstVar ?? ''

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(rule)
  }

  return groups
}

/**
 * Gets the first variant variable in an expression.
 */
function getFirstVar(expr: BooleanExpression): string | null {
  switch (expr.type) {
    case 'literal':
      return null
    case 'var':
      return expr.variant
    case 'not':
      return getFirstVar(expr.operand)
    case 'and':
    case 'or':
      for (const op of expr.operands) {
        const v = getFirstVar(op)
        if (v) return v
      }
      return null
  }
}

/**
 * Gets the value of the first variant variable.
 */
function getFirstVarValue(expr: BooleanExpression, variantKey: string): string | null {
  switch (expr.type) {
    case 'literal':
      return null
    case 'var':
      return expr.variant === variantKey ? expr.value : null
    case 'not':
      return null // Don't group by negated values
    case 'and':
      for (const op of expr.operands) {
        if (op.type === 'var' && op.variant === variantKey) {
          return op.value
        }
      }
      return null
    case 'or':
      return null // Can't group OR expressions by single value
  }
}

/**
 * Removes the first variant from an expression.
 */
function removeFirstVar(expr: BooleanExpression, variantKey: string): BooleanExpression {
  switch (expr.type) {
    case 'literal':
    case 'not':
      return expr
    case 'var':
      return expr.variant === variantKey ? { type: 'literal', value: true } : expr
    case 'and': {
      const remaining = expr.operands.filter(
        (op) => !(op.type === 'var' && op.variant === variantKey),
      )
      if (remaining.length === 0) return { type: 'literal', value: true }
      if (remaining.length === 1) return remaining[0]
      return { type: 'and', operands: remaining }
    }
    case 'or':
      return expr
  }
}

/**
 * Creates a function from the generated source code.
 *
 * @remarks
 * Uses the Function constructor to dynamically create an optimized function.
 * This is intentional as the compiler generates safe code from validated input.
 */
function createFunction<V extends VariantDef>(source: string): CompiledStyleFn<V> {
  // eslint-disable-next-line typescript-eslint/no-implied-eval, no-new-func
  // The source is compiler-generated from validated StyleMatrix, not user input
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`return ${source}`)() as CompiledStyleFn<V>
}

/**
 * Interprets a style matrix without compilation.
 *
 * @remarks
 * This is a reference implementation for testing and debugging.
 * It performs O(n) lookups instead of O(1).
 */
export function interpretMatrix<V extends VariantDef, Columns extends readonly string[]>(
  matrix: StyleMatrix<V, Columns>,
): CompiledStyleFn<V> {
  const classConditionMap = buildClassConditionMap(matrix)

  return (props) => {
    const classes: string[] = []

    for (const [cls, conditions] of classConditionMap) {
      const matches = conditions.some((cond) => {
        for (const [key, value] of Object.entries(cond)) {
          if (props[key as keyof V] !== value) return false
        }
        return true
      })

      if (matches) {
        classes.push(cls)
      }
    }

    return classes.join(' ')
  }
}
