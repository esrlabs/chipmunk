import { ParserExample } from './parser';
import * as Toolkit from 'logviewer.client.toolkit';

const gate: Toolkit.APluginServiceGate | undefined = (window as any).logviewer;
if (gate === undefined) {
    console.error(`Fail to find logviewer gate.`);
} else {
    gate.setPluginExports({
        example: new ParserExample(),
    });
}
