declare var importScripts: any;

importScripts('../../node_modules/zone.js/dist/zone.js');
importScripts('../../node_modules/systemjs/dist/system.src.js');
importScripts('../../node_modules/systemjs/dist/system-polyfills.js');
importScripts('../../systemjs.config.js');

declare var System: any;
require = System.amdRequire;

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