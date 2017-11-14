import { ViewControllerList             } from './list/component';
import { ViewControllerSearchResults    } from './search.results/component';
import { ViewControllerChart            } from './chart/component';
import { ViewControllerStateMonitorMain } from './statemonitor/component';
import { ViewControllerStreamSender     } from './streamsender/component';
import { ViewControllerMarkers          } from './markers/component';

const viewsControllersListObj = {
    ViewControllerList          : ViewControllerList,
    ViewControllerSearchResults : ViewControllerSearchResults,
    ViewControllerChart         : ViewControllerChart,
    ViewControllerStateMonitor  : ViewControllerStateMonitorMain,
    ViewControllerStreamSender  : ViewControllerStreamSender,
    ViewControllerMarkers       : ViewControllerMarkers
};

const viewsControllersListArr = [
    ViewControllerList,
    ViewControllerSearchResults,
    ViewControllerChart,
    ViewControllerStateMonitorMain,
    ViewControllerStreamSender,
    ViewControllerMarkers
];

export { viewsControllersListObj, viewsControllersListArr }