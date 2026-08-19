import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const localeDir = path.join(root, "src", "i18n", "locales");
const sourceRoot = path.join(root, "src");

function propertyName(property) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text;
  return null;
}

function flattenObject(node, prefix = "") {
  const keys = new Set();
  if (!ts.isObjectLiteralExpression(node)) return keys;
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property);
    if (!name) continue;
    const key = prefix ? `${prefix}.${name}` : name;
    keys.add(key);
    if (ts.isObjectLiteralExpression(property.initializer)) {
      for (const nested of flattenObject(property.initializer, key)) keys.add(nested);
    }
  }
  return keys;
}

function readLocale(file) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let keys = new Set();
  ast.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    const declaration = node.declarationList.declarations[0];
    if (!declaration || !ts.isIdentifier(declaration.name) || !ts.isObjectLiteralExpression(declaration.initializer)) return;
    keys = flattenObject(declaration.initializer);
  });
  return keys;
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !full.includes(`${path.sep}i18n${path.sep}locales${path.sep}`)) files.push(full);
  }
  return files;
}

const localeFiles = ["en.ts", "hi.ts", "mr.ts"].map((name) => path.join(localeDir, name));
const localeKeys = new Map(localeFiles.map((file) => [path.basename(file, ".ts"), readLocale(file)]));
const sourceKeys = new Set();
for (const file of walk(sourceRoot)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/(?:\bt|i18n\.t)\(\s*["']([^"']+)["']/g)) {
    if (!match[1].endsWith(".")) sourceKeys.add(match[1]);
  }
}

const errors = [];
const english = localeKeys.get("en");
for (const [language, keys] of localeKeys) {
  for (const key of english) if (!keys.has(key)) errors.push(`${language} is missing ${key}`);
  for (const key of keys) if (!english.has(key)) errors.push(`en is missing ${language}:${key}`);
}
for (const key of sourceKeys) if (!english.has(key)) errors.push(`source uses missing key ${key}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`i18n integrity passed: ${sourceKeys.size} source keys, ${english.size} locale keys, ${localeKeys.size} locales.`);
