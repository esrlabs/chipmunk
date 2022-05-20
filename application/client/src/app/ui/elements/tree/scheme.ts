import { CollectionViewer, SelectionChange, DataSource } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Entity } from './entity';
import { EntityType, Entity as IEntity } from '@platform/types/files';
import { State } from './state';
import { Services } from '@service/ilc/services';

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
    public cmd: string;
    private readonly _services: Services;

    constructor(cmd: string, services: Services) {
        this._services = services;
        this.cmd = cmd;
    }

    public initialData(): DynamicFlatNode[] {
        return [
            new DynamicFlatNode(
                new Entity(
                    {
                        name: this.cmd,
                        type: EntityType.Directory,
                        details: undefined,
                    },
                    '',
                ),
                0,
                true,
            ),
        ];
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
                    this.structure.set(path, sub);
                    this.cmd = path;
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
    private readonly _state: State;

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
        state: State,
    ) {
        this._treeControl = treeControl;
        this._database = database;
        this._state = state;
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

    public disconnect(collectionViewer: CollectionViewer): void {}

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
                    ) {}
                    this.data.splice(index + 1, count);
                }

                // notify the change
                this.dataChange.next(this.data);
            })
            .catch((err: Error) => {})
            .finally(() => {
                node.isLoading = false;
            });
    }
}
