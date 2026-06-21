import React, { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { uploadConsciousness, verifyConsciousness, transferConsciousness } from '../services/consciousnessService';
import { NeuralEncoder } from '../utils/neuralEncoder';

interface ConsciousnessData {
  consciousnessId: string;
  owner: string;
  encodingVersion: number;
  neuralHash: string;
  evolutionStage: number;
  createdAt: string;
}

interface ContinuityProof {
  previousConsciousnessId?: string;
  lifetimeTransitionHash: string;
  knowledgeTransferRatio: number;
  memoryIntegrityScore: number;
}

const ConsciousnessUpload: React.FC = () => {
  const { publicKey, isConnected } = useWallet();
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [consciousnessData, setConsciousnessData] = useState<ConsciousnessData | null>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  
  // Form states
  const [encodingVersion, setEncodingVersion] = useState(1);
  const [neuralFile, setNeuralFile] = useState<File | null>(null);
  const [previousConsciousnessId, setPreviousConsciousnessId] = useState('');
  const [knowledgeTransferData, setKnowledgeTransferData] = useState('');
  const [transferToAddress, setTransferToAddress] = useState('');
  const [transferProof, setTransferProof] = useState('');

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      const allowedTypes = ['.json', '.bin', '.dat', '.npz'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(fileExtension)) {
        alert('Invalid file type. Please upload .json, .bin, .dat, or .npz files.');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('File size exceeds 10MB limit.');
        return;
      }
      
      setNeuralFile(file);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!isConnected || !publicKey || !neuralFile) {
      alert('Please connect your wallet and select a neural data file.');
      return;
    }

    setUploading(true);
    try {
      // Read and validate neural data
      const neuralData = await neuralFile.text();
      
      // Create continuity proof if previous consciousness exists
      let continuityProof: ContinuityProof | undefined;
      if (previousConsciousnessId && knowledgeTransferData) {
        continuityProof = await NeuralEncoder.createContinuityProof(
          previousConsciousnessId,
          knowledgeTransferData,
          publicKey
        );
      }

      const result = await uploadConsciousness({
        ownerPublicKey: publicKey,
        neuralData,
        encodingVersion,
        continuityProof
      });

      setConsciousnessData(result);
      alert('Consciousness uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }, [isConnected, publicKey, neuralFile, encodingVersion, previousConsciousnessId, knowledgeTransferData]);

  const handleVerify = useCallback(async () => {
    if (!consciousnessData) {
      alert('No consciousness data to verify.');
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyConsciousness({
        consciousnessId: consciousnessData.consciousnessId,
        verificationHash: consciousnessData.neuralHash
      });

      setVerificationResult(result);
      alert(`Consciousness verification: ${result ? 'PASSED' : 'FAILED'}`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Verification failed:', err);
      alert(`Verification failed: ${error.message}`);
    } finally {
      setVerifying(false);
    }
  }, [consciousnessData]);

  const handleTransfer = useCallback(async () => {
    if (!consciousnessData || !transferToAddress || !transferProof) {
      alert('Please provide transfer details and proof.');
      return;
    }

    setTransferring(true);
    try {
      const result = await transferConsciousness({
        consciousnessId: consciousnessData.consciousnessId,
        currentOwnerPublicKey: publicKey!,
        newOwnerPublicKey: transferToAddress,
        transferProof
      });

      if (result) {
        alert('Consciousness transferred successfully!');
        setConsciousnessData(null);
        setVerificationResult(null);
      } else {
        alert('Transfer failed.');
      }
    } catch (error) {
      console.error('Transfer failed:', error);
      alert(`Transfer failed: ${error.message}`);
    } finally {
      setTransferring(false);
    }
  }, [consciousnessData, transferToAddress, transferProof, publicKey]);

  const generateTransferProof = useCallback(async () => {
    if (!consciousnessData || !transferToAddress) {
      alert('Please provide transfer destination address.');
      return;
    }

    // Generate transfer proof (simplified - in production would use cryptographic signing)
    const proofData = {
      consciousnessId: consciousnessData.consciousnessId,
      currentOwner: publicKey,
      newOwner: transferToAddress,
      timestamp: Date.now()
    };

    const proofString = JSON.stringify(proofData);
    const proof = btoa(proofString); // Base64 encoding for demo
    setTransferProof(proof);
    alert('Transfer proof generated!');
  }, [consciousnessData, transferToAddress, publicKey]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8 text-indigo-600">
        Consciousness Upload System
      </h1>

      {/* Upload Section */}
      <div className="mb-8 p-6 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Upload Consciousness</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Neural Data File
            </label>
            <input
              type="file"
              accept=".json,.bin,.dat,.npz"
              onChange={handleFileSelect}
              className="w-full p-2 border rounded"
              disabled={!isConnected}
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports: .json, .bin, .dat, .npz (Max 10MB)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Encoding Version
            </label>
            <select
              value={encodingVersion}
              onChange={(e) => setEncodingVersion(Number(e.target.value))}
              className="w-full p-2 border rounded"
              disabled={!isConnected}
            >
              <option value={1}>Version 1 - Basic Neural Hash</option>
              <option value={2}>Version 2 - Advanced Pattern Recognition</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Previous Consciousness ID (Optional)
            </label>
            <input
              type="text"
              value={previousConsciousnessId}
              onChange={(e) => setPreviousConsciousnessId(e.target.value)}
              placeholder="For lifetime continuity..."
              className="w-full p-2 border rounded"
              disabled={!isConnected}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Knowledge Transfer Data (Optional)
            </label>
            <textarea
              value={knowledgeTransferData}
              onChange={(e) => setKnowledgeTransferData(e.target.value)}
              placeholder="Describe knowledge transfer patterns..."
              className="w-full p-2 border rounded h-20"
              disabled={!isConnected}
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!isConnected || uploading || !neuralFile}
          className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 disabled:bg-gray-400"
        >
          {uploading ? 'Uploading...' : 'Upload Consciousness'}
        </button>
      </div>

      {/* Consciousness Data Display */}
      {consciousnessData && (
        <div className="mb-8 p-6 border rounded-lg bg-green-50">
          <h2 className="text-xl font-semibold mb-4">Consciousness Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">ID:</span> {consciousnessData.consciousnessId}
            </div>
            <div>
              <span className="font-medium">Owner:</span> {consciousnessData.owner}
            </div>
            <div>
              <span className="font-medium">Encoding Version:</span> {consciousnessData.encodingVersion}
            </div>
            <div>
              <span className="font-medium">Evolution Stage:</span> {consciousnessData.evolutionStage}
            </div>
            <div>
              <span className="font-medium">Neural Hash:</span> {consciousnessData.neuralHash}
            </div>
            <div>
              <span className="font-medium">Created:</span> {new Date(consciousnessData.createdAt).toLocaleString()}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {verifying ? 'Verifying...' : 'Verify Integrity'}
            </button>
          </div>

          {verificationResult !== null && (
            <div className={`mt-4 p-3 rounded ${verificationResult ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <strong>Verification Result:</strong> {verificationResult ? 'PASSED' : 'FAILED'}
            </div>
          )}
        </div>
      )}

      {/* Transfer Section */}
      {consciousnessData && (
        <div className="mb-8 p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Transfer Consciousness</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer To (Public Key)
              </label>
              <input
                type="text"
                value={transferToAddress}
                onChange={(e) => setTransferToAddress(e.target.value)}
                placeholder="Recipient public key..."
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Proof
              </label>
              <textarea
                value={transferProof}
                onChange={(e) => setTransferProof(e.target.value)}
                placeholder="Transfer proof will be generated..."
                className="w-full p-2 border rounded h-20"
                readOnly
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={generateTransferProof}
              disabled={!transferToAddress}
              className="bg-yellow-600 text-white py-2 px-4 rounded hover:bg-yellow-700 disabled:bg-gray-400"
            >
              Generate Transfer Proof
            </button>

            <button
              onClick={handleTransfer}
              disabled={!transferToAddress || !transferProof || transferring}
              className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {transferring ? 'Transferring...' : 'Transfer Consciousness'}
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">How It Works</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Connect your wallet to authorize consciousness uploads</li>
          <li>Upload your neural data file (JSON, binary, or compressed format)</li>
          <li>Choose encoding version - Version 2 provides better pattern recognition</li>
          <li>Optionally link to previous consciousness for lifetime continuity</li>
          <li>System encodes your consciousness using neural algorithms</li>
          <li>Consciousness is stored on Stellar blockchain with cryptographic verification</li>
          <li>Verify integrity anytime using the neural hash</li>
          <li>Transfer consciousness between platforms or owners with proof</li>
        </ol>

        <div className="mt-4 p-3 bg-blue-100 rounded text-sm">
          <strong>🔒 Security Note:</strong> Your consciousness data is encrypted and stored 
          securely on the blockchain. Only you control access and transfer permissions.
        </div>
      </div>
    </div>
  );
};

export default ConsciousnessUpload;
