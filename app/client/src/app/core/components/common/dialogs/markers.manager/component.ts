import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, EventEmitter, OnDestroy } from '@angular/core';


import { events as Events                       } from '../../../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../../../core/modules/controller.config';

import { GUID                                   } from '../../../../../core/modules/tools.guid';

import { localSettings, KEYs                    } from '../../../../../core/modules/controller.localsettings';

import { Marker                                 } from './marker/interface.marker';
import { popupController                        } from '../../../../../core/components/common/popup/controller';
import { MarkersEditDialog                      } from '../../../../../core/components/common/dialogs/markers.edit/component';

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
        this.onAddMarker = this.onAddMarker.bind(this);
        this.loadMarkers();
        this.onMarkerChanges();
    }

    initMarker(marker : Marker){
        return {
            value           : marker.value,
            backgroundColor : marker.backgroundColor,
            foregroundColor : marker.foregroundColor,
            active          : marker.active,
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

    onMarkerChange(hook: string, updated: string, foregroundColor: string, backgroundColor: string){
        let index = this.getMarkerIndexByHook(hook);
        if (~index){
            if (!~this.getMarkerIndexByHook(updated)){
                this.markers[index] = this.initMarker({
                    value           : updated,
                    foregroundColor : foregroundColor,
                    backgroundColor : backgroundColor,
                    active          : this.markers[index].active
                });
            } else {
                this.markers[this.getMarkerIndexByHook(updated)].foregroundColor = foregroundColor;
                this.markers[this.getMarkerIndexByHook(updated)].backgroundColor = backgroundColor;
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
                                active          : true
                            }));
                        } else {
                            this.markers[this.getMarkerIndexByHook(marker['hook'])].foregroundColor = marker['foregroundColor'];
                            this.markers[this.getMarkerIndexByHook(marker['hook'])].backgroundColor = marker['backgroundColor'];
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
                height          : '25rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onMarkerChanges(){
        this.saveMarkers();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.MARKERS_CHANGED, this.markers);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED, this.getActiveMarkers());
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
                        active          : marker.active
                    };
                })
            }
        });
    }

}
