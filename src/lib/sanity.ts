import { sanityClient } from 'sanity:client';
import imageUrlBuilder from '@sanity/image-url';

// Build custom image URLs optimized through Sanity's CDN
const builder = imageUrlBuilder(sanityClient);

export function urlFor(source: any) {
  return builder.image(source);
}

export { sanityClient };
