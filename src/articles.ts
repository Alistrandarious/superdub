// Original Superdub articles, written for the Success Kit.
export type Block =
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  | { t: 'li'; text: string }
  | { t: 'quote'; text: string };

export interface Article {
  id: string;
  title: string;
  author: string;
  readMins: number;
  tag: string;
  accent: string;   // cover accent
  dek: string;      // one-line standfirst
  body: Block[];
}

export const ARTICLES: Article[] = [
  {
    id: 'build-habits',
    title: 'How to Build Habits That Actually Stick',
    author: 'Ali Shah',
    readMins: 4,
    tag: 'Habits',
    accent: '#2FD27E',
    dek: 'Motivation gets you started. Systems are what keep you going.',
    body: [
      { t: 'p', text: 'Most people quit a new habit not because they are lazy, but because they bet everything on motivation. Motivation is a feeling, and feelings are weather — they change daily. The people who change their lives don\'t feel more motivated than you. They\'ve just built systems that don\'t need motivation to run.' },
      { t: 'h', text: 'Make it small enough to be stupid' },
      { t: 'p', text: 'The single biggest mistake is starting too big. "Read 30 minutes a day" fails; "read one page" survives. When a habit is small enough that you can do it on your worst day, it stops being negotiable. You can always do more — but you commit to the floor, not the ceiling. The win is showing up, not the size of the showing up.' },
      { t: 'h', text: 'Anchor it to something you already do' },
      { t: 'p', text: 'New habits stick best when they ride on the back of old ones. This is called habit stacking: "After I pour my morning coffee, I take my vitamins." The existing habit is the cue. You don\'t need to remember — the routine reminds you.' },
      { t: 'h', text: 'Never miss twice' },
      { t: 'p', text: 'You will miss days. Life happens. The rule that separates people who keep their habits from people who lose them is simple: never miss twice. One missed day is an accident. Two is the start of a new (worse) habit. Missing once is fine — just don\'t let the exception become the rule.' },
      { t: 'quote', text: 'You do not rise to the level of your goals. You fall to the level of your systems.' },
      { t: 'h', text: 'Make the streak visible' },
      { t: 'p', text: 'A chain of green days is one of the most motivating things in the world — not because of the reward, but because you don\'t want to break it. That\'s the entire idea behind tracking. When progress is visible, your brain treats protecting it as the goal. That\'s exactly what Superdub is built to do: turn invisible consistency into something you can see and defend.' },
      { t: 'p', text: 'Start today. Pick one habit. Make it tiny. Anchor it. And whatever happens this week — never miss twice.' },
    ],
  },
  {
    id: 'habit-tracking',
    title: 'Why Habit Tracking Works (And How to Do It Right)',
    author: 'Ali Shah',
    readMins: 3,
    tag: 'Tracking',
    accent: '#2E8BFF',
    dek: 'What gets measured gets managed — and what gets ticked gets repeated.',
    body: [
      { t: 'p', text: 'Tracking a habit feels almost too simple to matter. You did the thing; you mark it done. But that small act does three powerful things at once, and understanding them is the difference between tracking that changes your life and tracking you abandon by Thursday.' },
      { t: 'h', text: '1. It\'s a cue' },
      { t: 'p', text: 'Opening the app and seeing an unticked habit is itself a reminder to act. The tracker doesn\'t just record behaviour — it prompts it.' },
      { t: 'h', text: '2. It\'s a reward' },
      { t: 'p', text: 'Marking something done releases a genuine hit of satisfaction. The checkmark, the streak ticking up, the bar filling — these are small, immediate rewards for a behaviour whose real payoff (fitness, knowledge, health) is months away. Tracking bridges that gap.' },
      { t: 'h', text: '3. It\'s honest feedback' },
      { t: 'p', text: 'You can\'t lie to a calendar. "I\'ve been pretty consistent" turns out to mean three days out of fourteen. The data is humbling, and that honesty is the point — you can only fix what you can see.' },
      { t: 'h', text: 'How to track without burning out' },
      { t: 'li', text: 'Track few things. Three habits done daily beats ten tracked once.' },
      { t: 'li', text: 'Track the input, not the outcome. "Walked today", not "lost weight". You control inputs.' },
      { t: 'li', text: 'Be honest even when it hurts. A real miss logged is worth more than a fake done.' },
      { t: 'li', text: 'Review weekly. Patterns only show up over time — which day do you always slip?' },
      { t: 'p', text: 'Done right, tracking turns your intentions into a feedback loop. You see the truth, you protect your streak, and slowly the habit stops being something you do and becomes something you are.' },
    ],
  },
  {
    id: 'goal-setting',
    title: 'Goal Setting That Actually Gets You There',
    author: 'Ali Shah',
    readMins: 4,
    tag: 'Goals',
    accent: '#A855F7',
    dek: 'A goal without a system is just a wish with a deadline.',
    body: [
      { t: 'p', text: 'Everyone sets goals in January. Almost no one keeps them by March. The problem is rarely the goal itself — it\'s that we set the destination and ignore the vehicle. Here\'s how to set goals that survive contact with real life.' },
      { t: 'h', text: 'Set the goal, then forget it' },
      { t: 'p', text: 'This sounds backwards, but it\'s the key. Use the goal to set the direction — "lose 8kg", "read 12 books" — then put your attention entirely on the daily system that gets you there. You don\'t lose 8kg by thinking about 8kg. You lose it by hitting your steps and your calories today. Fall in love with the process; let the outcome take care of itself.' },
      { t: 'h', text: 'Make it specific and measurable' },
      { t: 'p', text: '"Get fit" is not a goal — it\'s a vibe. "Walk 8,000 steps a day, five days a week" is a goal, because you can know, unarguably, whether you did it. Vague goals give your brain room to negotiate. Specific ones don\'t.' },
      { t: 'h', text: 'Work backwards from the deadline' },
      { t: 'p', text: 'Take the outcome and divide it by the time. Want to lose 8kg in four months? That\'s about 0.5kg a week — a calm, sustainable pace. Now you\'re not chasing a scary number; you\'re chasing this week\'s half-kilo. Big goals become a series of small, boring, achievable ones.' },
      { t: 'quote', text: 'Goals are good for setting a direction, but systems are best for making progress.' },
      { t: 'h', text: 'Build in the comeback' },
      { t: 'p', text: 'You will fall behind at some point. Plan for it now, while you\'re calm. Decide in advance: "If I miss a week, I don\'t scrap the goal — I just start again from where I am." The people who reach their goals aren\'t the ones who never fall off. They\'re the ones who get back on fastest.' },
      { t: 'p', text: 'Set the destination. Then pour your energy into the next single step. That\'s the whole game.' },
    ],
  },
  {
    id: 'daily-weigh-in',
    title: 'Why You Should Weigh Yourself Every Day',
    author: 'Ali Shah',
    readMins: 4,
    tag: 'Weight loss',
    accent: '#FFB928',
    dek: 'The scale isn\'t a judge. It\'s a sensor — and daily data beats weekly guesswork.',
    body: [
      { t: 'p', text: 'A lot of advice tells you to weigh yourself once a week, or to throw the scale away entirely. I think that\'s a mistake — and the research agrees. People who weigh themselves daily lose more weight and keep it off better. But only if you understand what the number actually means.' },
      { t: 'h', text: 'Your weight is noisy — that\'s normal' },
      { t: 'p', text: 'Your body weight can swing 1–2kg in a single day from water, salt, carbs, hormones, and what\'s simply still in your digestive system. None of that is fat. If you only weigh weekly, you might catch a random high day and feel like a failure when you\'re actually doing fine. Daily data lets you see through the noise.' },
      { t: 'h', text: 'Watch the trend, not the day' },
      { t: 'p', text: 'No single weigh-in tells you anything. The trend over two weeks tells you everything. This is why Superdub draws a smoothed trend line through your daily dots — one day up, one day down, but the line quietly heading where you want to go. Judge yourself by the line, never the dot.' },
      { t: 'h', text: 'Weigh under the same conditions' },
      { t: 'li', text: 'First thing in the morning.' },
      { t: 'li', text: 'After using the bathroom.' },
      { t: 'li', text: 'Before eating or drinking.' },
      { t: 'li', text: 'Same scale, minimal clothing.' },
      { t: 'p', text: 'Consistency in how you measure removes most of the noise before it ever reaches the chart.' },
      { t: 'h', text: 'It keeps you honest and aware' },
      { t: 'p', text: 'The daily step on the scale is a tiny moment of accountability. It keeps your goal in front of you without obsession. A weekend of overeating shows up gently on Monday, you adjust, and you move on — long before it becomes a month of drift.' },
      { t: 'quote', text: 'You\'re not weighing yourself to feel bad. You\'re collecting data so you can make good decisions.' },
      { t: 'p', text: 'Step on the scale every morning. Log the number. Ignore the daily wobble. Trust the line. That calm, boring habit — repeated — is how the weight actually comes off.' },
    ],
  },
];
