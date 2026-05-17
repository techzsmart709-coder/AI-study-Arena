/**
 * Lightweight request validation middleware (no external deps).
 * Each validator returns a middleware function that checks req.body
 * against a schema of { field: { type, required, min, max } }.
 */

function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`"${field}" is required.`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`"${field}" must be a string.`);
      }
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`"${field}" must be a number.`);
      }
      if (rules.type === 'string' && typeof value === 'string') {
        if (rules.min && value.length < rules.min) errors.push(`"${field}" must be at least ${rules.min} characters.`);
        if (rules.max && value.length > rules.max) errors.push(`"${field}" must be at most ${rules.max} characters.`);
      }
      if (rules.type === 'number' && typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) errors.push(`"${field}" must be at least ${rules.min}.`);
        if (rules.max !== undefined && value > rules.max) errors.push(`"${field}" must be at most ${rules.max}.`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
  };
}

// ── Pre-built validators for each endpoint ─────────────────

export const validateQuizGenerate = validate({
  topic: { type: 'string', required: true, min: 1, max: 200 },
  numQuestions: { type: 'number', required: false, min: 1, max: 50 },
});

export const validateTopicSuggest = validate({
  query: { type: 'string', required: false, max: 100 },
});

export const validateScoreSave = validate({
  username: { type: 'string', required: true, min: 1, max: 100 },
  topic: { type: 'string', required: true, min: 1, max: 200 },
  score: { type: 'number', required: true, min: 0, max: 100000 },
});
