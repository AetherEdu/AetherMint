/**
 * Autonomous Agents Controller – stub (PR #349 followup)
 *
 * `src/routes/autonomousAgents.js` imports this module, but the full
 * implementation has not yet been built.  Without this stub, requiring
 * `src/index.ts` in tests fails with:
 *
 *   Cannot find module '../controllers/autonomousAgentsController'
 *   from 'src/routes/autonomousAgents.js'
 *
 * The stub returns `501 Not Implemented` for every endpoint so the route
 * mounts cleanly and OpenAPI introspection can proceed without crashing.
 */

const execute = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Autonomous agents – execute not yet implemented',
  });
};

const getStatus = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Autonomous agents – getStatus not yet implemented',
  });
};

const getAgents = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Autonomous agents – getAgents not yet implemented',
  });
};

const registerAgent = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Autonomous agents – registerAgent not yet implemented',
  });
};

const getAgentById = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Autonomous agents – getAgentById not yet implemented',
  });
};

const updateAgent = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Autonomous agents – updateAgent not yet implemented',
  });
};

const deleteAgent = (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Autonomous agents – deleteAgent not yet implemented',
  });
};

module.exports = {
  execute,
  getStatus,
  getAgents,
  registerAgent,
  getAgentById,
  updateAgent,
  deleteAgent,
};
