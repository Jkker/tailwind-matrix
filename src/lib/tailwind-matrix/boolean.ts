/**
 * Boolean Expression Minimization
 *
 * @remarks
 * Implements boolean function minimization for optimizing class conditions.
 * Uses a Quine-McCluskey inspired approach with logic reduction.
 */

import type {
  BooleanExpression,
  VariantDef,
  VariantCondition,
} from './types'

/**
 * Creates a boolean variable expression.
 */
export function boolVar(variant: string, value: string): BooleanExpression {
  return { type: 'var', variant, value }
}

/**
 * Creates a NOT expression.
 */
export function boolNot(operand: BooleanExpression): BooleanExpression {
  // Simplify double negation
  if (operand.type === 'not') {
    return operand.operand
  }
  // NOT true = false, NOT false = true
  if (operand.type === 'literal') {
    return { type: 'literal', value: !operand.value }
  }
  return { type: 'not', operand }
}

/**
 * Creates an AND expression.
 */
export function boolAnd(...operands: BooleanExpression[]): BooleanExpression {
  // Flatten nested ANDs
  const flattened: BooleanExpression[] = []
  for (const op of operands) {
    if (op.type === 'and') {
      flattened.push(...op.operands)
    } else {
      flattened.push(op)
    }
  }

  // Filter out true literals, check for false
  const filtered = flattened.filter((op) => {
    if (op.type === 'literal') {
      if (!op.value) return true // Keep false to short-circuit
      return false // Remove true
    }
    return true
  })

  // If any operand is false, result is false
  if (filtered.some((op) => op.type === 'literal' && !op.value)) {
    return { type: 'literal', value: false }
  }

  if (filtered.length === 0) {
    return { type: 'literal', value: true }
  }

  if (filtered.length === 1) {
    return filtered[0]
  }

  return { type: 'and', operands: filtered }
}

/**
 * Creates an OR expression.
 */
export function boolOr(...operands: BooleanExpression[]): BooleanExpression {
  // Flatten nested ORs
  const flattened: BooleanExpression[] = []
  for (const op of operands) {
    if (op.type === 'or') {
      flattened.push(...op.operands)
    } else {
      flattened.push(op)
    }
  }

  // Filter out false literals, check for true
  const filtered = flattened.filter((op) => {
    if (op.type === 'literal') {
      if (op.value) return true // Keep true to short-circuit
      return false // Remove false
    }
    return true
  })

  // If any operand is true, result is true
  if (filtered.some((op) => op.type === 'literal' && op.value)) {
    return { type: 'literal', value: true }
  }

  if (filtered.length === 0) {
    return { type: 'literal', value: false }
  }

  if (filtered.length === 1) {
    return filtered[0]
  }

  return { type: 'or', operands: filtered }
}

/**
 * Converts a variant condition to a boolean expression.
 *
 * @remarks
 * An empty condition becomes `true` (always matches).
 * Each key-value pair becomes `variant === value`.
 */
export function conditionToExpression<V extends VariantDef>(
  condition: VariantCondition<V>,
): BooleanExpression {
  const entries = Object.entries(condition) as [string, string][]

  if (entries.length === 0) {
    return { type: 'literal', value: true }
  }

  const terms = entries.map(([variant, value]) => boolVar(variant, value))

  return boolAnd(...terms)
}

/**
 * Converts multiple conditions (OR relationship) to a boolean expression.
 */
export function conditionsToExpression<V extends VariantDef>(
  conditions: ReadonlyArray<VariantCondition<V>>,
): BooleanExpression {
  if (conditions.length === 0) {
    return { type: 'literal', value: false }
  }

  const terms = conditions.map(conditionToExpression)
  return boolOr(...terms)
}

/**
 * Simplifies a boolean expression using algebraic rules.
 *
 * @remarks
 * Applies the following simplifications:
 * - (A AND !A) = false
 * - (A OR !A) = true
 * - (A AND A) = A
 * - (A OR A) = A
 * - Absorption: A OR (A AND B) = A
 * - Consensus: (A AND B) OR (!A AND B) = B
 */
