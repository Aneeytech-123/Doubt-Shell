/**
 * The subject rooms created by `npm run db:init`.
 * To add a new subject, add an object to this list and run `npm run db:init` again.
 * Existing subjects and all their doubts are kept (INSERT OR IGNORE).
 */
module.exports = [
  {
    code: 'DAA',
    name: 'Design and Analysis of Algorithms',
    description: 'Complexity, divide and conquer, greedy methods, dynamic programming, graphs and NP-completeness.',
  },
  {
    code: 'CN',
    name: 'Computer Networks',
    description: 'OSI and TCP/IP models, routing, switching, IP addressing, transport protocols and network security.',
  },
  {
    code: 'WT',
    name: 'Web Technology',
    description: 'HTML, CSS, JavaScript, HTTP, Node.js, Express, databases and building full-stack web applications.',
  },
];
