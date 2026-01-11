import db from '../config/database';
import { getSiteSetting, mergeConfig } from './siteConfig';

const ECOSYSTEM_KEY = 'ecosystem_config';

export const DEFAULT_ECOSYSTEM_CONFIG = {
  webhooks: [
    {
      id: 'link.created',
      label: 'Link created',
      description: 'Triggered when a new short link is generated.',
      enabled: true,
      url: '',
    },
    {
      id: 'link.deleted',
      label: 'Link deleted',
      description: 'Fires when a link is removed or expired.',
      enabled: false,
      url: '',
    },
    {
      id: 'click.recorded',
      label: 'Click recorded',
      description: 'Every redirect records a click event with geo + referrer data.',
      enabled: true,
      url: '',
    },
  ],
  integrations: [
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect campaigns to Gmail, Sheets, Slack, and hundreds of apps.',
      status: 'beta',
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Post new link analytics to a channel or DM the owner team.',
      status: 'preview',
    },
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Stream UTM-tracked campaigns directly into GA4 dashboards.',
      status: 'coming-soon',
    },
  ],
  tools: {
    extension: {
      label: 'Browser extension',
      description: 'Shorten any page from the toolbar and push to your default domain.',
      installLink: 'https://github.com/chrisw65/shortcode/tree/master/extension',
    },
    bookmarklet: {
      label: 'Bookmarklet',
      snippet: 'javascript:(async()=>{const url=encodeURIComponent(location.href);window.open(`https://okleaf.link/admin/links.html?prefill=${url}`);})();',
      description: 'Drag this to your bookmarks bar to shorten any URL without leaving the page.',
    },
  },
  domainHealth: {
    nextCheck: 'In 90 minutes',
    insights: [
      { label: 'TXT records', detail: '57% verified within 24h', status: 'ok' },
      { label: 'SSL expiry', detail: 'Next renewal Feb 12, 2026', status: 'ok' },
      { label: 'DNS automation', detail: '3 domains rely on Cloudflare Workers', status: 'warning' },
    ],
  },
  mobile: {
    themeToggle: {
      label: 'Theme toggle',
      description: 'Let users choose light or dark mode and persist the preference.',
      enabled: true,
    },
  },
};

export async function getEcosystemConfig() {
  const stored = await getSiteSetting(ECOSYSTEM_KEY);
  return mergeConfig(DEFAULT_ECOSYSTEM_CONFIG, stored || {});
}

export async function saveEcosystemConfig(payload: Record<string, any>) {
  const merged = mergeConfig(DEFAULT_ECOSYSTEM_CONFIG, payload || {});
  await db.query(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [ECOSYSTEM_KEY, JSON.stringify(merged)]
  );
  return merged;
}
