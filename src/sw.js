import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { RangeRequestsPlugin } from 'workbox-range-requests';

// registerType: 'autoUpdate' (astro.config.mjs) posts this message from
// registerSW.js once a new SW has installed, so it activates immediately
// instead of waiting for every tab to close.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Everything EXCEPT the dialect audio files goes through the normal
// generated precache manifest (audio is excluded via
// astro.config.mjs's injectManifest.globPatterns — see the audio section
// below for why).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/')));

// --- Audio: one CacheFirst + RangeRequestsPlugin route, not precached ---
//
// Cloudflare Pages does not honor Range requests for static assets — it
// always returns a plain 200 with the full file, never 206/Accept-Ranges.
// Without that, HTMLMediaElement.seekable collapses to [0,0] and any seek
// ahead of what's already been downloaded (the seek track, prev/next-verse)
// silently fails. workbox-range-requests fixes this: it synthesizes real
// 206 partial responses from a cached full copy of the file.
//
// This must be the ONLY route serving these files. Audio was previously
// ALSO included in the standard precache (globPatterns included 'mp3'),
// which seemed harmless but wasn't: precacheAndRoute() registers its own
// route for every precached URL, and — confirmed by testing, not a guess —
// that route is checked before any later registerRoute() call and serves
// the full cached file directly, with no Range awareness at all, for every
// request including ones carrying a Range header. The prev/next-verse
// buttons and seek track kept failing even after adding the plugin below,
// because the plain precache route was winning every time. Removing 'mp3'
// from the precache glob and routing audio only through this
// CacheFirst+RangeRequestsPlugin strategy is what actually fixes it — do
// not put audio back in globPatterns.
const AUDIO_CACHE = 'audio-range-cache';
const audioStrategy = new CacheFirst({
  cacheName: AUDIO_CACHE,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new RangeRequestsPlugin(),
  ],
});

registerRoute(({ request }) => request.destination === 'audio', audioStrategy);

// --- Audio is cached ON DEMAND, not warmed at install ---
//
// Jonah/Ruth fetch every audio file at install time (warmStrategyCache). That
// premise ("the total is small", ~13MB) stops holding for a 10-chapter book:
// Esther's audio is ~66MB, install would drag all of it down whether or not
// anyone ever plays a given dialect (most people use one track, 13-24MB), and
// a single failed fetch fails the whole SW install. So install now only
// precaches the app shell, and the page asks for audio to be kept offline the
// first time a track is PLAYED (index.astro: requestOfflineAudio) by posting
// { type: 'CACHE_AUDIO', url }. We then download that one file in full (NO
// Range header — a 206 would be uncacheable and useless to
// RangeRequestsPlugin, which needs the whole file) into the same
// 'audio-range-cache' the route above serves from, so seeking keeps working
// offline, exactly as it did with the old warm-up.
//
// Until the copy lands the <audio> element streams from the network as usual
// (CacheFirst misses -> network; the 206 isn't cached because of
// CacheableResponsePlugin's [0, 200]), so playback never waits on this.
// Consequence for users: offline audio is available for the tracks/chapters
// they have played at least once, not for everything.
const AUDIO_URL_RE = /^\/audio\/(adx|bod|khg|eng|cmn)\/chapter-\d+\.mp3$/;
const inFlight = new Set();

async function cacheAudioInFull(url) {
  const cache = await caches.open(AUDIO_CACHE);
  if (await cache.match(url)) return; // already stored in full
  const res = await fetch(url);
  // Only a complete 200 is useful here — never store a partial (206) or error.
  if (res.status === 200) await cache.put(url, res);
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'CACHE_AUDIO' || typeof data.url !== 'string') return;
  // Same-origin audio paths only (the page only ever sends its own <audio> src).
  const path = new URL(data.url, self.location.origin);
  if (path.origin !== self.location.origin || !AUDIO_URL_RE.test(path.pathname)) return;
  if (inFlight.has(path.pathname)) return;
  inFlight.add(path.pathname);
  event.waitUntil(
    cacheAudioInFull(path.pathname)
      .catch(() => {}) // offline/failed: the next play simply asks again
      .finally(() => inFlight.delete(path.pathname)),
  );
});
