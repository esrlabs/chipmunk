import { Component, Input, OnDestroy, AfterContentInit, ChangeDetectorRef, ComponentFactoryResolver, ReflectiveInjector, ViewChild, ViewContainerRef } from '@angular/core';
import { ViewClass                      } from '../../../services/class.view';
import { FavoriteItem                   } from '../../../services/class.favorite.item';

import { events as Events               } from '../../../modules/controller.events';
import { configuration as Configuration } from '../../../modules/controller.config';

import { EVENT_VIEW_BAR_ADD_FAVORITE_RESPONSE   } from '../../../interfaces/events/VIEW_BAR_ADD_FAVORITE_RESPONSE';
import { ACTIONS                                } from '../../../consts/consts.views.obligatory.actions';

@Component({
  selector      : 'view-bar',
  templateUrl   : './template.html',
})
export class ViewBar implements OnDestroy, AfterContentInit{
    @Input() menu       : Array<Object>         = [];
    @Input() favorites  : Array<FavoriteItem>   = [];
    @Input() description: string                = '';
    @Input() viewParams : ViewClass             = null;

    @ViewChild('middle', { read: ViewContainerRef }) middle: ViewContainerRef;

    private middleComponent: any = null;

    public isFavoriteActive : boolean = true;

    constructor(private changeDetectorRef : ChangeDetectorRef,
                private resolver: ComponentFactoryResolver){
        [   Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_INJECT_COMPONENT,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_UPDATE_BUTTON,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_ENABLE_BUTTON,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_DISABLE_BUTTON].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
    }

    ngOnDestroy(){
        [   Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_INJECT_COMPONENT,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_UPDATE_BUTTON,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_ENABLE_BUTTON,
            Configuration.sets.EVENTS_VIEWS.VIEW_BAR_DISABLE_BUTTON].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    ngAfterContentInit(){
        this.updateFavoriteState();
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    updateFavoriteState(){
        if (this.viewParams !== void 0){
            this.isFavoriteActive = ~this.viewParams.hide.indexOf(ACTIONS.FAVORITE) ? false : true;
        }
    }

    getButtonIndexByGUID(GUID: string | symbol){
        let index = -1;
        this.menu instanceof Array && this.menu.forEach((item, i)=>{
            if (item['GUID'] !== void 0 && item['GUID'] === GUID){
                index = i;
            }
        });
        return index;
    }

    injectComponent(data: {component: any, inputs: any, params : Object }) {
        if (!data) {
            return;
        }

        // Inputs need to be in the following format to be resolved properly
        let inputProviders = Object.keys(data.inputs).map((inputName) => {return {provide: inputName, useValue: data.inputs[inputName]};});
        let resolvedInputs = ReflectiveInjector.resolve(inputProviders);

        // We create an injector out of the data we want to pass down and this components injector
        let injector = ReflectiveInjector.fromResolvedProviders(resolvedInputs, this.middle.parentInjector);

        // We create a factory out of the component we want to create
        let factory = this.resolver.resolveComponentFactory(data.component);

        // We create the component using the factory and the injector
        let component = factory.create(injector);

        //Setups params
        Object.keys(data.params).forEach((param)=>{
            component.instance[param] !== void 0 && (component.instance[param] = data.params[param]);
        });

        // We insert the component into the dom container
        this.middle.insert(component.hostView);

        // We can destroy the old component is we like by calling destroy
        if (this.middleComponent) {
            this.middleComponent.destroy();
        }

        this.middleComponent = component;
    }

    onVIEW_BAR_INJECT_COMPONENT(GUID: string, component: {component: any, inputs: any, params : Object }, callback?: Function){
        if (this.viewParams.GUID === GUID){
            this.injectComponent(component);
            typeof callback === 'function' && callback(true);
        } else {
            typeof callback === 'function' && callback(false);
        }
        this.forceUpdate();
    }

    onVIEW_BAR_ADD_FAVORITE_RESPONSE(params : EVENT_VIEW_BAR_ADD_FAVORITE_RESPONSE){
        if (this.viewParams.GUID === params.GUID){
            if (this.isFavorite(params.index)){
                this.removeFavorite(params.index);
            } else {
                this.addFavorite(params.index);
            }
            this.forceUpdate();
        }
    }

    onVIEW_BAR_ADD_BUTTON(GUID: string, button: Object, last: boolean = false, callback?: Function){
        if (this.viewParams === null) {
            return false;
        }
        if (this.viewParams.GUID === GUID){
            button['GUID'] = button['GUID'] !== void 0 ? button['GUID'] : Symbol();
            if (last){
                this.menu.splice(this.menu.length - 1, 0, button);
            } else {
                this.menu.unshift(button);
            }
            typeof callback === 'function' && callback(button['GUID']);
        } else {
            typeof callback === 'function' && callback();
        }
        this.forceUpdate();
    }

    onVIEW_BAR_UPDATE_BUTTON(GUID: string, button: Object, callback?: Function){
        if (this.viewParams === null) {
            return false;
        }
        if (this.viewParams.GUID === GUID){
            const index = this.getButtonIndexByGUID(button['GUID']);
            if (~index){
                Object.keys(button).forEach((key: string) => {
                    this.menu[index][key] = button[key];
                });
            }
            typeof callback === 'function' && callback(button['GUID']);
        } else {
            typeof callback === 'function' && callback();
        }
        this.forceUpdate();
    }

    onVIEW_BAR_REMOVE_BUTTON(GUID: string, buttonGUID: symbol, callback?: Function){
        if (this.viewParams.GUID === GUID){
            let index = this.getButtonIndexByGUID(buttonGUID);
            ~index && this.menu.splice(index, 1);
        }
        this.forceUpdate();
    }

    onVIEW_BAR_ENABLE_BUTTON(GUID: string, buttonGUID: symbol){
        if (this.viewParams.GUID === GUID){
            let index = this.getButtonIndexByGUID(buttonGUID);
            ~index && (this.menu[index]['disable'] = false);
        }
        this.forceUpdate();
    }

    onVIEW_BAR_DISABLE_BUTTON(GUID: string, buttonGUID: symbol){
        if (this.viewParams.GUID === GUID){
            let index = this.getButtonIndexByGUID(buttonGUID);
            ~index && (this.menu[index]['disable'] = true);
        }
        this.forceUpdate();
    }

    isFavorite(mark: number | string){
        let result = false;
        this.favorites.forEach((favorite)=>{
            mark == favorite.mark && (result = true);
        });
        return result;
    }

    removeFavorite(mark : number | string){
        this.favorites = this.favorites.filter((favorite)=>{
            return favorite.mark != mark;
        });
    }

    addFavorite(mark : number){
        this.favorites.push({
            icon: null,
            mark: mark
        });
    }

    onMenuItemClick(index: number){
        if (this.menu[index] !== void 0){
            !this.menu[index]['disable'] && (typeof this.menu[index]['action'] === 'function' && this.menu[index]['action']());
        }
    }

    onAddFavorite(smth:any){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_CLICKED, this.viewParams.GUID);
    }

    onSelectFavorite(smth:any){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_GOTO, { GUID: this.viewParams.GUID, index: parseInt(smth.mark, 10) });
    }

    onMouseDown(event: MouseEvent){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEDOWN, this.viewParams.GUID);
    }

    onMouseUp(event: MouseEvent){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEUP, this.viewParams.GUID);
    }

}
