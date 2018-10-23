import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, EventEmitter, OnDestroy } from '@angular/core';


import { events as Events                       } from '../../../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../../../core/modules/controller.config';

import { serviceRequests                        } from '../../../../../core/services/service.requests';

import { localSettings, KEYs                    } from '../../../../../core/modules/controller.localsettings';

import { Marker                                 } from './marker/interface.marker';
import { popupController                        } from '../../../../../core/components/common/popup/controller';
import { MarkersEditDialog                      } from '../../../../../core/components/common/dialogs/markers.edit/component';
import { DialogMessage                          } from '../../../../../core/components/common/dialogs/dialog-message/component';

const SETTINGS = {
    LIST_KEY    : 'LIST_KEY'
};

@Component({
    selector        : 'dialog-markers-manager',
    templateUrl     : './template.html'
})

export class DialogMarkersManager implements OnInit, OnDestroy {

    public markers: Array<Marker> = [];

    ngOnInit(){
    }

    ngOnDestroy(){
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;
        this.onAddMarker                = this.onAddMarker.bind(this);
        this.onCopyFromFilters          = this.onCopyFromFilters.bind(this);
        this.loadMarkers();
        this.onMarkerChanges();
    }

    initMarker(marker : Marker){
        return {
            value           : marker.value,
            backgroundColor : marker.backgroundColor,
            foregroundColor : marker.foregroundColor,
            active          : marker.active,
            lineIsTarget    : marker.lineIsTarget,
            isRegExp        : marker.isRegExp,
            onChangeColor   : this.onMarkerColorChange.bind(this, marker.value),
            onRemove        : this.onMarkerRemove.bind(this, marker.value),
            onChangeState   : this.onMarkerChangeState.bind(this, marker.value),
            onChange        : this.onMarkerChange.bind(this, marker.value)
        }
    }

    onMarkerColorChange(hook: string, foregroundColor: string, backgroundColor: string){
        let index = this.getMarkerIndexByHook(hook);
        if (~index){
            this.markers[index].backgroundColor = backgroundColor;
            this.markers[index].foregroundColor = foregroundColor;
            this.onMarkerChanges();
            this.forceUpdate();
        }
    }

    onMarkerRemove(hook: string){
        let index = this.getMarkerIndexByHook(hook);
        if (~index){
            this.markers.splice(index, 1);
            this.onMarkerChanges();
            this.forceUpdate();
        }
    }

    onMarkerChangeState(hook: string, state: boolean){
        let index = this.getMarkerIndexByHook(hook);
        if (~index){
            this.markers[index].active = state;
            this.onMarkerChanges();
            this.forceUpdate();
        }
    }

    onMarkerChange(hook: string, updated: string, foregroundColor: string, backgroundColor: string, lineIsTarget: boolean, isRegExp: boolean){
        let index = this.getMarkerIndexByHook(hook);
        if (~index){
            if (!~this.getMarkerIndexByHook(updated)){
                this.markers[index] = this.initMarker({
                    value           : updated,
                    foregroundColor : foregroundColor,
                    backgroundColor : backgroundColor,
                    active          : this.markers[index].active,
                    lineIsTarget    : lineIsTarget,
                    isRegExp        : isRegExp
                });
            } else {
                this.markers[this.getMarkerIndexByHook(updated)].foregroundColor    = foregroundColor;
                this.markers[this.getMarkerIndexByHook(updated)].backgroundColor    = backgroundColor;
                this.markers[this.getMarkerIndexByHook(updated)].lineIsTarget       = lineIsTarget;
                this.markers[this.getMarkerIndexByHook(updated)].isRegExp           = isRegExp;
            }
            this.onMarkerChanges();
            this.forceUpdate();
        }
    }

    getMarkerIndexByHook(hook: string){
        let result = -1;
        this.markers.forEach((marker, index)=>{
            marker.value === hook && (result = index);
        });
        return result;
    }

