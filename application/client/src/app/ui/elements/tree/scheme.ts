import { CollectionViewer, SelectionChange, DataSource } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Entity } from './entity';
import { EntityType, Entity as IEntity } from '@platform/types/files';
import { Services } from '@service/ilc/services';

export { Entity };

type ExpandedCallback = () => void;

export class DynamicFlatNode {
    protected expandedCallback: ExpandedCallback | undefined;

    constructor(
        public item: Entity,
        public level = 1,
        public expandable = false,
        public isLoading = false,
    ) {}

    public onExpanded(cb: ExpandedCallback) {
        this.expandedCallback = cb;
    }

    public afterExpanded() {
        if (this.expandedCallback === undefined) {
            return;
        }
        const cb = this.expandedCallback;
        this.expandedCallback = undefined;
        cb();
    }
}

export class DynamicDatabase {
    public readonly structure = new Map<string, Entity[]>();
    public roots: string[];

    protected readonly services: Services;
    protected source!: DynamicDataSource;

    constructor(roots: string[], services: Services) {
        this.services = services;
        this.roots = roots;
    }

    public destroy() {
        this.roots = [];
        this.structure.clear();
    }

    public bind(source: DynamicDataSource) {
        this.source = source;
    }

    public initialData(): DynamicFlatNode[] {
        return this.roots.map(
            (root: string) =>
                new DynamicFlatNode(
                    new Entity(
                        {
                            name: root,
                            type: EntityType.Directory,
                            details: undefined,
                        },
                        '',
                        true,
                    ),
                    0,
                    true,
                ),
        );
    }

    public overwrite(roots: string[]) {
        this.roots = roots;
        this.source.data = this.initialData();
    }

    public addRoot(root: string) {
        this.roots.push(root);
    }

    public removeRoot(root: string) {
        this.roots = this.roots.filter((r) => r !== root);
    }

    public getChildren(path: string): Promise<Entity[]> {
        const entities = this.structure.get(path);
        if (entities !== undefined) {
            return Promise.resolve(entities);
        }
        return new Promise((resolve, reject) => {
            this.services.system.bridge
                .files()
                .ls(path)
                .then((entities: IEntity[]) => {
                    const sub = entities.map((entity) => new Entity(entity, path, false));
                    sub.sort((a) => {
                        return a.isFolder() ? -1 : 1;
                    });
                    this.structure.set(path, sub);
                    resolve(sub);
                })
                .catch(reject);
        });
    }

    public isExpandable(path: string): boolean {
        return this.structure.has(path);
    }
}

export type OnToggleHandler = (entity: Entity, expand: boolean) => void;

export class DynamicDataSource implements DataSource<DynamicFlatNode> {
    public readonly dataChange = new BehaviorSubject<DynamicFlatNode[]>([]);
    private readonly _treeControl: FlatTreeControl<DynamicFlatNode>;
    private readonly _database: DynamicDatabase;
    private readonly _onToggle: OnToggleHandler;

    get data(): DynamicFlatNode[] {
        return this.dataChange.value;
    }
    set data(value: DynamicFlatNode[]) {
        this._treeControl.dataNodes = value;
        this.dataChange.next(value);
    }

    constructor(
        treeControl: FlatTreeControl<DynamicFlatNode>,
        database: DynamicDatabase,
        onToggle: OnToggleHandler,
    ) {
        this._treeControl = treeControl;
        this._database = database;
        this._onToggle = onToggle;
    }

    public connect(collectionViewer: CollectionViewer): Observable<DynamicFlatNode[]> {
        this._treeControl.expansionModel.changed.subscribe((change) => {
            if (
                (change as SelectionChange<DynamicFlatNode>).added ||
                (change as SelectionChange<DynamicFlatNode>).removed
            ) {
                this.handleTreeControl(change as SelectionChange<DynamicFlatNode>);
            }
        });
        return merge(collectionViewer.viewChange, this.dataChange).pipe(map(() => this.data));
    }

    public disconnect(_collectionViewer: CollectionViewer): void {
        this._database.destroy();
    }

    public handleTreeControl(change: SelectionChange<DynamicFlatNode>) {
        if (change.added) {
            change.added.forEach((node) => this.toggleNode(node, true));
        }
        if (change.removed) {
            change.removed
                .slice()
                .reverse()
                .forEach((node) => this.toggleNode(node, false));
        }
    }

    public expandByPath(path: string): Promise<void> {
        const node = this.getByPath(path);
        if (node === undefined) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            let isResolved = false;
            const done = () => {
                clearTimeout(timeout);
                if (isResolved) {
                    return;
                }
                isResolved = true;
                resolve();
            };
            const timeout = setTimeout(() => {
                // We are using timeout to prevent dead promisses
                done();
            }, 5000);
            node.onExpanded(() => {
                done();
            });
            this._treeControl.expand(node);
        });
    }

    public async expand(paths: string[]): Promise<void> {
        for (const path of paths) {
            await this.expandByPath(path);
        }
        return Promise.resolve();
    }

    public getByPath(path: string): DynamicFlatNode | undefined {
        return this.data.find((e) => e.item.getPath() == path);
    }

    public toggleNode(node: DynamicFlatNode, expand: boolean): Promise<void> {
        const index = this.data.indexOf(node);
        if (index < 0) {
            // If no children, or cannot find the node, no op
            node.afterExpanded();
            return Promise.resolve();
        }
        this._onToggle(node.item, expand);
        return new Promise((resolve, _reject) => {
            node.isLoading = true;
            this._database
                .getChildren(node.item.getPath())
                .then((entries: Entity[]) => {
                    if (expand) {
                        const nodes = entries.map(
                            (entity) =>
                                new DynamicFlatNode(entity, node.level + 1, entity.isFolder()),
                        );
                        this.data.splice(index + 1, 0, ...nodes);
                    } else {
                        let count = 0;
                        for (
                            let i = index + 1;
                            i < this.data.length && this.data[i].level > node.level;
                            i++, count++
                        ) {
                            // Counting
                        }
                        this.data.splice(index + 1, count);
                    }
                    // notify the change
                    this.dataChange.next(this.data);
                })
                .catch((err: Error) => {
                    console.log(`Unexpected error: ${err.message}`);
                })
                .finally(() => {
                    node.isLoading = false;
                    node.afterExpanded();
                    resolve();
                });
        });
    }
}
