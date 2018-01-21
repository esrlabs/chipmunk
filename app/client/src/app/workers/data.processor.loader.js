importScripts('../../node_modules/zone.js/dist/zone.js');
importScripts('../../node_modules/systemjs/dist/system.src.js');
importScripts('../../node_modules/systemjs/dist/system-polyfills.js');
importScripts('../../systemjs.config.js');
require = System.amdRequire;
var modules = {
    '../core/interfaces/interface.data.filter.js': true,
    '../core/modules/tools.logs.js': true,
    '../core/modules/parsers/controller.data.parsers.js': true,
    '../core/modules/controller.data.search.modes.js': true,
    '../core/modules/tools.guid.js': true,
    '../workers/data.processor.interfaces.js': true,
};
Object.keys(modules).forEach(function (url) {
    System.import(url).then(function () {
        delete modules[url];
        if (Object.keys(modules).length === 0) {
            importScripts('./data.processor.js');
        }
    });
}.bind(this));
//# sourceMappingURL=data.processor.loader.js.map