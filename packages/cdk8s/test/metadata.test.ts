import { Metadata } from "../lib";
import { Construct, Node } from "constructs";


test('no metadata is associated when initialized', () => {
  // GIVEN
  const construct = new Root();

  // THEN
  expect(Metadata.resolveLabels(construct)).toStrictEqual({});
  expect(Metadata.resolveNamespace(construct)).toStrictEqual(undefined);
});

describe('Metadata.of(scope)', () => {

  test('adds a metadata construct to the scope', () => {
    // GIVEN
    const c = new Root();
    expect(Node.of(c).children.length).toEqual(0); // start with no children

    // WHEN
    Metadata.of(c);

    // THEN
    expect(Node.of(c).children.length).toEqual(1);
    expect(Node.of(Node.of(c).children[0]).path).toEqual('$cdk8s.Metadata');
  });

  test('returns the same metadata object for the same scope', () => {
    // GIVEN
    const c1 = new Root();
    const c2 = new Root();

    // WHEN
    const md1 = Metadata.of(c1);
    const md2 = Metadata.of(c1);
    const md3 = Metadata.of(c2);

    // THEN
    expect(md1).toEqual(md2);
    expect(md1 == md3).toBeFalsy();
  });
});


describe('namespaces', () => {

  test('undefined by default', () => {
    // GIVEN
    const root = new Root();

    // THEN
    expect(Metadata.resolveNamespace(root)).toStrictEqual(undefined);
  });

  test('set/get for a single construct', () => {
    // GIVEN
    const construct = new Root();
    const metadata = Metadata.of(construct);

    // WHEN
    metadata.addNamespace('my-namespace');

    // THEN
    expect(Metadata.resolveNamespace(construct)).toStrictEqual('my-namespace');
  });

  test('Metadata is not added when only reading', () => {
    // GIVEN
    const parent = new Root();
    const child = new Construct(parent, 'child');

    // THEN
    expect(Metadata.resolveNamespace(child)).toStrictEqual(undefined);
    expect(Node.of(child).children.length).toEqual(0);

    expect(Metadata.resolveNamespace(parent)).toStrictEqual(undefined);
    expect(Node.of(parent).children.length).toEqual(1); // "child"
  });

  test('delegates to parent scope', () => {
    // GIVEN
    const parent = new Root();
    const child = new Construct(parent, 'child');

    // WHEN
    Metadata.of(parent).addNamespace('parent_namespace');

    // THEN
    expect(Metadata.resolveNamespace(parent)).toStrictEqual('parent_namespace');
    expect(Metadata.resolveNamespace(child)).toStrictEqual('parent_namespace');
  });

  test('last parent prevails', () => {
    // GIVEN
    const { root, all, childgroup, group, child1, child2, child3, child4 } = createTree();
    const exp = (c: Construct, expected: string) => expect(Metadata.resolveNamespace(c)).toStrictEqual(expected);

    // set ns only at the root, expect everyone to have that namespace
    // WHEN
    Metadata.of(root).addNamespace('root-ns');
    // THEN
    all.forEach(c => exp(c, 'root-ns'));

    // set ns at the childgroup level, expect all children to have it
    // WHEN
    Metadata.of(childgroup).addNamespace('childgroup-ns');
    // THEN
    [ root, group, child1, child2 ].forEach(c => exp(c, 'root-ns'));
    [ childgroup, child3, child4  ].forEach(c => exp(c, 'childgroup-ns'));

    // set ns for child2 directly
    // WHEN
    Metadata.of(child2).addNamespace('child2-ns');
    // THEN
    exp(child2, 'child2-ns');
    [ root, group, child1 ].forEach(c => exp(c, 'root-ns'));
    [ childgroup, child3, child4  ].forEach(c => exp(c, 'childgroup-ns'));
  });

  test('an empty string or null is equivalent to undefined', () => {
    // GIVEN
    const root = new Root();
    const md = Metadata.of(root);
    md.addNamespace('foo');
    expect(Metadata.resolveNamespace(root)).toStrictEqual('foo');

    // WHEN
    md.addNamespace('');

    // THEN
    expect(Metadata.resolveNamespace(root)).toStrictEqual(undefined);

    // WHEN
    md.addNamespace('foo');
    expect(Metadata.resolveNamespace(root)).toStrictEqual('foo');

    md.addNamespace(undefined);
    expect(Metadata.resolveNamespace(root)).toStrictEqual(undefined);
  });

  test('"undefined" removes the namespace from the scope', () => {
    // GIVEN
    const root = new Root();
    const parent = new Construct(root, 'parent');
    const child = new Construct(parent, 'child');
    Metadata.of(root).addNamespace('root');
    expect(Metadata.resolveNamespace(root)).toStrictEqual('root');
    expect(Metadata.resolveNamespace(parent)).toStrictEqual('root');
    expect(Metadata.resolveNamespace(child)).toStrictEqual('root');

    // WHEN
    Metadata.of(parent).addNamespace(undefined);

    // THEN
    expect(Metadata.resolveNamespace(root)).toStrictEqual('root');
    expect(Metadata.resolveNamespace(parent)).toStrictEqual(undefined);
    expect(Metadata.resolveNamespace(child)).toStrictEqual(undefined);
  });

  test('removeNamespace() removes the namespace from the scope', () => {
    // GIVEN
    const root = new Root();
    const parent = new Construct(root, 'parent');
    const child = new Construct(parent, 'child');
    Metadata.of(root).addNamespace('root');
    expect(Metadata.resolveNamespace(root)).toStrictEqual('root');
    expect(Metadata.resolveNamespace(parent)).toStrictEqual('root');
    expect(Metadata.resolveNamespace(child)).toStrictEqual('root');

    // WHEN
    Metadata.of(parent).removeNamespace();

    // THEN
    expect(Metadata.resolveNamespace(root)).toStrictEqual('root');
    expect(Metadata.resolveNamespace(parent)).toStrictEqual(undefined);
    expect(Metadata.resolveNamespace(child)).toStrictEqual(undefined);
  });

});


