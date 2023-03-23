import { Component, ChangeDetectorRef, Input, OnDestroy, AfterViewInit } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../states/serial';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { Ilc, IlcInterface } from '@env/decorators/component';

import SerialService from './service/service';

@Component({
    selector: 'app-serial-setup-base',
    template: '',
})
@Ilc()
export class SetupBase extends ChangesDetector implements AfterViewInit, OnDestroy {
    @Input() public state!: State;
    @Input() public action!: Action;

    public _ng_ports: string[] = [];

    private _timeout!: number;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterViewInit() {
        this._detectPorts();
    }

    public ngOnDestroy() {
        clearTimeout(this._timeout);
        this.state.destroy();
    }

    private _detectPorts() {
        this.ilc()
            .services.system.bridge.ports()
            .list()
            .then((ports: string[]) => {
                this._ng_ports = ports;
                let selected: string = SerialService.selected;
                if (this._ng_ports.indexOf(SerialService.selected) === -1) {
                    selected =
                        this._ng_ports.length > 0
                            ? SerialService.setSelected(this._ng_ports[0])
                            : SerialService.setSelected('');
                }
                if (this._ng_ports.length === 0) {
                    selected = SerialService.setSelected('');
                } else if (SerialService.selected === '' && this._ng_ports.length > 0) {
                    selected = SerialService.setSelected(this._ng_ports[0]);
                }
                this.state.path = selected;
                this.action.setDisabled(selected === '');
            })
            .catch((err: Error) => {
                this.log().error(`Fail to update ports list due error: ${err.message}`);
            })
            .finally(() => {
                this._timeout = setTimeout(() => {
                    this._detectPorts();
                }, 3000) as unknown as number;
            });
    }
}
export interface SetupBase extends IlcInterface {}