    getActiveMarkers(){
        return this.markers
            .filter((marker)=>{
                return marker.active;
            })
            .map((marker)=>{
                return {
                    value           : marker.value,
                    foregroundColor : marker.foregroundColor,
                    backgroundColor : marker.backgroundColor,
                    lineIsTarget    : marker.lineIsTarget !== void 0 ? marker.lineIsTarget : false,
                    isRegExp        : marker.isRegExp !== void 0 ? marker.isRegExp : false,
                }
            });
    }

    onAddMarker(){
        let popup = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : MarkersEditDialog,
                params      : {
                    callback    : function(marker: Object){
                        if (!~this.getMarkerIndexByHook(marker['hook'])){
                            this.markers.push(this.initMarker({
                                foregroundColor : marker['foregroundColor'],
                                backgroundColor : marker['backgroundColor'],
                                value           : marker['hook'],
                                lineIsTarget    : marker['lineIsTarget'],
                                isRegExp        : marker['isRegExp'],
                                active          : true
                            }));
                        } else {
                            this.markers[this.getMarkerIndexByHook(marker['hook'])].foregroundColor = marker['foregroundColor'];
                            this.markers[this.getMarkerIndexByHook(marker['hook'])].backgroundColor = marker['backgroundColor'];
                            this.markers[this.getMarkerIndexByHook(marker['hook'])].lineIsTarget    = marker['lineIsTarget'];
                            this.markers[this.getMarkerIndexByHook(marker['hook'])].isRegExp        = marker['isRegExp'];
                        }
                        this.onMarkerChanges();
                        this.forceUpdate();
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('Add marker'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '31rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onCopyFromFilters() {
        const requests = serviceRequests.getRequests();
        if (!(requests instanceof Array)) {
            return false;
        }
        const added: any[] = [];
        requests.forEach((request) => {
            if (this.isMarkerExist(request.value)) {
                return;
            }
            added.push({
               value: request.value,
               foregroundColor: request.foregroundColor,
               backgroundColor: request.backgroundColor,
               lineIsTarget: true,
               isRegExp: true,
               active: request.active
            });
        });
        if (added.length > 0) {
            this.showMessage(
                'Copied',
                `Was copied ${added.length} entities. Save it?`,
                'Yes, save it',
                'No',
                () => {
                    this.markers.push(...added);
                    this.saveMarkers();
                    this.onMarkerChanges();
                },
                () => {
                    //Do nothing
                });
        }
    }

    isMarkerExist(value: string): boolean {
        let result = false;
        this.markers.forEach((marker: Marker) => {
            if (result) {
                return;
            }
            if (marker.value === value) {
                result = true;
            }
        });
        return result;
    }

    onMarkerChanges(){
        this.saveMarkers();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.MARKERS_CHANGED, this.markers);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED, this.getActiveMarkers());
    }

    showMessage(title: string, message: string, yes: string, no: string, onYes: () => void, onNo: () => void){
        let guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message: message,
                    buttons: [
                        {
                            caption: yes,
                            handle : () => {
                                popupController.close(guid);
                                onYes();
                            }
                        },
                        {
                            caption: no,
                            handle : () => {
                                popupController.close(guid);
                                onNo();
                            }
                        }
                    ]
                }
            },
            title   : title,
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '15rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : guid
        });
    }

    loadMarkers(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.view_markers] !== void 0 && settings[KEYs.view_markers] !== null && settings[KEYs.view_markers][SETTINGS.LIST_KEY] instanceof Array){
            this.markers = settings[KEYs.view_markers][SETTINGS.LIST_KEY].map((marker : any)=>{
                return this.initMarker(marker);
            });
        }
    }

    saveMarkers(){
        localSettings.set({
            [KEYs.view_markers] : {
                [SETTINGS.LIST_KEY] : this.markers.map((marker)=>{
                    return {
                        value           : marker.value,
                        backgroundColor : marker.backgroundColor,
                        foregroundColor : marker.foregroundColor,
                        active          : marker.active,
                        lineIsTarget    : marker.lineIsTarget !== void 0 ? marker.lineIsTarget : false,
                        isRegExp        : marker.isRegExp !== void 0 ? marker.isRegExp : false
                    };
                })
            }
        });
    }

}
