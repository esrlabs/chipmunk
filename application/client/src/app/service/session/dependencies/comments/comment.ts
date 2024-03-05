import { Recognizable } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { Json } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';
import { CommentDefinition } from '@platform/types/comment';
import * as obj from '@platform/env/obj';

export class Comment extends Json<Comment> implements Recognizable, Equal<Comment> {
    public static KEY: string = 'comment';

    public static fromJson(json: string): Comment | Error {
        try {
            const def: CommentDefinition = JSON.parse(json);
            def.uuid = obj.getAsString(def, 'uuid');
            def.selection = obj.getAsObj(def, 'selection');
            def.selection.start = obj.getAsObj(def.selection, 'start');
            def.selection.start.offset = obj.getAsValidNumber(def.selection.start, 'offset');
            def.selection.start.position = obj.getAsValidNumber(def.selection.start, 'position');
            def.selection.start.text = obj.getAsString(def.selection.start, 'text');
            def.selection.end = obj.getAsObj(def.selection, 'end');
            def.selection.end.offset = obj.getAsValidNumber(def.selection.end, 'offset');
            def.selection.end.position = obj.getAsValidNumber(def.selection.end, 'position');
            def.selection.end.text = obj.getAsString(def.selection.end, 'text');
            def.responses = obj.getAsArray(def, 'responses');
            for (const response of def.responses) {
                response.comment = obj.getAsString(response, 'comment');
                response.created = obj.getAsValidNumber(response, 'created');
                response.modified = obj.getAsValidNumber(response, 'modified');
                response.uuid = obj.getAsString(response, 'uuid');
            }
            def.created = obj.getAsValidNumber(def, 'created');
            def.modified = obj.getAsValidNumber(def, 'modified');
            def.color = obj.getAsNotEmptyStringOrAsUndefined(def, 'color');
            def.comment = obj.getAsString(def, 'comment');
            return new Comment(def);
        } catch (e) {
            return new Error(error(e));
        }
    }

    constructor(public readonly definition: CommentDefinition) {
        super();
    }

    public uuid(): string {
        return this.definition.uuid;
    }

    public isSame(comment: Comment): boolean {
        return comment.uuid() == this.definition.uuid;
    }

    public json(): {
        to(): string;
        from(str: string): Comment | Error;
        key(): string;
    } {
        return {
            to: (): string => {
                return JSON.stringify(this.definition);
            },
            from: (json: string): Comment | Error => {
                return Comment.fromJson(json);
            },
            key: (): string => {
                return Comment.KEY;
            },
        };
    }
}
