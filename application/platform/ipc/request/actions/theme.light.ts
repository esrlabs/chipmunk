import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'ThemeLightRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ThemeLightResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
