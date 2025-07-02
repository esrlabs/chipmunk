import { PluginEntity } from '@platform/types/bindings';
import { Render } from './index';
import { Columns } from './columns';
import { Protocol } from '@platform/types/observe/parser';

export class Implementation extends Render<Columns> {
    private _columnsCount: number = 0;

    constructor(plugin: PluginEntity) {
        super();

        if (
            typeof plugin.info.render_options === 'object' &&
            'Parser' in plugin.info.render_options
        ) {
            const columns_options = plugin.info.render_options.Parser.columns_options;

            if (columns_options === null) {
                // Render options doesn't have columns.
                return;
            }

            const headers: {
                caption: string;
                desc: string;
            }[] = [];
            const widths: number[] = [];

            this._columnsCount = columns_options.columns.length;

            for (const column of columns_options.columns) {
                headers.push({ caption: column.caption, desc: column.description });
                widths.push(column.width);
            }

            this.setBoundEntity(
                new Columns(
                    // headers,
                    [],
                    true,
                    widths,
                    columns_options.min_width,
                    columns_options.max_width,
                ),
            );
        }
    }

    override protocol(): Protocol {
        return Protocol.Plugin;
    }

    public override columns(): number {
        return this._columnsCount;
    }

    public override delimiter(): string | undefined {
        return this._columnsCount > 0 ? `\u0004` : undefined;
    }
}
