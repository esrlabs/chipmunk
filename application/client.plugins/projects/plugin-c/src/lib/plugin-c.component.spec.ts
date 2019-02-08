import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginCComponent } from './plugin-c.component';

describe('PluginCComponent', () => {
  let component: PluginCComponent;
  let fixture: ComponentFixture<PluginCComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PluginCComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PluginCComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
