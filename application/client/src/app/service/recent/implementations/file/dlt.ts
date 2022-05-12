import { Base } from './base';

export class Dlt extends Base {
    public stats: {
        errors: number;
        warn: number;
        info: number;
        debug: number;
        verbose: number;
    } = {
        errors: 0,
        warn: 0,
        info: 0,
        debug: 0,
        verbose: 0,
    };

    public struct: {
        app_ids: string[];
        context_ids: string[];
        ecu_ids: string[];
    } = {
        app_ids: [],
        context_ids: [],
        ecu_ids: [],
    };
}
