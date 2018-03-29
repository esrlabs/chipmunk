"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const platform_browser_dynamic_1 = require("@angular/platform-browser-dynamic");
const app_module_1 = require("./app/app.module");
const core_load_1 = require("./app/core/core.load");
const core_1 = require("@angular/core");
core_1.enableProdMode();
core_load_1.loader.init(() => {
    platform_browser_dynamic_1.platformBrowserDynamic().bootstrapModule(app_module_1.AppModule).then((ref) => { });
});
//# sourceMappingURL=main.js.map