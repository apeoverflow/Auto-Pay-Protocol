/** SSR utilities — guards for browser-only APIs */

export const isServer = typeof window === 'undefined'
export const isBrowser = !isServer
