import { FlatTreeControl } from '@angular/cdk/tree';
import { Services } from '@service/ilc';
import { Filter } from '@elements/filter/filter';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { favorites, FavoritePlace } from '@service/favorites';
import { Subscription } from '@platform/env/subscription';

import * as Scheme from './scheme';

export class State {
    public filter: Filter;
    public favorites: FavoritePlace[] = [];
    public scheme!: {
        db: Scheme.DynamicDatabase;
        tree: FlatTreeControl<Scheme.DynamicFlatNode>;
        source: Scheme.DynamicDataSource;
    };
    protected ilc: IlcInterface & ChangesDetector;
    protected focused: boolean = false;

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
                        if (!this.focused) {
                            return true;
                        }
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
                                this.scheme.source.expand(selectedRef);
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

    public async init(services: Services): Promise<void> {
        const db = new Scheme.DynamicDatabase(services, this.filter);
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
                    this.ilc.log().error(`Fail to update state of folder's tree: ${err.message}`);
                });
            },
            this.ilc,
        );
        db.bind(source);
        source.data = db.initialData();
        this.scheme = { db, tree, source };
        await this.reload();
        this.ilc.env().subscriber.register(
            favorites.updates.get().list.subscribe(() => {
                favorites
                    .places()
                    .get()
                    .then((places) => {
                        this.favorites = places;
                        this.scheme.db.overwrite(this.favorites.slice());
                    })
                    .catch((err: Error) => {
                        this.ilc.log().error(`Fail to get favorites places list: ${err.message}`);
                    })
                    .finally(() => {
                        this.ilc.detectChanges();
                    });
            }),
        );
    }

    public bind(container: HTMLElement): void {
        this.focus = this.focus.bind(this);
        this.blur = this.blur.bind(this);
        container.addEventListener('focus', this.focus);
        container.addEventListener('blur', this.blur);
        this.ilc.env().subscriber.register(
            new Subscription('container_focus_listener', () => {
                container.removeEventListener('focus', this.focus);
                container.removeEventListener('blur', this.blur);
            }),
        );
    }

    public async reload(): Promise<void> {
        this.favorites = await favorites.places().get();
        this.scheme.db.overwrite(this.favorites.slice());
        if (this.scheme.source.data.length > 0) {
            this.scheme.source.data[0].item.selecting().select();
        }
        this.ilc.detectChanges();
    }

    public expand() {
        this.scheme.source.expand(favorites.states.map((v) => v.path));
    }

    public focus(): void {
        this.focused = true;
    }

    public blur(): void {
        this.focused = false;
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
                this.ilc.log().error(`Fail to add favorites: ${err.message}`);
            });
    }

    public isEmpty(): boolean {
        return this.scheme.db.isEmpty();
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
