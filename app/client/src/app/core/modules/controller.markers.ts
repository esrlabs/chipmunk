import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';
import { localSettings, KEYs                    } from '../../core/modules/controller.localsettings';
import { Marker                                 } from "../../views/markers/marker/interface.marker";

const SETTINGS = {
    LIST_KEY    : 'LIST_KEY'
};

class MarkersController {

    public markers          : Array<Marker>         = [];

    public init(callback : Function = null){
        [   Configuration.sets.SYSTEM_EVENTS.MARKERS_GET_ALL].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.loadMarkers();
        this.onMarkerChanges();
        typeof callback === 'function' && callback();
    }

    onMarkerChanges(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED, this.getActiveMarkers());
    }

    loadMarkers(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.view_markers] !== void 0 && settings[KEYs.view_markers] !== null && settings[KEYs.view_markers][SETTINGS.LIST_KEY] instanceof Array){
            this.markers = settings[KEYs.view_markers][SETTINGS.LIST_KEY].map((marker : any)=>{
                return marker;
            });
        }
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

    onMARKERS_GET_ALL(callback: Function){
        this.loadMarkers();
        typeof callback === 'function' && callback(this.getActiveMarkers());
    }

}


export { MarkersController }

