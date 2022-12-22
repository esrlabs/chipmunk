import { FlatTreeControl } from '@angular/cdk/tree';
import { Services } from '@service/ilc';
import { Instance as Logger } from '@platform/env/logger';
import { Filter } from '@elements/filter/filter';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { favorites } from '@service/favorites';

import * as Scheme from './scheme';

export class State {
    public filter: Filter;
    public favorites: string[] = [];
    public scheme!: {
        db: Scheme.DynamicDatabase;
        tree: FlatTreeControl<Scheme.DynamicFlatNode>;
        source: Scheme.DynamicDataSource;
    };
    protected ilc: IlcInterface & ChangesDetector;
    private _log!: Logger;

    constructor(ilc: IlcInterface & ChangesDetector) {
        this.ilc = ilc;
        this.filter = new Filter(ilc, {
            clearOnEnter: true,
            clearOnEscape: true,
            placeholder: 'Files filter',
        });
        this.filter.subjects.get().change.subscribe((_path: string) => {
            ilc.detectChanges();
        });
        ilc.env().subscriber.register(
            ilc
                .ilc()
                .services.ui.listener.listen<KeyboardEvent>(
                    'keydown',
                    window,
                    (event: KeyboardEvent) => {
                        const count = this.scheme.source.data.length;
                        const selected = this.scheme.source.data.findIndex((d) => d.item.selected);
                        if (selected === -1) {
                            if (count > 0) {
                                this.scheme.source.data[0].item.selecting().select();
                            }
                            return true;
                        }
                        const selectedRef = this.scheme.source.data[selected];
                        const nextRef = this.scheme.source.data[selected + 1];
                        const prevRef = this.scheme.source.data[selected - 1];
                        if (event.key === 'ArrowDown' && nextRef !== undefined) {
                            selectedRef.item.selecting().unselect();
                            nextRef.item.selecting().select();
                        } else if (event.key === 'ArrowUp' && prevRef !== undefined) {
                            selectedRef.item.selecting().unselect();
                            prevRef.item.selecting().select();
                        } else if (event.key === ' ') {
                            if (selectedRef.expandable) {
                                this.scheme.source.toggleNode(selectedRef, true);
                            }
                        }
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            ilc.detectChanges();
                            this._scrollIntoView();
                            return false;
                        }
                        ilc.detectChanges();
                        return true;
                    },
                ),
        );
    }

    public async init(services: Services, log: Logger): Promise<void> {
        this._log = log;
        const db = new Scheme.DynamicDatabase(this.favorites.slice(), services, this.filter);
        const tree = new FlatTreeControl<Scheme.DynamicFlatNode>(
            (node: Scheme.DynamicFlatNode) => node.level,
            (node: Scheme.DynamicFlatNode) => node.expandable,
        );
        const source = new Scheme.DynamicDataSource(
            tree,
            db,
            (entity: Scheme.Entity, expanded: boolean) => {
                (() => {
                    if (expanded) {
                        return favorites.expanded().add(entity.getPath(), entity.parent);
                    } else {
                        return favorites.expanded().remove(entity.getPath());
                    }
                })().catch((err: Error) => {
                    this._log.error(`Fail to update state of folder's tree: ${err.message}`);
                });
            },
        );
        db.bind(source);
        source.data = db.initialData();
        this.scheme = { db, tree, source };
        this.favorites = favorites.favorites.slice();
        this.scheme.db.overwrite(this.favorites.slice());
        if (this.scheme.source.data.length > 0) {
            this.scheme.source.data[0].item.selecting().select();
        }
        this.ilc.env().subscriber.register(
            favorites.updates.get().list.subscribe(() => {
                this.favorites = favorites.favorites.slice();
                this.scheme.db.overwrite(this.favorites.slice());
            }),
        );
    }

    public expand(): void {
        this.scheme.source.expand(favorites.states.map((v) => v.path));
    }

    public select(node: Scheme.DynamicFlatNode) {
        const selected = this.scheme.source.data.find((d) => d.item.selected);
        if (selected !== undefined) {
            selected.item.selecting().unselect();
        }
        node.item.selecting().select();
        this.ilc.detectChanges();
    }

    public removePlace(entity: Scheme.Entity) {
        const path = entity.getPath();
        favorites
            .places()
            .remove(path)
            .catch((err: Error) => {
                this._log.error(`Fail to add favorites: ${err.message}`);
            });
    }

    private _scrollIntoView() {
        const nodes = document.querySelectorAll(`mat-tree-node[data-selected="true"]`);
        if (nodes.length === 0) {
            return;
        }
        nodes.forEach((node: Element) => {
            (node as HTMLElement).scrollIntoView({
                behavior: 'auto',
                block: 'nearest',
                inline: 'nearest',
            });
        });
    }
}
