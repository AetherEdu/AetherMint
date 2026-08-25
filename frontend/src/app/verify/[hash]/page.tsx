import React from 'react';
import CredentialDisplay from '../../../components/verify/CredentialDisplay';
import QRCodeDisplay from '../../../components/verify/QRCodeDisplay';
import { Metadata } from 'next';

type Props = {
  params: { hash: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Verify Credential - ${params.hash}`,
    description: 'Public credential verification portal for AetherMint',
  };
}

export default async function VerifyPage({ params }: Props) {
  const { hash } = params;
  
  // Fetch from our backend endpoint
  // In a real app we'd fetch from process.env.NEXT_PUBLIC_API_URL or similar, 
  // but for server components we can use the local route if available or direct fetch
  let credentialData = null;
  let error = null;
  let revoked = false;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${apiUrl}/verify/${hash}`, {
      next: { revalidate: 60 } // Cache for 60 seconds
    });
    
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 400 && data.error === 'Credential revoked') {
        revoked = true;
        credentialData = data.credential;
      } else {
        error = data.error || 'Failed to verify credential';
      }
    } else {
      credentialData = data.data;
    }
  } catch (err: any) {
    error = 'Network error or unable to reach verification service.';
  }

  const currentUrl = process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/verify/${hash}`
    : `https://aethermint.edu/verify/${hash}`;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            Credential Verification
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Public portal to verify the authenticity of an issued credential.
          </p>
        </div>

        {error && !revoked && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {revoked && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Invalid State: </strong>
            <span className="block sm:inline">This credential has been revoked by the issuer.</span>
          </div>
        )}

        {credentialData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-2">
              <CredentialDisplay credential={credentialData} revoked={revoked} />
            </div>
            <div className="col-span-1 flex flex-col items-center space-y-4 justify-center border-l border-gray-200 pl-8">
              <QRCodeDisplay url={currentUrl} />
              <p className="text-xs text-gray-500 text-center">Scan to share or verify on mobile</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
