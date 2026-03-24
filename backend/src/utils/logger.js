const winston = require('winston');
const path = require('path');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf((info) =>
    `${info.timestamp} ${info.level}: ${info.message}`
  )
);

const transports = [
<<<<<<< feature/instructor-suite-139
  new winston.transports.Console(),
=======
  // Console transport
  new winston.transports.Console(),
  // Error log file
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
  }),
  // Combined log file
  new winston.transports.File({
    filename: path.join('logs', 'all.log'),
  }),
  // Security log file
  new winston.transports.File({
    filename: path.join('logs', 'security.log'),
    level: 'warn', // Only log warnings, errors, and custom security events here
  }),
>>>>>>> main
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels,
  format,
  transports,
});

module.exports = logger;
