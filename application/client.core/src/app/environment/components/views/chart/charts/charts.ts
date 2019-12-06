import ChartStepped from './chart.stepped';
import ChartSmooth from './chart.smooth';
import { AChart, EChartType } from './chart.interface';

const charts = {
    [EChartType.stepped]: new ChartStepped(),
    [EChartType.smooth]: new ChartSmooth(),
};

export { AChart, IOption, EOptionType, IOptionsObj, EChartType } from './chart.interface';

export function getController(type: EChartType): AChart | undefined {
    return charts[type];
}

export default charts;
