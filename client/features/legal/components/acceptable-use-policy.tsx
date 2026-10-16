import { LegalDocument } from "./legal-document";

export function AcceptableUsePolicy() {
  return (
    <LegalDocument title="Acceptable use">
      <section className="space-y-3">
        <h2>Your sources</h2>
        <p>
          Submit only text, files, and URLs you have a right to store and send
          to the services SourceLab uses. That includes other people’s personal
          data, copyrighted work, and material behind a login. Website import,
          YouTube transcripts, and web search can pull in content from third
          parties. Those sites have their own terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2>How not to use SourceLab</h2>
        <ul>
          <li>Do not break the law, or ask the product to help you do so.</li>
          <li>
            Do not try to reach another person’s notebooks, memory, or account.
            Notebooks are single-owner.
          </li>
          <li>
            Do not upload malware, or send requests whose purpose is to
            overload the service.
          </li>
          <li>
            Do not rely on a generated answer as the only check of a fact.
            Read the cited passage.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>What the product does not include</h2>
        <p>
          There is no moderation dashboard and no in-product report form. A
          public support email has not been published. These rules describe
          expected use. They are not a promise that misuse will be detected.
        </p>
      </section>
    </LegalDocument>
  );
}
