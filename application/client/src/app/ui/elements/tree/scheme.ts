import { CollectionViewer, SelectionChange, DataSource } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Entity } from './entity';
import { EntityType } from '@platform/types/files';
import { Services } from '@service/ilc/services';
import { Filter } from '@elements/filter/filter';
import { FavoritePlace } from '@service/favorites';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';

export { Entity };

type ExpandedCallback = () => void;

const DEFAULT_LEN = 10000;

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

    public isVisible(): boolean {
        return this.item.isVisible();
    }
}

export class DynamicDatabase {
    public readonly structure = new Map<string, Entity[]>();
    public roots: FavoritePlace[] = [];

    protected readonly services: Services;
    protected readonly filter: Filter;
    protected source!: DynamicDataSource;

    constructor(services: Services, filter: Filter) {
        this.services = services;
        this.filter = filter;
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
            (root: FavoritePlace) =>
                new DynamicFlatNode(
                    new Entity(
                        {
                            name: root.path,
                            fullname: root.path,
                            type: EntityType.Directory,
                            details: undefined,
                        },
                        '',
                        true,
                        root.exists,
                        this.filter,
                    ),
                    0,
                    root.exists,
                ),
        );
    }

    public overwrite(roots: FavoritePlace[]) {
        this.roots = roots;
        this.source.data = this.initialData();
    }

    public getChildren(path: string): Promise<Entity[]> {
        const entities = this.structure.get(path);
        if (entities !== undefined) {
            return Promise.resolve(entities);
        }
        return new Promise((resolve, reject) => {
            this.services.system.bridge
                .files()
                .ls({ paths: [path], depth: 1, max: DEFAULT_LEN })
                .then((data) => {
                    const sub = data.entities.map(
                        (entity) => new Entity(entity, path, false, true, this.filter),
                    );
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

    public isEmpty(): boolean {
        return this.roots.length === 0;
    }
}

export type OnToggleHandler = (entity: Entity, expand: boolean) => void;

export class DynamicDataSource implements DataSource<DynamicFlatNode> {
    public readonly dataChange = new BehaviorSubject<DynamicFlatNode[]>([]);

    protected readonly treeControl: FlatTreeControl<DynamicFlatNode>;
    protected readonly database: DynamicDatabase;
    protected readonly onToggle: OnToggleHandler;
    protected readonly ilc: IlcInterface & ChangesDetector;

    get data(): DynamicFlatNode[] {
        return this.dataChange.value;
    }
    set data(value: DynamicFlatNode[]) {
        this.treeControl.dataNodes = value;
        this.dataChange.next(value);
    }

    constructor(
        treeControl: FlatTreeControl<DynamicFlatNode>,
        database: DynamicDatabase,
        onToggle: OnToggleHandler,
        ilc: IlcInterface & ChangesDetector,
    ) {
        this.treeControl = treeControl;
        this.database = database;
        this.onToggle = onToggle;
        this.ilc = ilc;
    }

    public connect(collectionViewer: CollectionViewer): Observable<DynamicFlatNode[]> {
        this.treeControl.expansionModel.changed.subscribe((change) => {
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
        this.database.destroy();
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
            this.treeControl.expand(node);
        });
    }

    public async expand(paths: string[] | DynamicFlatNode): Promise<void> {
        if (paths instanceof Array) {
            for (const path of paths) {
                await this.expandByPath(path);
            }
        } else {
            this.treeControl.expand(paths);
        }
        return Promise.resolve();
    }

    public getByPath(path: string): DynamicFlatNode | undefined {
        return this.data.find((e) => e.item.getPath() == path);
    }

    public toggleNode(node: DynamicFlatNode, expand: boolean): Promise<void> {
        const index = this.data.indexOf(node);
        if (index < 0 || !node.item.exists) {
            // If no children, or cannot find the node, no op
            node.afterExpanded();
            return Promise.resolve();
        }
        this.onToggle(node.item, expand);
        node.item.expanded = expand;
        return new Promise((resolve, _reject) => {
            node.isLoading = true;
            this.database
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
                    this.ilc
                        .log()
                        .error(`Unexpected error with getting childs for tree: ${err.message}`);
                })
                .finally(() => {
                    node.isLoading = false;
                    node.afterExpanded();
                    this.ilc.detectChanges();
                    resolve();
                });
        });
    }
}
