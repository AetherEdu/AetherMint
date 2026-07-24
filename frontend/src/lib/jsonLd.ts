export type CourseJsonLdInput = {
  name: string;
  description: string;
  url: string;
  image?: string;
  instructor?: string;
  educationalLevel?: string;
  teaches?: string[];
  coursePrerequisites?: string;
  occupation?: string;
};

export type CredentialJsonLdInput = {
  name: string;
  description: string;
  url: string;
  image?: string;
  issuer?: string;
  credentialCategory?: string;
  dateIssued?: string;
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aethermint.edu';

export function buildCourseJsonLd(input: CourseJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: input.name,
    description: input.description,
    url: input.url,
    image: input.image || `${siteUrl}/og-image.svg`,
    instructor: input.instructor ? { '@type': 'Person', name: input.instructor } : undefined,
    educationalLevel: input.educationalLevel,
    teaches: input.teaches,
    coursePrerequisites: input.coursePrerequisites,
    occupation: input.occupation,
  };
}

export function buildCredentialJsonLd(input: CredentialJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalCredential',
    name: input.name,
    description: input.description,
    url: input.url,
    image: input.image || `${siteUrl}/og-image.svg`,
    issuer: input.issuer ? { '@type': 'Organization', name: input.issuer } : undefined,
    credentialCategory: input.credentialCategory,
    dateIssued: input.dateIssued,
  };
}

export function buildJsonLdScript(data: Record<string, unknown>) {
  return {
    __html: JSON.stringify(data),
  };
}
