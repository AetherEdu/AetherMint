import React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { LoadingFallback } from '@/components/LoadingFallback';

/**
 * ConsciousnessUpload is a heavy component that depends on the wallet
 * context, the consciousness service, the neural encoder and a number
 * of state-heavy helpers. For AetherEdu/AetherMint issue #141 we
 * lazy-load it so its transitive deps land in a dedicated chunk and
 * never block the initial render.
 */
const ConsciousnessUpload = dynamic(
  () =>
    import('../components/ConsciousnessUpload').then((m) => ({
      default: m.default,
    })),
  {
    ssr: false,
    loading: () => (
      <LoadingFallback message="Loading consciousness upload…" size="lg" />
    ),
  },
);

// Dynamic page - uses wallet hooks that require client-side context
export async function getServerSideProps() {
  return { props: {} };
}

const ConsciousnessPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Consciousness Upload - AetherMint Education</title>
        <meta name="description" content="Upload and preserve your consciousness on the blockchain for digital immortality" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-indigo-600 mb-4">
              Digital Consciousness Upload
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Preserve your learning experiences and knowledge on the blockchain,
              enabling digital immortality of educational achievements and continuous
              learning across lifetimes.
            </p>
          </div>

          <ConsciousnessUpload />
        </div>
      </main>
    </>
  );
};

export default ConsciousnessPage;
