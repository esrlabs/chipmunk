import {Component, Input, OnDestroy    } from '@angular/core';
import { APIProcessor       } from '../../../../api/api.processor';
import { APICommands        } from '../../../../api/api.commands';
import { APIResponse        } from '../../../../api/api.response.interface';
import {events as Events} from "../../../../modules/controller.events";
import {configuration as Configuration} from "../../../../modules/controller.config";

@Component({
    selector    : 'dialog-serialports-list',
    templateUrl : './template.html',
})

export class DialogSerialPortsList implements OnDestroy {
    @Input() ports      : Array<string> = [];
    @Input() handler    : Function      = null;

    private _scanning: boolean = false;

    constructor() {
        this._onScanTrigger     = this._onScanTrigger.bind(this);
        this._onScanStatistic   = this._onScanStatistic.bind(this);
        this._onScanFinish      = this._onScanFinish.bind(this);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SERIAL_SCAN_STATISTIC_COME, this._onScanStatistic);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SERIAL_SCAN_FINISHED, this._onScanFinish);
    }

    ngOnDestroy(){
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.SERIAL_SCAN_STATISTIC_COME, this._onScanStatistic);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.SERIAL_SCAN_FINISHED, this._onScanFinish);
        this._stopScanning();
    }

    _onScanStatistic(statistic: any){
        if (typeof statistic !== 'object' || statistic === null) {
            return false;
        }
        Object.keys(statistic).forEach((name: string) => {
            this.ports = this.ports.map((port: any) => {
                if (port.name === name) {
                    port.received = statistic[name];
                }
                return port;
            });
        });
    }

    _onScanFinish(statistic: any){
        this._scanning = false;
    }

    _onScanTrigger(){
        if (!this._scanning) {
            this.ports = this.ports.map((port) => {
                return Object.assign({ received: 0 }, port);
            });
            APIProcessor.send(
                APICommands.scanPorts,
                {},
                (response : APIResponse, error: Error) =>{
                    if (error !== null){
                        return false;
                    }
                    if (response.code !== 0 || !(response.output instanceof Array)){
                        return false;
                    }
                    this._scanning = true;
                }
            );
        } else {
            this._stopScanning();
        }
    }

    _stopScanning(){
        APIProcessor.send(
            APICommands.stopScanPorts,
            {},
            (response : APIResponse, error: Error) =>{
                if (error !== null){
                    return false;
                }
                if (response.code !== 0){
                    return false;
                }
                this._scanning = false;
            }
        );
    }

    onSelect(portID: string, settings: boolean){
        typeof this.handler === 'function' && this.handler(portID, settings);
    }

}
