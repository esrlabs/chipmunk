import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabStreamOutput } from '../../../output/controller.session.tab.stream.output';
import { ControllerSessionScope } from '../../../scope/controller.session.tab.scope';
import { Session } from '../../../../session';
import { IPCMessages as IPC } from '../../../../../../services/service.electron.ipc';
import { EChartType } from '../../../../../../components/views/chart/charts/charts';
import { Importable } from '../../../importer/controller.session.importer.interface';
import {
    ChartRequest,
    IChartUpdateEvent,
    IChartsStorageUpdated,
    ChartsStorage,
    IChartDescOptional,
} from './controller.session.tab.search.charts.storage';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';

import ServiceElectronIpc from '../../../../../../services/service.electron.ipc';
import OutputParsersService from '../../../../../../services/standalone/service.output.parsers';
import EventsSessionService from '../../../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IChartMatch {
    row: number;
    value: string[] | undefined;
}

export interface IChartData {
    [source: string]: IChartMatch[];
}

export class ChartData {

    private _data: IChartData = {};

    public from(src: IPC.TExtractedValues): ChartData {
        this._data = {};
        src.forEach((values: IPC.IExtractedValue) => {
            values.values.forEach((value: IPC.IExtractedMatch) => {
                const filter = value.filter.filter;
                if (this._data[filter] === undefined) {
                    this._data[filter] = [];
                    this._data[filter].push({
                        row: values.position,
                        value: value.values,
                    });
                } else {
                    const index: number = this._data[filter].findIndex(v => v.row === values.position);
                    if (index === -1) {
                        this._data[filter].push({
                            row: values.position,
                            value: value.values,
                        });
                    } else {
                        this._data[filter][index].value = this._data[filter][index].value.concat(value.values);
                    }
                }
            });
        });
        return this;
    }

    public get(): IChartData {
        return this._data;
    }

}
