
import {EventEmitter, Injectable} from "@angular/core";

import { ViewClass                      } from './class.view';
import { ViewSizeClass                  } from '../services/class.view.size';
import { ViewPositionClass              } from '../services/class.view.position';
import { GUID                           } from '../modules/tools.guid';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';
import { localSettings, KEYs            } from '../modules/controller.localsettings';
import { Logs, TYPES as LogTypes        } from '../modules/tools.logs';
import { RESIZE_MODES                   } from '../consts/consts.resize.modes';
import { VIEW_RESIZE                    } from '../interfaces/events/VIEW_RESIZE';


class DefaultsLoader{

    getDefaults(){
        let views_settings = Configuration.sets.VIEWS_DEFAULTS.map((view : any)=>{
            return Object.assign({}, view);
        });
        return views_settings;
    }

    load(){
        let local = localSettings.get();
        if (local[KEYs.views] !== null){
            return this.isValid(local[KEYs.views].settings) ? local[KEYs.views].settings : this.getDefaults();
        } else {
            let views_settings = this.getDefaults();
            localSettings.set( {
                [KEYs.views] : {
                    settings : views_settings
                }
            });
            return views_settings;
        }
    }

    save(current : Array<any>){
        localSettings.set( {
            [KEYs.views] : {
                settings : current.map((view)=>{
                    return {
                        "id"        : view.id,
                        "size"      : {
                            "width"   : view.size.width,
                            "height"  : view.size.height
                        },
                        "position"  : {
                            "top"     : view.position.top,
                            "left"    : view.position.left
                        },
                        "row"       : view.row,
                        "column"    : view.column
                    }
                })
            }
        });
    }

    isValid(views_settings: Array<any>){
        let result  = true,
            test    = /[^\d\.%\-]/gi;
        views_settings.forEach((view) => {
            if (typeof view.size.width      === 'string' && typeof view.size.height     === 'string' &&
                typeof view.position.top    === 'string' && typeof view.position.left   === 'string'){
                if (~view.size.width.search(test) || ~view.size.height.search(test) || ~view.position.top.search(test) || ~view.position.left.search(test)){
                    result = false;
                }
            } else {
                result = false;
            }
        });
        return result;
    }
}

interface ViewState{
    top     : string;
    left    : string;
    width   : string;
    height  : string;
}

class Calculator{
    public width        : number = -1;
    public height       : number = -1;
    public rows         : number = -1;
    public columns      : number = -1;
    public _columns     : number = -1;
    public count        : number = -1;
    private sizeGetter  : Function = null;
    public emitter      : EventEmitter<any> = new EventEmitter();

