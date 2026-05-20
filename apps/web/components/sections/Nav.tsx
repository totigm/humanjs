'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { EASE_EXPO } from '../../lib/motion';
import { GithubMark, Wordmark } from '../icons';
import { Button } from '../primitives';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#personalities', label: 'Personalities' },
  { href: '#install', label: 'Install' },
] as const;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [menuOpen]);

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2, ease: EASE_EXPO }}
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-300',
          scrolled
            ? 'border-b border-hairline bg-canvas/70 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-8">
          <a
            href="#top"
            className="rounded-sm text-lg outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <Wordmark />
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted transition-colors duration-200 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://github.com/totigm/humanjs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted transition-colors duration-200 hover:text-foreground"
            >
              <GithubMark size={16} />
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button size="sm" href="#install" className="hidden sm:inline-flex">
              Get started
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] bg-canvas/95 backdrop-blur-xl md:hidden"
    >
      <div className="flex h-16 items-center justify-between px-6">
        <Wordmark />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <motion.nav
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
        }}
        className="flex flex-col gap-1 px-6 pt-8"
      >
        {navLinks.map((link) => (
          <motion.a
            key={link.href}
            href={link.href}
            onClick={onClose}
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_EXPO } },
            }}
            className="border-b border-hairline py-5 text-2xl font-medium text-foreground"
          >
            {link.label}
          </motion.a>
        ))}
        <motion.a
          href="https://github.com/totigm/humanjs"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_EXPO } },
          }}
          className="flex items-center gap-3 border-b border-hairline py-5 text-2xl font-medium text-foreground"
        >
          <GithubMark size={20} />
          GitHub
        </motion.a>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_EXPO } },
          }}
          className="mt-8"
        >
          <Button size="lg" href="#install" onClick={onClose} className="w-full">
            Get started
          </Button>
        </motion.div>
      </motion.nav>
    </motion.div>
  );
}
