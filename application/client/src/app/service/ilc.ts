/**
 * Declares and documents the global ILC (Internal Life Cycle) service, which can be injected
 * into any Angular service or component to provide standardized infrastructure utilities.
 *
 * @remarks
 * The `ILC` service serves as a central lifecycle-aware utility provider. Its key responsibilities include:
 *
 * - Automatic delivery of the logging system via `this.ilc().log()`, ensuring consistent logging access across services and components.
 * - Managed subscription registration via `this.ilc().env()`, with automatic cleanup:
 *   - Particularly useful in Angular components, where any subscriptions registered through `ilc` are automatically unsubscribed
 *     when the component is destroyed.
 *   - This removes the need for manual cleanup in `ngOnDestroy` and protects against memory leaks or zombie callbacks.
 * - Access to globally available application services through a unified interface.
 * - Safe event subscription mechanism for internal service events:
 *   - Works similarly to the Angular lifecycle-aware subscription model.
 *   - If a service or component is destroyed, the associated subscriptions are automatically removed.
 *
 * @recommendation
 * It is highly recommended to register **all** event subscriptions through the `ILC` system to prevent:
 * - Memory leaks caused by unreleased handlers.
 * - Logic executing on components or services that have already been destroyed.
 *
 * @example Angular Component Injection
 * ```ts
 * @Component({
 *   selector: 'app-views-attachments-list',
 *   templateUrl: './template.html',
 *   styleUrls: ['./styles.less'],
 *   standalone: false,
 * })
 * @Ilc() // Injects the ILC instance
 * export class Attachments extends ChangesDetector implements AfterContentInit {
 *   public method() {
 *     this.ilc().log().error('Hello, Ilc!');
 *   }
 * }
 * ```
 *
 * @module
 * @public
 */
import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { Events, Declarations } from '@service/ilc/events';
import { Channel } from '@service/ilc/events.channel';
import { Emitter } from '@service/ilc/events.emitter';
import { Services } from '@service/ilc/services';
import { Logger } from '@platform/log';
import { session, Session, UnboundTab } from '@service/session';
import { state } from '@service/state';
import { jobs } from '@service/jobs';
import { popup } from '@ui/service/popup';
import { notifications } from '@ui/service/notifications';
import { contextmenu } from '@ui/service/contextmenu';
import { layout } from '@ui/service/layout';
import { toolbar } from '@ui/service/toolbar';
import { sidebar } from '@ui/service/sidebar';
import { bridge } from '@service/bridge';
import { hotkeys } from '@service/hotkeys';
import { cli } from '@service/cli';
import { actions } from '@service/actions';
import { favorites } from '@service/favorites';
import { sys } from '@service/sys';
import { plugins } from './plugins';

import { Subscriber } from '@platform/env/subscription';

export { Channel, Emitter, Declarations, Services };

/**
 * Defines the internal ILC API used to expose core services and event infrastructure.
 *
 * @interface InternalAPI
 * @internal
 */
export interface InternalAPI {
    /**
     * Provides access to the internal communication channel.
     */
    channel: Channel;

    /**
     * Event emitter used for publishing events across the system.
     */
    emitter: Emitter;

    /**
     * Collection of globally available application services.
     */
    services: Services;

    /**
     * Logger instance scoped to the current component or service.
     */
    logger: Logger;
}

/**
 * Defines the environment-scoped subscription system.
 * Used for automatic cleanup of event listeners tied to component lifecycle.
 *
 * @interface Env
 * @internal
 */
export interface Env {
    /**
     * Subscription manager for registering lifecycle-aware event handlers.
     */
    subscriber: Subscriber;
}

/**
 * Provides access to session-related data within the component or service.
 *
 * @interface Accessor
 * @internal
 */
export interface Accessor {
    /**
     * Grants access to the current bound session.
     * The callback is invoked with the session instance, if available.
     *
     * @param cb - A callback to handle the current session.
     * @returns `true` if the session was available and the callback was called, otherwise `false`.
     */
    session: (cb: (session: Session) => void) => boolean;

    /**
     * Grants access to the unbound tab state.
     * The callback is invoked if the tab is not associated with a session.
     *
     * @param cb - A callback to handle the unbound tab state.
     * @returns `true` if unbound state was available and the callback was called, otherwise `false`.
     */
    unbound: (cb: (session: UnboundTab) => void) => boolean;
}

/**
 * Manages lifecycle hooks for cleanup logic.
 *
 * @interface Life
 * @internal
 */
export interface Life {
    /**
     * Registers a handler to be called automatically when the component or service is destroyed.
     *
     * @param handler - A cleanup function.
     */
    destroy: (handler: () => void) => void;
}

/**
 * The main public ILC interface available to Angular components and services via `this.ilc()`.
 *
 * @interface IlcInterface
 * @public
 */
export interface IlcInterface {
    /**
     * Returns a logger instance scoped to the current context.
     */
    log(): Logger;

    /**
     * Exposes internal ILC APIs: communication channels, emitter, services, and logger.
     * Use with caution - intended mostly for internal integration.
     */
    ilc(): InternalAPI;

    /**
     * Provides access to environment-level features, such as auto-cleanup subscriptions.
     */
    env(): Env;

    /**
     * Grants access to session state and unbound tab context.
     */
    access(): Accessor;

    /**
     * Registers destruction hooks for performing cleanup when the owning
     * component or service is destroyed.
     */
    life(): Life;
}

// System services
@DependOn(session)
@DependOn(state)
@DependOn(jobs)
@DependOn(bridge)
@DependOn(hotkeys)
@DependOn(cli)
@DependOn(actions)
@DependOn(favorites)
@DependOn(sys)
@DependOn(plugins)
// UI services
@DependOn(sidebar)
@DependOn(toolbar)
@DependOn(layout)
@DependOn(popup)
@DependOn(notifications)
@DependOn(contextmenu)
@SetupService(services['ilc'])
export class Service extends Implementation {
    private readonly _events: Events = new Events();

    public override destroy(): Promise<void> {
        this._events.destroy();
        return Promise.resolve();
    }

    public channel(owner: string, logger: Logger): Channel {
        return new Channel(owner, this._events, logger);
    }

    public emitter(owner: string, logger: Logger): Emitter {
        return new Emitter(owner, this._events, logger);
    }

    public services(owner: string, logger: Logger): Services {
        return new Services(owner, logger);
    }
}
export interface Service extends Interface {}
export const ilc = register(new Service());
