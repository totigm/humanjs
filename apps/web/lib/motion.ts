/**
 * Shared motion tokens used across the landing page. Keeping them in one
 * file ensures the page's overall rhythm and timing language stays
 * consistent as new sections are added.
 */

/**
 * IntersectionObserver-style margin passed to framer-motion's `useInView`.
 * Shrinks the trigger area by 10% from the bottom so elements only
 * register as "in view" once they're meaningfully on screen.
 */
export const IN_VIEW_MARGIN = '0px 0px -10% 0px';

/**
 * Brand easing curve — a smooth ease-out used by every entrance animation
 * on the page. Equivalent to the `--ease-expo` CSS variable in globals.css.
 */
export const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
