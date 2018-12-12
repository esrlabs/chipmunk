import { Component, ChangeDetectorRef, AfterContentInit, ViewChild, Input } from '@angular/core';
import { TRule, TRules, TCase, TCases           } from '../component';
import { EContextMenuItemTypes, IContextMenuItem, IContextMenuEvent } from '../../../core/components/context-menu/interfaces';
import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';
import { popupController                        } from '../../../core/components/common/popup/controller';
import { ColorSelectorDialog                    } from '../../../core/components/common/dialogs/color.selector/component';

@Component({
    selector    : 'list-quickchart',
    templateUrl : './template.html',
})

export class ViewControllerQuickchartList implements AfterContentInit {

    @Input() rules: TRules = {};
    @Input() cases: TCases = {};
    @Input() removeRule: (rule: TRule) => void;
    @Input() hideCase: (casse: TCase) => void;
    @Input() onColorChange: (casse: TCase) => void;
    @Input() onCaseVisibility: (casse: TCase) => void;
    @Input() onRuleVisibility: (rule: TRule) => void;
    @Input() onRemoveAllRules: () => void;
    @Input() onHideAllCases: () => void;
    @Input() onInvertCases: () => void;
    @Input() onChartSmooth: (isSmooth: boolean) => void;
    @Input() onChartLabels: (isLabels: boolean) => void;

    private isSmooth: boolean = false;
    private isLabels: boolean = false;

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.onSmoothToggle = this.onSmoothToggle.bind(this);
        this.onLabelsToggle = this.onLabelsToggle.bind(this);
        this.onHideAll = this.onHideAll.bind(this);
        this.onRemoveAll = this.onRemoveAll.bind(this);
        this.onInvertAll = this.onInvertAll.bind(this);
    }


    ngAfterContentInit(){
        
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    public objectKeys = Object.keys;

    onContextMenuRulesMouseDown(event: MouseEvent, rule: TRule){
        if (window.oncontextmenu !== void 0) {
            return true;
        }
        event.which === 3 && this.onContextRulesMenu(event, rule);
    }

    onContextRulesMenu(event: MouseEvent, rule: TRule){
        let contextEvent = {x: event.pageX,
            y: event.pageY,
            items: [
                { type: EContextMenuItemTypes.divider },
                {
                    caption : 'Remove',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        this.removeRule(rule);
                    }
                }
            ]} as IContextMenuEvent;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.CONTEXT_MENU_CALL, contextEvent);
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    onContextMenuCasesMouseDown(event: MouseEvent, casse: TCase ) {
        if (window.oncontextmenu !== void 0) {
            return true;
        }
        event.which === 3 && this.onContextCasesMenu(event, casse);
    }

    onContextCasesMenu(event: MouseEvent, casse: TCase) {
        let contextEvent = {x: event.pageX,
            y: event.pageY,
            items: [
                {
                    caption : 'Change color',
                    type    : EContextMenuItemTypes.item,
                    handler : () => { 
                        this.onColorCaseChange(event, casse);
                    }
                },
                { type: EContextMenuItemTypes.divider },
                {
                    caption : 'Hide',
                    type    : EContextMenuItemTypes.item,
                    handler : () => { 
                        this.hideCase(casse);
                    }
                }
            ]} as IContextMenuEvent;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.CONTEXT_MENU_CALL, contextEvent);
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    onRuleApplyAsSearch(event: MouseEvent, rule: TRule) {
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.TRIGGER_SEARCH_REQUEST, { value: rule.reg, mode: 'reg'});
    }

    onClickVisibilityCase(event: MouseEvent, casse: TCase) {
        this.onCaseVisibility(casse);
    }

    onClickVisibilityRule(event: MouseEvent, rule: TRule) {
        this.onRuleVisibility(rule);
    }

    onColorCaseChange(event: MouseEvent, casse: TCase) {
        let popupGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ColorSelectorDialog,
                params      : {
                    popupGUID   : popupGUID,
                    color       : casse.color,
                    callback    : (color: string) => {
                        casse.color = color;
                        this.onColorChange(casse);
                        popupController.close(popupGUID);
                    }
                }
            },
            title   : _('Select color'),
            settings: {
                move            : true,
                resize          : true,
                width           : '19rem',
                height          : '19rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popupGUID
        });
    }

    onSmoothToggle() {
        this.isSmooth = !this.isSmooth;
        this.onChartSmooth(this.isSmooth);
    }

    onLabelsToggle() {
        this.isLabels = !this.isLabels;
        this.onChartLabels(this.isLabels);
    }

    onHideAll() {
        this.onHideAllCases();
    }

    onInvertAll() {
        this.onInvertCases();
    }

    onRemoveAll() {
        this.onRemoveAllRules();
    }
}
