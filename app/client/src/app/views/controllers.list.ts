import { ViewControllerList             } from './list/component';
import { ViewControllerSearchResults    } from './search.results/component';
import { ViewControllerChart            } from './chart/component';
import { ViewControllerQuickChart       } from './quickchart/component';
import { ViewControllerStateMonitorMain } from './statemonitor/component';
import { ViewControllerStreamSender     } from './streamsender/component';
import { ViewControllerMarkers          } from './markers/component';
import { ViewControllerDLTMonitor       } from './dlt.monitor/component';

const viewsControllersListObj = {
    ViewControllerList          : ViewControllerList,
    ViewControllerSearchResults : ViewControllerSearchResults,
    ViewControllerChart         : ViewControllerChart,
    ViewControllerQuickChart    : ViewControllerQuickChart,
    ViewControllerStateMonitor  : ViewControllerStateMonitorMain,
    ViewControllerStreamSender  : ViewControllerStreamSender,
    ViewControllerMarkers       : ViewControllerMarkers,
    ViewControllerDLTMonitor    : ViewControllerDLTMonitor
};

const viewsControllersListArr = [
    ViewControllerList,
    ViewControllerSearchResults,
    ViewControllerChart,
    ViewControllerQuickChart,
    ViewControllerStateMonitorMain,
    ViewControllerStreamSender,
    ViewControllerMarkers,
    ViewControllerDLTMonitor
];

export { viewsControllersListObj, viewsControllersListArr }