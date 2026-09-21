import Script from "next/script";
import { PageViewTracker } from "@/components/store/PageViewTracker";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

const SAFE_ID = /^[A-Za-z0-9-]+$/;
// Same rule as isPrivatePath in lib/analytics.ts (that module is client-only, so it cannot be imported here).
const PRIVATE_PATH = /^\/order(?:\/|$)/;

/**
 * Loads GA4 and Meta Pixel after the page becomes interactive, only if configured.
 * Their automatic page views and Meta's automatic events are off; PageViewTracker
 * sends page views instead.
 */
export function Analytics() {
  const ga = GA_ID && SAFE_ID.test(GA_ID) ? GA_ID : null;
  const pixel = PIXEL_ID && SAFE_ID.test(PIXEL_ID) ? PIXEL_ID : null;
  if (!ga && !pixel) return null;
  return (
    <>
      <Script id="analytics" strategy="afterInteractive">
        {bootScript(ga, pixel)}
      </Script>
      {/* After the script, so its first effect runs once gtag/fbq exist. */}
      <PageViewTracker />
    </>
  );
}

/**
 * Order links (/order/<token>) are secret: they show the customer's name and address.
 * So a page load stays on one side for its whole life: one that starts on an order
 * link never loads the trackers, and one that has them never shows an order link.
 * Next.js navigates through history.pushState/replaceState, so those are wrapped to
 * turn any move across that line into a full page load (and a back/forward move into
 * a reload). The wrap goes on before gtag.js adds its own history hooks and again once
 * it has loaded, so GA never sees an order URL, even with GA4's "page changes based on
 * browser history events" left on.
 */
function bootScript(ga: string | null, pixel: string | null): string {
  const gaInit = ga
    ? `w.dataLayer=w.dataLayer||[];function gtag(){dataLayer.push(arguments);}w.gtag=gtag;gtag('js',new Date());gtag('config','${ga}',{send_page_view:false});` +
      `var g=d.createElement('script');g.async=true;g.src='https://www.googletagmanager.com/gtag/js?id=${ga}';g.onload=function(){guard('pushState');guard('replaceState');};d.head.appendChild(g);`
    : "";
  const pixelInit = pixel
    ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(w,d,'script','https://connect.facebook.net/en_US/fbevents.js');` +
      `fbq.disablePushState=true;fbq('set','autoConfig',false,'${pixel}');fbq('init','${pixel}');`
    : "";
  return `(function(w,d,l,h){
if(w.__deenboxAnalytics)return;w.__deenboxAnalytics=1;
var P=${PRIVATE_PATH},leaving=null;
function priv(u){try{return P.test(new URL(u,l.href).pathname);}catch(e){return false;}}
var here=priv(l.href);
function go(u){var t=new URL(u,l.href).href;if(t!==leaving){leaving=t;l.assign(t);}}
function guard(m){var orig=h[m];h[m]=function(s,t,u){if(u!=null&&priv(u)!==here)return go(u);return orig.apply(h,arguments);};}
guard('pushState');guard('replaceState');
w.addEventListener('popstate',function(e){if(priv(l.href)!==here){e.stopImmediatePropagation();l.reload();}},true);
w.addEventListener('pageshow',function(e){if(e.persisted&&leaving)l.reload();});
if(here)return;
${gaInit}${pixelInit}
})(window,document,location,history);`;
}
