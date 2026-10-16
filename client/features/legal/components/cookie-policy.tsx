import { CookiePreferencesButton } from "@/features/consent/components/cookie-preferences-button";
import { LegalDocument } from "./legal-document";

export function CookiePolicy() {
  return (
    <LegalDocument title="Cookies">
      <section className="space-y-3">
        <h2>Your choice</h2>
        <p>
          Necessary storage stays on. Analytics stays off until you allow it.
          There is no marketing category. The choice is saved in this browser
          until you change it. It does not expire on a timer.
        </p>
        <p>
          <CookiePreferencesButton className="rounded-md underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30" />
        </p>
      </section>

      <section className="space-y-3">
        <h2>Necessary</h2>
        <ul>
          <li>
            Better Auth session cookies. httpOnly, SameSite=Lax, and Secure in
            production. They keep you signed in. Rejecting Analytics does not
            sign you out.
          </li>
          <li>
            <span className="font-mono text-xs">sidebar_state</span> cookie,
            for seven days, remembers whether the notebook sidebar is open.
          </li>
          <li>
            <span className="font-mono text-xs">theme</span> in local storage
            remembers light, dark, or system.
          </li>
          <li>
            <span className="font-mono text-xs">sourcelab-chat-preferences</span>{" "}
            in local storage remembers the chat model and web-search toggle
            for each notebook.
          </li>
          <li>
            <span className="font-mono text-xs">sourcelab-ui</span> in local
            storage remembers whether the sources panel is open.
          </li>
          <li>
            <span className="font-mono text-xs">sourcelab-consent</span> in
            local storage remembers the Analytics choice.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>Analytics</h2>
        <p>
          If this deployment sets a Google Tag Manager container id, the
          container script is added only after Analytics is granted. Before
          that, the page records a denied consent default and does not insert
          the Tag Manager script. A noscript Tag Manager frame is not used.
          Advertising signals stay denied even when Analytics is allowed.
        </p>
        <p>
          Changing the choice sends a consent update. Granting Analytics can
          load Tag Manager on that page. Withdrawing it denies analytics
          storage. The script already on the page is not removed until the
          next load, which will not insert it again while Analytics is denied.
          Tags inside the container still have to be set to require analytics
          storage. This application cannot do that from the Tag Manager
          dashboard.
        </p>
      </section>
    </LegalDocument>
  );
}
