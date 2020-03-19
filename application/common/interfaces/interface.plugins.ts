import { IDependencies } from './interface.versions';

export interface IPlugin {
    name: string;                   
    url: string;                    
    file: string;                   
    version: string;                
    display_name: string;           
    description: string;            
    readme: string;
    icon: string;
    default: boolean;
    dependencies: IDependencies;
}