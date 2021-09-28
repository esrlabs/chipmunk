import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IEnvironment, INewInformation } from '../component';

import ContextMenuService, {
    IMenuItem,
} from '../../../../../services/standalone/service.contextmenu';

@Component({
    selector: 'app-sidebar-app-shell-environment-variables',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppShellEnvironmentVariablesComponent implements OnInit, OnDestroy {
    @Input() public information!: INewInformation;
    @Input() public setEnvironment!: (information: INewInformation) => void;
    @Input() public close!: () => {};

    @ViewChild('variableAdd') _ng_variableAdd!: ElementRef<HTMLInputElement>;

    public readonly _ng_inputType = {
        variable: 'variable',
        value: 'value',
    };
    public readonly _ng_colors = {
        valid: '#eaeaea',
        invalid: '#fd1515',
    };
    public _ng_valid: boolean = false;
    public _ng_selected: IEnvironment | undefined;
    public _ng_adding: boolean = false;
    public _ng_height: number = 200;
    public _ng_variable: string = '';
    public _ng_value: string = '';
    public _ng_newVariable: string = '';
    public _ng_newValue: string = '';

    private _prevValue: string = '';
    private _prevVariable: string = '';
    private _prevSelected: IEnvironment | undefined;

    constructor() {}

    public ngOnInit() {
        this._sortInformation();
        this._ng_height = Math.round(window.innerHeight * 0.7);
    }

    public ngOnDestroy() {
        if (this._ng_selected) {
            this._ng_selected.editing.variable = false;
            this._ng_selected.editing.value = false;
        }
        this.setEnvironment(this.information);
    }

    public _ng_onContexMenu(event: MouseEvent, env: IEnvironment, type: string) {
        this._changeFocus(env);
        const items: IMenuItem[] = [
            {
                caption: 'Edit',
                handler: () => {
                    if (this._ng_selected === undefined) {
                        return;
                    }
                    if (type === this._ng_value) {
                        this._ng_value = this._ng_selected.value;
                        env.editing.value = true;
                        this._prevValue = env.value;
                    } else {
                        this._ng_variable = this._ng_selected.variable;
                        env.editing.variable = true;
                        this._prevVariable = env.variable;
                    }
                },
            },
            {
                caption: 'Remove',
                handler: () => {
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

    public _ng_onKeyUp(event: KeyboardEvent, isVariable: boolean, environment: IEnvironment) {
        if (
            isVariable &&
            (this._ng_variable.trim() === '' || this._variableExists(this._ng_variable))
        ) {
            this._ng_valid = false;
            return;
        }
        this._ng_valid = true;
        if (event.key !== 'Enter') {
            return;
        }
        if (isVariable) {
            environment.variable = this._ng_variable;
            this._sortInformation();
        } else {
            environment.value = this._ng_value;
        }
        this._setCustomStatus();
    }

    public _ng_onKeyUpAdd(event: KeyboardEvent, isVariable: boolean = false) {
        if (
            isVariable &&
            (this._ng_newVariable.trim() === '' || this._variableExists(this._ng_newVariable))
        ) {
            this._ng_valid = false;
            return;
        }
        this._ng_valid = true;
        if (event.key !== 'Enter') {
            return;
        }
        this._finishCreating(true);
        this._setCustomStatus();
        this._sortInformation();
    }

    public _ng_onClick(env: IEnvironment) {
        if (this._ng_selected !== undefined && this._ng_selected.variable === env.variable) {
            this._ng_selected = undefined;
        } else {
            this._ng_selected = env;
            this._changeFocus(env);
        }
    }

    public _ng_onDoubleClick(env: IEnvironment, type: string) {
        if (this._ng_selected === undefined) {
            return;
        }
        this._changeFocus(env);
        if (type === this._ng_inputType.value) {
            this._ng_value = this._ng_selected.value;
            env.editing.value = true;
            this._prevValue = env.value;
        } else {
            this._ng_variable = this._ng_selected.variable;
            env.editing.variable = true;
            this._prevVariable = env.variable;
        }
    }

    public _ng_add() {
        this._changeFocus();
        this._ng_adding = true;
        if (this._ng_variableAdd !== undefined) {
            this._ng_variableAdd.nativeElement.scrollIntoView();
        }
    }

    public _ng_remove() {
        this.information.env = this.information.env.filter((env: IEnvironment) => {
            if (this._ng_selected === undefined) {
                return;
            }
            return (
                env.value !== this._ng_selected.value && env.variable !== this._ng_selected.variable
            );
        });
    }

    public _ng_onCancel() {
        this._finishCreating(false);
        this.close();
    }

    private _changeFocus(selected?: IEnvironment) {
        this._prevSelected = this._ng_selected;
        if (this._prevSelected !== undefined) {
            this._prevSelected.editing.value = false;
            this._prevSelected.editing.variable = false;
            this._prevSelected.selected = false;
        }
        this._ng_selected = selected;
        if (this._ng_selected !== undefined) {
            this._ng_selected.editing.value = false;
            this._ng_selected.editing.variable = false;
            this._ng_selected.selected = true;
        }
        this._finishCreating(false);
    }

    private _finishCreating(save: boolean) {
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
            if (a.variable < b.variable) {
                return -1;
            }
            if (a.variable > b.variable) {
                return 1;
            }
            return 0;
        });
    }

    private _variableExists(variable: string): boolean {
        return this.information.env.filter((env: IEnvironment) => {
            return env.variable === variable;
        }).length === 0
            ? false
            : true;
    }
}
