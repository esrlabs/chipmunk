import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnDestroy, EventEmitter, AfterViewChecked } from '@angular/core';
import { DomSanitizer                           } from '@angular/platform-browser';
import { ViewControllerPattern                  } from '../controller.pattern';
import { Logs, TYPES as LogTypes                } from '../../core/modules/tools.logs';
import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';
import { ViewInterface                          } from '../../core/interfaces/interface.view';
import { ViewClass                              } from '../../core/services/class.view';
import { ViewControllerQuickchartChart          } from './chart/component';
import { IChartSettings                         } from './chart/component';
import { ViewControllerQuickchartBar            } from './topbar/component';
import { dataController                         } from '../../core/modules/controller.data'
import { MODES                                  } from '../../core/modules/controller.data.search.modes';
import { EVENT_DATA_IS_UPDATED                  } from '../../core/interfaces/events/DATA_IS_UPDATE';
import { DataRow                                } from '../../core/interfaces/interface.data.row';
import { ChartData, ChartDataItem               } from '../../core/components/common/d3/interface.chart.data';
import { TFiltersMatches, TMatches              } from '../../workers/data.processor.interfaces.js';
import { GUID                                   } from '../../core/modules/tools.guid';
import { isValidRegExp, safelyCreateRegExp      } from '../../core/modules/tools.regexp';
import { localSettings, KEYs                    } from '../../core/modules/controller.localsettings';
import { DialogMessage                          } from "../../core/components/common/dialogs/dialog-message/component";
import { popupController                        } from "../../core/components/common/popup/controller";

export type TRule = { name: string; reg: string; regExp: RegExp | null, id: string };
export type TRules = { [key: string]: TRule };
export type TTimeframe = { end: number, start: number };
export type TCase = { color: string; visibility: boolean, name: string, rule: string, chartAlias: string };
export type TCases = { [key: string]: TCase };

interface IQuickChatSettings {
    rules: TRules
}

class ChartDataImplementation {
    data        : { [key: string]: ChartDataItem[] } = {};
    textColors  : { [key: string]: string } = {};
    lineColors  : { [key: string]: string } = {};
    start       : Date      = new Date(0);
    end         : Date      = new Date(0);
    min         : number    = Infinity;
    max         : number    = -1

    constructor(src?: ChartDataImplementation) {
        if (src instanceof ChartDataImplementation) {
            this.data = Object.assign({}, src.data);
            this.textColors = Object.assign({}, src.textColors);
            this.lineColors = Object.assign({}, src.lineColors);
            this.start = src.start;
            this.end = src.end;
            this.min = src.min;
            this.max = src.max;
        }
    }
}

class SettingsController {

    defaults(): IQuickChatSettings {
        return {
            rules: {}
        };
    }

    load(): IQuickChatSettings{
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.quickchat] !== void 0 && settings[KEYs.quickchat] !== null){
            return settings[KEYs.quickchat];
        } else {
            return this.defaults();
        }
    }

    save(settings: IQuickChatSettings){
        localSettings.reset(KEYs.quickchat, 'update');
        localSettings.set({
            [KEYs.quickchat] : settings
        });
    }

}

@Component({
    selector        : 'view-controller-quickchart',
    templateUrl     : './template.html',
})

export class ViewControllerQuickChart extends ViewControllerPattern implements ViewInterface, OnInit, OnDestroy, AfterViewChecked {

    public viewParams: ViewClass = null;

    @ViewChild('chart') chartCom : ViewControllerQuickchartChart;

