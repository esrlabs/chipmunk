import {Component, Input, ChangeDetectorRef, OnInit                     } from '@angular/core';
import { ParserClass, ParserData, ParserDataIndex, ParsedResultIndexes  } from '../../../../modules/parsers/controller.data.parsers.tracker.inerfaces';
import { Manager, DEFAULTS                                              } from '../../../../modules/parsers/controller.data.parsers.tracker.manager';
import { GUID                                                           } from '../../../../modules/tools.guid';

@Component({
    selector    : 'chart-edit-rules-segments-dialog',
    templateUrl : './template.html',
})

export class ChartEditRulesSegmentsDialog implements OnInit{
    @Input() callback           : Function      = null;
    @Input() GUID               : string        = null;

    private manager             : Manager       = new Manager();
    private sets                : any           = {};

    public data                 : ParserData    = null;
    public segments             : Array<Object> = [];
    public values               : Array<Object> = [];
    public clearing             : Array<Object> = [];
    public indexes              : Array<Object> = [];
    public name                 : string        = '';
    public errors               : Array<string> = [];

    ngOnInit(){
        if (this.GUID !== null && this.sets[this.GUID] !== void 0){
            this.data       = this.sets[this.GUID];
            ['segments', 'values', 'clearing'].forEach((target)=>{
                this[target]   = this.data[target].map((value: string)=>{
                    return {
                        GUID : GUID.generate(),
                        value: value
                    }
                });
            });
            this.indexes        = Object.keys(this.data.indexes).map((key: string)=>{
                return {
                    GUID : GUID.generate(),
                    value: this.data.indexes[key].value,
                    index: this.data.indexes[key].index,
                    label: this.data.indexes[key].label
                }
            });
            this.name           = this.data.name;
        } else {
            this.data = {
                name        : '',
                segments    : [],
                values      : [],
                clearing    : [],
                lineColor   : DEFAULTS.LINE_COLOR,
                textColor   : DEFAULTS.TEXT_COLOR,
                active      : true,
                indexes     : null
            };
            ['segments', 'values', 'clearing'].forEach((target)=>{
                this[target]    = [];
            });
            this.indexes        = [];
            this.name           = '';
        }
    }

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.changeDetectorRef          = changeDetectorRef;
        this.onNameChange               = this.onNameChange.             bind(this);
        this.onApply                    = this.onApply.             bind(this);
        this.onAddNew                   = this.onAddNew.            bind(this);
        this.onRemove                   = this.onRemove.            bind(this);
        this.onAddNewIndex              = this.onAddNewIndex.       bind(this);
        this.onRemoveIndex              = this.onRemoveIndex.       bind(this);
        this.onIndexHookChange          = this.onIndexHookChange.   bind(this);
        this.onIndexIndexChange         = this.onIndexIndexChange.  bind(this);
        this.onIndexLabelChange         = this.onIndexLabelChange.  bind(this);

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
        ['segments', 'values', 'clearing'].forEach((target)=>{
            if (this[target].length > 0){
                this[target].forEach((smth: any)=>{
                    smth.value.trim() === '' && this.errors.push('You cannot define empty ' + target + ' RegExp.');
                });
            } else {
                this.errors.push('You should define at least one ' + target + ' RegExp.');
            }
        });

        if (this.indexes.length > 0){
            let history = {
                indexes: {},
                labels : {},
                values : {}
            };
            this.indexes.forEach((index: any)=>{
                if (index.value.trim()  === ''){
                    this.errors.push('You should define for index some value (hook). Define it or remove not valid index.');
                }
                if (index.label.trim()  === ''){
                    this.errors.push('You should define for index some label (will be shown on chart). Define it or remove not valid index.');
                }
                if (index.index < 0){
                    this.errors.push('Use as index number >= 0');
                }
                if (history.indexes[index.index] !== void 0){
                    this.errors.push('You have same value of index for several indexes. Check next index: ' + JSON.stringify(index));
                }
                history.indexes[index.index] = true;
                if (history.labels[index.label] !== void 0){
                    this.errors.push('You have same label for several indexes. Check next index: ' + JSON.stringify(index));
                }
                history.labels[index.label] = true;
                if (history.values[index.value] !== void 0){
                    this.errors.push('You have same value (hook) for several indexes. Check next index: ' + JSON.stringify(index));
                }
                history.values[index.value] = true;
            });
        } else {
            this.errors.push('You should define at least one index. Indexes - definition of data, which will be render on chart.');
        }
    }


    save(){
        this.data.name      = this.name;
        ['segments', 'values', 'clearing'].forEach((target)=>{
            this.data[target] = this[target].map((smth: any)=>{
                return smth.value;
            });
        });
        this.data.indexes   = {};
        this.indexes.forEach((index: any)=>{
            this.data.indexes[index.value] = {
                value: index.value,
                index: index.index,
                label: index.label
            };
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

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Indexes
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    getIndexIndexByGUID(GUID: string){
        let index = -1;
        this.indexes.forEach((test, i)=>{
            test['GUID'] === GUID && (index = i);
        });
        return index;
    }

    onAddNewIndex(){
        this.indexes.push({
            GUID : GUID.generate(),
            value: '',
            index: 0,
            label: ''
        });
    }

    onRemoveIndex(GUID: string){
        let index = this.getIndexIndexByGUID(GUID);
        if (~index){
            this.indexes.splice(index, 1);
        }
    }

    onIndexHookChange(GUID: string, event: KeyboardEvent){
        let index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['value'] = event.target['value']);
    }

    onIndexIndexChange(GUID: string, event: KeyboardEvent){
        let index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['index'] = event.target['value']);
    }

    onIndexLabelChange(GUID: string, event: KeyboardEvent){
        let index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['label'] = event.target['value']);
    }
}
