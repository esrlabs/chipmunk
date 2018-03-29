declare var importScripts: any;

importScripts('../../node_modules/zone.js/dist/zone.js');
importScripts('../../node_modules/systemjs/dist/system.src.js');
importScripts('../../systemjs.config.js');

declare var System: any;
require = System.amdRequire;

/*
* This is hack for typescript version > 2.1.6. Newest versions are added
* code into each module:
* Object.defineProperty(exports, "__esModule", { value: true });
* variable exports for sure isn't defined. So, it makes an error.
* Oldest version of TS doesn't do it.
* */
//Hack: start =============================================
declare var exports : any;
var exports: any = {};
//Hack: end ===============================================

var modules = {
    '../core/interfaces/interface.data.filter.js': true,
    '../core/modules/controller.data.search.modes.js': true,
    '../workers/data.processor.interfaces.js': true,
    '../workers/data.processor.strings.js': true
};

Object.keys(modules).forEach(function(url: string) {
    System.import(url).then(() => {
        delete modules[url];
        if (Object.keys(modules).length === 0) {
            importScripts('./data.processor.js');
        }
    }).catch((error: Error) => {
        console.log(error);
    });
}.bind(this));