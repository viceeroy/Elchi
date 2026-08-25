import { trackAICrawlerRequest } from '@datafast/ai-crawl';

export default function middleware(
  request: Request,
  event: { waitUntil: (promise: Promise<unknown>) => void }
) {
  trackAICrawlerRequest(request, event, {
    websiteId: 'dfid_HuqfXN07SpsFWoIp6ObZk',
    domain: 'elchi.org',
  });
}

export const config = {
  matcher: [
    '/((?!api|_next|assets|static|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|css|js|woff2|webmanifest)$).*)',
  ],
};
