/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string
  export default content
}

declare module 'mermaid/dist/mermaid.esm.min.mjs' {
  import mermaid from 'mermaid'
  export default mermaid
}

interface ImportMetaEnv {
  readonly VITE_CLIENT_KEY: string
  readonly VITE_CLIENT_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
