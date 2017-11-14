import { Logs, TYPES                        } from '../tools.logs';
import { configuration as Configuration     } from '../../../core/modules/controller.config';
import { events as Events                   } from '../../../core/modules/controller.events';
import { localSettings, KEYs                } from '../../../core/modules/controller.localsettings';

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
        } else {
            return Object.assign({}, Configuration.sets.VIEW_TRACKER.sets);
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
            Events.trigger(Configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED);
        } else {
            Events.trigger(Configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_STYLE_UPDATED);
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