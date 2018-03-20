import {Component, Input, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonInput                } from '../../input/component';
import {KEYs, localSettings} from "../../../../modules/controller.localsettings";

class StorageController {

    defaults(): Array<string>{
        return [];
    }

    load(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.terminal] !== void 0 && settings[KEYs.terminal] !== null && settings[KEYs.terminal].history !== void 0){
            return settings[KEYs.terminal].history;
        } else {
            return this.defaults();
        }
    }

    save(histroy: Array<string>){
        if (histroy instanceof Array){
            localSettings.set({
                [KEYs.terminal] : {
                    history : histroy
                }
            });
        }
    }

}

@Component({
    selector    : 'dialog-terminalstream-settings',
    templateUrl : './template.html',
})

export class DialogTerminalStreamOpen implements AfterViewChecked{
    @Input() alias      : string        = '';
    @Input() path       : string        = '';
    @Input() keywords   : string        = '';
    @Input() proceed    : Function      = null;
    @Input() cancel     : Function      = null;

    @ViewChild('_alias'     ) _alias    : CommonInput;
    @ViewChild('_keywords'  ) _keywords : CommonInput;
    @ViewChild('_path'      ) _path     : CommonInput;

    private history: Array<string> = [];
    private historyCursor: number = -1;
    private storage: StorageController = new StorageController();
    private _focused: boolean = false;

    constructor() {
        this.onProceed = this.onProceed.bind(this);
        this.history = this.storage.load();
    }

    ngAfterViewChecked(){
        if (!this._focused && this._alias !== null){
            this._alias.setFocus();
            this._focused = true;
        }
    }

    onProceed(){
        const cmd = this._alias.getValue();
        if (cmd.trim() === '') {
            return false;
        }
        this.history.push(cmd);
        this.storage.save(this.history);
        this.proceed({
            alias       : cmd,
            keywords    : this._keywords.getValue(),
            path        : this._path.getValue()
        });
    }

    onKeyUp(event: KeyboardEvent, value: string){

        switch (event.keyCode){
            case 38:
                this.historyCursor += 1;
                if (this.historyCursor > (this.history.length - 1)) {
                    this.historyCursor = this.history.length - 1;
                }
                this.history[this.historyCursor] !== void 0 && this._alias.setValue(this.history[this.historyCursor]);
                break;
            case 40:
                this.historyCursor -= 1;
                if (this.historyCursor < 0) {
                    this.historyCursor = 0;
                }
                this.history[this.historyCursor] !== void 0 && this._alias.setValue(this.history[this.historyCursor]);
                break;
            case 13:
                this.onProceed();
        }
    }

}
