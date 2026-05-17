// ── Extracted Constants ──────────────────────────────────────
// Single source of truth for all names, personas, and display data.

export const BOT_NAMES = [
  'Aria_Zen', 'Liam_Study', 'Max_Archivist', 'Kyra_JS', 'Ben_Bio',
  'Maya_Code', 'James_H', 'Luna_Dev', 'Alex_Smith', 'Jordan_K',
  'Sasha_R', 'Sam_D', 'Casey_M', 'Zoe_Q', 'Noah_V'
];

export const BOT_PERSONAS = [
  'The Analytical Monk',
  'The Fast Responder',
  'The Socratic Doubter',
  'The Calm Strategist',
  'The Bold Challenger'
];

export const INDIAN_NAMES = [
  'Aarav Sharma', 'Arjun Patel', 'Rohan Gupta', 'Ishan Iyer', 'Vihaan Reddy',
  'Aryan Singh', 'Advait Joshi', 'Pranav Nair', 'Ishita Verma', 'Ananya Das',
  'Diya Malhotra', 'Myra Kapoor', 'Saanvi Rao', 'Kavya Pillai', 'Aditi Bose',
  'Riya Sen', 'Sneha Kulkarni', 'Rahul Mehra', 'Siddharth Jain', 'Priyanka Ghose',
  'Ishaan Khatri', 'Vivaan Goel', 'Kabir Bansal', 'Aditya Thakur', 'Arnav Saxena',
  'Reyansh Ahuja', 'Mohammed Zaid', 'Sai Teja', 'Atharva Mane', 'Shaurya Chauhan',
  'Tanishq Aggarwal', 'Yash Vardhan', 'Vedant Deshmukh', 'Kushal Taneja', 'Harsh Mishra',
  'Manan Chawla', 'Devansh Tyagi', 'Veer Pratap', 'Kiaan Sarin', 'Zoya Khan',
  'Kyra Dsouza', 'Shanaya Gill', 'Inaya Sheikh', 'Aadhya Hegde', 'Tara Dsouza',
  'Sara Ali', 'Amaira Vohra', 'Meher Bhasin', 'Avni Chaturvedi', 'Navya Khurana'
];

export const FAKE_TOPICS = [
  'Quantum Physics', 'Ancient History', 'Machine Learning', 'Organic Chemistry',
  'Calculus', 'World Geography', 'Neuroscience', 'Macroeconomics',
  'Software Engineering', 'Philosophy of Ethics', 'Marine Biology',
  'Astrophysics', 'Medieval Literature', 'Social Psychology', 'Criminology'
];

// Helper
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
