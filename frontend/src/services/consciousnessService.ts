import axios from 'axios';
import { env } from '@/lib/env';

const API_BASE_URL = env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface UploadConsciousnessRequest {
  ownerPublicKey: string;
  neuralData: string;
  encodingVersion: number;
  continuityProof?: ContinuityProof;
}

export interface ContinuityProof {
  previousConsciousnessId?: string;
  lifetimeTransitionHash: string;
  knowledgeTransferRatio: number;
  memoryIntegrityScore: number;
}

export interface ConsciousnessData {
  consciousnessId: string;
  owner: string;
  encodingVersion: number;
  neuralHash: string;
  evolutionStage: number;
  createdAt: string;
}

export interface VerifyConsciousnessRequest {
  consciousnessId: string;
  verificationHash: string;
}

export interface TransferConsciousnessRequest {
  consciousnessId: string;
  currentOwnerPublicKey: string;
  newOwnerPublicKey: string;
  transferProof: string;
}

export interface MarketplaceListingRequest {
  consciousnessId: string;
  ownerPublicKey: string;
  price: number;
  accessDuration: number;
  licenseType: number; // 0: Full, 1: ReadOnly, 2: Learning
}

export interface PurchaseConsciousnessRequest {
  consciousnessId: string;
  buyerPublicKey: string;
  paymentProof: string;
}

export interface MarketplaceItem {
  consciousnessId: string;
  owner: string;
  price: number;
  accessDuration: number;
  licenseType: number;
  listedAt: string;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    rating?: number;
  };
}

export interface ConsciousnessMetadata {
  consciousnessId: string;
  owner: string;
  encodingVersion: number;
  neuralHash: string;
  evolutionStage: number;
  createdAt: string;
  continuityProof?: ContinuityProof;
  verificationHistory?: Array<{
    timestamp: string;
    result: boolean;
    verifier?: string;
  }>;
  transferHistory?: Array<{
    timestamp: string;
    from: string;
    to: string;
  }>;
}

export interface AccessDetails {
  accessGranted: boolean;
  expiresAt: string;
  licenseType: number;
  remainingTime?: number;
}

// API Service Functions
export const consciousnessService = {
  // Upload consciousness to blockchain
  async uploadConsciousness(request: UploadConsciousnessRequest): Promise<ConsciousnessData> {
    try {
      const formData = new FormData();
      
      // Create a blob from neural data
      const neuralBlob = new Blob([request.neuralData], { type: 'application/json' });
      formData.append('neuralData', neuralBlob, 'consciousness.json');
      formData.append('ownerPublicKey', request.ownerPublicKey);
      formData.append('encodingVersion', request.encodingVersion.toString());
      
      if (request.continuityProof?.previousConsciousnessId) {
        formData.append('previousConsciousnessId', request.continuityProof.previousConsciousnessId);
      }
      
      if (request.continuityProof) {
        formData.append('knowledgeTransferData', JSON.stringify(request.continuityProof));
      }

      const response = await axios.post(`${API_BASE_URL}/api/consciousness/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds timeout for large files
      });

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to upload consciousness');
    }
  },

  // Verify consciousness integrity
  async verifyConsciousness(request: VerifyConsciousnessRequest): Promise<{ isValid: boolean; verifiedAt: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/consciousness/verify`, request);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to verify consciousness');
    }
  },

  // Transfer consciousness ownership
  async transferConsciousness(request: TransferConsciousnessRequest): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/consciousness/transfer`, request);
      return response.data.success;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to transfer consciousness');
    }
  },

  // List consciousness on marketplace
  async listOnMarketplace(request: MarketplaceListingRequest): Promise<{ listedAt: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/consciousness/marketplace/list`, request);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to list on marketplace');
    }
  },

  // Purchase consciousness access
  async purchaseConsciousnessAccess(request: PurchaseConsciousnessRequest): Promise<AccessDetails> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/consciousness/marketplace/purchase`, request);
      return response.data.accessDetails;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to purchase consciousness access');
    }
  },

  // Get consciousness metadata
  async getConsciousnessMetadata(consciousnessId: string): Promise<ConsciousnessMetadata> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/consciousness/metadata/${consciousnessId}`);
      return response.data.metadata;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get consciousness metadata');
    }
  },

  // Get owned consciousnesses
  async getOwnedConsciousnesses(publicKey: string): Promise<ConsciousnessData[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/consciousness/owned/${publicKey}`);
      return response.data.consciousnesses;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get owned consciousnesses');
    }
  },

  // Get marketplace listings
  async getMarketplaceListings(filters?: {
    minPrice?: number;
    maxPrice?: number;
    licenseType?: number;
    search?: string;
  }): Promise<MarketplaceItem[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters?.licenseType !== undefined) params.append('licenseType', filters.licenseType.toString());
      if (filters?.search) params.append('search', filters.search);

      const response = await axios.get(`${API_BASE_URL}/api/consciousness/marketplace/listings?${params}`);
      return response.data.listings;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get marketplace listings');
    }
  },

  // Update consciousness evolution
  async updateEvolution(consciousnessId: string, newKnowledge: string): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/consciousness/evolution/update`, {
        consciousnessId,
        newKnowledge
      });
      return response.data.success;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update consciousness evolution');
    }
  },

  // Get consciousness analytics
  async getConsciousnessAnalytics(consciousnessId: string): Promise<{
    totalVerifications: number;
    successRate: number;
    averageEvolutionTime: number;
    knowledgeGrowth: Array<{
      timestamp: string;
      knowledgeSize: number;
      evolutionStage: number;
    }>;
    accessHistory: Array<{
      timestamp: string;
      accessor: string;
      licenseType: number;
      duration: number;
    }>;
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/consciousness/analytics/${consciousnessId}`);
      return response.data.analytics;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get consciousness analytics');
    }
  },

  // Create continuity proof
  async createContinuityProof(
    currentConsciousnessId: string,
    previousConsciousnessId?: string,
    knowledgeTransferData?: string
  ): Promise<ContinuityProof> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/consciousness/continuity/create`, {
        currentConsciousnessId,
        previousConsciousnessId,
        knowledgeTransferData
      });
      return response.data.continuityProof;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create continuity proof');
    }
  },

  // Verify continuity proof
  async verifyContinuityProof(continuityProof: ContinuityProof): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/consciousness/continuity/verify`, {
        continuityProof
      });
      return response.data.isValid;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to verify continuity proof');
    }
  }
};

// Export individual functions for easier import
export const uploadConsciousness = consciousnessService.uploadConsciousness;
export const verifyConsciousness = consciousnessService.verifyConsciousness;
export const transferConsciousness = consciousnessService.transferConsciousness;
export const listOnMarketplace = consciousnessService.listOnMarketplace;
export const purchaseConsciousnessAccess = consciousnessService.purchaseConsciousnessAccess;
export const getConsciousnessMetadata = consciousnessService.getConsciousnessMetadata;
export const getOwnedConsciousnesses = consciousnessService.getOwnedConsciousnesses;
export const getMarketplaceListings = consciousnessService.getMarketplaceListings;
export const updateEvolution = consciousnessService.updateEvolution;
export const getConsciousnessAnalytics = consciousnessService.getConsciousnessAnalytics;
export const createContinuityProof = consciousnessService.createContinuityProof;
export const verifyContinuityProof = consciousnessService.verifyContinuityProof;
