/**
 * Utility code generators for JSON conversions (TypeScript, Go Struct, YAML, JSONPath)
 */

export function jsonToTypeScript(json: any, rootName = 'RootObject'): string {
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    const interfaces: string[] = [];

    function generateInterface(name: string, data: any): string {
      if (typeof data !== 'object' || data === null) {
        return `export type ${name} = ${typeof data};`;
      }

      if (Array.isArray(data)) {
        const itemType = data.length > 0 ? typeof data[0] : 'any';
        if (itemType === 'object' && data[0] !== null) {
          const subName = `${name}Item`;
          generateInterface(subName, data[0]);
          return `export type ${name} = ${subName}[];`;
        }
        return `export type ${name} = ${itemType}[];`;
      }

      const lines: string[] = [`export interface ${name} {`];
      for (const [key, value] of Object.entries(data)) {
        let typeStr: string = typeof value;
        if (value === null) {
          typeStr = 'any';
        } else if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
            const subName = `${name}_${capitalize(key)}Item`;
            generateInterface(subName, value[0]);
            typeStr = `${subName}[]`;
          } else {
            typeStr = value.length > 0 ? `${typeof value[0]}[]` : 'any[]';
          }
        } else if (typeof value === 'object') {
          const subName = `${name}_${capitalize(key)}`;
          generateInterface(subName, value);
          typeStr = subName;
        }
        lines.push(`  ${key}: ${typeStr};`);
      }
      lines.push('}');
      const result = lines.join('\n');
      interfaces.push(result);
      return result;
    }

    generateInterface(rootName, obj);
    return interfaces.reverse().join('\n\n');
  } catch (e: any) {
    return `// Error generating TypeScript: ${e.message}`;
  }
}

export function jsonToGoStruct(json: any, rootName = 'Root'): string {
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    const structs: string[] = [];

    function generateStruct(name: string, data: any): string {
      if (typeof data !== 'object' || data === null) {
        return `type ${name} ${goType(data)}`;
      }

      if (Array.isArray(data)) {
        if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
          const subName = `${name}Item`;
          generateStruct(subName, data[0]);
          return `type ${name} []${subName}`;
        }
        return `type ${name} []${data.length > 0 ? goType(data[0]) : 'interface{}'}`;
      }

      const lines: string[] = [`type ${name} struct {`];
      for (const [key, value] of Object.entries(data)) {
        const fieldName = capitalize(toCamelCase(key));
        let typeStr = goType(value);

        if (value === null) {
          typeStr = 'interface{}';
        } else if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
            const subName = `${name}${capitalize(toCamelCase(key))}Item`;
            generateStruct(subName, value[0]);
            typeStr = `[]${subName}`;
          } else {
            typeStr = `[]${value.length > 0 ? goType(value[0]) : 'interface{}'}`;
          }
        } else if (typeof value === 'object') {
          const subName = `${name}${capitalize(toCamelCase(key))}`;
          generateStruct(subName, value);
          typeStr = subName;
        }

        lines.push(`\t${fieldName} ${typeStr} \`json:"${key}"\``);
      }
      lines.push('}');
      const result = lines.join('\n');
      structs.push(result);
      return result;
    }

    generateStruct(rootName, obj);
    return structs.reverse().join('\n\n');
  } catch (e: any) {
    return `// Error generating Go struct: ${e.message}`;
  }
}

function goType(val: any): string {
  if (typeof val === 'string') return 'string';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int64' : 'float64';
  if (typeof val === 'boolean') return 'bool';
  return 'interface{}';
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toCamelCase(s: string): string {
  return s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

export function jsonToYaml(json: any, indent = 0): string {
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    return yamlify(obj, indent);
  } catch (e: any) {
    return `# Error generating YAML: ${e.message}`;
  }
}

function yamlify(val: any, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (val === null) return 'null';
  if (typeof val === 'string') {
    return val.includes('\n') || val.includes(':') ? JSON.stringify(val) : val;
  }
  if (typeof val !== 'object') return String(val);

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return val
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          const sub = yamlify(item, indent + 2).trimStart();
          return `${pad}- ${sub}`;
        }
        return `${pad}- ${yamlify(item, 0)}`;
      })
      .join('\n');
  }

  const keys = Object.keys(val);
  if (keys.length === 0) return '{}';
  return keys
    .map((k) => {
      const v = val[k];
      if (typeof v === 'object' && v !== null) {
        return `${pad}${k}:\n${yamlify(v, indent + 2)}`;
      }
      return `${pad}${k}: ${yamlify(v, 0)}`;
    })
    .join('\n');
}

/**
 * Simple JSONPath / Object property path evaluator (e.g. $.users[0].name or users.0.name)
 */
export function evaluateJsonPath(obj: any, path: string): any {
  if (!path || path.trim() === '' || path.trim() === '$') return obj;
  try {
    const normalized = path
      .replace(/^\$\.?/, '')
      .replace(/\[(\w+)\]/g, '.$1')
      .replace(/^\./, '');

    const parts = normalized.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  } catch (_) {
    return undefined;
  }
}
