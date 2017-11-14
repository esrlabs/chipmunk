import { Component, Input, AfterViewInit, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ViewClass                      } from '../../../services/class.view';
import { viewsControllersListObj        } from '../../../../views/controllers.list';

import { events as Events               } from '../../../modules/controller.events';
import { configuration as Configuration } from '../../../modules/controller.config';

import { RESIZE_MODES                   } from '../../../consts/consts.resize.modes';

import { ACTIONS                        } from '../../../consts/consts.views.obligatory.actions';

@Component({
    selector        : 'view',
    templateUrl     : './template.html',
})

export class View implements AfterViewInit, AfterContentInit, OnDestroy{
    private resize : symbol = null;
    private cache  = {
        x : -1,
        y : -1
    };
    private dragable: boolean = false;
    public dragover : boolean = false;
    public dragging : boolean = false;

    @Input() params : ViewClass = null;

    viewController  : any = null;

    constructor(private changeDetectorRef: ChangeDetectorRef){
        this.onMouseMoveWindow              = this.onMouseMoveWindow.           bind(this);
        this.onMouseUpWindow                = this.onMouseUpWindow.             bind(this);
        [   Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEDOWN,
            Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEUP].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
    }

    ngAfterContentInit(){
        this.addActionsToMenu();
        this.addFavoriteActions();
        this.addObligatoryMenu();
        this.renderComponent();
    }

    ngAfterViewInit() {
    }

    ngOnDestroy() {
        [   Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEDOWN,
            Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEUP].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.FORGET_FILTER, this.params.GUID);
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    renderComponent() {
        this.viewController = {
            component   : viewsControllersListObj[this.params.controller],
            inputs      : { },
            params      : { viewParams : this.params },
        };
    }

    addFavoriteActions(){
        this.params.favorites.unshift({
            icon : 'fa-bookmark-o',
            mark : null
        });
    }

    getMenuItemBySymbol(symbol: symbol) : any{
        let _item = null;
        this.params.menu.forEach((item : any)=>{
            if (item.symbol !== void 0 && item.symbol === symbol){
                _item = item;
            }
        });
        return _item;
    }

    toggleItem(symbol: symbol){
        let item = this.getMenuItemBySymbol(symbol);
        if (item !== null){
            item.active = !item.active;
            this.forceUpdate();
        }
    }

