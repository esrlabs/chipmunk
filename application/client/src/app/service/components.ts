import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { Subjects, Subject } from '@platform/env/subscription';
import {
    LoadingDoneEvent,
    LoadingCancelledEvent,
    LoadingErrorEvent,
    LoadingErrorsEvent,
} from '@platform/types/components';

import * as Events from '@platform/ipc/event/index';
import * as Requests from '@platform/ipc/request/index';

import { Field, FieldDesc, Ident, OutputRender, SessionAction } from '@platform/types/bindings';

@SetupService(services['components'])
export class Service extends Implementation {
    /**
     * A collection of subjects used for broadcasting events related to component settings loading and validation.
     * These subjects are used to notify the client about the progress and results of loading static and lazy settings.
     */
    public subjects: Subjects<{
        /**
         * Emitted when lazy settings have finished loading.
         * Contains the fully resolved settings as if they were static.
         */
        LoadingDone: Subject<LoadingDoneEvent>;

        /**
         * Emitted when an error occurs while retrieving the component's configuration schema.
         * Contains identifiers of the fields for which schema retrieval failed.
         */
        LoadingErrors: Subject<LoadingErrorsEvent>;

        /**
         * Emitted in response to a validation request.
         * Contains field-level validation errors for the submitted configuration data.
         */
        LoadingError: Subject<LoadingErrorEvent>;

        /**
         * Emitted when lazy loading of settings has been cancelled.
         * Typically triggered when the user aborts the session before completion.
         */
        LoadingCancelled: Subject<LoadingCancelledEvent>;
    }> = new Subjects({
        LoadingDone: new Subject<LoadingDoneEvent>(),
        LoadingErrors: new Subject<LoadingErrorsEvent>(),
        LoadingError: new Subject<LoadingErrorEvent>(),
        LoadingCancelled: new Subject<LoadingCancelledEvent>(),
    });

    public override ready(): Promise<void> {
        this.register(
            Events.IpcEvent.subscribe<Events.Components.LoadingDone.Event>(
                Events.Components.LoadingDone.Event,
                (event) => {
                    this.subjects.get().LoadingDone.emit(event.event);
                },
            ),
            Events.IpcEvent.subscribe<Events.Components.LoadingErrors.Event>(
                Events.Components.LoadingErrors.Event,
                (event) => {
                    this.subjects.get().LoadingErrors.emit(event.event);
                },
            ),
            Events.IpcEvent.subscribe<Events.Components.LoadingError.Event>(
                Events.Components.LoadingError.Event,
                (event) => {
                    this.subjects.get().LoadingError.emit(event.event);
                },
            ),
            Events.IpcEvent.subscribe<Events.Components.LoadingCancelled.Event>(
                Events.Components.LoadingCancelled.Event,
                (event) => {
                    this.subjects.get().LoadingCancelled.emit(event.event);
                },
            ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return Promise.resolve();
    }

    /**
     * Aborts the lazy loading process for the specified configuration fields.
     *
     * The client receives the identifiers of fields marked for lazy loading
     * along with the `getOptions` call. This method can be used to cancel
     * loading for any of those fields, for example, if the user closes the session
     * or navigates away before the data is fully loaded.
     *
     * @param fields - An array of field identifiers for which lazy loading should be cancelled.
     * @returns A promise that resolves when the cancellation has been processed.
     */
    public abort(fields: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Components.Abort.Response,
                new Requests.Components.Abort.Request({
                    fields,
                }),
            )
                .then((_) => {
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Retrieves the configuration schema (field descriptions) for the specified target components,
     * such as a parser and a data source.
     *
     * Note that the returned schema may vary depending on the `SessionAction` context.
     * For example, the DLT parser will include a lazy setting for "DLT Statistics" when the session
     * is based on a DLT file. However, the same parser will not include this setting if the session
     * refers to a stream instead of a file.
     *
     * @param origin - The session context (`SessionAction`) indicating the data source type (e.g., file or stream).
     * @param targets - An array of component identifiers (usually parser and source) whose configuration schemas should be retrieved.
     * @returns A promise that resolves to a map of component IDs to arrays of `FieldDesc` describing the configuration fields.
     */
    public getOptions(origin: SessionAction, targets: string[]): Promise<Map<string, FieldDesc[]>> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Components.GetOptions.Response,
                new Requests.Components.GetOptions.Request({
                    origin,
                    targets,
                }),
            )
                .then((response) => {
                    resolve(response.options);
                })
                .catch(reject);
        });
    }

