import { Construct, Node, IConstruct } from "constructs";

// the id of the Metadata construct added to scopes in which metadata is defined.
const id = `$cdk8s.Metadata`;

type Labels = Record<string, string | undefined>;

/**
 * Scope-wide k8s metadata.
 *
 * @example For example, if you wish all API objects within a construct subtree
 * to have a set of labels:
 *
 * ```ts
 * Metadata.of(scope).addLabels({
 *   app: 'my-app',
 *   foo: 'bar'
 * });
 * ```
 *
 * Metadata is applied top-down. This means that API-object-level metadata will
 * override any metadata specified by it's parent, etc.
 */
export class Metadata extends Construct {
  /**
   * Returns a `Metadata` object associated with a specific scope.
   * @param scope The construct scope
   */
  public static of(scope: IConstruct): Metadata {
    return this.tryGetMetadata(scope) ?? new Metadata(scope as Construct, id);
  }

  /**
   * Resolves the namespace that should be used for a specific scope.
   * @param scope The scope to resolve for
   */
  public static resolveNamespace(scope?: IConstruct): string | undefined {
    if (!scope) { return undefined; }

    const resolved = this.lookupMetadata(scope)?.namespace ?? this.resolveNamespace(Node.of(scope).scope);

    // if we resolve to an empty string, then it means the namespace was deleted
    // so return "undefined".
    return resolved !== '' ? resolved : undefined;
  }

  /**
   * Resolves the labels which should be applied to a scope by merging all
   * labels from parent scopes.
   *
   * @param scope The scope to resolve for
   */
  public static resolveLabels(scope?: IConstruct): Record<string, string> {
    if (!scope) { return { }; }

    return filterUndefined({
      ...this.resolveLabels(Node.of(scope).scope),
      ...this.lookupMetadata(scope)?.labels
    });
  }

  private static tryGetMetadata(scope: IConstruct): Metadata | undefined {
    return Node.of(scope).tryFindChild(id) as Metadata | undefined;
  }

  /**
   * Returns the first `Metadata` object associated with this scope or a parent scope.
   *
   * @param scope The scope to resolve for
   * @returns the first `Metadata` object defined or undefined if scope is undefined.
   */
  private static lookupMetadata(scope?: IConstruct): Metadata | undefined {
    if (!scope) { return undefined; }
    return this.tryGetMetadata(scope) ?? this.lookupMetadata(Node.of(scope).scope);
  }

  private labels?: Labels;
  private namespace?: string;

  private constructor(scope: Construct, id: string) {
    super(scope, id);
  }

  /**
   * Adds a labels to all the API objects within a scope.
   *
   * These labels will be added to all API objects within this scope unless the
   * same label is set within a narrower scope or at the API object itself.
   *
   * If the value is set to `undefined` the label is removed from the scope &
   * all API objects (equivalent to `removeLabel`).
   *
   * @param labels The labels to apply
   */
  public addLabels(labels: { [name: string]: string | undefined }) {
    // merge with existing
    this.labels = sortByKey({
      ...this.labels,
      ...labels
    });
  }

  /**
   * Removes a label from all API objects within the scope.
   *
   * @param label The label to remove
   */
  public removeLabel(label: string) {
    this.addLabels({ [label]: undefined });
  }

  /**
   * Sets the namespace for this scope.
   *
   * All API objects within this scope will use this scope will use this
   * namespace unless a namespace is defined within a narrower scope (or at the
   * API object itself).
   */
  public addNamespace(value: string | undefined) {
    // treat undefined as an empty string, which represents a "deleted" namespace
    if (value === undefined) {
      value = '';
    }

    this.namespace  = value;
  }

  /**
   * Clears the namespace definition from the scope and all API objects within
   * this scope.
   */
  public removeNamespace() {
    this.addNamespace(undefined);
  }
}

function sortByKey(obj: Labels): Labels {
  const result: Labels = {};
  for (const key of Object.keys(obj).sort()) {
    result[key] = obj[key];
  }
  return result;
}

function filterUndefined(obj: Labels): Record<string, string> {
  const result: Record<string, string> = { };
  for (const [ n, v ] of Object.entries(obj)) {
    if (v === undefined) { continue; }
    result[n] = v;
  }

  return result;
}