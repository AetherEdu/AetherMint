import { DidService } from './didService';

export * from './didService';

/** Shared DID service instance used by the API routes. */
const didService = new DidService();

export default didService;
