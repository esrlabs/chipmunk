"use strict";
var component_1 = require("./list/component");
var component_2 = require("./search.results/component");
var component_3 = require("./chart/component");
var component_4 = require("./statemonitor/component");
var component_5 = require("./streamsender/component");
var component_6 = require("./markers/component");
var viewsControllersListObj = {
    ViewControllerList: component_1.ViewControllerList,
    ViewControllerSearchResults: component_2.ViewControllerSearchResults,
    ViewControllerChart: component_3.ViewControllerChart,
    ViewControllerStateMonitor: component_4.ViewControllerStateMonitorMain,
    ViewControllerStreamSender: component_5.ViewControllerStreamSender,
    ViewControllerMarkers: component_6.ViewControllerMarkers
};
exports.viewsControllersListObj = viewsControllersListObj;
var viewsControllersListArr = [
    component_1.ViewControllerList,
    component_2.ViewControllerSearchResults,
    component_3.ViewControllerChart,
    component_4.ViewControllerStateMonitorMain,
    component_5.ViewControllerStreamSender,
    component_6.ViewControllerMarkers
];
exports.viewsControllersListArr = viewsControllersListArr;
//# sourceMappingURL=controllers.list.js.map