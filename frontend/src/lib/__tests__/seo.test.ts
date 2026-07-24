import { buildCourseJsonLd, buildCredentialJsonLd } from '../jsonLd';

describe('SEO JSON-LD helpers', () => {
  it('builds a course schema with the expected metadata', () => {
    const data = buildCourseJsonLd({
      name: 'Blockchain Basics',
      description: 'Learn the fundamentals of blockchain technology.',
      url: 'https://aethermint.edu/courses/blockchain-basics',
      image: 'https://aethermint.edu/og-image.svg',
      instructor: 'AetherMint Team',
      educationalLevel: 'Intermediate',
      teaches: ['Blockchain fundamentals', 'Wallet basics'],
      coursePrerequisites: 'Basic internet literacy',
      occupation: 'Developer',
    });

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('Course');
    expect(data.name).toBe('Blockchain Basics');
    expect(data.url).toContain('/courses/');
    expect(data.teaches).toEqual(['Blockchain fundamentals', 'Wallet basics']);
  });

  it('builds a credential schema with the expected metadata', () => {
    const data = buildCredentialJsonLd({
      name: 'Web3 Developer Certificate',
      description: 'Showcases proficiency in building decentralized apps.',
      url: 'https://aethermint.edu/credentials/web3-developer',
      image: 'https://aethermint.edu/og-image.svg',
      issuer: 'AetherMint Education',
      credentialCategory: 'certificate',
      dateIssued: '2026-01-01',
    });

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('EducationalOccupationalCredential');
    expect(data.name).toBe('Web3 Developer Certificate');
    expect(data.credentialCategory).toBe('certificate');
    expect(data.issuer).toHaveProperty('name', 'AetherMint Education');
  });
});
