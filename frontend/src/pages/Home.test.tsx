import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomePage } from './Home.tsx';

describe('HomePage', () => {
  it('renders the title and CTA buttons', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('Template');
    expect(html).toContain('Continue');
    expect(html).toContain('Cancel');
    expect(html).toContain('Welcome.');
  });
});