    constructor(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.HOLDER_VIEWS_RESIZE, this.onHolderResize.bind(this));
    }

    isSizeValid(){
        return this.height > 0 ? (this.width > 0 ? true : false) : false;
    }

    recheckSize(){
        if (!this.isSizeValid() && typeof this.sizeGetter === 'function') {
            this.onHolderResize(this.sizeGetter(), null);
        }
    }

    onHolderResize(size: any, sizeGetter: Function){
        this.height     = size.height;
        this.width      = size.width;
        typeof sizeGetter === 'function' && (this.sizeGetter = sizeGetter);
        this.isSizeValid() && this.emitter.emit();
    }

    reset(views:Array<ViewClass>){
        views = views.map((view : ViewClass)=>{
            view.size.width     = null;
            view.size.height    = null;
            view.position.left  = null;
            view.position.top   = null;
            return view;
        });
        return views;
    }

    getStateCopy(view: ViewClass){
        return {
            top     : view.position.top,
            left    : view.position.left,
            width   : view.size.width,
            height  : view.size.height
        } as ViewState;
    }

    updateState(view: ViewClass, state: ViewState){
        if (view.position.top !== state.top || view.position.left !== state.left || view.size.width !== state.width || view.size.height !== state.height){
            view.__updated = true;
        }
        return view;
    }

    percentX(px: number){
        this.recheckSize();
        return (100 / this.width) * px;
    }

    percentY(px: number){
        this.recheckSize();
        return (100 / this.height) * px;
    }

    recalculateBasic(views: Array<ViewClass>){
        this.columns    = Math.round(Math.sqrt(views.length));
        this.rows       = Math.ceil(views.length / this.columns);
        this._columns   = views.length - (this.rows - 1) * this.columns;
        this.count      = views.length;
    }

    recalculate(views: Array<ViewClass>){
        if (this.isRecalculationNeeded(views)){
            return this.calculate(views);
        } else {
            this.recalculateBasic(views);
            return views;
        }
    }

    isRecalculationNeeded(views: Array<ViewClass>){
        let result = false;
        if (views.length !== this.count && this.count !== -1){
            result = true;
        } else {
            views.forEach((view)=>{
                if (!result){
                    view.position.left  === -1 && (result = true);
                    view.position.top   === -1 && (result = true);
                    view.size.width     === -1 && (result = true);
                    view.size.height    === -1 && (result = true);
                    view.row            === -1 && (result = true);
                    view.column         === -1 && (result = true);
                }
            });
        }
        return result;
    }

    calculate(views: Array<ViewClass>){
        this.recheckSize();
        this.recalculateBasic(views);
        let columns     = this.columns,
            rows        = this.rows,
            column      = 0,
            row         = 0,
            top         = 0,
            top_step    = this.height / rows,
            left        = 0,
            count       = views.length;
        views           = views.map((view, index)=>{
            let in_column       = (count - index) >= columns ? columns : ( count - (rows - 1) * columns),
                left_step       = this.width / in_column,
                state           = this.getStateCopy(view);
            view.position.left  = this.percentX(left)                   + '%';
            view.position.top   = this.percentY(top)                    + '%';
            view.size.width     = this.percentX(this.width / in_column) + '%';
            view.size.height    = this.percentY(this.height / rows)     + '%';
            view.row            = row;
            view.column         = column;
            column += 1;
            if (column === columns){
                column  = 0;
                row     += 1;
                top     += top_step;
                left    = 0;
            } else {
                left    += left_step;
            }
            return this.updateState(view, state);
        });
        return views;
    }

    resizeHeightTop(views: Array<ViewClass>, row: number, column: number, dY: number){
        return views.map((view)=>{
            let state = this.getStateCopy(view);
            if (view.row === row - 1 || view.row === row){
                let height  = parseFloat(view.size.height as string),
                    top     = -1;
                if (view.row < row){
                    view.size.height    = (height   - this.percentY(dY)) + '%';
                }
                if (view.row === row){
                    top                 = parseFloat(view.position.top as string);
                    view.position.top   = (top      - this.percentY(dY)) + '%';
                    view.size.height    = (height   + this.percentY(dY)) + '%';
                }
            }
            return this.updateState(view, state);
        });
    }

    resizeHeightBottom(views: Array<ViewClass>, row: number, column: number, dY: number){
        return views.map((view)=>{
            let state = this.getStateCopy(view);
            if (view.row === row + 1 || view.row === row){
                let height  = parseFloat(view.size.height as string),
                    top     = -1;
                if (view.row === row){
                    view.size.height    = (height   - this.percentY(dY)) + '%';
                }
                if (view.row > row){
                    top                 = parseFloat(view.position.top as string);
                    view.size.height    = (height   + this.percentY(dY)) + '%';
                    view.position.top   = (top      - this.percentY(dY)) + '%';
                }
            }
            return this.updateState(view, state);
        });
    }

    resizeWidthLeft(views: Array<ViewClass>, row: number, column: number, dX: number){
        return views.map((view)=>{
            function apply(){
                if (view.column === column){
                    width               = parseFloat(view.size.width as string);
                    left                = parseFloat(view.position.left as string);
                    view.size.width     = (width    + this.percentX(dX)) + '%';
                    view.position.left  = (left     - this.percentX(dX)) + '%';
                }
                if (view.column < column){
                    width               = parseFloat(view.size.width as string);
                    view.size.width     = (width    -  this.percentX(dX)) + '%';
                }
            };
            let width   = -1,
                left    = -1,
                state   = this.getStateCopy(view);
            if (view.column === column - 1 || view.column === column){
                if (this._columns === this.columns){
                    apply.call(this);
                } else {
                    if (row === this.rows - 1){
                        view.row === this.rows - 1 && apply.call(this);
                    } else {
                        view.row !== this.rows - 1 && apply.call(this);
                    }
                }
            }
            return this.updateState(view, state);
        });
    }

    resizeWidthRight(views: Array<ViewClass>, row: number, column: number, dX: number){
        return views.map((view)=>{
            function apply(){
                if (view.column === column){
                    width               = parseFloat(view.size.width as string);
                    view.size.width     = (width    - this.percentX(dX)) + '%';
                }
                if (view.column > column){
                    width               = parseFloat(view.size.width as string);
                    left                = parseFloat(view.position.left as string);
                    view.size.width     = (width    + this.percentX(dX)) + '%';
                    view.position.left  = (left     - this.percentX(dX)) + '%';
                }
            };
            let width   = -1,
                left    = -1,
                state   = this.getStateCopy(view);
            if (view.column === column + 1 || view.column === column){
                if (this._columns === this.columns){
                    apply.call(this);
                } else {
                    if (row === this.rows - 1){
                        view.row === this.rows - 1 && apply.call(this);
                    } else {
                        view.row !== this.rows - 1 && apply.call(this);
                    }
                }
            }
            return this.updateState(view, state);
        });
    }


    resize(views: Array<ViewClass>, target: ViewClass, event: VIEW_RESIZE){
        switch (event.mode){
            case RESIZE_MODES.TOP:
                return this.resizeHeightTop     (views, target.row, target.column, event.dY);
            case RESIZE_MODES.BOTTOM:
                return this.resizeHeightBottom  (views, target.row, target.column, event.dY);
            case RESIZE_MODES.LEFT:
                return this.resizeWidthLeft     (views, target.row, target.column, event.dX);
            case RESIZE_MODES.RIGHT:
                return this.resizeWidthRight    (views, target.row, target.column, event.dX);
        }
        return views;
    }

    beforeUpdate(views: Array<ViewClass>){
        return views.map((view)=>{
            view.__updated = false;
            return view;
        });
    }

    afterUpdate(views: Array<ViewClass>){
        return views.map((view : ViewClass)=>{
            view.__updated && view.forceUpdateContent();
            view.__updated = false;
            return view;
        });
    }

}

