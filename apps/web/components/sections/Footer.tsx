import { GithubMark, Wordmark } from '../icons';
import { Container, Link } from '../primitives';

const productLinks = [
  { label: 'GitHub', href: 'https://github.com/totigm/humanjs' },
  { label: 'npm — core', href: 'https://www.npmjs.com/package/@humanjs/core' },
  { label: 'npm — playwright', href: 'https://www.npmjs.com/package/@humanjs/playwright' },
];

const communityLinks = [
  { label: 'Discussions', href: 'https://github.com/totigm/humanjs/discussions' },
  { label: 'Issues', href: 'https://github.com/totigm/humanjs/issues' },
];

const legalLinks = [
  { label: 'MIT License', href: 'https://github.com/totigm/humanjs/blob/main/LICENSE' },
  {
    label: 'Third-party notices',
    href: 'https://github.com/totigm/humanjs/blob/main/THIRD_PARTY_NOTICES.md',
  },
];

export function Footer() {
  return (
    <footer className="border-t border-hairline">
      <Container width="lg" className="py-16 md:py-20">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Wordmark className="text-base" />
            <p className="mt-4 max-w-xs text-sm text-muted">
              Humanize browser automation. For AI agents, QA tests, and demos.
            </p>
            <a
              href="https://github.com/totigm/humanjs"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              <GithubMark size={16} />
              Star on GitHub
            </a>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Community" links={communityLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-hairline pt-8 text-xs text-muted/70 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} HumanJS · MIT licensed</p>
          <p>
            Made by{' '}
            <Link href="https://github.com/totigm" variant="subtle" className="text-muted">
              Toti
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}

interface FooterColumnProps {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted/70">{title}</p>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} variant="subtle" className="text-sm">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
