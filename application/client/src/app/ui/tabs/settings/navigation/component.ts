import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    SimpleChanges,
    OnChanges,
    Input,
    AfterContentInit,
    NgZone,
} from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { Entry, ConnectedField, Field } from '../../../../controller/settings/field.store';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { IPair } from '../../../../thirdparty/code/engine';
import { ESettingType } from '../../../../services/service.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

interface ISettingNodeSrc {
    path: string;
    name: string;
    children?: ISettingNodeSrc[];
}

interface ISettingNode {
    expandable: boolean;
    path: string;
    name: string;
    level: number;
}

@Component({
    selector: 'app-tabs-settings-navigation',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class TabSettingsNavigationComponent implements OnDestroy, AfterContentInit, OnChanges {
    @Input() public entries!: Map<string, Entry | ConnectedField<any> | Field<any>>;
    @Input() public focused: Subject<string> = new Subject();
    @Input() public matches: Map<string, IPair> = new Map();
    @Input() public filter: string = '';

    public _ng_treeControl: FlatTreeControl<ISettingNode>;
    public _ng_dataSource!: MatTreeFlatDataSource<any, any, any>;
    public _ng_focused: string | undefined;

    private _treeFlattener!: MatTreeFlattener<any, any>;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsNavigationComponent');

    constructor(private _cdRef: ChangeDetectorRef, private _zone: NgZone) {
        this._treeFlattener = new MatTreeFlattener(
            this._transformer,
            (node) => node.level,
            (node) => node.expandable,
            (node) => node.children,
        );
        this._ng_treeControl = new FlatTreeControl<ISettingNode>(
            (node) => node.level,
            (node) => node.expandable,
        );
        this._ng_dataSource = new MatTreeFlatDataSource(this._ng_treeControl, this._treeFlattener);
        this._ng_dataSource.data = [];
    }

    public ngAfterContentInit() {
        this._ng_dataSource.data = this._getData();
        this._subscriptions.focused = this.focused
            .asObservable()
            .subscribe(this._onFocusChanged.bind(this));
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.entries === undefined) {
            return;
        }
        this._zone.run(() => {
            this._ng_dataSource.data = this._getData();
            if (this.filter !== '' || this._ng_focused !== undefined) {
                this._ng_treeControl.expandAll();
            }
        });
    }

    public _ng_hasChild(_: number, node: ISettingNode): boolean {
        return node.expandable;
    }

    public _ng_onNodeClick(node: ISettingNode) {
        if (this._ng_focused === node.path) {
            return;
        }
        this._ng_focused = node.path;
        this.focused.next(node.path);
        this._forceUpdate();
    }

    private _onFocusChanged(path: string) {
        if (this._ng_focused === path) {
            return;
        }
        this._ng_focused = path;
        this._forceUpdate();
    }

    private _getData(): ISettingNodeSrc[] {
        let count: number = 0;

        function find(tree: ISettingNodeSrc[], path: string): ISettingNodeSrc | undefined {
            let target: ISettingNodeSrc | undefined;
            tree.forEach((node: ISettingNodeSrc) => {
                if (target !== undefined) {
                    return;
                }
                if (node.path === path) {
                    target = node;
                } else if (node.children instanceof Array) {
                    target = find(node.children, path);
                }
            });
            return target;
        }

        function fill(tree: ISettingNodeSrc[], store: Entry[]) {
            store.forEach((entry: Entry) => {
                if (entry.getPath() === '') {
                    tree.push({
                        path: entry.getFullPath(),
                        name: entry.getName(),
                    });
                    count += 1;
                    return;
                }
                const target: ISettingNodeSrc | undefined = find(tree, entry.getPath());
                if (target === undefined) {
                    return;
                }
                target.children = target.children !== undefined ? target.children : [];
                target.children.push({
                    path: entry.getFullPath(),
                    name: entry.getName(),
                });
                count += 1;
            });
            return tree;
        }
        const data: ISettingNodeSrc[] = [];
        const sources: Entry[] = Array.from(this.entries.values()).filter(
            (entry: Entry | ConnectedField<any> | Field<any>) => {
                if (entry.getType() === ESettingType.hidden) {
                    return false;
                }
                if (entry instanceof ConnectedField || entry instanceof Field) {
                    return false;
                }
                return true;
            },
        );
        let safety: number = 0;
        do {
            fill(data, sources);
            if (safety++ > 10) {
                break;
            }
        } while (count !== sources.length);
        return data;
    }

    private _transformer(node: ISettingNodeSrc, level: number): ISettingNode {
        return {
            expandable: !!node.children && node.children.length > 0,
            name: node.name,
            level: level,
            path: node.path,
        };
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
