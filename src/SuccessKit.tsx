import React from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import SuperdubHeader from './SuperdubHeader';
import CogMenu from './CogMenu';

interface Resource {
  title: string;
  by: string;
  why: string;
  tag: string;
  url?: string;
}
interface Section {
  heading: string;
  blurb: string;
  items: Resource[];
}

// Curated, evergreen recommendations. Links point at stable author/publisher
// homepages so they don't rot. Opens in a new tab.
const SECTIONS: Section[] = [
  {
    heading: '📕 Start here — the essential books',
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
    heading: '🎯 Focus, discipline & motivation',
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
    heading: '🥗 Weight, health & the body',
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
    heading: '✍️ Free reads & ideas',
    blurb: 'Bite-sized wisdom you can finish today.',
    items: [
      { title: 'James Clear — 3-2-1 & article archive', by: 'jamesclear.com', tag: 'Articles', url: 'https://jamesclear.com/articles',
        why: 'Hundreds of free, sharp essays on habits and improvement. The weekly 3-2-1 newsletter is gold.' },
      { title: 'Farnam Street', by: 'Shane Parrish', tag: 'Mental models', url: 'https://fs.blog/',
        why: 'Learn the thinking tools behind good decisions. "Mastering the best of what others have figured out."' },
      { title: 'The Marginalian', by: 'Maria Popova', tag: 'Reflection', url: 'https://www.themarginalian.org/',
        why: 'Thoughtful, beautifully written essays on living well, creativity and meaning.' },
    ],
  },
];

const SuccessKit: React.FC = () => {
  const navigate = useNavigate();
  const open = (url?: string) => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); };

  return (
    <div className="app flush" style={{ '--theme': '#FFB928', '--theme-dim': '#FFB92866', '--theme-glow': '#FFB92814' } as React.CSSProperties}>
      <SuperdubHeader><CogMenu /></SuperdubHeader>

      <div className="success-scroll">
        <div className="success-head">
          <h1 className="success-title">📚 Success Kit</h1>
          <p className="success-sub">Hand-picked books and reads to help you build habits, stay disciplined and reach your goals. Tap any card to open it.</p>
        </div>

        {SECTIONS.map(sec => (
          <section key={sec.heading} className="success-section">
            <h2 className="success-section-title">{sec.heading}</h2>
            <p className="success-section-blurb">{sec.blurb}</p>
            <div className="success-grid">
              {sec.items.map(r => (
                <button key={r.title} className={`success-card${r.url ? '' : ' no-link'}`} onClick={() => open(r.url)}>
                  <div className="success-card-top">
                    <span className="success-card-tag">{r.tag}</span>
                    {r.url && <span className="success-card-link">↗</span>}
                  </div>
                  <div className="success-card-title">{r.title}</div>
                  <div className="success-card-by">{r.by}</div>
                  <div className="success-card-why">{r.why}</div>
                </button>
              ))}
            </div>
          </section>
        ))}

        <p className="success-foot">More coming soon. Got a recommendation? Tell us in <button className="success-foot-link" onClick={() => navigate('/about')}>About</button>.</p>
        <div style={{ height: 90 }} />
      </div>
    </div>
  );
};

export default SuccessKit;
