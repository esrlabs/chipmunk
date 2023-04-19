import { Component, Input, AfterViewInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { State } from '@ui/elements/transport/setup/states/serial';
import { NO_PORT, CUSTOM_PORT } from '../common';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { Subject } from '@platform/env/subscription';
import { Options as AutocompleteOptions } from '@elements/autocomplete/component';

@Component({
    selector: 'app-transport-serial-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class List implements AfterViewInit {
    @Input() action!: Action;
    @Input() state!: State;

    public readonly NO_PORT = NO_PORT;
    public readonly CUSTOM_PORT = CUSTOM_PORT;
    public readonly inputs: AutocompleteOptions = {
        name: 'Port',
        storage: 'serial_port_recent',
        defaults: '',
        placeholder: 'Enter custom port',
        label: 'Custom port',
        recent: new Subject<void>(),
    };

    private _ports: string[] = [];
    private _customPorts: string[] = [];
    private _isCustom: boolean = false;
    private _previousPort: string = NO_PORT;

    public ngAfterViewInit() {
        this.state.action = this.action;
        this.updatePortsList();
    }

    public get isCustom(): boolean {
        return this._isCustom;
    }

    public get port(): string {
        return this.state.path;
    }

    public set port(port: string) {
        if (port === CUSTOM_PORT) {
            this._previousPort = this.state.path;
            this._isCustom = true;
        }
        this.state.path = port;
    }

    public get ports(): string[] {
        return this._ports;
    }

    public isAvailable(_port: string): boolean {
        // [TODO] Need unbound session for this - Closely connected to sparklines
        return true;
    }

    public updatePortsList() {
        this.ilc()
            .services.system.bridge.ports()
            .list()
            .then((ports: string[]) => {
                this._ports = [...this._customPorts, ...ports];
                if (this._ports.indexOf(this.state.path) === -1) {
                    this.state.path = this._ports.length > 0 ? this._ports[0] : NO_PORT;
                }
            })
            .catch((err: Error) => {
                this.log().error(
                    `Fail to update serial ports list due to the following error: ${err.message}`,
                );
            });
    }

    public onEnter(port: string) {
        port = port.trim();
        if (port === '') {
            this.state.path = NO_PORT;
        } else {
            if (this.ports.indexOf(port) === -1 && this._customPorts.indexOf(port) === -1) {
                this.ports.push(port);
                this._customPorts.push(port);
            }
            this.state.path = port;
        }
        this._isCustom = false;
    }

    public onFocusOut() {
        this._isCustom = false;
        if (this.state.path === CUSTOM_PORT) {
            this.state.path = this._previousPort;
        }
    }
}
export interface List extends IlcInterface {}
