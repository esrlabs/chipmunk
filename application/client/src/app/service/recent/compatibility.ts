import { Entry } from '@platform/types/storage/entry';

import * as $ from '@platform/types/observe';
import * as Factory from '@platform/types/observe/factory';

// Interface belong to >= 3.8.1
interface IDLTFilters {
    app_ids?: string[];
    context_ids?: string[];
    ecu_ids?: string[];
}

// Interface belong to >= 3.8.1
interface IDLTOptions {
    logLevel: number;
    filters: IDLTFilters;
    fibex: string[];
    tz?: string;
}

export function optionsToParserSettings(
    options: IDLTOptions,
    with_storage_header: boolean,
    app_id_count: number,
    context_id_count: number,
): $.Parser.Dlt.IConfiguration {
    const filter_config: $.Parser.Dlt.IFilters = {
        min_log_level: options.logLevel,
        app_ids: options.filters.app_ids,
        context_ids: options.filters.context_ids,
        ecu_ids: options.filters.ecu_ids,
        app_id_count,
        context_id_count,
    };
    return {
        filter_config,
        fibex_file_paths: options.fibex.length > 0 ? options.fibex : undefined,
        with_storage_header,
    };
}

// This function has to be removed since v 3.9.x or 3.10.x (after a couple of
// update iterations)
export function from_3_8_1(entry: Entry): $.Observe {
    const action = JSON.parse(entry.content);
    let observe;
    if (action['file'] !== undefined) {
        if (action['file']['dlt'] !== undefined) {
            observe = new Factory.File()
                .asDlt(optionsToParserSettings(action['file']['dlt'], true, 0, 0))
                .type($.Types.File.FileType.Binary)
                .file(action['file']['filename'])
                .get();
        } else if (action['file']['pcap'] !== undefined) {
            observe = new Factory.File()
                .asDlt(optionsToParserSettings(action['file']['pcap']['dlt'], true, 0, 0))
                .type($.Types.File.FileType.PcapNG)
                .file(action['file']['filename'])
                .get();
        } else {
            observe = new Factory.File()
                .asText()
                .file(action['file']['filename'])
                .type($.Types.File.FileType.Text)
                .get();
        }
    } else if (action['dlt_stream'] !== undefined) {
        const defs = action['dlt_stream'];
        const source = defs['source'];
        const preconstructed = new Factory.Stream().asDlt(
            optionsToParserSettings(defs['options'], false, 0, 0),
        );
        if (source['process'] !== undefined) {
            preconstructed.process(source['process']);
        } else if (source['serial'] !== undefined) {
            preconstructed.serial(source['serial']);
        } else if (source['tcp'] !== undefined) {
            preconstructed.tcp(source['tcp']);
        } else if (source['udp'] !== undefined) {
            preconstructed.udp(source['udp']);
        } else {
            throw new Error(`Unknonw type of source for stream.`);
        }
        observe = preconstructed.get();
    } else if (action['text_stream'] !== undefined) {
        const defs = action['text_stream'];
        const source = defs['source'];
        const preconstructed = new Factory.Stream().asText();
        if (source['process'] !== undefined) {
            preconstructed.process(source['process']);
        } else if (source['serial'] !== undefined) {
            preconstructed.serial(source['serial']);
        } else if (source['tcp'] !== undefined) {
            preconstructed.tcp(source['tcp']);
        } else if (source['udp'] !== undefined) {
            preconstructed.udp(source['udp']);
        } else {
            throw new Error(`Unknonw type of source for stream.`);
        }
        observe = preconstructed.get();
    } else {
        throw new Error(`Unknonw type of action.`);
    }
    const error = observe.validate();
    if (error instanceof Error) {
        throw error;
    }
    return observe;
}
