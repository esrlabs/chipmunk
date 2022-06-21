import { CollectionViewer, SelectionChange, DataSource } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Entity } from './entity';
import { EntityType, Entity as IEntity } from '@platform/types/files';
import { Services } from '@service/ilc/services';

export { Entity };

export class DynamicFlatNode {
    constructor(
        public item: Entity,
        public level = 1,
        public expandable = false,
        public isLoading = false,
    ) {}
}

export class DynamicDatabase {
    public readonly structure = new Map<string, Entity[]>();
    public roots: string[];
    private readonly _services: Services;

    constructor(roots: string[], services: Services) {
        this._services = services;
        this.roots = roots;
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
                    ),
                    0,
                    true,
                ),
        );
    }

    public overwrite(roots: string[]) {
        this.roots = roots;
    }

    public addRoot(root: string) {
        this.roots.push(root);
    }

    public getChildren(path: string): Promise<Entity[]> {
        const entities = this.structure.get(path);
        if (entities !== undefined) {
            return Promise.resolve(entities);
        }
        return new Promise((resolve, reject) => {
            this._services.system.bridge
                .files()
                .ls(path)
                .then((entities: IEntity[]) => {
                    const sub = entities.map((entity) => new Entity(entity, path));
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

export class DynamicDataSource implements DataSource<DynamicFlatNode> {
    public readonly dataChange = new BehaviorSubject<DynamicFlatNode[]>([]);
    private readonly _treeControl: FlatTreeControl<DynamicFlatNode>;
    private readonly _database: DynamicDatabase;

    get data(): DynamicFlatNode[] {
        return this.dataChange.value;
    }
    set data(value: DynamicFlatNode[]) {
        this._treeControl.dataNodes = value;
        this.dataChange.next(value);
    }

    constructor(treeControl: FlatTreeControl<DynamicFlatNode>, database: DynamicDatabase) {
        this._treeControl = treeControl;
        this._database = database;
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

    public disconnect(collectionViewer: CollectionViewer): void {
        console.log(`Not implemented: ${collectionViewer}`);
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

    public toggleNode(node: DynamicFlatNode, expand: boolean) {
        const index = this.data.indexOf(node);
        if (index < 0) {
            // If no children, or cannot find the node, no op
            return;
        }
        node.isLoading = true;
        this._database
            .getChildren(node.item.getPath())
            .then((entries: Entity[]) => {
                if (expand) {
                    const nodes = entries.map(
                        (entity) => new DynamicFlatNode(entity, node.level + 1, entity.isFolder()),
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
            });
    }
}
