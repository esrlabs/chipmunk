import {Component, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnInit, AfterViewChecked, OnDestroy } from '@angular/core';

import { dataController                         } from '../../../core/modules/controller.data';
import { Logs, TYPES as LogTypes                } from '../../../core/modules/tools.logs';
import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';
import { GUID                                   } from '../../../core/modules/tools.guid';

import { ViewInterface                          } from '../../../core/interfaces/interface.view';
import { DataRow                                } from '../../../core/interfaces/interface.data.row';
import { EVENT_DATA_IS_UPDATED                  } from '../../../core/interfaces/events/DATA_IS_UPDATE';

import { ViewSizeClassInt as Size               } from '../../../core/services/class.view.size';

import { D3Controller                           } from '../../../core/components/common/d3/D3.series';

import { ChartData, ChartDataItem               } from '../../../core/components/common/d3/interface.chart.data';

import { Manager                                } from '../../../core/modules/parsers/controller.data.parsers.tracker.manager';
import { ParsedResultIndexes                    } from '../../../core/modules/parsers/controller.data.parsers.tracker.inerfaces';
import { TabController                          } from '../class.tab.controller';


const OFFSET_DIRECTION = {
    RIGHT : Symbol(),
    LEFT  : Symbol()
};
/**
     lineColors  : { [key: string]: string },
    textColors  : { [key: string]: string },
    data        : { [key: string]: ChartDataItem[] },
    start       : Date,
    end         : Date,
    min         : number,
    max         : number
 * 
 */


class RowsData {
    data        : { [key: string]: ChartDataItem[] } = {};
    textColors  : { [key: string]: string } = {};
    lineColors  : { [key: string]: string } = {};
    start       : Date      = null;
    end         : Date      = null;
    min         : number    = Infinity;
    max         : number    = -1
}

@Component({
    selector        : 'view-controller-chart',
    templateUrl     : './template.html',
})

export class ViewControllerTabChart extends TabController implements ViewInterface, OnInit, AfterViewChecked, OnDestroy {
    @ViewChild ('svg', { read: ViewContainerRef}) svg: ViewContainerRef;

    public size         : Size = {
        width : 100,
        height: 100
    };

    private D3          : D3Controller  = null;
    private rows        : ChartData     = null;
    private _rows       : Array<DataRow>= [];
    private manager     : Manager       = new Manager();
    private sets        : any           = null;
    private active      : boolean       = true;
    public  GUID        : string        = GUID.generate();

    private selection   : {
        own     : boolean,
        index   : number
    } = {
        own     : false,
        index   : -1
    };

    ngOnInit(){
        //this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.onSelect   .subscribe(this.onTabSelected);
        this.onDeselect .subscribe(this.onTabDeselected);
        this.onResize   .subscribe(this.onResizeHandle);

    }

    ngAfterViewChecked(){
        if (this.active){
            this.onWindowResize();
            if (this.D3 === null && this._rows.length === 0){
                //this.onDATA_IS_UPDATED(new EVENT_DATA_IS_UPDATED(dataController.getRows()), false);
            }
            if (this.D3 === null && this.svg !== void 0){
                this.initD3Controller();
            }
        }
    }

    ngOnDestroy(){
        this.D3 !== null && this.D3.destroy();
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED,
            Configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_STYLE_UPDATED].forEach((handle)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Tab functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onTabSelected(){
        this.active = true;
        this.ngAfterViewChecked();
        this.forceUpdate();
    }

    onTabDeselected(){
        this.active = false;
        this.D3 !== null && this.D3.destroy();
        this.D3 = null;
    }

    onResizeHandle(){
        this.forceUpdate();
    }

    onWindowResize(){
        if (this.active){
            let size            = this.viewContainerRef.element.nativeElement.getBoundingClientRect();
            this.size.height    = size.height;
            this.size.width     = size.width;
            this.D3 !== null && this.D3.resize();
        }
    }

    initD3Controller(){
        if (this.active && this.rows.start !== null && this.rows.end !== null){
            this.D3 === null && (this.D3 = new D3Controller('svg[id="' + this.GUID + '"]', this.onSelectChart.bind(this)));
            this.D3.onData(this.rows);
        }
    }

    forceUpdate(){
        this.active && this.changeDetectorRef.detectChanges();
    }

    forceUpdateD3(){
        this.active && (this.D3 !== null && this.D3.onData(this.rows));
    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        super();
        this.onTabSelected      = this.onTabSelected.   bind(this);
        this.onTabDeselected    = this.onTabDeselected. bind(this);
        this.onResizeHandle     = this.onResizeHandle.  bind(this);
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED,
            Configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_STYLE_UPDATED].forEach((handle)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        //Load available sets
        this.loadSets();
    }

    loadSets(){
        this.sets = this.manager.load();
        this.sets = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
    }

    isAnySets(){
        return Object.keys(this.sets).length > 0 ? (this.rows === null ? false : (Object.keys(this.rows.data).length > 0)) : false;
    }

    initRowsData(){
        if (this.rows === null){
            this.resetRowsDate();
        }
    }

    resetRowsDate(){
        this.rows = new RowsData();
    }

    updateTimeBorders(){
        if (this.rows !== null){
        }
    }

    onSelectChart(datetime : Date){
        if (this._rows instanceof Array){
            const position = datetime.getTime();
            if (position >= 0 && position <= this._rows.length - 1){
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, position, this.viewParams.GUID);
            }
        }
    }

