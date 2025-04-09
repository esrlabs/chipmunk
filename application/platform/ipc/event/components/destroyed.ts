import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'EmitComponentsDestroyed' })
export class Event extends SignatureRequirement {}

export interface Event extends Interface {}
