import { TestBed } from '@angular/core/testing';

import { PluginCService } from './plugin-c.service';

describe('PluginCService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: PluginCService = TestBed.get(PluginCService);
    expect(service).toBeTruthy();
  });
});
