// ── Topic Taxonomy Tree ─────────────────────────────────────
// Used by MatchmakingService for cross-topic matching.
// Players studying related topics (same category) can be matched
// when no exact-topic match is found within the ELO range.

const TAXONOMY = {
  'Science': ['Physics', 'Chemistry', 'Biology', 'Astronomy', 'Earth Science', 'Environmental Science', 'Geology'],
  'Physics': ['Quantum Mechanics', 'Classical Mechanics', 'Thermodynamics', 'Optics', 'Electromagnetism', 'Nuclear Physics', 'Astrophysics', 'Quantum Physics', 'Relativity', 'Particle Physics'],
  'Chemistry': ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Biochemistry', 'Analytical Chemistry', 'Polymer Chemistry'],
  'Biology': ['Molecular Biology', 'Genetics', 'Ecology', 'Microbiology', 'Zoology', 'Botany', 'Marine Biology', 'Neuroscience', 'Cell Biology', 'Evolutionary Biology'],
  'Mathematics': ['Calculus', 'Linear Algebra', 'Statistics', 'Probability', 'Number Theory', 'Geometry', 'Discrete Mathematics', 'Trigonometry', 'Topology', 'Abstract Algebra', 'Differential Equations'],
  'Computer Science': ['Programming', 'Data Structures', 'Algorithms', 'Machine Learning', 'Artificial Intelligence', 'Web Development', 'Cybersecurity', 'Software Engineering', 'Database Systems', 'Operating Systems', 'Computer Networks', 'Compiler Design', 'Cloud Computing'],
  'Engineering': ['Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Electronics', 'Robotics', 'Signal Processing'],
  'Social Sciences': ['Psychology', 'Sociology', 'Economics', 'Political Science', 'Anthropology', 'Social Psychology', 'Criminology', 'Human Geography'],
  'Humanities': ['History', 'Philosophy', 'Literature', 'Linguistics', 'Art History', 'Ethics', 'Ancient History', 'Medieval Literature', 'Philosophy of Ethics', 'World History'],
  'Medicine': ['Anatomy', 'Physiology', 'Pharmacology', 'Pathology', 'Immunology', 'Epidemiology', 'Public Health'],
  'Business': ['Marketing', 'Finance', 'Accounting', 'Management', 'Entrepreneurship', 'Macroeconomics', 'Microeconomics', 'International Business'],
  'Arts': ['Music Theory', 'Film Studies', 'Photography', 'Architecture', 'Graphic Design'],
  'Law': ['Constitutional Law', 'Criminal Law', 'International Law', 'Corporate Law', 'Contract Law'],
};

// Build reverse lookup: topic → parent category
const topicToCategory = new Map();
for (const [category, topics] of Object.entries(TAXONOMY)) {
  topicToCategory.set(category.toLowerCase(), category.toLowerCase()); // Self-map
  for (const topic of topics) {
    topicToCategory.set(topic.toLowerCase(), category.toLowerCase());
  }
}

/**
 * Get the parent category for a topic.
 * Falls back to fuzzy-match on partial includes.
 */
export function getCategory(topic) {
  const lower = topic.toLowerCase();
  if (topicToCategory.has(lower)) return topicToCategory.get(lower);

  // Fuzzy: check if any known topic is contained in the query
  for (const [known, cat] of topicToCategory.entries()) {
    if (lower.includes(known) || known.includes(lower)) return cat;
  }

  return null; // Truly unknown topic
}

/**
 * Check if two topics are in the same category (related match).
 */
export function areRelated(topicA, topicB) {
  const catA = getCategory(topicA);
  const catB = getCategory(topicB);
  return catA && catB && catA === catB;
}

/**
 * Get all known topics (flat list).
 */
export function getAllTopics() {
  const all = new Set();
  for (const [cat, topics] of Object.entries(TAXONOMY)) {
    all.add(cat);
    topics.forEach(t => all.add(t));
  }
  return [...all];
}

export { TAXONOMY };
