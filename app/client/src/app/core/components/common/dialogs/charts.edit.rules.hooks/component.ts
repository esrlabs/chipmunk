import {Component, Input, ChangeDetectorRef, OnInit                     } from '@angular/core';
import { ParserClass, ParserData, ParserDataIndex, ParsedResultIndexes  } from '../../../../modules/parsers/controller.data.parsers.tracker.inerfaces';
import { Manager, DEFAULTS                                              } from '../../../../modules/parsers/controller.data.parsers.tracker.manager';
import { GUID                                                           } from '../../../../modules/tools.guid';

@Component({
    selector    : 'chart-edit-rules-hooks-dialog',
    templateUrl : './template.html',
})

export class ChartEditRulesHooksDialog implements OnInit{
    @Input() callback           : Function      = null;
    @Input() GUID               : string        = null;

    private manager             : Manager       = new Manager();
    private sets                : any           = {};

    public data                 : ParserData    = null;
    public tests                : Array<Object> = [];
    public indexes              : Array<Object> = [];
    public name                 : string        = '';
    public errors               : Array<string> = [];

    ngOnInit(){
        if (this.GUID !== null && this.sets[this.GUID] !== void 0){
            this.data       = Object.assign({}, this.sets[this.GUID]);
            this.tests      = this.data.tests.map((value)=>{
                return {
                    GUID : GUID.generate(),
                    value: value
                }
            });
            this.indexes    = Object.keys(this.data.indexes).map((key: string)=>{
                return {
                    GUID : GUID.generate(),
                    value: this.data.indexes[key].value,
                    index: this.data.indexes[key].index,
                    label: this.data.indexes[key].label
                }
            });
            this.name       = this.data.name;
        } else {
            this.data = {
                name        : '',
                tests       : [],
                lineColor   : DEFAULTS.LINE_COLOR,
                textColor   : DEFAULTS.TEXT_COLOR,
                active      : true,
                indexes     : null
            };
            this.tests      = [];
            this.indexes    = [];
            this.name       = '';
        }
    }

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.changeDetectorRef          = changeDetectorRef;
        this.onApply                    = this.onApply.             bind(this);
        this.onNameChange               = this.onNameChange.        bind(this);
        this.onAddNewTest               = this.onAddNewTest.        bind(this);
        this.onRemoveTest               = this.onRemoveTest.        bind(this);
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
        if (this.tests.length > 0){
            this.tests.forEach((test: any)=>{
                test.value.trim() === '' && this.errors.push('You cannot define empty test RegExp. Please, remove empty one or define some RegExp for it.');
            });
        } else {
            this.errors.push('You should define at least one test RegExp. Without test-RegExp we cannot detect data in stream, which has necessary values for chart.');
        }
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
        this.data.tests     = this.tests.map((test: any)=>{
            return test.value;
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
    * Tests
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    isEmptyAnyWhere(){
        let result = false;
        this.tests.forEach((test, i)=>{
            test['value'].trim() === '' && (result = true);
        });
        return result;
    }

    getTestIndexByGUID(GUID: string){
        let index = -1;
        this.tests.forEach((test, i)=>{
            test['GUID'] === GUID && (index = i);
        });
        return index;
    }

    onAddNewTest(){
        if (!this.isEmptyAnyWhere()){
            this.tests.push({
                GUID : GUID.generate(),
                value: ''
            });
        }
    }

    onRemoveTest(GUID: string){
        let index = this.getTestIndexByGUID(GUID);
        if (~index){
            this.tests.splice(index, 1);
        }
    }

    onTestChange(GUID: string, event: KeyboardEvent){
        let index = this.getTestIndexByGUID(GUID);
        ~index && (this.tests[index]['value'] = event.target['value']);
    }

    onTestBlur(GUID: string, event: KeyboardEvent){
        if (this.tests.length > 1){
            typeof event.target['value'] === 'string' && (event.target['value'].trim() === '' && this.onRemoveTest(GUID));
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
