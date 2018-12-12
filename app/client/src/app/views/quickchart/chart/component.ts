import {Component, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnInit, AfterViewChecked, OnDestroy, Input } from '@angular/core';
import { ViewSizeClassInt as Size               } from '../../../core/services/class.view.size';
import { D3Controller                           } from '../../../core/components/common/d3/D3.series';
import { ChartData                              } from '../../../core/components/common/d3/interface.chart.data';

export interface IChartSettings {
    isSmooth: boolean;
    isLabels: boolean;
}

@Component({
    selector        : 'view-controller-quickchart-holder',
    templateUrl     : './template.html',
})

export class ViewControllerQuickchartChart implements OnInit, AfterViewChecked, OnDestroy {
    
    @ViewChild ('svg', { read: ViewContainerRef}) svg: ViewContainerRef;

    @Input() GUID: string;
    @Input() onSelect: (date: Date) => void;

    public size: Size = {
        width : 100,
        height: 100
    };

    private D3          : D3Controller  = null;
    private chartData   : ChartData     = null;
    private settings    : IChartSettings= {
        isSmooth: false,
        isLabels: false
    };
    private selection   : {
        own     : boolean,
        index   : number
    } = {
        own     : false,
        index   : -1
    };

    ngOnInit(){

    }

    ngAfterViewChecked(){
        this.onWindowResize();
        this.initD3Controller();
    }

    ngOnDestroy(){
        this.D3 !== null && this.D3.destroy();
    }

    onResizeHandle(){
        this.forceUpdate();
    }

    onWindowResize(){
        let size = this.viewContainerRef.element.nativeElement.getBoundingClientRect();
        this.size.height = size.height;
        this.size.width = size.width;
        this.D3 !== null && this.D3.resize();
    }

    initD3Controller(){
        if (this.D3 !== null) {
            return;
        }
        if (this.svg === void 0) {
            return;
        }
        this.D3 = new D3Controller('svg[id="' + this.GUID + '"]', this.onSelectChart.bind(this), this.settings.isLabels, true, this.settings.isSmooth);
    }

    destroyD3Controller() {
        if (this.D3 === null || this.D3 === void 0) {
            return;
        }
        this.D3.destroy();
        this.D3 = null;
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    forceUpdateD3(){
        if (this.D3 === null) {
            return;
        }
        if (this.chartData === null) {
            return;
        }
        this.D3.onData(this.chartData);
    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        this.onResizeHandle = this.onResizeHandle.bind(this);
    }

    
    onSelectChart(datetime : Date){
        this.onSelect(datetime);
    }

    public update(chartData: ChartData) {
        this.chartData = chartData;
        this.initD3Controller();
        this.forceUpdateD3();
    }

    public goToPosition(index: number) {
        const datetime = new Date(index);
        this.D3 !== null && this.D3.goToPosition(datetime);
    }

    public updateSettings(settings: IChartSettings) {
        this.settings = settings;
        this.destroyD3Controller();
        this.initD3Controller();
        this.forceUpdateD3();
    }

}
