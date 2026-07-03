import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import SuperdubHeader from './SuperdubHeader';
import { ARTICLES, type Article, type Block } from './articles';
import { UPDATE_LOG, type UpdateEntry } from './updates';

function fmtUpdateDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface Resource {
  title: string;
  by: string;
  why: string;
  tag: string;
  url?: string;
}
interface Section {
  heading: string;
  emoji: string;
  blurb: string;
  items: Resource[];
}

const SECTIONS: Section[] = [
  {
    heading: 'Start here',
    emoji: '📕',
    blurb: 'If you read one thing about building habits, make it one of these.',
    items: [
      { title: 'Atomic Habits', by: 'James Clear', tag: 'Habits', url: 'https://jamesclear.com/atomic-habits',
        why: 'The modern playbook. Make habits obvious, attractive, easy and satisfying — and shrink them to 1% better.' },
      { title: 'Tiny Habits', by: 'BJ Fogg', tag: 'Behaviour', url: 'https://tinyhabits.com/',
        why: 'Anchor a tiny new behaviour to something you already do, then celebrate. Brilliantly low-friction.' },
      { title: 'The Power of Habit', by: 'Charles Duhigg', tag: 'Science', url: 'https://charlesduhigg.com/the-power-of-habit/',
        why: 'The cue → routine → reward loop, and how to rewire it. Great for understanding *why* habits stick.' },
      { title: 'Mindset', by: 'Carol Dweck', tag: 'Growth', url: 'https://www.mindsetonline.com/',
        why: 'Fixed vs growth mindset. The belief that you can improve is the foundation everything else stands on.' },
    ],
  },
  {
    heading: 'Focus & discipline',
    emoji: '🎯',
    blurb: 'For the days when showing up is hard.',
    items: [
      { title: 'Deep Work', by: 'Cal Newport', tag: 'Focus', url: 'https://calnewport.com/books/deep-work/',
        why: 'Why distraction-free focus is a superpower, and how to train it. Pairs perfectly with habit streaks.' },
      { title: 'The War of Art', by: 'Steven Pressfield', tag: 'Resistance', url: 'https://stevenpressfield.com/books/the-war-of-art/',
        why: 'Names the inner "Resistance" that stops you starting — and how the pros beat it. Short and punchy.' },
      { title: 'Discipline Is Destiny', by: 'Ryan Holiday', tag: 'Stoicism', url: 'https://dailystoic.com/',
        why: 'Self-mastery as the cornerstone virtue. A calm, practical case for doing the hard thing.' },
    ],
  },
  {
    heading: 'Weight & the body',
    emoji: '🥗',
    blurb: 'Sustainable change beats crash diets every time.',
    items: [
      { title: 'Why We Sleep', by: 'Matthew Walker', tag: 'Sleep', url: 'https://www.sleepdiplomat.com/',
        why: 'Sleep is the lever under appetite, recovery and willpower. Fix this and weight goals get easier.' },
      { title: 'Outlive', by: 'Peter Attia', tag: 'Longevity', url: 'https://peterattiamd.com/outlive/',
        why: 'Train for the life you want at 90. Reframes exercise and nutrition around the long game.' },
      { title: 'Burn', by: 'Herman Pontzer', tag: 'Metabolism', url: 'https://www.hermanpontzer.com/',
        why: 'What science actually says about metabolism and calories. Cuts through diet-culture myths.' },
    ],
  },
  {
    heading: 'Free reads',
    emoji: '✍️',
    blurb: 'Bite-sized wisdom you can finish today.',
    items: [
      { title: 'James Clear — article archive', by: 'jamesclear.com', tag: 'Articles', url: 'https://jamesclear.com/articles',
        why: 'Hundreds of free, sharp essays on habits and improvement. The weekly 3-2-1 newsletter is gold.' },
      { title: 'Farnam Street', by: 'Shane Parrish', tag: 'Mental models', url: 'https://fs.blog/',
        why: 'Learn the thinking tools behind good decisions. "Mastering the best of what others have figured out."' },
      { title: 'The Marginalian', by: 'Maria Popova', tag: 'Reflection', url: 'https://www.themarginalian.org/',
        why: 'Thoughtful, beautifully written essays on living well, creativity and meaning.' },
    ],
  },
];

