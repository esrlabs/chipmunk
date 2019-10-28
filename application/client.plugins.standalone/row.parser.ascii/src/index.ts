import { ASCIIColorsParser } from './parser';
import * as Toolkit from 'chipmunk.client.toolkit';

const gate: Toolkit.APluginServiceGate | undefined = (window as any).logviewer;
if (gate === undefined) {
    console.error(`Fail to find logviewer gate.`);
} else {
    gate.setPluginExports({
        parser: new ASCIIColorsParser(),
    });
}
