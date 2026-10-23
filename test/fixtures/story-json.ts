// examples copied from our story JSON contract docs, so tests can check
// the format we agreed on actually works

const words = (text: string) => text.split(' ');
const emotions = (...names: string[]) =>
  names.map((emotion) => ({ emotion, portrait_x: null, portrait_y: null }));

export const lionCharacters = [
  {
    name: 'Dave',
    description: null,
    emotions: emotions('default', 'thinking', 'angry', 'happy'),
  },
  {
    name: 'Cindy',
    description: null,
    emotions: emotions('default', 'thinking', 'worried'),
  },
];

const dialogue = (name: string, portrait: string, text: string) => ({
  dialogue: { name, portrait, text: { words: words(text) }, text_color: null },
});
const prose = (text: string) => ({
  prose: { text: { words: words(text) }, text_color: null },
});

// the full example from section 4 of story-json.md
export const lionScript = {
  flags: {
    'Face the lion': { line_id: 8 },
    Hide: { line_id: 12 },
    Morning: { line_id: 15 },
  },
  variables: [],
  lines: [
    { background: 'cabin-interior.jpg' },
    prose('The fire had burned down to embers.'),
    dialogue('Dave', 'default', "I'm in a cabin in the woods."),
    prose('He pulled his coat tighter.'),
    dialogue('Dave', 'default', "And I'm fairly sure I'm in danger."),
    dialogue('Cindy', 'worried', 'Did you hear that?'),
    prose('Something heavy scraped against the door.'),
    {
      choice: [
        { goto_line: 8, option_body: 'Open the door', condition: null },
        { goto_line: 12, option_body: 'Hide under the table', condition: null },
      ],
    },
    { background: 'cabin-door.jpg' },
    dialogue('Dave', 'angry', 'Whatever you are, leave us alone!'),
    prose('The lion blinked, then went back into the trees.'),
    { goto_line: 15 },
    dialogue('Cindy', 'default', "Don't. Make. A. Sound."),
    prose('They waited until the scraping stopped.'),
    { goto_line: 15 },
    { background: 'forest-morning.jpg' },
    dialogue('Dave', 'happy', 'We made it.'),
    { end: true },
  ].map((line, line_id) => ({ line_id, ...line })),
};

// the sprint 1 example, left exactly how it was written in the doc
// (no portrait or text_color on the dialogue)
export const belugaScript = {
  flags: {
    end_of_presentation: { line_id: 5 },
    continue_presentation: { line_id: 7 },
    fight_lara: { line_id: 10 },
    the_correct_option: { line_id: 14 },
  },
  variables: [],
  lines: [
    {
      dialogue: {
        name: 'Arthur',
        text: {
          words: words('Good morning Lauren, welcome to Interactive fiction!'),
        },
      },
    },
    {
      dialogue: {
        name: 'Paul',
        text: {
          words: words(
            'We worked very hard on this, Adejare and I got zero sleep!',
          ),
        },
      },
    },
    {
      prose: {
        text: { words: words('Adejare looks at you with sleepless eyes.') },
      },
    },
    { dialogue: { name: 'Krupal', text: { words: words('Wake up dude..') } } },
    {
      choice: [
        { goto_line: 5, option_body: 'Ignore the group', condition: null },
        { goto_line: 7, option_body: 'Say goodmorning', condition: null },
        {
          goto_line: 14,
          option_body: 'Immediately give the group an A',
          condition: null,
        },
      ],
    },
    {
      prose: {
        text: {
          words: words(
            'The group looks worried that you are unresponsive and calls medical.',
          ),
        },
      },
    },
    { end: true },
    {
      dialogue: {
        name: 'Lara',
        text: {
          words: words(
            "Thank goodness this isn't a carpooling app am I right?",
          ),
        },
      },
    },
    {
      dialogue: {
        name: 'Carsten',
        text: {
          words: words(
            "We literally had that same idea Lara… We aren't any better.",
          ),
        },
      },
    },
    {
      choice: [
        {
          goto_line: 10,
          option_body: 'Give team Beluga an F',
          condition: null,
        },
        {
          goto_line: 14,
          option_body: 'Give team Beluga an A',
          condition: null,
        },
      ],
    },
    {
      dialogue: {
        name: 'Lara',
        text: {
          words: words("Hey! You can't do that! I have to fight you now."),
        },
      },
    },
    {
      prose: {
        text: {
          words: words('You get into a physical altercation with Lara..'),
        },
      },
    },
    { prose: { text: { words: words('You win without a scratch.') } } },
    { end: true },
    { prose: { text: { words: words('Everyone celebrates.') } } },
    { prose: { text: { words: words('Colin wakes up. It was all a dream') } } },
    { end: true },
  ].map((line, line_id) => ({ line_id, ...line })),
};

export const belugaCharacters = [
  'Arthur',
  'Paul',
  'Krupal',
  'Lara',
  'Carsten',
].map((name) => ({ name, description: null, emotions: emotions('default') }));
