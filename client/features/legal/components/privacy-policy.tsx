import Link from "next/link";
import { LegalDocument } from "./legal-document";
import { LegalPlaceholder } from "./legal-placeholder";
import { site } from "@/shared/lib/site";

export function PrivacyPolicy() {
  return (
    <LegalDocument title="Privacy policy">
      <section className="space-y-3">
        <h2>Who publishes SourceLab</h2>
        <p>
          SourceLab is published by Harsh. A registered legal name, postal
          address, and governing law are not stated here:{" "}
          <LegalPlaceholder>[Legal entity name]</LegalPlaceholder>,{" "}
          <LegalPlaceholder>[Postal address]</LegalPlaceholder>,{" "}
          <LegalPlaceholder>[Governing law]</LegalPlaceholder>. The public
          site address is <LegalPlaceholder>[Production domain]</LegalPlaceholder>.
          This text says “this website” until that domain is confirmed.
        </p>
        <p>
          There is no published support email yet:{" "}
          <LegalPlaceholder>[Support email]</LegalPlaceholder>. Until that
          address exists, SourceLab has no in-product contact form.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Accounts</h2>
        <p>
          You can create an account with email and password, or with Google.
          Email sign-up asks you to verify the address. Password reset sends
          a link by email when email delivery is configured. The account
          stores your name, email address, and, for Google sign-in, the
          profile image Google provides. The password itself is not stored in
          plain text by the application database.
        </p>
        <p>
          Sign-in uses an httpOnly session cookie (<span className="text-muted-foreground">SameSite=Lax</span>, and Secure when the server is in production). Signing out ends that session in this browser. There is no button to delete an account.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Notebooks, sources, and chat</h2>
        <p>
          Notebooks are private to the account that created them. SourceLab
          does not offer shared or team workspaces. A notebook can hold pasted
          text, markdown, a PDF, a website URL, or a YouTube URL.
        </p>
        <ul>
          <li>Pasted text and markdown are stored in the application database.</li>
          <li>
            PDFs are uploaded to Cloudinary. Extracted text is stored in the
            database. Deleting a source removes the database row and its search
            index. It does not delete the Cloudinary file.
          </li>
          <li>Website import sends the URL to Firecrawl and stores the resulting text.</li>
          <li>YouTube import fetches the transcript and stores that text.</li>
          <li>
            A web-search result can be saved as a source. Chat can also send a
            query to Tavily when web search is allowed for that turn.
          </li>
        </ul>
        <p>
          Ready sources are split into chunks, embedded, and stored in
          Pinecone under that notebook. Chat messages, citations, and a rolling
          summary are stored in the database. Prompts, source text, and model
          output are sent to OpenAI to embed content, answer questions, and
          generate study tools. SourceLab does not control how long OpenAI
          keeps that data.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Memory</h2>
        <p>
          Memory is stored with Mem0. User memory is recalled in every notebook
          you own. Notebook memory stays in the notebook where it was saved or
          learned from chat. You can add, edit, and delete memories from the
          memory page. Deleting a notebook asks Mem0 to delete that notebook’s
          memories. It does not delete user memory. If Mem0 is not configured,
          memory features do nothing.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Credits and payments</h2>
        <p>
          Free includes 10 credits once. Pro is ₹499 per month and sets the
          balance to 500 credits each billing period. Unused Pro credits do not
          roll over. Chat costs 0.1 credit, a learning artifact costs 1, and a
          source that finishes processing costs 1. Stripe processes checkout
          and the billing portal. SourceLab stores the plan, credit balance,
          and Stripe customer id. Card numbers are handled by Stripe, not by
          SourceLab’s database.
        </p>
        <p>
          Cancelling Pro keeps the Pro plan until Stripe ends the subscription.
          Credits left at that point stay on the account. No refund policy is
          offered.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Analytics</h2>
        <p>
          Google Tag Manager is not loaded until you allow Analytics, and only
          if a container id is configured for this deployment. Advertising
          storage stays denied. The choice is kept in this browser until you
          change it. Details are on the{" "}
          <Link href={site.cookies} className="underline underline-offset-4">
            cookie page
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2>Deletion and retention</h2>
        <p>
          Deleting a notebook removes its database records, and SourceLab
          attempts to delete that notebook’s Pinecone namespace and notebook
          memories. Those outside deletes are best-effort. Deleting a source
          removes its database text and Pinecone vectors, not the Cloudinary
          PDF. User memory, the account, Stripe customer data, and copies held
          by OpenAI, Mem0, Cloudinary, Resend, or other processors are not
          cleared by those actions.
        </p>
        <p>
          A retention period has not been set:{" "}
          <LegalPlaceholder>[Data retention period]</LegalPlaceholder>. There
          is no self-serve account deletion. A deletion request cannot be
          completed from the product until a support address is published.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Other processors</h2>
        <p>
          Depending on the feature, data can be processed by PostgreSQL,
          Pinecone, OpenAI, Cloudinary, Firecrawl, the YouTube transcript
          service, Tavily, Mem0, Resend, Stripe, Inngest, and Google (for
          sign-in, and for Tag Manager if you allow Analytics). Each of those
          services has its own retention rules. SourceLab does not claim a
          certification or a data-processing agreement on this page.
        </p>
      </section>
    </LegalDocument>
  );
}