export function simplifyExpression(expr: BooleanExpression): BooleanExpression {
  switch (expr.type) {
    case 'literal':
    case 'var':
      return expr

    case 'not': {
      const simplified = simplifyExpression(expr.operand)
      return boolNot(simplified)
    }

    case 'and': {
      const simplified = expr.operands.map(simplifyExpression)
      const result = boolAnd(...simplified)

      if (result.type !== 'and') return result

      // Check for complementary terms (A AND !A = false)
      if (hasComplementaryTerms(result.operands)) {
        return { type: 'literal', value: false }
      }

      // Remove duplicate terms
      const deduped = removeDuplicateTerms(result.operands)
      if (deduped.length === 0) return { type: 'literal', value: true }
      if (deduped.length === 1) return deduped[0]
      return { type: 'and', operands: deduped }
    }

    case 'or': {
      const simplified = expr.operands.map(simplifyExpression)
      const result = boolOr(...simplified)

      if (result.type !== 'or') return result

      // Check for complementary terms (A OR !A = true)
      if (hasComplementaryTerms(result.operands)) {
        return { type: 'literal', value: true }
      }

      // Apply absorption and consensus
      const absorbed = applyAbsorption(result.operands)
      const consensus = applyConsensus(absorbed)

      if (consensus.length === 1) return consensus[0]
      if (consensus.length === 0) return { type: 'literal', value: false }

      return { type: 'or', operands: consensus }
    }
  }
}

/**
 * Checks if an array of expressions contains complementary terms.
 */
function hasComplementaryTerms(operands: readonly BooleanExpression[]): boolean {
  for (let i = 0; i < operands.length; i++) {
    for (let j = i + 1; j < operands.length; j++) {
      if (areComplementary(operands[i], operands[j])) {
        return true
      }
    }
  }
  return false
}

/**
 * Checks if two expressions are complementary (A and !A).
 */
function areComplementary(a: BooleanExpression, b: BooleanExpression): boolean {
  if (a.type === 'not' && expressionsEqual(a.operand, b)) return true
  if (b.type === 'not' && expressionsEqual(b.operand, a)) return true
  return false
}

/**
 * Checks if two expressions are structurally equal.
 */
export function expressionsEqual(a: BooleanExpression, b: BooleanExpression): boolean {
  if (a.type !== b.type) return false

  switch (a.type) {
    case 'literal':
      return b.type === 'literal' && a.value === b.value

    case 'var':
      return b.type === 'var' && a.variant === b.variant && a.value === b.value

    case 'not':
      return b.type === 'not' && expressionsEqual(a.operand, b.operand)

    case 'and':
    case 'or': {
      if (b.type !== 'and' && b.type !== 'or') return false
      const bOps = b.operands
      if (a.operands.length !== bOps.length) return false
      // Order-independent comparison
      const aSet = new Set(a.operands.map(exprToString))
      const bSet = new Set(bOps.map(exprToString))
      if (aSet.size !== bSet.size) return false
      for (const s of aSet) {
        if (!bSet.has(s)) return false
      }
      return true
    }
  }
}

/**
 * Removes duplicate terms from an array of expressions.
 */
function removeDuplicateTerms(operands: readonly BooleanExpression[]): BooleanExpression[] {
  const seen = new Set<string>()
  const result: BooleanExpression[] = []

  for (const op of operands) {
    const key = exprToString(op)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(op)
    }
  }

  return result
}

/**
 * Applies absorption law: A OR (A AND B) = A.
 */
function applyAbsorption(operands: readonly BooleanExpression[]): BooleanExpression[] {
  const result = [...operands]

  // Sort by complexity (simpler terms first)
  result.sort((a, b) => getComplexity(a) - getComplexity(b))

  // Check each term against simpler terms
  for (let i = result.length - 1; i >= 0; i--) {
    for (let j = 0; j < i; j++) {
      if (isAbsorbedBy(result[i], result[j])) {
        result.splice(i, 1)
        break
      }
    }
  }

  return result
}

/**
 * Checks if expression A is absorbed by B (B OR A = B when A implies B).
 */
