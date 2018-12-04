import {Component, Input, ChangeDetectorRef, OnInit                     } from '@angular/core';
import { ParserClass, ParserData, ParserDataIndex, ParsedResultIndexes  } from '../../../../modules/parsers/controller.data.parsers.tracker.inerfaces';
import { Manager, DEFAULTS                                              } from '../../../../modules/parsers/controller.data.parsers.tracker.manager';
import { GUID                                                           } from '../../../../modules/tools.guid';

@Component({
    selector    : 'chart-edit-rules-targets-dialog',
    templateUrl : './template.html',
})

export class ChartEditRulesNumericDialog implements OnInit {

    @Input() callback           : Function      = null;
    @Input() GUID               : string        = null;

    private manager             : Manager       = new Manager();
    private sets                : any           = {};

    public data                 : ParserData    = null;
    public targets              : Array<Object> = [];
    public values               : Array<Object> = [];
    public clearing             : Array<Object> = [];
    public name                 : string        = '';
    public errors               : Array<string> = [];

    ngOnInit(){
        if (this.GUID !== null && this.sets[this.GUID] !== void 0){
            this.data       = this.sets[this.GUID];
            ['targets', 'values', 'clearing'].forEach((target)=>{
                this[target]   = this.data[target].map((value: string)=>{
                    return {
                        GUID : GUID.generate(),
                        value: value
                    }
                });
            });
            this.name           = this.data.name;
        } else {
            this.data = {
                name        : '',
                targets     : [],
                values      : [],
                clearing    : [],
                lineColor   : DEFAULTS.LINE_COLOR,
                textColor   : DEFAULTS.TEXT_COLOR,
                active      : true,
            };
            ['targets', 'values', 'clearing'].forEach((target)=>{
                this[target]    = [];
            });
            this.name           = '';
        }
    }

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.changeDetectorRef          = changeDetectorRef;
        this.onNameChange               = this.onNameChange.    bind(this);
        this.onApply                    = this.onApply.         bind(this);
        this.onAddNew                   = this.onAddNew.        bind(this);
        this.onRemove                   = this.onRemove.        bind(this);

        //Load available sets
        this.sets = this.manager.load();
        this.sets = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    getErrorMessages(){
        if (this.name === ''){
            this.errors.push('Name of sets cannot be empty. Please define some name.');
        }
        // Clearing could be empty
        ['targets', 'values'].forEach((target)=>{
            if (this[target].length > 0){
                this[target].forEach((smth: any)=>{
                    smth.value.trim() === '' && this.errors.push('You cannot define empty ' + target + ' RegExp.');
                });
            } else {
                this.errors.push('You should define at least one ' + target + ' RegExp.');
            }
        });
    }


    save(){
        this.data.name      = this.name;
        ['targets', 'values', 'clearing'].forEach((target)=>{
            this.data[target] = this[target].map((smth: any)=>{
                return smth.value;
            });
        });
        return Object.assign({}, this.data);
    }

    onApply(){
        this.getErrorMessages();
        if (this.errors.length === 0){
            typeof this.callback === 'function' && this.callback(this.save());
        } else {

        }
    }

    onErrorsReset(){
        this.errors = [];
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Name
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    onNameChange(event: KeyboardEvent){
        this.name = event.target['value'];
    }


    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Common
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    isEmptyAnyWhere(target: string){
        let result = false;
        this[target].forEach((item: any, i: number)=>{
            item['value'].trim() === '' && (result = true);
        });
        return result;
    }

    getIndexByGUID(target: string, GUID: string){
        let index = -1;
        this[target].forEach((item: any, i: number)=>{
            item['GUID'] === GUID && (index = i);
        });
        return index;
    }

    onAddNew(target: string){
        if (!this.isEmptyAnyWhere(target)){
            this[target].push({
                GUID : GUID.generate(),
                value: ''
            });
        }
    }

    onRemove(target: string, GUID: string){
        let index = this.getIndexByGUID(target, GUID);
        if (~index){
            this[target].splice(index, 1);
        }
    }

    onChange(target: string, GUID: string, event: KeyboardEvent){
        let index = this.getIndexByGUID(target, GUID);
        ~index && (this[target][index]['value'] = event.target['value']);
    }

    onBlur(target: string, GUID: string, event: KeyboardEvent){
        if (this[target].length > 1){
            typeof event.target['value'] === 'string' && (event.target['value'].trim() === '' && this.onRemove(target, GUID));
        }
    }

}
