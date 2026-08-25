declare class SecurityService {
  botPatterns: string[];
  logSecurityEvent(ip: string, type: string, details?: Record<string, unknown>): Promise<boolean>;
  autoBlockIP(ip: string, reason: string): Promise<boolean>;
  isIPBlocked(ip: string): Promise<string | boolean>;
  getSecurityPulse(): Promise<{ timestamp: string; activeBlocks: number; systemStatus: string } | null>;
  addToWhitelist(ip: string): Promise<void>;
  checkGeoRestriction(ip: string, req?: { headers?: Record<string, string | string[] | undefined> }): Promise<boolean>;
  checkTimeRestriction(): Promise<boolean>;
  trackMiddlewarePerformance(name: string, duration: number): void;
}

declare const securityService: SecurityService;
export = securityService;