    parseData(source : Array<DataRow>, dest: RowsData, offset: number = 0){
        source.map((row: DataRow, index)=>{
            if (row.parsed !== void 0 && row.parsed.tracks !== null && typeof row.parsed.tracks === 'object'){
                const datetime = new Date(index + offset);
                Object.keys(this.sets).forEach((GUID)=>{
                    if (this.sets[GUID].active && row.parsed.tracks[GUID] instanceof Array && row.parsed.tracks[GUID].length > 0){
                        dest.data[GUID] === void 0 && (dest.data[GUID] = []);
                        row.parsed.tracks[GUID].forEach((index: ParsedResultIndexes)=>{
                            dest.data[GUID].push({
                                datetime    : datetime,
                                value       : index.index,
                                key         : index.label
                            });
                            dest.end                                = datetime;
                            dest.start === null     && (dest.start  = datetime);
                            dest.min > index.index  && (dest.min    = index.index);
                            dest.max < index.index  && (dest.max    = index.index);
                        });
                    }
                });
            }
        });
        dest.textColors = {};
        dest.lineColors = {};
        Object.keys(this.sets).forEach((GUID)=>{
            dest.textColors[GUID] = this.sets[GUID].textColor;
            dest.lineColors[GUID] = this.sets[GUID].lineColor;
        });
        return dest;
    }

    onDATA_IS_UPDATED(event : EVENT_DATA_IS_UPDATED, updateD3 = true){
        if (event.rows instanceof Array && event.rows.length > 0){
            let measure = Logs.measure('[view.chart][onDATA_IS_UPDATED]');
            this.resetRowsDate();
            this._rows  = event.rows.slice();
            this.rows   = this.parseData(event.rows, this.rows);
            this.forceUpdate();
            updateD3 && this.forceUpdateD3();
            Logs.measure(measure);
        }
    }

    onDATA_FILTER_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
        }
    }

    onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[view.chart][onDATA_IS_MODIFIED]'),
                rows    = new RowsData();
            rows        = this.parseData(event.rows, rows, this._rows.length);
            this._rows.push(...event.rows);
            if (Object.keys(rows.data).length === 0) {
                return;
            }
            this.initRowsData();
            Object.keys(rows.lineColors).forEach((key: string) => {
                this.rows.lineColors[key] = rows.lineColors[key];
            });
            Object.keys(rows.textColors).forEach((key: string) => {
                this.rows.textColors[key] = rows.textColors[key];
            });
            Object.keys(this.rows.data).forEach((key)=>{
                if (rows.data[key] !== void 0){
                    this.rows.data[key].push(...rows.data[key]);
                }
            });
            Object.keys(rows.data).forEach((key)=>{
                if (this.rows.data[key] === void 0){
                    this.rows.data[key] = rows.data[key];
                }
            });
            this.rows.start = this.rows.start === null ? rows.start : this.rows.start;
            this.rows.max   = this.rows.max > rows.max ? this.rows.max : rows.max;
            this.rows.min   = this.rows.min < rows.min ? this.rows.min : rows.min;
            this.rows.end   = rows.end;
            this.forceUpdate();
            this.forceUpdateD3();
            Logs.measure(measure);
        }
    }

    onCHART_VIEW_CHARTS_UPDATED(needsParsing: boolean = true){
        this.loadSets();
        needsParsing && dataController.updateForParsers();
        //this.onDATA_IS_UPDATED(new EVENT_DATA_IS_UPDATED(dataController.getRows()), true);
    }

    onCHART_VIEW_CHARTS_STYLE_UPDATED(){
        this.onCHART_VIEW_CHARTS_UPDATED(false);
    }

    getTimestampByIndex(index: number, offset: symbol):Date{
        let result = null;
        if (index >= 0 && index <= this._rows.length - 1){
            return new Date(index);
            /*
            switch (offset){
                case OFFSET_DIRECTION.LEFT:
                    return this.getTimestampByIndex(index - 1, offset);
                case OFFSET_DIRECTION.RIGHT:
                    return this.getTimestampByIndex(index + 1, offset);
            }
            */
        } else {
            
        }
        return result;
    }

    onROW_IS_SELECTED(index : number, GUID : string){
        if (this.viewParams.GUID !== GUID){
            if (this.D3 !== null && this._rows instanceof Array){
                let selected = null;
                selected === null && (selected = this.getTimestampByIndex(index,   OFFSET_DIRECTION.LEFT));
                selected === null && (selected = this.getTimestampByIndex(index,   OFFSET_DIRECTION.RIGHT));
                if (selected !== null){
                    this.D3.goToPosition(selected);
                }
            }
        }
    }

}
