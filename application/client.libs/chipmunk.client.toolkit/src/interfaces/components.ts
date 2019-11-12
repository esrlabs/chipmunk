/**
 * Description of Angular component
 * Used for injections and dynamic creating of components
 */
export interface IComponentInjection {

    /**
     * @property {string} id - id of injection
     */
    id: string;

    /**
     * @property {Angular.Component} factory - reference to Angular component
     */
    factory: any;

    /**
     * @property {boolean} resolved - shows: does component is resolved already or not.
     * As usual for components of core value should be false. For components of plugins - true.
     */
    resolved?: boolean;

    /**
     * @property {[key: string]: any} inputs - collection of any inputs
     * these inputs will be delivery into component (defined in property
     * factory).
     */
    inputs?: { [key: string]: any };
}
