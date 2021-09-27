import { ViewOutputComponent } from '../components/views/output/component';

export const DefaultViews: IDefaultView[] = [
    {
        guid: 'output',
        name: 'Output',
        component: ViewOutputComponent,
    },
];

export interface IDefaultView {
    guid: string;
    name: string;
    component: any;
}
