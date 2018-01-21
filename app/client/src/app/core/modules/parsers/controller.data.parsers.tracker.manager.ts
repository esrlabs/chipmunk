import { configuration          } from '../../../core/modules/controller.config.js';
import { events as Events       } from '../../../core/modules/controller.events.js';
import { localSettings, KEYs    } from '../../../core/modules/controller.localsettings.js';

declare var Configuration: any;//We need global one to support worker

const
    DEFAULTS = {
        LINE_COLOR: 'rgb(20,20,20)',
        TEXT_COLOR: 'rgb(20,20,20)'
    };

const
    SETTINGS = {
        SETs : 'SETs'
    };

class Manager{

    load(){
        let settings = localSettings.get();
        if (settings[KEYs.view_charts] !== void 0 && settings[KEYs.view_charts] !== null && settings[KEYs.view_charts][SETTINGS.SETs] !== void 0){
            return Object.assign({}, settings[KEYs.view_charts][SETTINGS.SETs]);
        } else if (Object.keys(configuration.sets).length > 0) {
            return Object.assign({}, configuration.sets.VIEW_TRACKER.sets);
        } else if (typeof Configuration !== 'undefined'){
            return Object.assign({}, Configuration.sets.VIEW_TRACKER.sets);
        } else {
            return null;
        }
    }

    save(sets: any, needParsing : boolean = true){
        localSettings.reset(KEYs.view_charts, 'update');
        localSettings.set({
            [KEYs.view_charts] : {
                [SETTINGS.SETs] : sets
            }
        });
        if (needParsing){
            Events.trigger(configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED);
        } else {
            Events.trigger(configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_STYLE_UPDATED);
        }
    }

    update(GUID: string, updated: any, needParsing : boolean = true){
        let sets = this.load();
        if (sets[GUID] !== void 0) {
            sets[GUID] = updated;
            this.save(sets, needParsing);
        }
    }

    add(set: any){
        let sets = this.load();
        if (sets[set.name] === void 0) {
            sets[set.name] = set;
            this.save(sets);
        }
    }

    remove(GUID: string){
        let sets = this.load();
        if (sets[GUID] !== void 0) {
            delete sets[GUID];
            this.save(sets);
        }
    }

};

export { Manager, DEFAULTS }