    /**
     * Retrieves the output render definition for displaying parsed data.
     *
     * The provided `uuid` is expected to refer to a parser, since the parser
     * is responsible for defining how the data should be visually represented.
     *
     * @param uuid - The unique identifier of the parser component.
     * @returns A promise that resolves to the `OutputRender` definition used for rendering output,
     *          or `null`/`undefined` if no render is available.
     */
    public getOutputRender(uuid: string): Promise<OutputRender | null | undefined> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Components.GetOutputRender.Response,
                new Requests.Components.GetOutputRender.Request({
                    uuid,
                }),
            )
                .then((response) => {
                    resolve(response.render);
                })
                .catch(reject);
        });
    }

    /**
     * Validates the provided configuration fields for the specified component.
     *
     * Validation is context-aware and may depend on the `SessionAction` (e.g., file vs. stream).
     * The result is a map where each key corresponds to a field identifier, and the value
     * is a human-readable error message describing the validation issue.
     *
     * @param origin - The session context (`SessionAction`) indicating the source type (e.g., file, stream).
     * @param target - The identifier of the component whose settings are being validated.
     * @param fields - An array of field values to be validated.
     * @returns A promise that resolves to a map of field IDs to validation error messages.
     *          If a field is valid, it will not appear in the result.
     */
    public validate(
        origin: SessionAction,
        target: string,
        fields: Field[],
    ): Promise<Map<string, string>> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Components.Validate.Response,
                new Requests.Components.Validate.Request({
                    origin,
                    target,
                    fields,
                }),
            )
                .then((response) => {
                    resolve(response.errors);
                })
                .catch(reject);
        });
    }

    /**
     * Provides access to the list of available components for the given session context.
     *
     * This includes both sources and parsers. The list may vary depending on the `SessionAction`,
     * which defines the context (e.g., file-based vs. stream-based sessions).
     *
     * @param origin - The session context (`SessionAction`) determining which components are applicable.
     * @returns An object with methods to retrieve available component identifiers.
     */
    public get(origin: SessionAction): {
        /**
         * Retrieves a list of available source components.
         *
         * @returns A promise that resolves to an array of `Ident` objects representing source components.
         */
        sources(): Promise<Ident[]>;

        /**
         * Retrieves a list of available parser components.
         *
         * @returns A promise that resolves to an array of `Ident` objects representing parser components.
         */
        parsers(): Promise<Ident[]>;
    } {
        return {
            sources: (): Promise<Ident[]> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Components.GetSources.Response,
                        new Requests.Components.GetSources.Request({
                            origin,
                        }),
                    )
                        .then((response) => {
                            resolve(response.list);
                        })
                        .catch(reject);
                });
            },
            parsers: (): Promise<Ident[]> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Components.GetParsers.Response,
                        new Requests.Components.GetParsers.Request({
                            origin,
                        }),
                    )
                        .then((response) => {
                            resolve(response.list);
                        })
                        .catch(reject);
                });
            },
        };
    }

    /**
     * Retrieves the identifier metadata for the specified component.
     *
     * The provided `uuid` should correspond to a registered component (e.g., parser or source).
     * If the component exists, its `Ident` information will be returned; otherwise, the result
     * will be `undefined`.
     *
     * @param uuid - The unique identifier of the component.
     * @returns A promise that resolves to the `Ident` object describing the component,
     *          or `undefined` if no matching component is found.
     */
    public getIdent(uuid: string): Promise<Ident | undefined> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Components.GetIdent.Response,
                new Requests.Components.GetIdent.Request({
                    target: uuid,
                }),
            )
                .then((response) => {
                    resolve(response.ident);
                })
                .catch(reject);
        });
    }
}
export interface Service extends Interface {}
export const components = register(new Service());
