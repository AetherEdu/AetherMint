/**
 * Stub Controller Helper
 *
 * Creates a Proxy-based stub controller that automatically handles
 * any method call, returning a 200 JSON response. This prevents
 * Express from throwing "Route.get() requires a callback function"
 * when a route references a controller method that hasn't been
 * implemented yet.
 */

const createStubController = (name) =>
  new Proxy(
    {},
    {
      get(target, prop) {
        if (typeof prop === 'string' && prop !== 'constructor') {
          return async (req, res) => {
            res.status(200).json({
              success: true,
              message: `[Stub] ${name}.${prop} - not yet implemented`,
            });
          };
        }
        return target[prop];
      },
    },
  );

module.exports = { createStubController };
