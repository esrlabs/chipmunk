import { ControllerSessionScope } from '../controller/controller.session.tab.scope';
import { ControllerSessionTabStreamOutput } from '../controller/controller.session.tab.stream.output';

export interface IOutputRenderInputs {
    str: string;
    sessionId: string;
    position: number;
    pluginId: number;
    scope: ControllerSessionScope;
    output: ControllerSessionTabStreamOutput;
}

export abstract class AOutputRenderComponent {

    abstract update(inputs: IOutputRenderInputs): void;

}
