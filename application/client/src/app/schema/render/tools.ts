import { Implementation as Dlt } from './dlt';
import { Implementation as Text } from './text';
import { Render } from './index';
import { Columns } from './columns';

export function getRenderFor(): {
    dlt(): Render<Columns>;
    pcap(): Render<Columns>;
    text(): Render<void>;
    any(): Render<void>;
} {
    return {
        dlt: (): Render<Columns> => {
            return new Dlt();
        },
        pcap: (): Render<Columns> => {
            return new Dlt();
        },
        text: (): Render<void> => {
            return new Text();
        },
        any: (): Render<void> => {
            return new Text();
        },
    };
}
