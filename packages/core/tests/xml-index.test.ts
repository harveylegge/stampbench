import { describe, expect, it } from 'vitest';
import { indexXml, resolveFirstXmlPath, resolveXmlPath } from '../src/locate/xml-index.js';

/**
 * Fixtures are inline on purpose: the official test corpus under
 * tools/parity/vendor is downloaded, not committed (tools/parity/.gitignore),
 * so a test that read from it would pass locally and fail in CI.
 */

describe('indexXml — positions', () => {
  it('records line and column of elements, values and closing tags', () => {
    const xml = ['<Invoice>', '  <ID>INV-1</ID>', '</Invoice>'].join('\n');
    const index = indexXml(xml);
    const root = index.root!;

    expect(root.name).toBe('Invoice');
    expect(root.line).toBe(1);
    expect(root.column).toBe(1);
    expect(root.endLine).toBe(3);

    const id = root.children[0]!;
    expect(id.name).toBe('ID');
    expect(id.line).toBe(2);
    expect(id.column).toBe(3);
    expect(id.valueLine).toBe(2);
    expect(id.valueColumn).toBe(7);
    expect(id.endLine).toBe(2);
    expect(index.lineCount).toBe(3);
  });

  it('anchors the value at the first non-whitespace character, not the tag', () => {
    const xml = ['<Invoice>', '  <ID>', '    INV-1', '  </ID>', '</Invoice>'].join('\n');
    const id = indexXml(xml).root!.children[0]!;
    expect(id.line).toBe(2);
    expect(id.valueLine).toBe(3);
    expect(id.valueColumn).toBe(5);
    expect(id.endLine).toBe(4);
  });

  it('strips namespace prefixes but keeps the qualified name', () => {
    const xml = ['<ubl:Invoice xmlns:ubl="urn:x" xmlns:cbc="urn:y">', '  <cbc:ID>1</cbc:ID>', '</ubl:Invoice>'].join('\n');
    const root = indexXml(xml).root!;
    expect(root.name).toBe('Invoice');
    expect(root.qualifiedName).toBe('ubl:Invoice');
    expect(root.children[0]!.name).toBe('ID');
    expect(root.children[0]!.qualifiedName).toBe('cbc:ID');
  });

  it('counts CRLF, LF and a lone CR as one line break each', () => {
    expect(indexXml('<a>\r\n  <b>1</b>\r\n</a>').root!.children[0]!.line).toBe(2);
    expect(indexXml('<a>\n  <b>1</b>\n</a>').root!.children[0]!.line).toBe(2);
    expect(indexXml('<a>\r  <b>1</b>\r</a>').root!.children[0]!.line).toBe(2);
  });

  it('ignores a byte-order mark when computing the first column', () => {
    const root = indexXml('﻿<Invoice><ID>1</ID></Invoice>').root!;
    expect(root.line).toBe(1);
    expect(root.column).toBe(1);
  });

  it('records attribute name and value positions across a multi-line tag', () => {
    const xml = ['<Invoice>', '  <InvoicedQuantity', '      unitCode="C62">5</InvoicedQuantity>', '</Invoice>'].join('\n');
    const qty = indexXml(xml).root!.children[0]!;
    const unit = qty.attributes.get('unitCode')!;
    expect(qty.line).toBe(2);
    expect(unit.line).toBe(3);
    expect(unit.column).toBe(7);
    expect(unit.valueLine).toBe(3);
    expect(unit.valueColumn).toBe(17);
  });

  it('strips prefixes from attribute names', () => {
    const root = indexXml('<a><b xsi:type="T">1</b></a>').root!;
    expect(root.children[0]!.attributes.has('type')).toBe(true);
  });
});

describe('indexXml — lexical constructs that defeat naive tag matching', () => {
  it('does not treat markup inside a comment as elements', () => {
    const xml = ['<Invoice>', '  <!-- <ID>decoy</ID> and a > bracket -->', '  <ID>real</ID>', '</Invoice>'].join('\n');
    const root = indexXml(xml).root!;
    expect(root.children).toHaveLength(1);
    expect(root.children[0]!.line).toBe(3);
  });

  it('does not treat markup inside CDATA as elements', () => {
    const xml = ['<Invoice>', '  <Note><![CDATA[<ID>not an element</ID>]]></Note>', '  <ID>real</ID>', '</Invoice>'].join('\n');
    const root = indexXml(xml).root!;
    expect(root.children.map((c) => c.name)).toEqual(['Note', 'ID']);
    expect(root.children[0]!.children).toHaveLength(0);
    expect(resolveXmlPath(indexXml(xml), '/Invoice/ID')!.line).toBe(3);
  });

  it('skips the XML declaration and processing instructions', () => {
    const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<?sort order="a > b"?>', '<Invoice>', '  <ID>1</ID>', '</Invoice>'].join('\n');
    const root = indexXml(xml).root!;
    expect(root.name).toBe('Invoice');
    expect(root.line).toBe(3);
  });

  it('skips a DOCTYPE whose internal subset contains a > character', () => {
    const xml = ['<!DOCTYPE Invoice [', '  <!ENTITY probe "a > b">', ']>', '<Invoice>', '  <ID>1</ID>', '</Invoice>'].join('\n');
    const root = indexXml(xml).root!;
    expect(root.name).toBe('Invoice');
    expect(root.line).toBe(4);
  });

  it('does not end a tag on a > inside a quoted attribute value', () => {
    const xml = ['<Invoice>', '  <ID note="x > y" other=\'a > b\'>V</ID>', '</Invoice>'].join('\n');
    const root = indexXml(xml).root!;
    const id = root.children[0]!;
    expect(root.children).toHaveLength(1);
    expect(id.attributes.has('note')).toBe(true);
    expect(id.attributes.has('other')).toBe(true);
    expect(id.valueLine).toBe(2);
  });

  it('treats self-closing tags as complete elements', () => {
    const xml = ['<Invoice>', '  <Empty/>', '  <ID>1</ID>', '</Invoice>'].join('\n');
    const root = indexXml(xml).root!;
    expect(root.children.map((c) => c.name)).toEqual(['Empty', 'ID']);
    expect(root.children[0]!.endLine).toBe(2);
    expect(root.children[1]!.line).toBe(3);
  });

  it('handles an empty document and a document with no elements', () => {
    expect(indexXml('').root).toBeUndefined();
    expect(indexXml('<?xml version="1.0"?>').root).toBeUndefined();
  });
});

