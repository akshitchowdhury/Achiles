import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
// Per-plan display faces. Imported eagerly but they cost almost nothing up
// front: an @font-face rule is a declaration, not a fetch — a browser only
// downloads a family once rendered text actually resolves to it, so a Spartan
// athlete pays for Cinzel and for nothing else. Explicit `latin-<weight>`
// entrypoints rather than the packages' index.css, which would pull every
// weight, every subset, and (for the two Japanese faces) megabytes of kana.
import '@fontsource-variable/cinzel' // spartan display · greek-god small caps
import '@fontsource-variable/cormorant-garamond' // greek-god display
import '@fontsource/chakra-petch/latin-500.css' // superhero labels
import '@fontsource/chakra-petch/latin-700.css' // superhero display
import '@fontsource/barlow-condensed/latin-600.css' // athlete labels
import '@fontsource/barlow-condensed/latin-700.css' // athlete display
import '@fontsource/barlow-condensed/latin-700-italic.css' // athlete headlines
import '@fontsource/bebas-neue/latin-400.css' // manga display
import '@fontsource-variable/orbitron' // manga labels
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