function isAbsorbedBy(a: BooleanExpression, b: BooleanExpression): boolean {
  // A AND B is absorbed by A
  if (a.type === 'and' && expressionsEqual(a.operands.find((op) => expressionsEqual(op, b)) ?? { type: 'literal', value: false }, b)) {
    return true
  }

  // Check if all terms of b are in a (for AND expressions)
  if (b.type === 'and' && a.type === 'and') {
    const aTerms = new Set(a.operands.map(exprToString))
    return b.operands.every((op) => aTerms.has(exprToString(op)))
  }

  if (a.type === 'and') {
    return a.operands.some((op) => expressionsEqual(op, b))
  }

  return false
}

/**
 * Applies consensus theorem: (A AND B) OR (!A AND B) = B.
 */
function applyConsensus(operands: readonly BooleanExpression[]): BooleanExpression[] {
  const result = [...operands]

  // Find pairs that differ by exactly one complementary variable
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const consensus = findConsensus(result[i], result[j])
      if (consensus) {
        // Replace both terms with the consensus
        result.splice(j, 1)
        result[i] = consensus
        // Restart the search
        return applyConsensus(result)
      }
    }
  }

  return removeDuplicateTerms(result)
}

/**
 * Finds the consensus of two AND expressions.
 * Returns null if no consensus exists.
 */
function findConsensus(
  a: BooleanExpression,
  b: BooleanExpression,
): BooleanExpression | null {
  // Only works on AND expressions
  if (a.type !== 'and' || b.type !== 'and') return null

  const aTerms = a.operands
  const bTerms = b.operands

  // Find the differing term
  let differingIndex = -1
  let complementaryTerm: BooleanExpression | null = null

  for (let i = 0; i < aTerms.length; i++) {
    const aTerm = aTerms[i]
    let found = false

    for (const bTerm of bTerms) {
      if (expressionsEqual(aTerm, bTerm)) {
        found = true
        break
      }
      if (areComplementary(aTerm, bTerm)) {
        if (complementaryTerm) return null // More than one difference
        differingIndex = i
        complementaryTerm = aTerm
        found = true
        break
      }
    }

    if (!found) return null
  }

  if (differingIndex === -1 || aTerms.length !== bTerms.length) return null

  // The consensus is all terms except the complementary one
  const consensusTerms = aTerms.filter((_, i) => i !== differingIndex)

  if (consensusTerms.length === 0) return { type: 'literal', value: true }
  if (consensusTerms.length === 1) return consensusTerms[0]
  return { type: 'and', operands: consensusTerms }
}

/**
 * Gets the complexity of an expression (for sorting).
 */
function getComplexity(expr: BooleanExpression): number {
  switch (expr.type) {
    case 'literal':
      return 0
    case 'var':
      return 1
    case 'not':
      return 1 + getComplexity(expr.operand)
    case 'and':
    case 'or':
      return expr.operands.reduce((sum, op) => sum + getComplexity(op), 1)
  }
}

/**
 * Converts a boolean expression to a string representation.
 */
export function exprToString(expr: BooleanExpression): string {
  switch (expr.type) {
    case 'literal':
      return expr.value ? 'true' : 'false'
    case 'var':
      return `${expr.variant}==${expr.value}`
    case 'not':
      return `!(${exprToString(expr.operand)})`
    case 'and':
      return `(${expr.operands.map(exprToString).join(' && ')})`
    case 'or':
      return `(${expr.operands.map(exprToString).join(' || ')})`
  }
}

/**
 * Converts a boolean expression to JavaScript code.
 */
export function exprToJS(expr: BooleanExpression, propsName = 'props'): string {
  switch (expr.type) {
    case 'literal':
      return expr.value ? 'true' : 'false'
    case 'var':
      return `${propsName}.${expr.variant} === '${expr.value}'`
    case 'not':
      return `!(${exprToJS(expr.operand, propsName)})`
    case 'and':
      if (expr.operands.length === 1) return exprToJS(expr.operands[0], propsName)
      return expr.operands.map((op) => exprToJS(op, propsName)).join(' && ')
    case 'or':
      if (expr.operands.length === 1) return exprToJS(expr.operands[0], propsName)
      return `(${expr.operands.map((op) => exprToJS(op, propsName)).join(' || ')})`
  }
}
