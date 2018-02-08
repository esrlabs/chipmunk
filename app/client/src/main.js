"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var platform_browser_dynamic_1 = require("@angular/platform-browser-dynamic");
var app_module_1 = require("./app/app.module");
var core_load_1 = require("./app/core/core.load");
var core_1 = require("@angular/core");
core_1.enableProdMode();
core_load_1.loader.init(function () {
    platform_browser_dynamic_1.platformBrowserDynamic().bootstrapModule(app_module_1.AppModule).then(function (ref) { });
});
//# sourceMappingURL=main.js.map