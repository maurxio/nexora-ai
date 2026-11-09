import { resolveTemplates } from './template.js';

const expression = /^\s*([A-Za-z0-9_.-]+)\s*(>=|<=|==|!=|>|<)\s*(?:"([^"]*)"|'([^']*)'|(-?(?:\d+(?:\.\d+)?))|(true|false|null))\s*$/;

export function evaluateCondition(source, context) {
  const match = expression.exec(source);
  if (!match) throw Object.assign(new Error('La expresión de condición no es válida'), { retryable: false });
  const [, path, operator, doubleString, singleString, number, boolean] = match;
  const left = resolveTemplates(`{{${path}}}`, context);
  const right = doubleString ?? singleString ?? (number === undefined ? boolean === 'true' ? true : boolean === 'false' ? false : null : Number(number));
  switch (operator) {
    case '>': return left > right;
    case '>=': return left >= right;
    case '<': return left < right;
    case '<=': return left <= right;
    case '==': return left === right;
    case '!=': return left !== right;
    default: throw Object.assign(new Error('Operador de condición no válido'), { retryable: false });
  }
}