describe('resolveXmlPath', () => {
  const xml = [
    '<Invoice>',
    '  <ID>INV-1</ID>',
    '  <InvoiceLine>',
    '    <ID>1</ID>',
    '  </InvoiceLine>',
    '  <InvoiceLine>',
    '    <ID>2</ID>',
    '    <InvoicedQuantity unitCode="C62">5</InvoicedQuantity>',
    '  </InvoiceLine>',
    '  <InvoiceLine>',
    '    <ID>3</ID>',
    '  </InvoiceLine>',
    '</Invoice>',
  ].join('\n');
  const index = indexXml(xml);

  it('resolves an exact path', () => {
    const hit = resolveXmlPath(index, '/Invoice/ID')!;
    expect(hit.line).toBe(2);
    expect(hit.match).toBe('exact');
    expect(hit.resolvedPath).toBe('/Invoice/ID');
  });

  it('counts positional indices among same-named siblings, 1-based like XPath', () => {
    expect(resolveXmlPath(index, '/Invoice/InvoiceLine[1]/ID')!.line).toBe(4);
    expect(resolveXmlPath(index, '/Invoice/InvoiceLine[2]/ID')!.line).toBe(7);
    expect(resolveXmlPath(index, '/Invoice/InvoiceLine[3]/ID')!.line).toBe(11);
  });

  it('defaults a missing index to the first sibling', () => {
    expect(resolveXmlPath(index, '/Invoice/InvoiceLine/ID')!.line).toBe(4);
  });

  it('resolves an attribute to its own position', () => {
    const hit = resolveXmlPath(index, '/Invoice/InvoiceLine[2]/InvoicedQuantity/@unitCode')!;
    expect(hit.line).toBe(8);
    expect(hit.match).toBe('exact');
    expect(hit.column).toBe(23);
    expect(hit.valueColumn).toBe(33);
  });

  it('falls back to the deepest existing ancestor when the element is absent', () => {
    const hit = resolveXmlPath(index, '/Invoice/InvoiceLine[2]/Item/Name')!;
    expect(hit.match).toBe('ancestor');
    expect(hit.resolvedPath).toBe('/Invoice/InvoiceLine[2]');
    expect(hit.line).toBe(6);
  });

  it('falls back to the element when the requested attribute is absent', () => {
    const hit = resolveXmlPath(index, '/Invoice/InvoiceLine[1]/ID/@schemeID')!;
    expect(hit.match).toBe('ancestor');
    expect(hit.line).toBe(4);
  });

  it('falls back when the positional index exceeds the sibling count', () => {
    const hit = resolveXmlPath(index, '/Invoice/InvoiceLine[9]/ID')!;
    expect(hit.match).toBe('ancestor');
    expect(hit.resolvedPath).toBe('/Invoice');
  });

  it('returns undefined when the root element does not match', () => {
    expect(resolveXmlPath(index, '/CrossIndustryInvoice/ID')).toBeUndefined();
    expect(resolveXmlPath(indexXml(''), '/Invoice')).toBeUndefined();
  });

  it('resolves the root itself', () => {
    const hit = resolveXmlPath(index, '/Invoice')!;
    expect(hit.match).toBe('exact');
    expect(hit.line).toBe(1);
  });
});

describe('resolveFirstXmlPath', () => {
  const index = indexXml(['<Invoice>', '  <B>1</B>', '</Invoice>'].join('\n'));

  it('prefers an exact match over an earlier ancestor match', () => {
    const hit = resolveFirstXmlPath(index, ['/Invoice/A/Deep', '/Invoice/B'])!;
    expect(hit.match).toBe('exact');
    expect(hit.line).toBe(2);
  });

  it('returns the deepest ancestor when nothing matches exactly', () => {
    const hit = resolveFirstXmlPath(index, ['/Invoice/A/Deep', '/Invoice/C'])!;
    expect(hit.match).toBe('ancestor');
    expect(hit.resolvedPath).toBe('/Invoice');
  });

  it('returns undefined when no candidate resolves at all', () => {
    expect(resolveFirstXmlPath(index, ['/Other/A', '/Nope'])).toBeUndefined();
  });
});
