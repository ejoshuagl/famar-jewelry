'use client'

import { useEffect, useState } from 'react'

const SNOWFLAKES = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${-((index * 1.7) % 12)}s`,
  duration: `${10 + (index % 7)}s`,
  size: `${5 + (index % 4) * 2}px`,
}))

export function SiteTheme() {
  const [theme, setTheme] = useState<'standard' | 'christmas'>('standard')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/theme', { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setTheme(data.theme === 'christmas' ? 'christmas' : 'standard'))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('Error loading theme:', error)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.siteTheme = theme
    return () => { delete document.documentElement.dataset.siteTheme }
  }, [theme])

  if (theme !== 'christmas') return null

  return (
    <div className="christmas-snow" aria-hidden="true">
      {SNOWFLAKES.map((flake) => (
        <span
          key={flake.id}
          style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration, width: flake.size, height: flake.size }}
        />
      ))}
    </div>
  )
}
