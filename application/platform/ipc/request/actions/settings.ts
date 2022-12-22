import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'SettingsDialogRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'SettingsDialogResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
