import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aethermint.edu';

const routes = [
  '',
  '/campus',
  '/lab',
  '/profile',
  '/demo',
  '/courses',
  '/settings',
];

const courseIds = ['blockchain-basics', 'smart-contracts'];
const credentialIds = ['web3-developer'];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const courseRoutes = courseIds.map((id) => ({
    url: `${siteUrl}/courses/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const credentialRoutes = credentialIds.map((id) => ({
    url: `${siteUrl}/credentials/${id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...courseRoutes, ...credentialRoutes];
}
