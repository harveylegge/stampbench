/**
 * Source-position index over raw XML.
 *
 * `fast-xml-parser` gives us a semantic tree but discards where anything came
 * from, so a validation failure cannot say "line 42". This module makes one
 * extra pass over the original text and records, for every element, the line
 * and column of its opening tag, its text value, and its closing tag.
 *
 * It is a position scanner, not a parser: it never builds values, resolves
 * entities or checks well-formedness. Callers run it *after*
 * `XMLValidator.validate()` has accepted the document, so it may assume the
 * markup is well formed — but it must never report a *wrong* position for any
 * legal XML, which is why comments, CDATA, processing instructions, the
 * DOCTYPE internal subset and quoted attribute values are all skipped
 * explicitly rather than pattern-matched.
 *
 * Namespace prefixes are stripped from `name` (but kept in `qualifiedName`) so
 * lookups match the prefix-stripped semantic model produced by the parsers.
 *
 * Why not use fast-xml-parser, which we already depend on? Its
 * `captureMetaData: true` option does expose a `startIndex` per node, but it
 * cannot serve this use case:
 *
 *   1. A leaf element with no attributes collapses to a plain string, and a
 *      Symbol cannot be attached to a primitive — so exactly the elements most
 *      violations point at (BT-1 ID, BT-2 IssueDate, BT-5 DocumentCurrencyCode)
 *      carry no position at all. Restoring it needs `alwaysCreateTextNode`,
 *      which changes the shape of every value both parsers read.
 *   2. `startIndex` is an offset into a *line-ending-normalised* copy of the
 *      input, so it is wrong against the caller's original string whenever the
 *      file uses CRLF.
 *   3. It gives no attribute positions and no closing-tag positions.
 *
 * Verified against fast-xml-parser 5.10.1. Re-check before replacing this.
 */

/** Where an attribute sits in the source. */
export interface XmlAttributeLocation {
  /** Attribute name exactly as written, e.g. `xsi:type`. */
  qualifiedName: string;
  /** The raw text between the quotes; entity references are not expanded. */
  value: string;
  /** 1-based line of the attribute name. */
  line: number;
  /** 1-based column of the attribute name. */
  column: number;
  /** 1-based line of the first character inside the quotes. */
  valueLine: number;
  /** 1-based column of the first character inside the quotes. */
  valueColumn: number;
}

/** One element occurrence, with its position in the source text. */
export interface XmlNode {
  /** Element name with any namespace prefix removed, e.g. `InvoicedQuantity`. */
  name: string;
  /** Element name exactly as written, e.g. `cbc:InvoicedQuantity`. */
  qualifiedName: string;
  /** 1-based line of the `<` that opens the element. */
  line: number;
  /** 1-based column of the `<` that opens the element. */
  column: number;
  /** 1-based line of the first non-whitespace character of the text content. */
  valueLine?: number;
  /** 1-based column of the first non-whitespace character of the text content. */
  valueColumn?: number;
  /**
   * The element's first run of text, trimmed. Character and entity references
   * are *not* expanded, so compare only against simple values such as code
   * lists — which is all the bindings need it for.
   */
  value?: string;
  /** 1-based line of the closing tag, or of the opening tag when self-closing. */
  endLine: number;
  /** Attribute positions, keyed by prefix-stripped attribute name. */
  attributes: Map<string, XmlAttributeLocation>;
  children: XmlNode[];
}

export interface XmlDocumentIndex {
  /** The document element, absent only for a document with no elements. */
  root?: XmlNode;
  /** Total number of lines in the source, for clamping reported positions. */
  lineCount: number;
}

interface Cursor {
  i: number;
  line: number;
  col: number;
}

/**
 * Move the cursor to `to`, counting line breaks on the way.
 * CRLF, LF and a lone CR each count as exactly one break.
 */
function advance(xml: string, cur: Cursor, to: number): void {
  let i = cur.i;
  while (i < to) {
    const ch = xml.charCodeAt(i);
    if (ch === 10 /* \n */) {
      cur.line++;
      cur.col = 1;
      i++;
    } else if (ch === 13 /* \r */) {
      cur.line++;
      cur.col = 1;
      i++;
      // Consume the LF of a CRLF pair, but never step past `to` — overshooting
      // would desynchronise the caller's own position arithmetic.
      if (i < to && xml.charCodeAt(i) === 10) i++;
    } else {
      cur.col++;
      i++;
    }
  }
  cur.i = i;
}

function isSpace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13;
}

