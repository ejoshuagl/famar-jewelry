'use client'

import { useEffect, useState } from 'react'

const SNOWFLAKES = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${-((index * 1.7) % 12)}s`,
  duration: `${10 + (index % 7)}s`,
  size: `${5 + (index % 4) * 2}px`,
}))

const LIGHTS = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${2 + index * 5.6}%`,
  delay: `${(index % 6) * 0.22}s`,
  color: ['gold', 'red', 'green', 'warm'][index % 4],
}))

const STARS = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  left: `${4 + ((index * 29) % 91)}%`,
  top: `${14 + ((index * 17) % 74)}%`,
  delay: `${(index % 5) * 0.6}s`,
}))

export function SiteTheme() {
  const [theme, setTheme] = useState<'standard' | 'christmas' | 'halloween' | 'black-friday' | 'valentine'>('standard')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/theme', { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setTheme(['christmas', 'halloween', 'black-friday', 'valentine'].includes(data.theme) ? data.theme : 'standard'))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('Error loading theme:', error)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.siteTheme = theme
    return () => { delete document.documentElement.dataset.siteTheme }
  }, [theme])

  if (theme === 'standard') return null

  if (theme !== 'christmas') {
    const decorations = {
      halloween: ['☾', '✦', '◆', '✧', '☾', '✦', '◆', '✧'],
      'black-friday': ['%', '✦', '%', '◆', '%', '✦', '%', '◆'],
      valentine: ['♥', '✦', '♡', '♥', '✧', '♡', '♥', '✦'],
    }[theme]

    return (
      <div className={`seasonal-decorations seasonal-${theme}`} aria-hidden="true">
        <div className="seasonal-top-accent" />
        {decorations.map((symbol, index) => (
          <i
            key={`${symbol}-${index}`}
            style={{ left: `${4 + ((index * 29) % 91)}%`, animationDelay: `${index * -0.7}s`, animationDuration: `${7 + (index % 4)}s` }}
          >{symbol}</i>
        ))}
      </div>
    )
  }

  return (
    <div className="christmas-decorations" aria-hidden="true">
      <div className="christmas-light-wire">
        {LIGHTS.map((light) => (
          <i key={light.id} className={`christmas-light christmas-light-${light.color}`} style={{ left: light.left, animationDelay: light.delay }} />
        ))}
      </div>
      <div className="christmas-stars">
        {STARS.map((star) => (
          <i key={star.id} style={{ left: star.left, top: star.top, animationDelay: star.delay }}>✦</i>
        ))}
      </div>
      <div className="christmas-ornament christmas-ornament-left"><i /><b /></div>
      <div className="christmas-ornament christmas-ornament-right"><i /><b /></div>
      <div className="christmas-snow">
        {SNOWFLAKES.map((flake) => (
          <span
            key={flake.id}
            style={{ left: flake.left, animationDelay: flake.delay, animationDuration: flake.duration, width: flake.size, height: flake.size }}
          />
        ))}
      </div>
    </div>
  )
}
