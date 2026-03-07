import pino from 'pino'

function getLogLevel(): string {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL
  if (process.env.DEBUG === 'true') return 'debug'
  return 'info'
}

const rootLogger = pino({
  level: getLogLevel(),
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
})

export function createLogger(name: string) {
  return rootLogger.child({ name })
}

export const logger = rootLogger
