export const ROUNDS = [
  {
    id: 'eviction',
    kicker: 'NOMINATION NIGHT · LIVE VOTING',
    label: 'Eviction vote',
    title: 'WHO WILL YOU SAVE?',
    question: 'Dex and Demi are nominated! Vote to SAVE the housemate you want to stay in Bahay ni Kuya.',
    instruction: 'BBS = Big Brother Save · The contestant with fewer votes will be evicted.',
    options: [
      { id: 'dex', name: 'DEX', alias: 'Ang Madiskarteng Atabs ng Etivac', symbol: 'DX', color: 'blue', image: 'assets/dex.webp' },
      { id: 'demi', name: 'DEMI', alias: 'Ang Witty Kinatawan ng CDO', symbol: 'DM', color: 'pink', image: 'assets/demi.webp' },
    ],
  },
  {
    id: 'final-demi-jara',
    kicker: 'BIG NIGHT · THE FINAL VOTE',
    label: 'Big Night: Demi & Jara',
    title: 'VOTE FOR YOUR BIG WINNER',
    question: 'Dex has been evicted. Only Demi and Jara remain. Who will be this season’s Big Winner?',
    instruction: 'Choose ONE finalist. This is a show vote, not an inheritance ruling.',
    options: [
      { id: 'demi', name: 'DEMI', alias: 'Ang Witty Kinatawan ng CDO', symbol: 'DM', color: 'pink', image: 'assets/demi.webp' },
      { id: 'jara', name: 'JARA', alias: 'Ang Caring Eldest Heir ng Baguio City', symbol: 'JR', color: 'violet', image: 'assets/jara.webp' },
    ],
  },
  {
    id: 'final-dex-jara',
    kicker: 'BIG NIGHT · THE FINAL VOTE',
    label: 'Big Night: Dex & Jara',
    title: 'VOTE FOR YOUR BIG WINNER',
    question: 'Demi has been evicted. Only Dex and Jara remain. Who will be this season’s Big Winner?',
    instruction: 'Choose ONE finalist. This is a show vote, not an inheritance ruling.',
    options: [
      { id: 'dex', name: 'DEX', alias: 'Ang Madiskarteng Atabs ng Etivac', symbol: 'DX', color: 'blue', image: 'assets/dex.webp' },
      { id: 'jara', name: 'JARA', alias: 'Ang Caring Eldest Heir ng Baguio City', symbol: 'JR', color: 'violet', image: 'assets/jara.webp' },
    ],
  },
  {
    id: 'diaz-quiz',
    kicker: 'CASE CHALLENGE · DIAZ v. IAC',
    label: 'Bonus case poll',
    title: 'BBS OR BBE: THE 1990 RULING',
    question: 'Under Diaz v. IAC (1990), was the claim of the nonmarital grandchildren through their deceased legitimate father allowed?',
    instruction: 'Answer according to the historical 1990 decision, NOT the later Aquino v. Aquino doctrine.',
    options: [
      { id: 'bbs', name: 'BBS · YES', alias: 'Their claim was allowed', symbol: '✓', color: 'blue' },
      { id: 'bbe', name: 'BBE · NO', alias: 'Their claim was excluded', symbol: '✕', color: 'pink' },
    ],
    correct: 'bbe',
    explanation: 'Diaz (1990) excluded the grandchildren under its reading of Article 992. Aquino v. Aquino (2021) later abandoned that interpretation for representation under Article 982.',
  },
];
export const ROUND_MAP = Object.fromEntries(ROUNDS.map(round => [round.id, round]));
export const DEFAULT_STATE = {activeRound: 'eviction', status: 'waiting', showResults: false, resultSummary: null};
export function makeSummary(roundId, votes = {}) {
  const round = ROUND_MAP[roundId];
  const counts = Object.fromEntries(round.options.map(option => [option.id, 0]));
  Object.values(votes || {}).forEach(choice => {if (Object.hasOwn(counts, choice)) counts[choice]++;});
  return {roundId, counts, total: Object.values(counts).reduce((a,b)=>a+b,0)};
}