// Tag accent colours for book cards
const TAG_COLORS: Record<string, string> = {
  Habits: '#2FD27E', Behaviour: '#5AD1FF', Science: '#A855F7', Growth: '#FFB928',
  Focus: '#2E8BFF', Resistance: '#FF5E8A', Stoicism: '#FFD23F',
  Sleep: '#7CF8C0', Longevity: '#52EFA0', Metabolism: '#2FE0C4',
  Articles: '#FFB928', 'Mental models': '#A855F7', Reflection: '#FF9A6C',
};

function ArticleReader({ article, onClose }: { article: Article; onClose: () => void }) {
  return (
    <div className="reader-overlay" onClick={onClose}>
      <div className="reader" onClick={e => e.stopPropagation()} style={{ '--accent': article.accent } as React.CSSProperties}>
        <button className="reader-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="reader-cover" style={{ background: `linear-gradient(135deg, ${article.accent}, ${article.accent}55)` }}>
          <span className="reader-tag">{article.tag}</span>
        </div>
        <div className="reader-body">
          <h1 className="reader-title">{article.title}</h1>
          <div className="reader-meta">By <strong>{article.author}</strong> · {article.readMins} min read</div>
          <p className="reader-dek">{article.dek}</p>
          {article.body.map((b: Block, i: number) => {
            if (b.t === 'h') return <h2 key={i} className="reader-h">{b.text}</h2>;
            if (b.t === 'li') return <li key={i} className="reader-li">{b.text}</li>;
            if (b.t === 'quote') return <blockquote key={i} className="reader-quote">{b.text}</blockquote>;
            return <p key={i} className="reader-p">{b.text}</p>;
          })}
          <div className="reader-end">— {article.author}, for Superdub</div>
        </div>
      </div>
    </div>
  );
}

