describe('securityService advanced restrictions', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    jest.resetModules();
  });

  function loadSecurityService(envOverrides = {}) {
    jest.resetModules();
    process.env = { ...originalEnv, ...envOverrides };
    return require('../../src/services/securityService');
  }

  describe('checkGeoRestriction', () => {
    it('returns false when geo restrictions are disabled', async () => {
      const securityService = loadSecurityService({
        GEO_RESTRICTIONS_ENABLED: 'false',
        GEO_BLOCKED_COUNTRIES: 'CN',
      });

      const blocked = await securityService.checkGeoRestriction('203.0.113.1', {
        headers: { 'cf-ipcountry': 'CN' },
      });

      expect(blocked).toBe(false);
    });

    it('returns true when country header matches a blocked country', async () => {
      const securityService = loadSecurityService({
        GEO_RESTRICTIONS_ENABLED: 'true',
        GEO_BLOCKED_COUNTRIES: 'CN,RU',
      });

      const blocked = await securityService.checkGeoRestriction('203.0.113.1', {
        headers: { 'cf-ipcountry': 'CN' },
      });

      expect(blocked).toBe(true);
    });

    it('returns false when country header is unknown (fail open)', async () => {
      const securityService = loadSecurityService({
        GEO_RESTRICTIONS_ENABLED: 'true',
        GEO_BLOCKED_COUNTRIES: 'CN',
      });

      const blocked = await securityService.checkGeoRestriction('203.0.113.1', {
        headers: {},
      });

      expect(blocked).toBe(false);
    });

    it('returns false for whitelisted IPs', async () => {
      const securityService = loadSecurityService({
        GEO_RESTRICTIONS_ENABLED: 'true',
        GEO_BLOCKED_COUNTRIES: 'CN',
        SECURITY_WHITELIST: '203.0.113.1',
      });

      const blocked = await securityService.checkGeoRestriction('203.0.113.1', {
        headers: { 'x-country-code': 'CN' },
      });

      expect(blocked).toBe(false);
    });
  });

  describe('checkTimeRestriction', () => {
    it('returns false when time restrictions are disabled', async () => {
      const securityService = loadSecurityService({
        TIME_RESTRICTIONS_ENABLED: 'false',
      });

      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(3);

      await expect(securityService.checkTimeRestriction()).resolves.toBe(false);
    });

    it('blocks during same-day maintenance window (0–6)', async () => {
      const securityService = loadSecurityService({
        TIME_RESTRICTIONS_ENABLED: 'true',
        TIME_RESTRICTIONS_START_HOUR: '0',
        TIME_RESTRICTIONS_END_HOUR: '6',
      });

      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(3);
      await expect(securityService.checkTimeRestriction()).resolves.toBe(true);

      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      await expect(securityService.checkTimeRestriction()).resolves.toBe(false);
    });

    it('blocks during overnight maintenance window (22–6)', async () => {
      const securityService = loadSecurityService({
        TIME_RESTRICTIONS_ENABLED: 'true',
        TIME_RESTRICTIONS_START_HOUR: '22',
        TIME_RESTRICTIONS_END_HOUR: '6',
      });

      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23);
      await expect(securityService.checkTimeRestriction()).resolves.toBe(true);

      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(4);
      await expect(securityService.checkTimeRestriction()).resolves.toBe(true);

      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      await expect(securityService.checkTimeRestriction()).resolves.toBe(false);
    });
  });
});
