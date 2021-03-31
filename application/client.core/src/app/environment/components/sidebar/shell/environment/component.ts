import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IEnvironment, INewInformation } from '../input/component';

import ContextMenuService, { IMenuItem } from '../../../../services/standalone/service.contextmenu';

@Component({
    selector: 'app-sidebar-app-shell-environment',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppShellEnvironmentComponent implements OnInit, OnDestroy {

    @Input() public information: INewInformation;
    @Input() public setEnvironment: (information: INewInformation) => void;
    @Input() public close: () => {};

    @ViewChild('variableAdd') _ng_variableAdd: ElementRef<HTMLInputElement>;

    public readonly _ng_variable: string = 'variable';
    public readonly _ng_value: string = 'value';
    public _ng_selected: IEnvironment;
    public _ng_adding: boolean = false;
    public _ng_height: number = 200;
    public _ng_newVariable: string = '';
    public _ng_newValue: string = '';

    private _prevValue: string = '';
    private _prevVariable: string = '';
    private _editing: IEnvironment | undefined;

    constructor() { }

    public ngOnInit() {
        this._sortInformation();
        this._ng_height = Math.round(window.innerHeight * .7);
    }

    public ngOnDestroy() {
        if (this._ng_selected !== undefined) {
            this._ng_selected.editing = {
                value: false,
                variable: false
            };
            this._ng_selected = undefined;
        }
        this._ng_adding = false;
        this.setEnvironment(this.information);
    }

    public _ng_onContexMenu(event: MouseEvent, env: IEnvironment, type: string) {
        const items: IMenuItem[] = [
            {
                caption: 'Edit',
                handler: () => {
                    this._changeFocus(env);
                    if (type === this._ng_value) {
                        env.editing.value = true;
                        this._prevValue = env.value;
                    } else {
                        env.editing.variable = true;
                        this._prevVariable = env.variable;
                    }
                }
            },
            {
                caption: 'Remove',
                handler: () => {
                    this._changeFocus();
                    this.information.env = this.information.env.filter((ngEnv: IEnvironment) => {
                        return ngEnv.variable !== env.variable && ngEnv.value !== env.value;
                    });
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        }
        this._finishCreating(true);
        this._setCustomStatus();
        this._sortInformation();
    }

    public _ng_onClick(env: IEnvironment) {
        if (this._ng_selected !== env) {
            this._changeFocus();
        }
        if (this._ng_selected !== undefined) {
            this._ng_selected.selected = false;
        }
        this._ng_selected = env;
        this._ng_selected.selected = true;
    }

    public _ng_onDoubleClick(env: IEnvironment, type: string) {
        this._changeFocus(env);
        if (type === this._ng_value) {
            env.editing.value = true;
            this._prevValue = env.value;
        } else {
            env.editing.variable = true;
            this._prevVariable = env.variable;
        }
    }

    public _ng_add() {
        this._ng_selected = undefined;
        this._ng_adding = true;
        if (this._ng_variableAdd !== undefined) {
            this._ng_variableAdd.nativeElement.scrollIntoView();
        }
    }

    public _ng_remove() {
        if (this._ng_selected !== undefined) {
            this.information.env = this.information.env.filter((env: IEnvironment) => {
                return (env.value !== this._ng_selected.value && env.variable !== this._ng_selected.variable);
            });
        }
    }

    public _ng_onCancel() {
        this._finishCreating(false);
        this.close();
    }

    private _changeFocus(newEditEnv?: IEnvironment) {
        if (this._editing !== undefined) {
            this._dropEditChanges();
            this._editing.editing.value = false;
            this._editing.editing.variable = false;
        }
        this._finishCreating(false);
        this._editing = newEditEnv;
    }

    private _dropEditChanges() {
        if (this._editing.editing.value) {
            this._editing.value = this._prevValue;
        } else if (this._editing.editing.variable) {
            this._editing.variable = this._prevVariable;
        }
    }

    private _finishCreating(save: boolean) {
        if (!this._ng_adding) {
            return;
        }
        if (save) {
            this.information.env.push({
                custom: true,
                editing: {
                    value: false,
                    variable: false,
                },
                value: this._ng_newValue,
                variable: this._ng_newVariable,
                selected: false,
            });
        }
        this._ng_adding = false;
        this._ng_newValue = '';
        this._ng_newVariable = '';
    }

    private _setCustomStatus() {
        if (this._ng_selected !== undefined && this._ng_selected.editing !== undefined) {
            if (this._ng_selected.editing.value) {
                if (this._prevValue !== this._ng_selected.value) {
                    this._ng_selected.custom = true;
                }
                this._ng_selected.editing.value = false;
            } else if (this._ng_selected.editing.variable) {
                if (this._prevVariable !== this._ng_selected.variable) {
                    this._ng_selected.custom = true;
                }
                this._ng_selected.editing.variable = false;
            }
        }
    }

    private _sortInformation() {
        this.information.env.sort((a: IEnvironment, b: IEnvironment) => {
            if (a.variable < b.variable) { return -1; }
            if (a.variable > b.variable) { return 1; }
            return 0;
        });
    }

}