/** XML name characters end at whitespace or at one of `/ > = <`. */
function isNameEnd(code: number): boolean {
  return isSpace(code) || code === 47 || code === 62 || code === 61 || code === 60;
}

function localName(qualified: string): string {
  const colon = qualified.lastIndexOf(':');
  return colon === -1 ? qualified : qualified.slice(colon + 1);
}

/**
 * Find the `>` that closes a `<!DOCTYPE …>` declaration, skipping over an
 * internal subset — `<!DOCTYPE x [ <!ENTITY a "> "> ]>` contains a `>` that
 * does not end the declaration.
 */
function findDoctypeEnd(xml: string, from: number): number {
  let depth = 0;
  for (let i = from; i < xml.length; i++) {
    const ch = xml.charCodeAt(i);
    if (ch === 91 /* [ */) depth++;
    else if (ch === 93 /* ] */) depth--;
    else if (ch === 62 /* > */ && depth <= 0) return i;
  }
  return xml.length - 1;
}

/**
 * Build a positional index of every element in `xml`.
 *
 * Runs in a single linear pass; cost is proportional to document length.
 */
export function indexXml(xml: string): XmlDocumentIndex {
  const cur: Cursor = { i: 0, line: 1, col: 1 };
  // A leading BOM is not part of the document text and occupies no column.
  if (xml.charCodeAt(0) === 0xfeff) cur.i = 1;

  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;

  while (cur.i < xml.length) {
    const lt = xml.indexOf('<', cur.i);
    if (lt === -1) break;

    // Text between the previous tag and this one belongs to the open element.
    const open = stack[stack.length - 1];
    if (open !== undefined && open.valueLine === undefined && lt > cur.i) {
      let k = cur.i;
      while (k < lt && isSpace(xml.charCodeAt(k))) k++;
      if (k < lt) {
        advance(xml, cur, k);
        open.valueLine = cur.line;
        open.valueColumn = cur.col;
        let end = lt;
        while (end > k && isSpace(xml.charCodeAt(end - 1))) end--;
        open.value = xml.slice(k, end);
      }
    }
    advance(xml, cur, lt);

    const next = xml.charCodeAt(lt + 1);

    // <?…?> processing instruction or XML declaration
    if (next === 63 /* ? */) {
      const end = xml.indexOf('?>', lt + 2);
      advance(xml, cur, end === -1 ? xml.length : end + 2);
      continue;
    }

    // <!-- --> comment, <![CDATA[ ]]> section, or <!DOCTYPE …>
    if (next === 33 /* ! */) {
      if (xml.startsWith('<!--', lt)) {
        const end = xml.indexOf('-->', lt + 4);
        advance(xml, cur, end === -1 ? xml.length : end + 3);
        continue;
      }
      if (xml.startsWith('<![CDATA[', lt)) {
        const end = xml.indexOf(']]>', lt + 9);
        // CDATA is text content; anchor the element's value at the section start.
        if (open !== undefined && open.valueLine === undefined) {
          open.valueLine = cur.line;
          open.valueColumn = cur.col;
          open.value = xml.slice(lt + 9, end === -1 ? xml.length : end);
        }
        advance(xml, cur, end === -1 ? xml.length : end + 3);
        continue;
      }
      advance(xml, cur, findDoctypeEnd(xml, lt + 2) + 1);
      continue;
    }

    // </name> closing tag
    if (next === 47 /* / */) {
      const end = xml.indexOf('>', lt + 2);
      const closed = stack.pop();
      if (closed !== undefined) closed.endLine = cur.line;
      advance(xml, cur, end === -1 ? xml.length : end + 1);
      continue;
    }

    // <name …> or <name …/> opening tag
    const tagLine = cur.line;
    const tagColumn = cur.col;
    let i = lt + 1;
    while (i < xml.length && !isNameEnd(xml.charCodeAt(i))) i++;
    const qualifiedName = xml.slice(lt + 1, i);
    if (qualifiedName === '') {
      // A bare `<` that is not markup; nothing sensible to index.
      advance(xml, cur, lt + 1);
      continue;
    }

    const node: XmlNode = {
      name: localName(qualifiedName),
      qualifiedName,
      line: tagLine,
      column: tagColumn,
      endLine: tagLine,
      attributes: new Map(),
      children: [],
    };

    // Attributes, up to `>` or `/>`.
    let selfClosing = false;
    while (i < xml.length) {
      while (i < xml.length && isSpace(xml.charCodeAt(i))) i++;
      const ch = xml.charCodeAt(i);
      if (ch === 62 /* > */) {
        i++;
        break;
      }
      if (ch === 47 /* / */) {
        selfClosing = true;
        i = xml.indexOf('>', i);
        i = i === -1 ? xml.length : i + 1;
        break;
      }
      const nameStart = i;
      while (i < xml.length && !isNameEnd(xml.charCodeAt(i))) i++;
      const attrName = xml.slice(nameStart, i);
      if (attrName === '') {
        i++;
        continue;
      }
      while (i < xml.length && isSpace(xml.charCodeAt(i))) i++;
      if (xml.charCodeAt(i) !== 61 /* = */) {
        // Valueless attribute: not legal XML, but do not lose our place.
        continue;
      }
      i++;
      while (i < xml.length && isSpace(xml.charCodeAt(i))) i++;
      const quote = xml.charCodeAt(i);
      if (quote !== 34 && quote !== 39) continue;
      const valueStart = i + 1;
      const valueEnd = xml.indexOf(String.fromCharCode(quote), valueStart);
      const closeAt = valueEnd === -1 ? xml.length : valueEnd;

      // Namespace declarations are never annotation targets, and stripping
      // their prefix would file `xmlns:cbc` under the key `cbc`, shadowing any
      // real attribute of that name.
      if (attrName !== 'xmlns' && !attrName.startsWith('xmlns:')) {
        // Positions are taken by walking the cursor, so multi-line tags stay correct.
        advance(xml, cur, nameStart);
        const attrLine = cur.line;
        const attrColumn = cur.col;
        advance(xml, cur, valueStart);
        node.attributes.set(localName(attrName), {
          qualifiedName: attrName,
          value: xml.slice(valueStart, closeAt),
          line: attrLine,
          column: attrColumn,
          valueLine: cur.line,
          valueColumn: cur.col,
        });
      }
      i = closeAt + 1;
    }

    const parent = stack[stack.length - 1];
    if (parent !== undefined) parent.children.push(node);
    else if (root === undefined) root = node;

    if (!selfClosing) stack.push(node);
    advance(xml, cur, i);
  }

  // Count lines by finishing the walk to the end of the document.
  advance(xml, cur, xml.length);
  return root === undefined ? { lineCount: cur.line } : { root, lineCount: cur.line };
}

