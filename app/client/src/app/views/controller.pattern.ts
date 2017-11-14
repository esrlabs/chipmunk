import { EventEmitter, AfterViewChecked         } from '@angular/core';

import { events as Events                       } from '../core/modules/controller.events';
import { configuration as Configuration         } from '../core/modules/controller.config';

import { EVENT_VIEW_BAR_ADD_FAVORITE_RESPONSE   } from '../core/interfaces/events/VIEW_BAR_ADD_FAVORITE_RESPONSE';

class ViewControllerPattern implements AfterViewChecked{
    public GUID : string = null;

    protected state : {
        silence     : boolean,
        deafness    : boolean,
        favorites   : boolean,
        filter      : boolean
    } = {
        silence     : false,
        deafness    : false,
        favorites   : true,
        filter      : true
    };

    protected emitters : {
        silence         : EventEmitter<boolean>,
        deafness        : EventEmitter<boolean>,
        favorites       : EventEmitter<boolean>,
        filter          : EventEmitter<boolean>,
        favoriteClick   : EventEmitter<string>,
        favoriteGOTO    : EventEmitter<EVENT_VIEW_BAR_ADD_FAVORITE_RESPONSE>,
        resize          : EventEmitter<null>
    } = {
        silence         : new EventEmitter(),
        deafness        : new EventEmitter(),
        favorites       : new EventEmitter(),
        filter          : new EventEmitter(),
        favoriteClick   : new EventEmitter(),
        favoriteGOTO    : new EventEmitter(),
        resize          : new EventEmitter()
    };

    protected flags = {
        resize : false
    };


    constructor(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_SILENCE_TOGGLE,       this.onVIEW_BAR_SILENCE_TOGGLE.         bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DEAFNESS_TOGGLE,      this.onVIEW_BAR_DEAFNESS_TOGGLE.        bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_FAVORITE_TOGGLE,      this.onVIEW_BAR_FAVORITE_TOGGLE.        bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_FILTER_TOGGLE,        this.onVIEW_BAR_FILTER_TOGGLE.          bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_CLICKED, this.onVIEW_BAR_ADD_FAVORITE_CLICKED.   bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_GOTO,    this.onVIEW_BAR_ADD_FAVORITE_GOTO.      bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.REMOVE_VIEW,                   this.onREMOVE_VIEW.                     bind(this));
    }

    ngAfterViewChecked(){
        if (this.flags.resize) { this.flags.resize = false; this.emitters.resize.emit(); }
    }

    setGUID(GUID: string){
        this.GUID = GUID;
    }

    getState(){
        return this.state;
    }

    getEmitters(){
        return this.emitters;
    }

    onVIEW_BAR_SILENCE_TOGGLE(GUID: string){
        this.GUID === GUID && (this.state.silence = !this.state.silence);
        this.GUID === GUID && this.emitters.silence.emit(this.state.silence);
    }

    onVIEW_BAR_DEAFNESS_TOGGLE(GUID: string){
        this.GUID === GUID && (this.state.deafness = !this.state.deafness);
        this.GUID === GUID && this.emitters.deafness.emit(this.state.deafness);
    }

    onVIEW_BAR_FAVORITE_TOGGLE(GUID: string){
        this.GUID === GUID && (this.state.favorites = !this.state.favorites);
        this.GUID === GUID && this.emitters.favorites.emit(this.state.favorites);
    }

    onVIEW_BAR_FILTER_TOGGLE(GUID: string){
        if (this.GUID === GUID){
            this.state.filter = !this.state.filter;
            this.emitters.filter.emit(this.state.filter);
            if (!this.state.filter){
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMEMBER_FILTER, this.GUID);
            } else {
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.FORGET_FILTER, this.GUID);
            }
        }
    }

    onVIEW_BAR_ADD_FAVORITE_CLICKED(GUID: string){
        this.GUID === GUID && this.emitters.favoriteClick.emit(GUID);
    }

    onVIEW_BAR_ADD_FAVORITE_GOTO( event: EVENT_VIEW_BAR_ADD_FAVORITE_RESPONSE){
        this.GUID === event.GUID && this.emitters.favoriteGOTO.emit(event);
    }

    onREMOVE_VIEW(GUID: string){
        this.GUID !== GUID && (this.flags.resize = true);
    }

}

export { ViewControllerPattern }