    getMenuAction(type: string){
        switch (type){
            case ACTIONS.SILENCE:
                return function () {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_SILENCE_TOGGLE, this.params.GUID);
                    this.toggleItem(ACTIONS.SILENCE);
                }.bind(this);
            case ACTIONS.DEAFNESS:
                return function () {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DEAFNESS_TOGGLE, this.params.GUID);
                    this.toggleItem(ACTIONS.DEAFNESS);
                }.bind(this);
            case ACTIONS.FILTER:
                return function () {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_FILTER_TOGGLE, this.params.GUID);
                    this.toggleItem(ACTIONS.FILTER);
                }.bind(this);
            case ACTIONS.CLOSE:
                return function () {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_VIEW, this.params.GUID);
                }.bind(this);
        }
    }

    addActionsToMenu(){
        this.params.menu = this.params.menu.map((item)=>{
            let event   = item['event'  ] !== void 0 ? item['event' ] : null,
                listen  = item['listen' ] !== void 0 ? item['listen'] : null,
                GUID    = this.params.GUID;
            event !== null && (item['action'] = (function(){
                Events.trigger(event, GUID);
                if (typeof item['active'] === 'boolean'){
                    item['active'] = !item['active'];
                    this.forceUpdate();
                }
            }).bind(this));
            listen !== null && (Events.bind(listen, (function(_GUID: string, active: boolean){
                if (_GUID === GUID && typeof item['active'] === 'boolean'){
                    item['active'] = active;
                    this.forceUpdate();
                }
            }).bind(this)));
            return item;
        });
    }

    addActiveState(){
        this.params.menu = this.params.menu.map((item)=>{
            return item;
        });
    }

    addObligatoryMenu(){
        if (!~this.params.hide.indexOf(ACTIONS.SILENCE)){
            this.params.menu.push({
                icon    : 'fa-eye-slash',
                symbol  : ACTIONS.SILENCE,
                GUID    : ACTIONS.SILENCE,
                action  : this.getMenuAction(ACTIONS.SILENCE),
                hint    : _('Do not make other views change'),
                active  : false,
                disable : false
            });
        }
        if (!~this.params.hide.indexOf(ACTIONS.DEAFNESS)){
            this.params.menu.push({
                icon    : 'fa-lock',
                symbol  : ACTIONS.DEAFNESS,
                GUID    : ACTIONS.DEAFNESS,
                action  : this.getMenuAction(ACTIONS.DEAFNESS),
                hint    : _('Do not react on changes outside'),
                active  : false,
                disable : false
            });
        }
        if (!~this.params.hide.indexOf(ACTIONS.FILTER)){
            this.params.menu.push({
                icon    : 'fa-filter',
                symbol  : ACTIONS.FILTER,
                GUID    : ACTIONS.FILTER,
                action  : this.getMenuAction(ACTIONS.FILTER),
                hint    : _('Do not react on filter changes'),
                active  : true,
                disable : false
            });
        }
        if (!~this.params.hide.indexOf(ACTIONS.CLOSE)){
            this.params.menu.push({
                icon    : 'fa-times',
                symbol  : ACTIONS.CLOSE,
                GUID    : ACTIONS.CLOSE,
                action  : this.getMenuAction(ACTIONS.CLOSE),
                hint    : _('Remove this view'),
                active  : false,
                disable : false
            });
        }
    }

    denySelection(){
        document.body.className += ' noselect';
    }

    allowSelection(){
        document.body.className = document.body.className.replace(' noselect', '');
    }

    attachWindowHandles(){
        window.addEventListener('mousemove',    this.onMouseMoveWindow);
        window.addEventListener('mouseup',      this.onMouseUpWindow);
    }

    detachWindowHandles(){
        window.removeEventListener('mousemove', this.onMouseMoveWindow);
        window.removeEventListener('mouseup',   this.onMouseUpWindow);
    }

    grabCoordinates(event : MouseEvent){
        return {
            x : event.screenX,
            y : event.screenY
        };
    }

    onMouseMoveWindow(event: MouseEvent){
        let coords  = this.grabCoordinates(event),
            dX      = this.cache.x - coords.x,
            dY      = this.cache.y - coords.y,
            changed = false;
        switch (this.resize){
            case RESIZE_MODES.TOP:
                dY !== 0 && (changed = true);
                break;
            case RESIZE_MODES.BOTTOM:
                dY !== 0 && (changed = true);
                break;
            case RESIZE_MODES.LEFT:
                dX !== 0 && (changed = true);
                break;
            case RESIZE_MODES.RIGHT:
                dX !== 0 && (changed = true);
                break;
        }
        changed && Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE, {
            GUID: this.params.GUID,
            dX  : this.cache.x - coords.x,
            dY  : this.cache.y - coords.y,
            mode: this.resize
        });
        this.cacheCoordinates(event);
    }

    onMouseUpWindow(){
        this.resize = null;
        this.detachWindowHandles();
        this.allowSelection();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE_FINISHED);
    }

    cacheCoordinates(event: MouseEvent){
        this.cache = this.grabCoordinates(event);
    }

    onResizeStarted(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE_STARTED);
    }

    onMouseDownT(event: MouseEvent){
        this.onResizeStarted();
        this.cacheCoordinates(event);
        this.attachWindowHandles();
        this.denySelection();
        this.resize = RESIZE_MODES.TOP;
    }
    onMouseDownB(event: MouseEvent){
        this.onResizeStarted();
        this.cacheCoordinates(event);
        this.attachWindowHandles();
        this.denySelection();
        this.resize = RESIZE_MODES.BOTTOM;
    }
    onMouseDownL(event: MouseEvent){
        this.onResizeStarted();
        this.cacheCoordinates(event);
        this.attachWindowHandles();
        this.denySelection();
        this.resize = RESIZE_MODES.LEFT;
    }
    onMouseDownR(event: MouseEvent){
        this.onResizeStarted();
        this.cacheCoordinates(event);
        this.attachWindowHandles();
        this.denySelection();
        this.resize = RESIZE_MODES.RIGHT;
    }

    onDragOver(event: DragEvent){
        this.dragover = true;
        event.preventDefault();
        event.stopPropagation();
    }

    onDragLeave(event: DragEvent){
        this.dragover = false;
    }

    onDrag(event: DragEvent){
        this.dragging = true;
    }

    onDragEnd(event: DragEvent){
        this.dragging = false;
        this.dragable = false;
    }

    onDragStart(event: DragEvent){
        if (!this.dragable){
            event.preventDefault();
            event.stopPropagation();
        } else {
            event.dataTransfer.setData('text/plain', this.params.GUID);
        }
    }

    onDrop(event: DragEvent){
        let GUID = event.dataTransfer.getData('text/plain');
        if (GUID !== this.params.GUID){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_SWITCH_POSITION_BETWEEN, GUID, this.params.GUID);
        }
        this.dragover = false;
    }

    onVIEW_BAR_DESCRIPTION_MOUSEDOWN(GUID: string){
        this.dragable = (GUID === this.params.GUID);
    }

    onVIEW_BAR_DESCRIPTION_MOUSEUP(GUID: string){
        this.dragable = false;
    }
}