// ————————————————————————————————————————————————————————————————
// Path resolution
// ————————————————————————————————————————————————————————————————

/** How closely a requested path could be located in the document. */
export type PathMatch =
  /** The exact element (or attribute) was found. */
  | 'exact'
  /** Only an ancestor of the requested path exists in this document. */
  | 'ancestor';

export interface ResolvedLocation {
  line: number;
  column: number;
  endLine: number;
  /** Position of the element's text value, when it has one. */
  valueLine?: number;
  valueColumn?: number;
  /** The text at the resolved location, for showing the offending snippet. */
  value?: string;
  match: PathMatch;
  /** The path that actually resolved — a prefix of the request when `match` is `ancestor`. */
  resolvedPath: string;
}

interface PathStep {
  name: string;
  /** 1-based position among same-named siblings. */
  index: number;
}

/**
 * Parse `/Invoice/InvoiceLine[3]/InvoicedQuantity/@unitCode` into steps plus an
 * optional trailing attribute. Missing indices default to 1, as in XPath.
 */
function parsePath(path: string): { steps: PathStep[]; attribute?: string } {
  const raw = path.split('/').filter((s) => s.length > 0);
  const steps: PathStep[] = [];
  let attribute: string | undefined;
  for (const part of raw) {
    if (part.startsWith('@')) {
      attribute = part.slice(1);
      continue;
    }
    const bracket = part.indexOf('[');
    if (bracket === -1) {
      steps.push({ name: part, index: 1 });
      continue;
    }
    const name = part.slice(0, bracket);
    const parsed = Number.parseInt(part.slice(bracket + 1, part.indexOf(']', bracket)), 10);
    steps.push({ name, index: Number.isFinite(parsed) && parsed > 0 ? parsed : 1 });
  }
  return attribute === undefined ? { steps } : { steps, attribute };
}

function nthChild(node: XmlNode, name: string, index: number): XmlNode | undefined {
  let seen = 0;
  for (const child of node.children) {
    if (child.name !== name) continue;
    seen++;
    if (seen === index) return child;
  }
  return undefined;
}