describe('labels', () => {

  test('defaults to no labels (empty hash)', () => {
    // GIVEN
    const { all } = createTree();

    // THEN
    all.forEach(v => expect(Metadata.resolveLabels(v)).toStrictEqual({}));
  });

  test('simple case', () => {
    // GIVEN
    const construct = new Construct(undefined as any, 'root');
    const metadata = Metadata.of(construct);

    // WHEN
    metadata.addLabels({
      label1: 'value1',
      label2: 'value2'
    });

    // THEN
    expect(Metadata.resolveLabels(construct)).toStrictEqual({
      label1: 'value1',
      label2: 'value2'
    });
  });

  test('merged together when added', () => {
    // GIVEN
    const construct = new Construct(undefined as any, 'root');
    const metadata = Metadata.of(construct);
    metadata.addLabels({
      label1: 'value1',
      label2: 'value2'
    });

    // WHEN
    metadata.addLabels({
      label3: 'value3',
    });

    // THEN
    expect(Metadata.resolveLabels(construct)).toStrictEqual({
      label1: 'value1',
      label2: 'value2',
      label3: 'value3',
    });
  });

  test('are sorted', () => {
    // GIVEN
    const construct = new Construct(undefined as any, 'root');
    const metadata = Metadata.of(construct);
    metadata.addLabels({
      aaaa: 'value1',
      zzzz: 'value2'
    });

    // WHEN
    metadata.addLabels({
      bbbb: 'value3',
    });

    // THEN
    expect(Metadata.resolveLabels(construct)).toStrictEqual({
      aaaa: 'value1',
      bbbb: 'value3',
      zzzz: 'value2',
    });

  });

  test('are merged from top to bottom', () => {
    // GIVEN
    const tree = createTree();

    // WHEN
    Metadata.of(tree.root).addLabels({
      root: 'i-am-root'
    });

    // THEN: "root" labels are applied to all nodes
    tree.all.forEach(c => expect(Metadata.resolveLabels(c)).toStrictEqual({
      root: 'i-am-root'
    }));

    // WHEN
    Metadata.of(tree.childgroup).addLabels({
      root: 'childgroup',
      childgroup: 'yes'
    });

    Metadata.of(tree.child3).addLabels({
      foo: 'bar'
    });

    // THEN: "childgroup" overrides root labels
    expect(Metadata.resolveLabels(tree.root)).toStrictEqual({ root: 'i-am-root' });
    expect(Metadata.resolveLabels(tree.group)).toStrictEqual({ root: 'i-am-root' });
    expect(Metadata.resolveLabels(tree.child1)).toStrictEqual({ root: 'i-am-root' });
    expect(Metadata.resolveLabels(tree.child2)).toStrictEqual({ root: 'i-am-root' });
    expect(Metadata.resolveLabels(tree.childgroup)).toStrictEqual({ root: 'childgroup', childgroup: 'yes' });
    expect(Metadata.resolveLabels(tree.child3)).toStrictEqual({ root: 'childgroup', childgroup: 'yes', foo: 'bar' });
    expect(Metadata.resolveLabels(tree.child4)).toStrictEqual({ root: 'childgroup', childgroup: 'yes' });
  });

  test('labels can be removed by specifying "undefined" as a value', () => {
    // GIVEN
    const root = new Root();
    const parent = new Construct(root, 'parent');
    const child = new Construct(parent, 'child');
    Metadata.of(root).addLabels({ 'my_label': 'root' });
    expect(Metadata.resolveLabels(root)).toStrictEqual({ 'my_label': 'root' });
    expect(Metadata.resolveLabels(parent)).toStrictEqual({ 'my_label': 'root' });
    expect(Metadata.resolveLabels(child)).toStrictEqual({ 'my_label': 'root' });

    // WHEN
    Metadata.of(parent).addLabels({ 'my_label': undefined });

    // THEN
    expect(Metadata.resolveLabels(root)).toStrictEqual({ 'my_label': 'root' });
    expect(Metadata.resolveLabels(parent)).toStrictEqual({ });
    expect(Metadata.resolveLabels(child)).toStrictEqual({ });
  });

  test('labels can be removed using removeLabel()', () => {
    // GIVEN
    const root = new Root();
    const parent = new Construct(root, 'parent');
    const child = new Construct(parent, 'child');
    Metadata.of(root).addLabels({ foo: '123' });
    Metadata.of(parent).addLabels({ foo: '123', bar: '8989' });
    expect(Metadata.resolveLabels(root)).toStrictEqual({ foo: '123' });
    expect(Metadata.resolveLabels(parent)).toStrictEqual({ foo: '123', bar: '8989' });
    expect(Metadata.resolveLabels(child)).toStrictEqual({ foo: '123', bar: '8989' });

    // WHEN
    Metadata.of(parent).removeLabel('foo');
    expect(Metadata.resolveLabels(root)).toStrictEqual({ foo: '123' });
    expect(Metadata.resolveLabels(parent)).toStrictEqual({ bar: '8989' });
    expect(Metadata.resolveLabels(child)).toStrictEqual({ bar: '8989' });
  });
});

/**
 * root
 * +--- group
 *     +--- child1
 *     +--- child2
 *     +--- childgroup
 *         +--- child3
 *         +--- child4
 *
 */
function createTree() {
  const root = new Root();
  const group = new Construct(root, 'group');
  const child1 = new Construct(group, 'child1');
  const child2 = new Construct(group, 'child2');
  const childgroup = new Construct(group, 'childgroup');
  const child3 = new Construct(childgroup, 'child3');
  const child4 = new Construct(childgroup, 'child4');

  const all = [ root, group, child1, child2, childgroup, child3, child4 ];

  return {
    root, group, child1, child2, childgroup, child3, child4, all
  };
}

class Root extends Construct {
  constructor() {
    super(undefined as any, 'root');
  }
}