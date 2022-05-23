import { Entity, EntityType } from '@platform/types/files';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Services } from '@service/ilc';
import { Instance as Logger } from '@platform/env/logger';

import * as Scheme from './scheme';

const STORAGE_KEY = 'user_favourites_places';

export class State {
    public favourites: string[] = [];
    public scheme!: {
        db: Scheme.DynamicDatabase;
        tree: FlatTreeControl<Scheme.DynamicFlatNode>;
        source: Scheme.DynamicDataSource;
    };
    private _services!: Services;
    private _log!: Logger;

    public init(services: Services, log: Logger): void {
        this._services = services;
        this._log = log;
        const db = new Scheme.DynamicDatabase(this.favourites.slice(), services);
        const tree = new FlatTreeControl<Scheme.DynamicFlatNode>(
            (node: Scheme.DynamicFlatNode) => node.level,
            (node: Scheme.DynamicFlatNode) => node.expandable,
        );
        const source = new Scheme.DynamicDataSource(tree, db);
        source.data = db.initialData();
        this.scheme = { db, tree, source };
        this._storage()
            .get()
            .then((favourites) => {
                this.favourites = favourites.slice();
                this.scheme.db.overwrite(favourites.slice());
                this.scheme.source.data = this.scheme.db.initialData();
            })
            .catch((err: Error) => {
                this._log.error(`Fail to read favourites: ${err.message}`);
            });
    }

    public addPlace(path: string) {
        if (path.trim().length === 0 || this.favourites.indexOf(path) !== -1) {
            return;
        }
        this._services.system.bridge
            .files()
            .stat(path)
            .then((entity: Entity) => {
                if (entity.type !== EntityType.Directory) {
                    return;
                }
                this.favourites.push(path);
                this.scheme.db.addRoot(path);
                this.scheme.source.data = this.scheme.db.initialData();
                this._storage()
                    .set(this.favourites)
                    .catch((err: Error) => {
                        this._log.error(`Fail to save favourites: ${err.message}`);
                    });
            })
            .catch((err: Error) => {
                this._log.error(err.message);
            });
    }

    private _storage(): {
        get(): Promise<string[]>;
        set(value: string[]): Promise<void>;
    } {
        return {
            get: (): Promise<string[]> => {
                return new Promise((resolve, reject) => {
                    this._services.system.bridge
                        .entries(STORAGE_KEY)
                        .get()
                        .then((entries) => {
                            resolve(entries.map((entry) => entry.content));
                        })
                        .catch(reject);
                });
            },
            set: (value: string[]): Promise<void> => {
                return this._services.system.bridge.entries(STORAGE_KEY).overwrite(
                    value.map((path: string) => {
                        return {
                            uuid: path,
                            content: path,
                        };
                    }),
                );
            },
        };
    }
}