@Injectable()

export class ServiceViews{

    private loader      : DefaultsLoader    = new DefaultsLoader();
    private calculator  : Calculator        = new Calculator();
    private defaults    : Array<any>        = null;
    private views       : Object            = Object.assign({}, Configuration.sets.VIEWS);

    public current      : Array<any>        = [];

    constructor (){
        this.defaults = this.loader.load();
        this.convert();
        this.addRefreshHandles();
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE,                   this.onVIEW_RESIZE.                 bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE_STARTED,           this.onVIEW_RESIZE_STARTED.         bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE_FINISHED,          this.onVIEW_RESIZE_FINISHED.        bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.REMOVE_VIEW,                   this.onREMOVE_VIEW.                 bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.ADD_VIEW,                      this.onADD_VIEW.                    bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEW_SWITCH_POSITION_BETWEEN,  this.onVIEW_SWITCH_POSITION_BETWEEN.bind(this));
        this.calculator.emitter.subscribe(this.onRecalculate.bind(this));
    }

    onREMOVE_VIEW(GUID: string){
        let index = this.getViewByGUID(GUID).index;
        if (~index){
            this.current.splice(index,1);
            this.refreshViews();
        }
    }

    onADD_VIEW(ID: string){
        let view = this.getDefaultView(ID);
        if (view !== null){
            this.current.push(view);
            this.addRefreshHandles();
            this.refreshViews();
        }
    }

    refreshViews(){
        this.current = this.calculator.recalculate(this.current);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEWS_COLLECTION_UPDATED);
        this.loader.save(this.current);
    }

    onRecalculate(offsets: any){
    }

    getViewByGUID(GUID: string) : any{
        let view    = null,
            index   = -1;
        this.current.forEach((_view: ViewClass, i)=>{
            if (_view.GUID === GUID){
                view    = _view;
                index   = i;
            }
        });
        return {
            view    : view,
            index   : index
        };
    }


    onVIEW_RESIZE(event: VIEW_RESIZE){
        let view = this.getViewByGUID(event.GUID).view;
        if (view !== void 0){
            if ((event.mode === RESIZE_MODES.TOP    && view.row     === 0) || (event.mode === RESIZE_MODES.BOTTOM   && view.row     === this.calculator.rows - 1) ||
                (event.mode === RESIZE_MODES.LEFT   && view.column  === 0) || (event.mode === RESIZE_MODES.RIGHT    && view.column  === this.calculator.columns - 1)){
                return false;
            } else {
                this.current = this.calculator.resize(this.current, view, event);
            }
        }
    }

    onVIEW_RESIZE_STARTED(){
        this.current = this.calculator.beforeUpdate(this.current);
    }

    onVIEW_RESIZE_FINISHED(){
        this.current = this.calculator.afterUpdate(this.current);
        this.loader.save(this.current);
    }

    onVIEW_SWITCH_POSITION_BETWEEN(GUID_A: string, GUID_B: string){
        function change(trg: any, src: any){
            trg.row           = src.row;
            trg.column        = src.column;
            trg.size.width    = src.size.width;
            trg.size.height   = src.size.height;
            trg.position.top  = src.position.top;
            trg.position.left = src.position.left;
        }
        let A = this.getViewByGUID(GUID_A).view,
            B = this.getViewByGUID(GUID_B).view;
        if (A !== null && B !== null){
            let _A = {
                row         : A.row,
                column      : A.column,
                size        : {
                    width   : A.size.width,
                    height  : A.size.height,
                },
                position    : {
                    top     : A.position.top,
                    left    : A.position.left,
                }
            };
            change(A, B);
            change(B, _A);
        }
        this.loader.save(this.current);
    }

    private validateMenu(items: Array<Object>){
        return items.map((item)=>{
            item['GUID'     ] === void 0 && (item['GUID'    ] = Symbol());
            item['disable'  ] === void 0 && (item['disable' ] = false);
            return item;
        });
    }

    private getDefaultView(ID: string){
        if (this.views[ID] !== void 0){
            let _view = this.views[ID];
            return {
                id          : ID,
                GUID        : GUID.generate(),
                name        : _view.name,
                description : _view.description,
                row         : -1,
                column      : -1,
                weight      : _view.weight,
                vertical    : _view.vertical,
                horizontal  : _view.horizontal,
                menu        : _view.menu instanceof Array ? this.validateMenu(_view.menu.map((item: any)=>{return Object.assign({}, item);})) : [],
                hide        : _view.hide instanceof Array ? _view.hide.map((item: any)=>{return item;}) : [],
                favorites   : true ? [] : [1],
                controller  : _view.controller,
                size        : {
                    width   : -1,
                    height  : -1,
                },
                position    : {
                    top     : -1,
                    left    : -1,
                }
            };
        } else {
            return null;
        }
    }

    private convert(){
        if (this.defaults instanceof Array){
            this.current = this.defaults.map((view)=>{
                if (this.views[view.id] !== void 0){
                    let _view = this.views[view.id];
                    return {
                        id          : view.id,
                        GUID        : GUID.generate(),
                        name        : _view.name,
                        description : _view.description,
                        row         : view.row      === void 0 ? -1 : view.row,
                        column      : view.column   === void 0 ? -1 : view.column,
                        weight      : _view.weight,
                        vertical    : _view.vertical,
                        horizontal  : _view.horizontal,
                        menu        : _view.menu instanceof Array ? this.validateMenu(_view.menu.map((item: any)=>{return Object.assign({}, item);})) : [],
                        hide        : _view.hide instanceof Array ? _view.hide.map((item: any)=>{return item;}) : [],
                        favorites   : [],
                        controller  : _view.controller,
                        size        : {
                            width   : view.size.width,
                            height  : view.size.height,
                        },
                        position    : {
                            top     : view.position.top,
                            left    : view.position.left,
                        }
                    };
                } else {
                    let msg = 'Unexpected error. Settings of views has description of view: "' + view.id + '", but cannot find basic description of this view in settings (./config/views.json).';
                    Logs.msg(msg, LogTypes.ERROR);
                    throw new Error(msg);
                }
            });
            this.current = this.calculator.recalculate(this.current);
        } else {
            this.current = [];
        }
    }

    private addRefreshHandles(){
        this.current instanceof Array && (this.current = this.current.map((view: ViewClass)=>{
            view.forceUpdateContent === void 0 && (view.forceUpdateContent = (function () {
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT, this.GUID);
            }.bind(view)));
            return view;
        }));
    }

    getViews() : ViewClass[]{
        return this.current;
    }
}