/** Direct children with the given prefix-stripped name, in document order. */
export function childrenNamed(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

/** The first direct child with the given name, if any. */
export function childNamed(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((c) => c.name === name);
}

/** Text-value position of a descendant reached by a chain of child names. */
export function descend(node: XmlNode, ...names: readonly string[]): XmlNode | undefined {
  let current: XmlNode | undefined = node;
  for (const name of names) {
    if (current === undefined) return undefined;
    current = childNamed(current, name);
  }
  return current;
}

function stepLabel(step: PathStep): string {
  return step.index === 1 ? step.name : `${step.name}[${step.index}]`;
}

/** Build a location from an element node. Exported for custom bindings. */
export function locationOfNode(node: XmlNode, match: PathMatch, resolvedPath: string): ResolvedLocation {
  const base: ResolvedLocation = {
    line: node.line,
    column: node.column,
    endLine: node.endLine,
    match,
    resolvedPath,
  };
  if (node.valueLine !== undefined) {
    base.valueLine = node.valueLine;
    base.valueColumn = node.valueColumn;
  }
  if (node.value !== undefined) base.value = node.value;
  return base;
}

/**
 * Build a location from an attribute of `node`, falling back to the element
 * itself when the attribute is absent.
 */
export function locationOfAttribute(
  node: XmlNode,
  attribute: string,
  resolvedPath: string,
): ResolvedLocation {
  const at = node.attributes.get(attribute);
  if (at === undefined) return locationOfNode(node, 'ancestor', resolvedPath);
  return {
    line: at.line,
    column: at.column,
    endLine: at.line,
    valueLine: at.valueLine,
    valueColumn: at.valueColumn,
    value: at.value,
    match: 'exact',
    resolvedPath: `${resolvedPath}/@${attribute}`,
  };
}

/** An element located by path, with how closely the path matched. */
export interface SelectedNode {
  node: XmlNode;
  match: PathMatch;
  /** The path that actually resolved — a prefix of the request when `match` is `ancestor`. */
  resolvedPath: string;
  /** The attribute named by the path, when the path requested one. */
  attribute?: string;
}

/**
 * Walk `path` and return the deepest element reached, together with whether
 * the walk completed. Bindings that need a predicate the path grammar cannot
 * express (for example "the PartyTaxScheme whose TaxScheme is VAT") select a
 * container with this and then narrow it themselves.
 */
export function selectXmlNode(index: XmlDocumentIndex, path: string): SelectedNode | undefined {
  const root = index.root;
  if (root === undefined) return undefined;
  const { steps, attribute } = parsePath(path);
  if (steps.length === 0) return undefined;
  if (steps[0]!.name !== root.name) return undefined;

  let node = root;
  let resolved = `/${root.name}`;
  for (let s = 1; s < steps.length; s++) {
    const step = steps[s]!;
    const child = nthChild(node, step.name, step.index);
    if (child === undefined) return { node, match: 'ancestor', resolvedPath: resolved };
    node = child;
    resolved += `/${stepLabel(step)}`;
  }
  return attribute === undefined
    ? { node, match: 'exact', resolvedPath: resolved }
    : { node, match: 'exact', resolvedPath: resolved, attribute };
}

/**
 * Locate `path` in an indexed document.
 *
 * Resolution degrades rather than failing: when the requested element is absent
 * — which is the common case, because most validation failures are *missing*
 * fields — the deepest existing ancestor is returned with `match: 'ancestor'`,
 * so an annotation still lands somewhere meaningful instead of on line 1.
 *
 * Returns `undefined` only when even the root element does not match.
 */
export function resolveXmlPath(index: XmlDocumentIndex, path: string): ResolvedLocation | undefined {
  const selected = selectXmlNode(index, path);
  if (selected === undefined) return undefined;
  if (selected.attribute !== undefined) {
    return locationOfAttribute(selected.node, selected.attribute, selected.resolvedPath);
  }
  return locationOfNode(selected.node, selected.match, selected.resolvedPath);
}

/**
 * Resolve the first path that exists exactly; otherwise the best `ancestor`
 * match among the candidates. Used when a business term has more than one
 * possible binding (for example a VAT identifier that may sit under either of
 * two party structures).
 */
export function resolveFirstXmlPath(
  index: XmlDocumentIndex,
  paths: readonly string[],
): ResolvedLocation | undefined {
  let fallback: ResolvedLocation | undefined;
  for (const path of paths) {
    const hit = resolveXmlPath(index, path);
    if (hit === undefined) continue;
    if (hit.match === 'exact') return hit;
    // Keep the deepest ancestor match as the consolation prize.
    if (fallback === undefined || hit.resolvedPath.length > fallback.resolvedPath.length) {
      fallback = hit;
    }
  }
  return fallback;
}
