/*
* @description Controller of loading all components of application
*
* Logic of work:
* In section #1 developer define reference to module, which should be loaded and initialized.
* Module should me implementation of interface (interfaces/interface.module.initiable/InitiableModule).
* It means, module should have method init(callback:Function).
*
* In section #2-3 developer define name of tasks and references between tasks and modules.
*
* In section #4 developer define ordering of loading and initialization of modules
* */

/*
* @description Section #1: references to modules, which should be loaded and initialized
* */
import { configuration      } from './modules/controller.config';
import { locale             } from './modules/tools.localization';
import { Logs               } from './modules/tools.logs';
import { events             } from './modules/controller.events';
import { dataController     } from './modules/controller.data';
import { versionController  } from './modules/controller.version';

/*
* @description Section #2: name (aliases) of tasks
* */
const TASKS = {
    LOGS    : Symbol(),
    LOCALE  : Symbol(),
    CONFIG  : Symbol(),
    VERSION : Symbol(),
    EVENTS  : Symbol(),
    DATA    : Symbol()
};

/*
* @description Section #3: references between tasks and modules
* */
const RUNNERS = {
    [TASKS.LOGS]    : Logs,
    [TASKS.LOCALE]  : locale,
    [TASKS.CONFIG]  : configuration,
    [TASKS.VERSION] : versionController,
    [TASKS.EVENTS]  : events,
    [TASKS.DATA]    : dataController
};

/*
* @description Section #4: ordering of processing of tasks
* */
const ORDERING = [
    [TASKS.LOGS],
    [TASKS.CONFIG],
    [TASKS.VERSION],
    [TASKS.LOCALE],
    [TASKS.EVENTS],
    [TASKS.DATA]
];

/*
* @description Class, which implement loading of modules. */
class Loader {
    private queue       : any[]                 = [];
    private callback    : Function              = null;

    private getPromise(module : any){
        return new Promise((resolve, reject)=>{
            module['init'](()=>{
                resolve();
            });
        });
    }

    private getQueue(){
        let tasks = this.queue.shift();
        return tasks.map((task : string)=>{
            return this.getPromise(RUNNERS[task]);
        });
    }

    private nextInQueue(){
        Promise.all(this.getQueue()).then(()=>{
            if (this.queue.length > 0){
                this.nextInQueue();
            } else {
                this.callback();
            }

        }).catch((error)=>{
            let message = 'no error details';
            if (typeof error === 'object' && error !== null && typeof error.message === 'string'){
                message = error.message;
            }
            throw new Error('Cannot normally finish loading of application [core.load]. Error: ' + message);
        });
    }

    init(callback: Function = null){
        this.queue.push(...ORDERING);
        this.callback = callback;
        this.nextInQueue();
    }
}

let loader = new Loader();

export { loader}