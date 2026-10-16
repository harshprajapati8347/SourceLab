import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from "./consent";

/**
 * Runs before Google Tag Manager. Defaults are denied unless a stored
 * Analytics choice already grants measurement. The container is not inserted
 * until that grant exists.
 */
export function consentBootScript(gtmId: string | null): string {
  const key = JSON.stringify(CONSENT_STORAGE_KEY);
  const container = gtmId ? JSON.stringify(gtmId) : "null";

  return `(function(){
    var KEY=${key};
    var VERSION=${CONSENT_VERSION};
    var GTM_ID=${container};
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
    var analytics="denied";
    var hasChoice=false;
    try{
      var raw=window.localStorage.getItem(KEY);
      if(raw){
        var saved=JSON.parse(raw);
        if(saved&&saved.version===VERSION&&typeof saved.analytics==="boolean"){
          hasChoice=true;
          analytics=saved.analytics?"granted":"denied";
        }
      }
    }catch(e){}
    window.gtag("consent","default",{
      ad_storage:"denied",
      ad_user_data:"denied",
      ad_personalization:"denied",
      analytics_storage:analytics,
      functionality_storage:"granted",
      personalization_storage:"denied",
      security_storage:"granted",
      wait_for_update:hasChoice?0:500
    });
    window.dataLayer.push({
      event:"consent_default",
      consent_analytics:analytics,
      consent_marketing:"denied",
      consent_necessary:"granted"
    });
    if(analytics==="granted"&&GTM_ID){
      window.dataLayer.push({"gtm.start":new Date().getTime(),event:"gtm.js"});
      var script=document.createElement("script");
      script.id="gtm-script";
      script.async=true;
      script.src="https://www.googletagmanager.com/gtm.js?id="+encodeURIComponent(GTM_ID);
      document.head.appendChild(script);
    }
  })();`;
}
