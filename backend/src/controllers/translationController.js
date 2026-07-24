/**
 * Translation Controller – stub (PR #349 followup)
 *
 * `src/routes/translation.js` imports six handler functions from this
 * module, but the full implementation has not yet been built.  Without
 * this stub, requiring `src/index.ts` in tests fails with:
 *
 *   Route.get() requires a callback function but got a [object Undefined]
 *
 * because `translationController.getLanguages` (and others) are undefined.
 *
 * The stub returns `501 Not Implemented` for every endpoint so the route
 * mounts cleanly and OpenAPI introspection can proceed without crashing.
 * Real implementations are tracked separately.
 */

const translate = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Translation – translate not yet implemented',
  });
};

const getLanguages = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Translation – getLanguages not yet implemented',
  });
};

const detectLanguage = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Translation – detectLanguage not yet implemented',
  });
};

const batchTranslate = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Translation – batchTranslate not yet implemented',
  });
};

const getContentTranslation = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Translation – getContentTranslation not yet implemented',
  });
};

const getUsageStats = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Translation – getUsageStats not yet implemented',
  });
};

module.exports = {
  translate,
  getLanguages,
  detectLanguage,
  batchTranslate,
  getContentTranslation,
  getUsageStats,
};
