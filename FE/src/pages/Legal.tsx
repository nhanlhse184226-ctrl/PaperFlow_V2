type LegalPageKind = "privacy" | "terms" | "support";

const contact = "nhanlhse184226@fpt.edu.vn";

const content: Record<
  LegalPageKind,
  {
    eyebrow: string;
    title: string;
    intro: string;
    sections: Array<[string, string]>;
  }
> = {
  privacy: {
    eyebrow: "PRIVACY POLICY",
    title: "Your research stays yours.",
    intro:
      "Effective 14 October 2026. This policy explains how PaperFlow handles the information needed to provide its research workspace.",
    sections: [
      [
        "Information we process",
        "We process your email address and account session, project titles and research context, uploaded PDFs and extracted text, drafts, saved evidence, and feedback you choose to send. A Hub note is public only when you deliberately publish it.",
      ],
      [
        "Why we process it",
        "We use this information to authenticate you, save and synchronize your workspace, analyze materials when you request an AI action, protect the service, and respond to support requests. PaperFlow does not sell personal data or use it for advertising.",
      ],
      [
        "AI processing",
        "AI analysis is requested only when you start an analysis, evaluation, comparison, translation, or writing check. AI output can be inaccurate and does not replace your academic judgment. Original quotations remain traceable to their source.",
      ],
      [
        "Storage and sharing",
        "PaperFlow uses hosted application, database, and file-storage services to run the workspace. Access is limited to operating the service and resolving support or security issues. We do not publish your research projects or PDFs.",
      ],
      [
        "Account deletion",
        "In the mobile app, open Account and choose Delete account. Deletion permanently removes the account and its owned projects, PDFs, Hub notes, feedback, and active sessions. You can also request help at the email below. Deleted data cannot be restored.",
      ],
      ["Contact", `For privacy or support requests, email ${contact}.`],
    ],
  },
  terms: {
    eyebrow: "TERMS OF USE",
    title: "Use PaperFlow responsibly.",
    intro:
      "Effective 14 October 2026. By using PaperFlow, you agree to these terms.",
    sections: [
      [
        "Research assistance",
        "PaperFlow organizes research materials and provides AI-assisted analysis. It does not guarantee factual accuracy, academic outcomes, originality, citation correctness, or acceptance by an institution. Review every result and source before relying on it.",
      ],
      [
        "Your content",
        "You remain responsible for the materials you upload and publish. Upload only content you are allowed to use. Do not upload unlawful, harmful, confidential, or infringing material.",
      ],
      [
        "Community Hub",
        "Hub posts are public to PaperFlow users. Do not post personal, confidential, abusive, hateful, illegal, or misleading content. Hub availability may be limited while moderation controls are improved.",
      ],
      [
        "Accounts and security",
        "Keep your login credentials secure and notify us if you suspect unauthorized access. We may suspend access to protect users, the service, or legal rights.",
      ],
      [
        "Changes and contact",
        `We may update these terms when the service or applicable requirements change. Questions can be sent to ${contact}.`,
      ],
    ],
  },
  support: {
    eyebrow: "SUPPORT",
    title: "We are here to help.",
    intro:
      "For sign-in, data, accessibility, privacy, or technical issues, contact the PaperFlow team.",
    sections: [
      ["Email", contact],
      [
        "What to include",
        "Tell us the email used for PaperFlow, the device and app version, what you expected, and what happened. Do not email PDFs, drafts, passwords, session tokens, or confidential research unless we specifically arrange a secure method.",
      ],
      [
        "Account deletion",
        "You can delete an account immediately from the mobile app: Account → Delete account. If you cannot access the account, email us from the registered address for assistance.",
      ],
    ],
  },
};

export default function Legal({ kind }: { kind: LegalPageKind }) {
  const page = content[kind];
  return (
    <main className="legal-page">
      <header className="legal-header">
        <a className="legal-brand" href="/">
          PAPERFLOW
        </a>
        <nav aria-label="Legal navigation">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
        </nav>
      </header>
      <article className="legal-content">
        <span className="eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p className="legal-intro">{page.intro}</p>
        {page.sections.map(([heading, copy]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{copy}</p>
          </section>
        ))}
        <p className="legal-updated">Last updated: 14 October 2026</p>
      </article>
    </main>
  );
}

export function legalKind(pathname: string): LegalPageKind | null {
  if (pathname === "/privacy") return "privacy";
  if (pathname === "/terms") return "terms";
  if (pathname === "/support") return "support";
  return null;
}
