/**
 * Gamification Controller – stub (PR #349 followup)
 *
 * `src/routes/gamification.js` imports this module, but the full
 * implementation has not yet been built.  Without this stub, requiring
 * `src/index.ts` in tests fails with:
 *
 *   Cannot find module '../controllers/gamificationController'
 *   from 'src/routes/gamification.js'
 *
 * The stub returns `501 Not Implemented` for every endpoint so the route
 * mounts cleanly and OpenAPI introspection can proceed without crashing.
 */

const getPoints = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Gamification – getPoints not yet implemented',
  });
};

const getBadges = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Gamification – getBadges not yet implemented',
  });
};

const getLeaderboard = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Gamification – getLeaderboard not yet implemented',
  });
};

const getAchievements = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Gamification – getAchievements not yet implemented',
  });
};

const createAchievement = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Gamification – createAchievement not yet implemented',
  });
};

const updateAchievement = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Gamification – updateAchievement not yet implemented',
  });
};

const deleteAchievement = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Gamification – deleteAchievement not yet implemented',
  });
};

const redeemBadge = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Gamification – redeemBadge not yet implemented',
  });
};

module.exports = {
  getPoints,
  getBadges,
  getLeaderboard,
  getAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  redeemBadge,
};
