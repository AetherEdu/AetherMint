'use client';

import React, { useEffect, useState } from 'react';

// Using a simple image-based QR API as a fallback if no QR code library is installed
// In a full implementation, you would use qrcode.react
export default function QRCodeDisplay({ url }: { url: string }) {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    // Generate QR code using a public API for this test
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`);
  }, [url]);

  return (
    <div className="p-4 bg-white border-2 border-gray-100 rounded-xl shadow-sm flex flex-col items-center">
      {qrUrl ? (
        <img src={qrUrl} alt="QR Code for Credential" width={200} height={200} className="rounded" />
      ) : (
        <div className="w-[200px] h-[200px] bg-gray-100 animate-pulse rounded"></div>
      )}
      <div className="mt-4 flex gap-2">
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Open Link
        </a>
        <span className="text-gray-300">|</span>
        <button 
          onClick={() => navigator.clipboard.writeText(url)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Copy Link
        </button>
      </div>
    </div>
  );
}
