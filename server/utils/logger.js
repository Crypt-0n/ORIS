/**
 * Logger structuré ORIS — basé sur Pino
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('Server started');
 *   logger.error({ err }, 'Something failed');
 *
 * Configuration:
 *   LOG_LEVEL=debug|info|warn|error (défaut: info)
 *   NODE_ENV=production → output JSON brut (pour log aggregators)
 *   NODE_ENV=development → output pretty (lisible en console)
 */
const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL || 'info';

const logger = pino({
    level,
    // En développement, on utilise pino-pretty pour la lisibilité
    ...(isDev && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss',
                ignore: 'pid,hostname',
            },
        },
    }),
    // En production : JSON brut, facilement parsable par ELK/Loki/etc.
    ...(!isDev && {
        formatters: {
            level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    }),
    // Ne jamais logger les champs sensibles
    redact: {
        paths: ['password', 'password_hash', 'pin_hash', 'token', 'access_token', 'JWT_SECRET'],
        censor: '[REDACTED]',
    },
    base: {
        service: 'oris-backend',
        version: process.env.npm_package_version || '0.9.0',
    },
});

module.exports = logger;
