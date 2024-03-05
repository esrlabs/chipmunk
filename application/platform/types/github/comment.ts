import {
    CommentDefinition,
    CommentState,
    CommentedSelection,
    Response,
    SelectionPoint,
} from '../comment';

import * as validator from '../../env/obj';

const protocols: { [key: string]: (def: CommentDefinition) => CommentDefinition } = {
    '0.0.1': (def: CommentDefinition): CommentDefinition => {
        validator.isObject(def);
        def.uuid = validator.getAsNotEmptyString(def, 'uuid');
        def.color = validator.getAsNotEmptyStringOrAsUndefined(def, 'color');
        def.state = validator.getAsNotEmptyString(def, 'state') as CommentState;
        def.created = validator.getAsValidNumber(def, 'created');
        def.modified = validator.getAsValidNumber(def, 'modified');
        def.selection = validator.getAsObj(def, 'selection');
        def.selection.text = validator.getAsString(def.selection, 'text');
        def.selection.start = validator.getAsObj(def.selection, 'start');
        def.selection.start.text = validator.getAsString(def.selection.start, 'text');
        def.selection.start.position = validator.getAsValidNumber(def.selection.start, 'position');
        def.selection.start.offset = validator.getAsValidNumber(def.selection.start, 'offset');
        def.selection.end = validator.getAsObj(def.selection, 'end');
        def.selection.end.text = validator.getAsString(def.selection.end, 'text');
        def.selection.end.position = validator.getAsValidNumber(def.selection.end, 'position');
        def.selection.end.offset = validator.getAsValidNumber(def.selection.end, 'offset');
        def.responses = validator.getAsArray(def, 'responses');
        def.responses.forEach((response) => {
            validator.isObject(response);
            response.created = validator.getAsValidNumber(response, 'created');
            response.modified = validator.getAsValidNumber(response, 'modified');
            response.uuid = validator.getAsNotEmptyString(response, 'uuid');
            response.comment = validator.getAsString(response, 'comment');
        });
        return def;
    },
};

export function getValidator(protocol: string): (def: CommentDefinition) => CommentDefinition {
    if (protocols[protocol] === undefined) {
        throw new Error(`No comments protocol v${protocol} is found`);
    }
    return protocols[protocol];
}

export { CommentDefinition, CommentState, CommentedSelection, Response, SelectionPoint, protocols };
