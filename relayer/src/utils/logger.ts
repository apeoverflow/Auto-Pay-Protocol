import pino from 'pino'

export function createLogger(name: string, level = 'info') {
  return pino({
    name,
    level,
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
}

export const logger = createLogger('relayer')