    private _chartGUID: string = GUID.generate();
    private _chartListIsOpened: boolean = false;
    private _rows: DataRow[] = [];
    private _rules: TRules = { };
    private _charts: ChartDataImplementation = new ChartDataImplementation();
    private _storedCharts: ChartDataImplementation = null;
    private _timeframe: TTimeframe = { end: 0, start: 0 };
    private _storedTimeframe: TTimeframe = null;
    private _settings: SettingsController = new SettingsController();
    private _cases: TCases = {};
    private _storedCases: TCases = {};
    private _chartSettings: IChartSettings= {
        isSmooth: false,
        isLabels: false
    };

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef,
        private sanitizer                   : DomSanitizer
    ){
        super();
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED].forEach((handle)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.onRemoveRule = this.onRemoveRule.bind(this);
        this.onHideCase = this.onHideCase.bind(this);
        this.onColorChange = this.onColorChange.bind(this);
        this.onSelectOnChart = this.onSelectOnChart.bind(this);
        this.onRuleVisibility = this.onRuleVisibility.bind(this);
        this.onCaseVisibility = this.onCaseVisibility.bind(this);
        this.onRemoveAllRules = this.onRemoveAllRules.bind(this);
        this.onHideAllCases = this.onHideAllCases.bind(this);
        this.onChartSmooth = this.onChartSmooth.bind(this);
        this.onChartLabels = this.onChartLabels.bind(this);
        this.onInvertCases = this.onInvertCases.bind(this);
        this._loadRules();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Angular
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    ngOnInit(){
        this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.viewParams !== null && this._addTopBar();
        this._rows = dataController.getRows();
        this._updateChartsDateFromRows(this._rows);
    }

    ngOnDestroy(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED].forEach((handle)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    ngAfterViewChecked(){
        super.ngAfterViewChecked();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Settings
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _loadRules() {
        const settings: IQuickChatSettings = this._settings.load();
        Object.keys(settings.rules).forEach((alias: string) => {
            if (settings.rules[alias].regExp instanceof RegExp) {
                return;
            }
            settings.rules[alias].regExp = safelyCreateRegExp(settings.rules[alias].reg);
        });
        this._rules = settings.rules;
    }

    private _saveRules() {
        this._settings.save({
            rules: this._rules
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Request manage
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    private _onChartsListTrigger() {
        this._chartListIsOpened = !this._chartListIsOpened;
    }

    private onRemoveRule(rule: TRule) {
        if (this._rules[rule.id] === void 0) {
            return Events.trigger(Configuration.sets.SYSTEM_EVENTS.CREATE_NOTIFICATION, {
                caption: 'Error',
                message: `Cannot find rule "${rule.name}"`,
            });
        }
        delete this._rules[rule.id];
        const chartAliases = this._getChartAliases(rule.id);
        chartAliases.forEach((charAlias: string) => {
            delete this._charts.lineColors[charAlias];
            delete this._charts.textColors[charAlias];
            delete this._charts.data[charAlias];
            delete this._cases[charAlias];
        });
        this._saveRules();
        this._updateChartView();
    }

    private onHideCase(casse: TCase) {

    }

    private _getChartAliases(ruleId: string): string[] {
        return Object.keys(this._cases).map((chartAlias: string) => {
            return chartAlias.indexOf(ruleId) !== -1 ? chartAlias : null;
        }).filter((alias: string | null) => {
            return alias !== null;
        });
    }

    private onColorChange(casse: TCase){
        if (this._charts.lineColors[casse.chartAlias] === void 0) {
            return;
        }
        this._charts.lineColors[casse.chartAlias] = casse.color;
        this._charts.textColors[casse.chartAlias] = casse.color;
        this._cases[casse.chartAlias].color = casse.color;
        this._updateChartView();
    }

    private onCaseVisibility(casse: TCase) {
        this._cases[casse.chartAlias].visibility = !this._cases[casse.chartAlias].visibility;
        this._rebuildCharts();
    }

    private onRuleVisibility(rule: TRule) {
        const chartAliases = this._getChartAliases(rule.id);
        chartAliases.forEach((chartAlias: string) => {
            this._cases[chartAlias].visibility = !this._cases[chartAlias].visibility;
        });
        this._rebuildCharts();
    }

    private onRemoveAllRules() {
        if (Object.keys(this._rules).length === 0) {
            return;
        }
        let guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message: `All your regular expressions will be removed. Are you sure?`,
                    buttons: [
                        {
                            caption: 'Yes, remove it',
                            handle : () => {
                                this._resetChartData();
                                this._rules = {};
                                this._cases = {};
                                this._rebuildCharts();
                                this._saveRules();
                                popupController.close(guid);
                            }
                        },
                        {
                            caption: 'No, keep it',
                            handle : ()=>{
                                popupController.close(guid);
                            }
                        }
                    ]
                }
            },
            title   : 'Confirmation',
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '10rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : guid
        });
    }

    private onHideAllCases() {
        Object.keys(this._cases).forEach((chartAlias: string) => {
            this._cases[chartAlias].visibility = false;
        });
        this._rebuildCharts();
    }

    private onInvertCases() {
        Object.keys(this._cases).forEach((chartAlias: string) => {
            this._cases[chartAlias].visibility = !this._cases[chartAlias].visibility;
        });
        this._rebuildCharts();
    }

    private onChartSmooth(isSmooth: boolean) {
        this._chartSettings.isSmooth = isSmooth;
        if (this.chartCom === null || this.chartCom === void 0) {
            return;
        }
        this.chartCom.updateSettings(this._chartSettings);
    }

    private onChartLabels(isLabels: boolean) {
        this._chartSettings.isLabels = isLabels;
        if (this.chartCom === null || this.chartCom === void 0) {
            return;
        }
        this.chartCom.updateSettings(this._chartSettings);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Chart requests processing (top bar)
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _addTopBar() {
        Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_INJECT_COMPONENT, this.viewParams.GUID, {
            component: ViewControllerQuickchartBar,
            params: {
                onRequestHandler: this._onRequestPosted.bind(this),
                onAcceptHandler: this._onAcceptRequest.bind(this),
                onResetHandler: this._onResetRequest.bind(this)
            },
            inputs: { }
        });
    }

    private _onAcceptRequest(value: string) {
        this._restoreChartData();
        const name: string = GUID.generate();
        this._rules[name] = {
            id: name,
            reg: value,
            regExp: safelyCreateRegExp(value),
            name: value
        };
        this._saveRules();
        this._refreshForRule(name);
    }

    private _onResetRequest() {
        this._restoreChartData() && this._updateChartView();

    }

    private _onRequestPosted(value: string) {
        if (value.trim() === '') {
            this._restoreChartData() && this._updateChartView();
            return;
        }
        if (!isValidRegExp(value)) {
            return Events.trigger(Configuration.sets.SYSTEM_EVENTS.CREATE_NOTIFICATION, {
                caption: 'Error',
                message: `Value "${value}" cannot be used as regular expression`,
            });
        }
        const alias: string = 'requested';
        dataController.getMatch({ [alias]: { 
            value: value,
            mode: MODES.REG
        }}).then((results: TFiltersMatches) => {
            this._showRequestedChart(results[alias], value, alias);
        }).catch((error) => {
            Logs.msg(`Processing of chart for quickchart data finished with error: ${error.message}`);
        });
    }

    private _showRequestedChart(data: TMatches | undefined, reg: string, alias: string = 'requested') {
        this._storeChartData();
        this._resetChartData();
        if (typeof data === 'undefined') {
            return;
        }
        this._addEntriesToChart(data, alias, {
            id: alias,
            reg: reg,
            regExp: safelyCreateRegExp(reg),
            name: alias
        }, 0);
        this._updateChartView();
    }

    private _storeChartData(){
        this._storedCharts = new ChartDataImplementation(this._charts);
        this._storedTimeframe = Object.assign({}, this._timeframe);
        this._storedCases = Object.assign({}, this._cases);
    }

    private _resetChartData(resetCases: boolean = true) {
        this._charts = new ChartDataImplementation();
        this._timeframe.start = 0;
        this._timeframe.end = 0;
        resetCases && (this._cases = {});
    }

    private _restoreChartData(): boolean {
        if (this._storedCharts === null) { 
            return false;
        }
        this._charts = new ChartDataImplementation(this._storedCharts);
        this._timeframe = Object.assign({}, this._storedTimeframe);
        this._cases = Object.assign({}, this._storedCases);
        this._storedCharts = null;
        this._storedTimeframe = null;
        this._storedCases = null;
        return true;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Handeling data events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private onDATA_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array && event.rows.length > 0){
            let measure = Logs.measure('[view.quickchart][onDATA_IS_UPDATED]');
            this._resetChartData();
            this._rows  = event.rows.slice();
            this._updateChartsData(event);
            Logs.measure(measure);
        }
    }

    private onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[view.quickchart][onDATA_IS_MODIFIED]');
            const offset = this._rows.length;
            this._rows.push(...event.rows);
            this._updateChartsData(event, offset);
            Logs.measure(measure);
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Chart data processing
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _updateChartView(){
        this.chartCom && this.chartCom.update(this._charts);
    }

    private _refreshForRule(alias: string) {
        if (this._rules[alias] === void 0) {
            return;
        }
        const rule: TRule = this._rules[alias];
        dataController.getMatch({ 
            [alias]: {
                mode: MODES.REG,
                value: rule.reg
            }
        }).then((results: TFiltersMatches) => {
            if (results[alias] === void 0) {
                return;
            }
            this._addEntriesToChart(results[alias], alias, rule, 0);
            this._updateChartView();
        }).catch((error) => {
            Logs.msg(`Processing of chart for quickchart data finished with error: ${error.message}`);
        });

    }

    private _updateChartsDateFromRows(rows: DataRow[]) {
        this._updateChartsData(new EVENT_DATA_IS_UPDATED(rows));
    }

    private _updateChartsData(event : EVENT_DATA_IS_UPDATED, offset: number = -1) {
        const filters = {};
        Object.keys(this._rules).forEach((alias: string) => {
            filters[alias] = {
                mode: MODES.REG,
                value: this._rules[alias].reg
            };
        });
        dataController.getMatch(filters, (offset !== -1 ? event.fragment : undefined)).then((results: TFiltersMatches) => {
            Object.keys(results).forEach((alias: string) => {
                this._addEntriesToChart(results[alias], alias, this._rules[alias], offset !== -1 ? offset : 0);
            });
            this._updateChartView();
        }).catch((error) => {
            Logs.msg(`Processing of chart for quickchart data finished with error: ${error.message}`);
        });
    }

    private _addEntriesToChart(data: TMatches, alias: string, rule: TRule, offset: number) {
        Object.keys(data).forEach((position: number | string) => {
            position = offset + parseInt(position as string, 10);
            if (this._rows[position] === void 0) {
                return Logs.msg(`Wrong position for quickchart in results: ${position}`);
            }
            const str: string = this._rows[position].str;
            rule.regExp.lastIndex = 0;
            const res = rule.regExp.exec(str);
            if (res === null || res.length === 0) {
                return Logs.msg(`Cannot get a match for quickchart in position: ${position}`);
            }
            let value, name;
            let ruleId: string = rule.id;
            switch (res.length) {
                case 1: 
                case 2: 
                    value = res[1];
                    name = alias;
                    break;
                case 3: 
                    value = res[1];
                    name = res[2];
                    break;
            }
            value = parseFloat(value);
            if (!isFinite(value) || isNaN(value) || typeof value !== 'number') {
                return Logs.msg(`Unexpected value for quickchart in position: ${position}`);
            }
            this._addEntryToChart(name, value, position as number, ruleId);
        });
    }

    private _addEntryToChart(name: string, value: number, position: number, ruleId: string) {
        let chartAlias = `chart_${ruleId}_${name.replace(/[^\w]/gi, '')}`;
        if (this._cases[chartAlias] !== void 0 && !this._cases[chartAlias].visibility) {
            return;
        }
        if (this._charts.data[chartAlias] === void 0) {
            this._charts.data[chartAlias] = [];
            if (this._cases[chartAlias] === void 0) {
                this._cases[chartAlias] = {
                    rule: ruleId,
                    name: name,
                    chartAlias: chartAlias,
                    color: `rgb(${Math.round(Math.random() * 255)},${Math.round(Math.random() * 255)},${Math.round(Math.random() * 255)})`,
                    visibility: true
                };
            } 
            this._charts.lineColors[chartAlias] = this._cases[chartAlias].color;
            this._charts.textColors[chartAlias] = this._cases[chartAlias].color;
        }
        this._charts.data[chartAlias].push({
            value: value,
            datetime: new Date(position),
            key: `${value}`
        });
        if (this._timeframe.start > position) {
            this._charts.start = new Date(position);
            this._timeframe.start = position;
        }
        if (this._timeframe.end < position) {
            this._charts.end = new Date(position);
            this._timeframe.end = position;
        }
        if (this._charts.min > value) {
            this._charts.min = value;
        }
        if (this._charts.max < value) {
            this._charts.max = value;
        }
    }

    _rebuildCharts() {
        this._resetChartData(false);
        this._updateChartsDateFromRows(this._rows);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Chart & stream events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    private onSelectOnChart(date: Date) {
        const position = date.getTime();
        if (position >= 0 && position <= this._rows.length - 1){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, position, this.GUID);
        }
    }

    onROW_IS_SELECTED(index : number, GUID : string){
        if (this.viewParams.GUID !== GUID){
            this.chartCom !== null && this.chartCom.goToPosition(index);
        }
    }

}