function UpdateReader({ update, onClose }: { update: UpdateEntry; onClose: () => void }) {
  return (
    <div className="reader-overlay" onClick={onClose}>
      <div className="reader" onClick={e => e.stopPropagation()} style={{ '--accent': '#FFB928' } as React.CSSProperties}>
        <button className="reader-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="reader-cover reader-cover--update">
          <span className="reader-cover-emoji">{update.emoji}</span>
        </div>
        <div className="reader-body">
          <h1 className="reader-title">{update.title}</h1>
          <div className="reader-meta">Superdub update · {new Date(update.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <p className="reader-dek">{update.summary}</p>
          <h2 className="reader-h">What changed</h2>
          {update.points.map((p, i) => <li key={i} className="reader-li">{p}</li>)}
          <div className="reader-end">Thanks for using Superdub 💚</div>
        </div>
      </div>
    </div>
  );
}

const SuccessKit: React.FC = () => {
  const navigate = useNavigate();
  const [reading, setReading] = useState<Article | null>(null);
  const [readingUpdate, setReadingUpdate] = useState<UpdateEntry | null>(null);
  const [showPrevUpdates, setShowPrevUpdates] = useState(false);
  const open = (url?: string) => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); };

  const [featuredArticle, ...restArticles] = ARTICLES;
  const [latestUpdate, ...prevUpdates] = UPDATE_LOG;

  return (
    <div className="app flush" style={{ '--theme': '#FFB928', '--theme-dim': '#FFB92866', '--theme-glow': '#FFB92814' } as React.CSSProperties}>
      <SuperdubHeader />
      {reading && <ArticleReader article={reading} onClose={() => setReading(null)} />}
      {readingUpdate && <UpdateReader update={readingUpdate} onClose={() => setReadingUpdate(null)} />}

      <div className="success-scroll">

        {/* Hero header */}
        <div className="success-head">
          <h1 className="success-title">📚 Success Kit</h1>
          <p className="success-sub">Original reads, curated books, and updates — everything to help you stay the course.</p>
        </div>

        {/* ── Featured article — big hero card ── */}
        {featuredArticle && (
          <section className="sk-section">
            <div className="sk-label">✍️ From Superdub</div>
            <button className="sk-hero-card" onClick={() => setReading(featuredArticle)}
              style={{ '--card-accent': featuredArticle.accent } as React.CSSProperties}>
              <div className="sk-hero-cover" style={{ background: `linear-gradient(135deg, ${featuredArticle.accent}dd, ${featuredArticle.accent}44)` }}>
                <span className="sk-hero-tag">{featuredArticle.tag}</span>
                <span className="sk-hero-read">{featuredArticle.readMins} min read</span>
              </div>
              <div className="sk-hero-body">
                <div className="sk-hero-title">{featuredArticle.title}</div>
                <div className="sk-hero-dek">{featuredArticle.dek}</div>
                <div className="sk-hero-author">By {featuredArticle.author} ↗</div>
              </div>
            </button>
          </section>
        )}

        {/* ── Rest of articles — 2-col grid ── */}
        {restArticles.length > 0 && (
          <div className="sk-article-grid">
            {restArticles.map(a => (
              <button key={a.id} className="sk-article-card" onClick={() => setReading(a)}
                style={{ '--card-accent': a.accent } as React.CSSProperties}>
                <div className="sk-article-cover" style={{ background: `linear-gradient(135deg, ${a.accent}cc, ${a.accent}33)` }}>
                  <span className="sk-article-tag">{a.tag}</span>
                </div>
                <div className="sk-article-body">
                  <div className="sk-article-title">{a.title}</div>
                  <div className="sk-article-meta">{a.readMins} min</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── What's New — latest update featured, previous ones tucked below ── */}
        {latestUpdate && (
          <section className="sk-section">
            <div className="sk-label">✨ What's New</div>
            <button className="sk-update-hero" onClick={() => setReadingUpdate(latestUpdate)}>
              <div className="sk-update-hero-top">
                <span className="sk-update-hero-emoji">{latestUpdate.emoji}</span>
                <div className="sk-update-hero-headings">
                  <span className="sk-update-hero-badge">Latest · {fmtUpdateDate(latestUpdate.date)}</span>
                  <span className="sk-update-hero-title">{latestUpdate.title}</span>
                </div>
              </div>
              <p className="sk-update-hero-summary">{latestUpdate.summary}</p>
              <span className="sk-update-hero-more">Read the full update →</span>
            </button>

            {prevUpdates.length > 0 && (
              <>
                <button className="sk-prev-toggle" onClick={() => setShowPrevUpdates(s => !s)}>
                  <span>Previous updates</span>
                  <span className="sk-prev-count">{prevUpdates.length}</span>
                  <span className={`sk-prev-chev${showPrevUpdates ? ' open' : ''}`}>▾</span>
                </button>
                {showPrevUpdates && (
                  <div className="sk-prev-list">
                    {prevUpdates.map((u, i) => (
                      <button key={i} className="sk-prev-row" onClick={() => setReadingUpdate(u)}>
                        <span className="sk-prev-emoji">{u.emoji}</span>
                        <span className="sk-prev-title">{u.title}</span>
                        <span className="sk-prev-date">{fmtUpdateDate(u.date)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ── Book shelves — one horizontal scroll row per category ── */}
        <section className="sk-section">
          <div className="sk-label">📖 Recommended reading</div>
          {SECTIONS.map(sec => (
            <div key={sec.heading} className="sk-shelf">
              <div className="sk-shelf-head">
                <span className="sk-shelf-emoji">{sec.emoji}</span>
                <div className="sk-shelf-info">
                  <span className="sk-shelf-title">{sec.heading}</span>
                  <span className="sk-shelf-blurb">{sec.blurb}</span>
                </div>
              </div>
              <div className="sk-hscroll">
                {sec.items.map(r => {
                  const accent = TAG_COLORS[r.tag] ?? '#FFB928';
                  return (
                    <button key={r.title} className="sk-book-card" onClick={() => open(r.url)}
                      style={{ '--card-accent': accent } as React.CSSProperties}>
                      <span className="sk-book-tag" style={{ background: `${accent}22`, color: accent }}>{r.tag}</span>
                      <div className="sk-book-title">{r.title}</div>
                      <div className="sk-book-by">{r.by}</div>
                      <div className="sk-book-why">{r.why}</div>
                      {r.url && <span className="sk-book-link">Open ↗</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <p className="success-foot">More coming soon. Got a recommendation? Tell us in <button className="success-foot-link" onClick={() => navigate('/about')}>About</button>.</p>
        <div style={{ height: 90 }} />
      </div>
    </div>
  );
};

export default SuccessKit;
